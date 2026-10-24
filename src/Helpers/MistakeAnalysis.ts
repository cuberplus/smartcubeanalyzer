import { calculateMovingAverage, calculateMovingStdDev } from './MathHelpers';
import { analyzeMoveMistakes, coreMovesCount, MoveMistake, typicalCaseMoves } from './MoveAnalysis';
import { getAufMovesForSolve, tokenizeMoves } from './CsvParser';
import { Solve, StepName } from './Types';

const CASE_MOVES_RULE = 'More than 2 extra core moves versus your typical count for this case and method (5+ examples required). AUF excluded.';
export const MISTAKES = {
    crossMoves: { label: 'Cross: Inefficient solution', rule: 'More than 8 slice turns for the cross. An intentional X-cross can also trigger this.' },
    f2lMoves: { label: 'F2L pair: Inefficient solution', rule: 'More than 12 slice turns for any individual F2L pair.' },
    ollMoves: { label: 'OLL: Inefficient solution', rule: CASE_MOVES_RULE },
    pllMoves: { label: 'PLL: Inefficient solution', rule: CASE_MOVES_RULE },
    f2lPause: { label: 'F2L: Long recognition gap', rule: 'More than 2 seconds before starting any F2L pair.' },
    ollRecognition: { label: 'OLL: Long recognition', rule: 'More than 2 seconds before starting OLL.' },
    pllRecognition: { label: 'PLL: Long recognition', rule: 'More than 2 seconds before starting PLL.' },
    singleUndo: { label: 'Single-move undo', rule: "A move immediately cancelled by its inverse (R R') in the named step or AUF." },
    sequenceUndo: { label: 'Multi-move undo', rule: "Two or more moves immediately undone in reverse (R U U' R') in this step or AUF. The inner single undo isn't counted again." },
    redundantTurns: { label: 'Redundant same-face turns', rule: 'Mergeable same-face turns (U U2, U U) or explicit 3+ quarter turns (U3, U4). A lone U2 is fine; sensor-split turns can trigger this.' },
    slowAuf: { label: 'AUF: Slow adjustment', rule: 'More than 0.5 seconds in the post-AUF of a last-layer step. Pre-AUF is excluded.' },
    slowStep: { label: 'Unusually slow step', rule: 'At least one step exceeds its rolling average plus 3 standard deviations, using the selected window.' },
    slowSolve: { label: 'Unusually slow solve', rule: 'Solve time exceeds its rolling average plus 3 standard deviations, using the selected window.' },
} as const;
export type MistakeKind = keyof typeof MISTAKES;
export interface Mistake { kind: MistakeKind; step?: StepName; auf?: boolean; }
export interface MistakeSummary { sampleCount: number; windowSize: number; counts: (Mistake & { count: number })[]; }
export const mistakeKey = ({ kind, step, auf }: Mistake) => `${kind}:${step ?? ''}:${auf ? 'auf' : ''}`;
export const mistakeLabel = ({ kind, step, auf }: Mistake) => `${step ? `${step}${auf ? ' AUF' : ''}: ` : ''}${MISTAKES[kind].label}`;
const PAIRS = new Set([StepName.F2L_1, StepName.F2L_2, StepName.F2L_3, StepName.F2L_4]);
const LAST_LAYER = new Set([StepName.OLL, StepName.PLL, StepName.EOLL, StepName.COLL, StepName.EPLL, StepName.CPLL, StepName.CMLL, StepName.ZBLL]);
type MoveFacts = { core: number; issues: MoveMistake[] };
const moveFactsCache = new Map<string, Map<string, MoveFacts>>();
function moveFacts(moves: string, auf: Set<string>): MoveFacts {
    const face = String(auf.values().next().value);
    let cache = moveFactsCache.get(face);
    if (!cache) moveFactsCache.set(face, cache = new Map());
    let facts = cache.get(moves);
    if (!facts) {
        const tokens = tokenizeMoves(moves);
        cache.set(moves, facts = { core: coreMovesCount(tokens, auf), issues: analyzeMoveMistakes(tokens, auf) });
    }
    return facts;
}

