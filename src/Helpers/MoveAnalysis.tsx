import { AUF_MOVES, ROTATIONS, getAufMovesForSolve, tokenizeMoves } from "./CsvParser";
import { AufInefficiency, CaseStats, getStep, MoveAnalysisResult, RedundantPair, Solve, SolveEfficiency, Step, StepName } from "./Types";

/**
 * Parses a single move token into its face (including wide-move prefix)
 * and a mod-4 quarter-turn value.
 * Returns null for rotations (x, y, z) or unrecognised tokens.
 */
type ParsedToken = { face: string; quarterTurns: number };

const MOVE_TOKEN_RE = /^([RLUDFBrludfbMESxyz]w?)(2'|3'?|'|2)?$/;
const SUFFIX_QUARTER_TURNS: { [suffix: string]: number } = { "": 1, "'": 3, "2": 2, "2'": 2, "3": 3, "3'": 3 };

/** The move vocabulary is tiny and repeats across every solve, so parsed tokens are memoised. */
const MOVE_TOKEN_CACHE = new Map<string, ParsedToken | null>();
function parseMoveToken(token: string): ParsedToken | null {
    let cached = MOVE_TOKEN_CACHE.get(token);
    if (cached === undefined) MOVE_TOKEN_CACHE.set(token, cached = parseMoveTokenUncached(token));
    return cached;
}

function parseMoveTokenUncached(token: string): ParsedToken | null {
    const m = token.match(MOVE_TOKEN_RE);
    if (!m) return null;
    const quarterTurns = SUFFIX_QUARTER_TURNS[m[2] ?? ""];
    return quarterTurns === undefined ? null : { face: m[1], quarterTurns };
}

function quarterTurnsToSliceTurns(qt: number): number {
    return ((qt % 4) + 4) % 4 === 0 ? 0 : 1;
}

function quarterTurnsToNotation(face: string, qt: number): string {
    const mod = ((qt % 4) + 4) % 4;
    if (mod === 1) return face;
    if (mod === 2) return face + "2";
    if (mod === 3) return face + "'";
    return "";
}

export function analyzeStepMoves(movesString: string, _aufMoves: Set<string> = AUF_MOVES): MoveAnalysisResult {
    const tokens = tokenizeMoves(movesString);
    if (tokens.length === 0) {
        return { originalTurns: 0, simplifiedTurns: 0, wastedMoves: 0, redundantPairs: [] };
    }

    type ParsedMove = { face: string; quarterTurns: number; originalIdx: number; originalToken: string };
    const parsed: ParsedMove[] = [];
    for (let i = 0; i < tokens.length; i++) {
        const p = parseMoveToken(tokens[i]);
        if (p) {
            parsed.push({ face: p.face, quarterTurns: p.quarterTurns, originalIdx: i, originalToken: tokens[i] });
        }
    }

    const originalTurns = parsed.reduce((sum, m) => sum + quarterTurnsToSliceTurns(m.quarterTurns), 0);

    const simplified: ParsedMove[] = [];
    const redundantPairs: RedundantPair[] = [];

    for (let i = 0; i < parsed.length; i++) {
        if (simplified.length > 0 && simplified[simplified.length - 1].face === parsed[i].face) {
            const prev = simplified[simplified.length - 1];
            const combined = (prev.quarterTurns + parsed[i].quarterTurns) % 4;

            const startIdx = prev.originalIdx;
            const endIdx = parsed[i].originalIdx;
            const pairMoves = tokens.slice(startIdx, endIdx + 1).join(" ");

            if (combined === 0) {
                redundantPairs.push({ startIdx, endIdx, moves: pairMoves });
                simplified.pop();
            } else {
                const prevSlice = quarterTurnsToSliceTurns(prev.quarterTurns);
                const curSlice = quarterTurnsToSliceTurns(parsed[i].quarterTurns);
                const newSlice = quarterTurnsToSliceTurns(combined);
                if (newSlice < prevSlice + curSlice) {
                    redundantPairs.push({ startIdx, endIdx, moves: pairMoves });
                }
                prev.quarterTurns = combined;
                prev.originalToken = quarterTurnsToNotation(prev.face, combined);
            }
        } else {
            simplified.push({ ...parsed[i] });
        }
    }

    const simplifiedTurns = simplified.reduce((sum, m) => sum + quarterTurnsToSliceTurns(m.quarterTurns), 0);
    const wastedMoves = originalTurns - simplifiedTurns;

    return { originalTurns, simplifiedTurns, wastedMoves, redundantPairs };
}

function countAufMoves(tokens: string[], direction: 'leading' | 'trailing', aufMoves: Set<string> = AUF_MOVES): number {
    let count = 0;
    if (direction === 'leading') {
        for (const t of tokens) {
            if (aufMoves.has(t)) count++;
            else break;
        }
    } else {
        for (let i = tokens.length - 1; i >= 0; i--) {
            if (aufMoves.has(tokens[i])) count++;
            else break;
        }
    }
    return count;
}

function isRotationOrAuf(t: string, aufMoves: Set<string> = AUF_MOVES): boolean {
    return ROTATIONS.has(t.toLowerCase()) || aufMoves.has(t);
}

export function coreMovesCount(movesString: string, aufMoves: Set<string> = AUF_MOVES): number {
    const tokens = tokenizeMoves(movesString);
    if (tokens.length === 0) return 0;
    let start = 0;
    while (start < tokens.length && isRotationOrAuf(tokens[start], aufMoves)) start++;
    let end = tokens.length - 1;
    while (end >= start && isRotationOrAuf(tokens[end], aufMoves)) end--;
    let count = 0;
    for (let i = start; i <= end; i++) {
        if (!ROTATIONS.has(tokens[i].toLowerCase())) count++;
    }
    return count;
}

/** Returns median (p50) of sorted array. */
function median(sorted: number[]): number {
    if (sorted.length === 0) return 0;
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 1) return sorted[mid];
    return (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Returns the lowest mode (smallest value that appears most often), or null if all values have the same frequency. */
function lowestMode(sorted: number[]): number | null {
    if (sorted.length === 0) return null;
    const counts: { [value: number]: number } = {};
    for (const v of sorted) {
        counts[v] = (counts[v] ?? 0) + 1;
    }
    const maxCount = Math.max(...Object.values(counts));
    const modes = Object.keys(counts)
        .map(Number)
        .filter((v) => counts[v] === maxCount)
        .sort((a, b) => a - b);
    if (modes.length === sorted.length) return null;
    return modes[0];
}

export function computeCaseFailureStats(
    solves: Solve[],
    stepName: StepName
): CaseStats[] {
    type CaseInstance = { solveId: string; coreMoves: number; totalTurns: number; stepTime: number };
    const caseMap: { [caseName: string]: CaseInstance[] } = {};

    for (const solve of solves) {
        const step = getStep(solve, stepName);
        if (!step || !step.case) continue;

        const caseName = step.case;
        if (!(caseName in caseMap)) caseMap[caseName] = [];
        const solveAufMoves = getAufMovesForSolve(solve);
        const core = coreMovesCount(step.moves, solveAufMoves);
        caseMap[caseName].push({ solveId: solve.id, coreMoves: core, totalTurns: step.turns, stepTime: step.time });
    }

    const results: CaseStats[] = [];
    const caseNames = Object.keys(caseMap);

    for (const caseName of caseNames) {
        if (caseName === "Solved") continue;
        const instances = caseMap[caseName];

        const moveCounts = instances.map((i: CaseInstance) => i.coreMoves).sort((a: number, b: number) => a - b);
        const n = moveCounts.length;
        let expectedMovesBase: number;
        if (n === 2) {
            expectedMovesBase = median(moveCounts);
        } else {
            const modeVal = lowestMode(moveCounts);
            expectedMovesBase = modeVal !== null ? modeVal : median(moveCounts);
        }
        // add some tolerance to the expected moves (eg: PLL that end in U+D o R2 counted as R+R)
        const tolerance = 2;
        const expectedMoves = expectedMovesBase + tolerance;

        const avgMoves = moveCounts.reduce((a: number, b: number) => a + b, 0) / moveCounts.length;
        const avgStepTime = instances.reduce((s: number, i: CaseInstance) => s + i.stepTime, 0) / instances.length;

        let failureCount = 0;
        const taggedInstances = instances.map((inst: CaseInstance) => {
            const failed = inst.coreMoves > expectedMoves && inst.stepTime > avgStepTime;
            if (failed) failureCount++;
            return { solveId: inst.solveId, turns: inst.totalTurns, failed };
        });

        results.push({
            caseName,
            totalCount: instances.length,
            failureCount,
            failureRate: instances.length > 0 ? (failureCount / instances.length) * 100 : 0,
            avgMoves,
            expectedMovesBase,
            expectedMoves,
            instances: taggedInstances,
        });
    }

    results.sort((a, b) => b.failureRate - a.failureRate);
    return results;
}

export function computeAufInefficiency(step: Step): AufInefficiency {
    const tokens = tokenizeMoves(step.moves);
    const preAufMoves = countAufMoves(tokens, 'leading');
    const postAufMoves = countAufMoves(tokens, 'trailing');
    const totalAufTime = step.preAufTime + step.postAufTime;
    const isHighCost = (preAufMoves + postAufMoves) > 2 || totalAufTime > 0.5;

    return { preAufMoves, postAufMoves, totalAufTime, isHighCost };
}

/** Lazily-built, per-CaseStats set of the solve ids that failed, so lookups are O(1) instead of a scan. */
const failedSolveIdsCache = new WeakMap<CaseStats, Set<string>>();
function failedSolveIds(stats: CaseStats): Set<string> {
    let ids = failedSolveIdsCache.get(stats);
    if (!ids) failedSolveIdsCache.set(stats, ids = new Set(stats.instances.filter((i) => i.failed).map((i) => i.solveId)));
    return ids;
}

/** Move strings repeat heavily across solves, so the two turn counts are memoised by step moves. */
const STEP_TURN_CACHE = new Map<string, { original: number; simplified: number }>();
function stepTurnCounts(moves: string): { original: number; simplified: number } {
    let counts = STEP_TURN_CACHE.get(moves);
    if (!counts) {
        const { originalTurns, simplifiedTurns } = analyzeStepMoves(moves);
        STEP_TURN_CACHE.set(moves, counts = { original: originalTurns, simplified: simplifiedTurns });
    }
    return counts;
}

export function computeSolveEfficiency(
    solve: Solve,
    ollCaseStats?: Map<string, CaseStats>,
    pllCaseStats?: Map<string, CaseStats>
): SolveEfficiency {
    let totalOriginal = 0;
    let totalSimplified = 0;

    for (const step of solve.steps) {
        if (!step.moves) continue;
        const counts = stepTurnCounts(step.moves);
        totalOriginal += counts.original;
        totalSimplified += counts.simplified;
    }

    const moveEfficiency = totalOriginal > 0 ? totalSimplified / totalOriginal : 1;

    let hadOllFailure = false;
    let hadPllFailure = false;

    const ollStep = getStep(solve, StepName.OLL);
    if (ollStep && ollStep.case && ollCaseStats) {
        const stats = ollCaseStats.get(ollStep.case);
        hadOllFailure = stats ? failedSolveIds(stats).has(solve.id) : false;
    }

    const pllStep = getStep(solve, StepName.PLL);
    if (pllStep && pllStep.case && pllCaseStats) {
        const stats = pllCaseStats.get(pllStep.case);
        hadPllFailure = stats ? failedSolveIds(stats).has(solve.id) : false;
    }

    return { moveEfficiency, hadOllFailure, hadPllFailure };
}