export function getMistakeMap(values: number[], windowSize: number): boolean[] {
    const average = calculateMovingAverage(values, windowSize), stdDev = calculateMovingStdDev(values, windowSize);
    return values.map((value, i) => value > average[Math.max(0, i - windowSize)] + 3 * stdDev[Math.max(0, i - windowSize)]);
}

export function markMistakes(solves: Solve[], windowSize: number): Solve[] {
    const valid = solves.filter(s => !s.isCorrupt);
    const examples = new Map<string, number[]>();
    for (const solve of valid) for (const { name, case: caseName, moves } of solve.steps) {
        if ((name !== StepName.OLL && name !== StepName.PLL) || !caseName || caseName === 'Solved' || !moves) continue;
        const key = `${solve.method}:${name}:${caseName}`;
        if (!examples.has(key)) examples.set(key, []);
        examples.get(key)!.push(moveFacts(moves, getAufMovesForSolve(solve)).core);
    }
    const thresholds = new Map<string, number>();
    examples.forEach((values, key) => { if (values.length >= 5) thresholds.set(key, typicalCaseMoves(values.sort((a, b) => a - b)) + 2); });
    const slowSolves = getMistakeMap(valid.map(s => s.time), windowSize);
    const slowSteps = Array.from(new Set(valid.flatMap(s => s.steps.map(step => step.name)))).map(name =>
        getMistakeMap(valid.map(s => s.steps.find(step => step.name === name)?.time ?? 0), windowSize));
    valid.forEach((solve, i) => {
        const reasons = new Map<string, Mistake>();
        const add = (kind: MistakeKind, step?: StepName, auf?: boolean) => { const mistake = { kind, step, auf }; reasons.set(mistakeKey(mistake), mistake); };
        if (slowSolves[i]) add('slowSolve');
        if (slowSteps.some(map => map[i])) add('slowStep');
        const auf = getAufMovesForSolve(solve);
        for (const { name, turns, moves, case: caseName, recognitionTime, time, postAufTime, executionTime } of solve.steps) {
            const pair = PAIRS.has(name), ll = LAST_LAYER.has(name);
            if (name === StepName.Cross && Number.isFinite(turns) && turns > 8) add('crossMoves');
            if (pair && Number.isFinite(turns) && turns > 12) add('f2lMoves');
            if (Number.isFinite(recognitionTime) && recognitionTime > 2 && recognitionTime <= time) {
                if (pair) add('f2lPause');
                if (name === StepName.OLL) add('ollRecognition');
                if (name === StepName.PLL) add('pllRecognition');
            }
            const threshold = thresholds.get(`${solve.method}:${name}:${caseName}`);
            const facts = moveFacts(moves, auf);
            if (threshold !== undefined && moves && facts.core > threshold) add(name === StepName.OLL ? 'ollMoves' : 'pllMoves');
            if (ll && Number.isFinite(postAufTime) && postAufTime > 0.5 && postAufTime <= executionTime) add('slowAuf');
            for (const issue of facts.issues) add(issue.kind, name, ll && issue.auf);
        }
        solve.mistakes = Array.from(reasons.values());
        solve.isMistake = reasons.size > 0;
    });
    return solves;
}

export function summarizeMistakes(solves: Solve[], windowSize: number): MistakeSummary {
    const size = Number.isFinite(windowSize) ? Math.max(0, Math.floor(windowSize)) : 0;
    const recent = size ? solves.filter(s => !s.isCorrupt).sort((a, b) => a.date.getTime() - b.date.getTime()).slice(-size) : [];
    const counts = new Map<string, Mistake & { count: number }>();
    (Object.keys(MISTAKES) as MistakeKind[]).filter(kind => !['singleUndo', 'sequenceUndo', 'redundantTurns'].includes(kind))
        .forEach(kind => counts.set(mistakeKey({ kind }), { kind, count: 0 }));
    for (const solve of recent) {
        const unique = new Map((solve.mistakes ?? []).map(mistake => [mistakeKey(mistake), mistake]));
        unique.forEach((mistake, key) => counts.set(key, { ...mistake, count: (counts.get(key)?.count ?? 0) + 1 }));
    }
    return { sampleCount: recent.length, windowSize: size, counts: Array.from(counts.values()).sort((a, b) => b.count - a.count) };
}
