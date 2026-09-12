import { Const } from "./Constants";
import { GetEmptySolve } from "./CubeHelpers";
import { Solve, CrossColor, MethodName, Step, StepName } from "./Types";

export const AUF_MOVES = new Set(['U', "U'", 'U2', "U2'", "U3", "U3'"]);
export const ROTATIONS = new Set([
    "x", "x'", "x2", "x3",
    "y", "y'", "y2", "y3",
    "z", "z'", "z2", "z3"
]);
const ACUBEMY_AUF_REMAP_CUTOFF_UTC = new Date('2025-10-21T13:00:00.000Z');
type FaceLetter = 'U' | 'D' | 'L' | 'R' | 'F' | 'B';

export function aufMovesForFace(face: FaceLetter): Set<string> {
    return new Set([face, `${face}'`, `${face}2`, `${face}2'`, `${face}3`, `${face}3'`]);
}

function getAcubemyAufFaceForCrossFace(crossFace: string | undefined | null): FaceLetter {
    switch ((crossFace ?? '').toUpperCase()) {
        case 'U':
            return 'D';
        case 'L':
            return 'R';
        case 'R':
            return 'L';
        case 'F':
            return 'B';
        case 'B':
            return 'F';
        case 'D':
        default:
            return 'U';
    }
}

function crossFaceFromCrossColor(crossColor: CrossColor): FaceLetter | null {
    switch (crossColor) {
        case CrossColor.White:
            return 'D';
        case CrossColor.Yellow:
            return 'U';
        case CrossColor.Orange:
            return 'L';
        case CrossColor.Red:
            return 'R';
        case CrossColor.Green:
            return 'F';
        case CrossColor.Blue:
            return 'B';
        default:
            return null;
    }
}

function isAcubemyBeforeAufCutoff(date: Date): boolean {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return false;
    return date.getTime() < ACUBEMY_AUF_REMAP_CUTOFF_UTC.getTime();
}

export function getAufMovesForSolve(solve: Pick<Solve, 'source' | 'date' | 'crossColor'>): Set<string> {
    if (solve.source !== 'acubemy' || !isAcubemyBeforeAufCutoff(solve.date)) {
        return AUF_MOVES;
    }
    const crossFace = crossFaceFromCrossColor(solve.crossColor);
    const aufFace = getAcubemyAufFaceForCrossFace(crossFace ?? 'D');
    return aufMovesForFace(aufFace);
}

export type MoveTiming = { move: string; timestamp: number };

/** Parses Cubeast format "U[100] R[200]" into MoveTiming[], filtering out rotations. */
export function parseRecordedMoves(raw: string): MoveTiming[] {
    const result: MoveTiming[] = [];
    if (!raw) return result;
    // One pass over the raw string: tokenizing it and slicing the digits out of every
    // "[123]" allocated millions of throwaway strings on a full export.
    const len = raw.length;
    let i = 0;
    while (i < len) {
        while (i < len && raw.charCodeAt(i) <= 32) i++;
        const start = i;
        while (i < len && raw.charCodeAt(i) > 32) i++;
        if (i === start || raw.charCodeAt(i - 1) !== 93) continue;
        let open = i - 2;
        let digits = 0;
        for (let c = raw.charCodeAt(open); open > start && c !== 91; c = raw.charCodeAt(--open)) {
            if (c < 48 || c > 57) { digits = -1; break; }
            digits++;
        }
        if (digits <= 0 || open <= start || raw.charCodeAt(open) !== 91) continue;
        let timestamp = 0;
        for (let d = open + 1; d < i - 1; d++) timestamp = timestamp * 10 + (raw.charCodeAt(d) - 48);
        const move = raw.slice(start, open);
        const firstChar = move.charCodeAt(0) | 32;
        // Only tokens starting with x/y/z can be rotations, so only they pay for the lookup.
        if (firstChar >= 120 && firstChar <= 122 && ROTATIONS.has(move.toLowerCase())) continue;
        result.push({ move, timestamp });
    }
    return result;
}

export type StepSegments = { recognition: number; preAuf: number; coreExecution: number; postAuf: number };

/**
 * Computes 4-segment timing from non-rotation moves and previous step end timestamp.
 * Cross: recognition=0, preAuf=0, postAuf=0, execution=all.
 * PLL skip (all U moves): preAuf=0, coreExecution=0, all time is postAuf.
 */
export function computeStepSegments(
    moves: MoveTiming[],
    prevEndTsMs: number | null,
    stepName: StepName,
    aufMoves: Set<string> = AUF_MOVES
): StepSegments {
    const zero = { recognition: 0, preAuf: 0, coreExecution: 0, postAuf: 0 };
    if (!moves.length) return zero;

    const firstTs = moves[0].timestamp;
    const lastTs = moves[moves.length - 1].timestamp;

    if (stepName === StepName.Cross) {
        return {
            recognition: 0,
            preAuf: 0,
            coreExecution: Math.max(0, (lastTs - firstTs) / 1000),
            postAuf: 0,
        };
    }

    const recognition = prevEndTsMs == null ? 0 : Math.max(0, (firstTs - prevEndTsMs) / 1000);

    let firstNonU: number | null = null;
    for (let i = 0; i < moves.length; i++) {
        if (!aufMoves.has(moves[i].move)) {
            firstNonU = i;
            break;
        }
    }
    let lastNonU: number | null = null;
    for (let i = moves.length - 1; i >= 0; i--) {
        if (!aufMoves.has(moves[i].move)) {
            lastNonU = i;
            break;
        }
    }

    if (stepName === StepName.PLL && firstNonU === null) {
        return {
            recognition,
            preAuf: 0,
            coreExecution: 0,
            postAuf: Math.max(0, (lastTs - firstTs) / 1000),
        };
    }
    if (firstNonU === null) {
        return {
            recognition,
            preAuf: 0,
            coreExecution: Math.max(0, (lastTs - firstTs) / 1000),
            postAuf: 0,
        };
    }

    const preAuf = (moves[firstNonU].timestamp - firstTs) / 1000;
    const postAuf =
        stepName === StepName.PLL && lastNonU !== null && lastNonU < moves.length - 1
            ? (lastTs - moves[lastNonU].timestamp) / 1000
            : 0;
    const coreExecution =
        lastNonU !== null
            ? Math.max(0, (moves[lastNonU].timestamp - moves[firstNonU].timestamp) / 1000)
            : 0;

    return { recognition, preAuf, coreExecution, postAuf };
}

/**
 * Cross span from timestamps is 0 with a single move or identical first/last timestamps.
 * Use CSV step execution (seconds) when degenerate and the export reports a positive duration.
 */
export function effectiveCrossExecutionSec(
    moveTimings: MoveTiming[],
    segmentExecutionSec: number,
    csvExecutionFallbackSec: number
): number {
    if (!moveTimings.length) return segmentExecutionSec;
    const firstTs = moveTimings[0].timestamp;
    const lastTs = moveTimings[moveTimings.length - 1].timestamp;
    const degenerate =
        moveTimings.length === 1 || firstTs === lastTs;
    if (degenerate && csvExecutionFallbackSec > 0 && segmentExecutionSec === 0) {
        return csvExecutionFallbackSec;
    }
    return segmentExecutionSec;
}

/** Splits a CSV line on `splitter`, ignoring separators inside [...] (e.g. case "[FL,BR]->FR 30"). */
function splitCsvLine(line: string, splitterCode: number): string[] {
    const out: string[] = [];
    let depth = 0, start = 0;
    for (let i = 0; i < line.length; i++) {
        const c = line.charCodeAt(i);
        if (c === 91) depth++;
        else if (c === 93) depth--;
        else if (c === splitterCode && depth === 0) { out.push(line.slice(start, i)); start = i + 1; }
    }
    out.push(line.slice(start));
    return out;
}

/** Parses "YYYY-MM-DD HH:mm:ss" (optionally suffixed, e.g. " UTC") as a UTC date. */
function parseUtcDateTime(value: string): Date {
    return new Date(Date.UTC(
        +value.slice(0, 4), +value.slice(5, 7) - 1, +value.slice(8, 10),
        +value.slice(11, 13), +value.slice(14, 16), +value.slice(17, 19)));
}

// --- Shared helpers for Acubemy move parsing  ---

function normalizeMovesString(raw: string | undefined | null): string {
    if (!raw) return "";
    const trimmed = raw.trim();
    if (!trimmed) return "";
    // Strip surrounding quotes Acubemy may add around move strings.
    const withoutQuotes = trimmed.replace(/^"(.*)"$/, "$1");
    return withoutQuotes.trim();
}

export function tokenizeMoves(raw: string | undefined | null): string[] {
    const normalized = normalizeMovesString(raw);
    if (!normalized) return [];
    return normalized
        .split(/\s+/)
        .filter((token) => token.length > 0);
}

/** Counts move tokens excluding cube rotations (x, y, z). Use for all turn counts. */
export function countMovesExcludingRotations(movesString: string | undefined | null): number {
    const tokens = tokenizeMoves(movesString);
    if (!tokens.length) return 0;
    return tokens.filter((t) => !ROTATIONS.has(t.toLowerCase())).length;
}

/** Returns move string with all rotation tokens (x, y, z and variants) removed. Use for Acubemy so stored data has no rotations. */
export function stripRotationsFromMoveString(movesString: string | undefined | null): string {
    if (!movesString || !movesString.trim()) return '';
    const tokens = tokenizeMoves(movesString);
    return tokens.filter((t) => !ROTATIONS.has(t.toLowerCase())).join(' ');
}

/**
 * A Cubeast row while it is being parsed. Move timings and the cumulative time are only
 * needed to derive real step timings, so they live here for the duration of one row
 * rather than on the Step itself - putting them on the Step and deleting them afterwards
 * drops every Step into V8's dictionary mode, which slows down all later chart work.
 */
interface RowScratch {
    moves: (MoveTiming[] | null)[];
    cumulativeSec: number[];
}

type ColumnSetter = (obj: Solve, value: string, scratch: RowScratch) => void;

function parseCubeastCsv(stringVal: string, splitter: string): Solve[] {
    // Separators inside [...] (e.g. step case "[FL,BR]->FR 30") are skipped while splitting,
    // which avoids rewriting the whole 45MB export before it can be parsed.
    const splitterCode = splitter.charCodeAt(0);
    const headerEnd = stringVal.indexOf("\n");
    const keys = splitCsvLine((headerEnd < 0 ? stringVal : stringVal.slice(0, headerEnd)).trim(), splitterCode);

    const keyMap: { [key: string]: (obj: Solve, value: string) => void } = {
        "id": (obj, value) => { obj.id = value; obj.rawSourceId = value; obj.source = 'cubeast'; },
        "time": (obj, value) => { obj.time = Number(value) / 1000; if (obj.time < 1) obj.isCorrupt = true; },
        "date": (obj, value) => { obj.date = parseUtcDateTime(value); },
        "solution_rotation": (obj, value) => {
            obj.crossColor = Const.crossMappings.get(value) ?? CrossColor.Unknown;
            if (obj.crossColor == CrossColor.Unknown) {
                //console.log("Unknown solution rotation: ", value);
                //obj.isCorrupt = true;
            };
        },
        "scramble": (obj, value) => { obj.scramble = value; },
        "solving_method": (obj, value) => { obj.method = value as MethodName; },
        "turns_per_second": (obj, value) => { obj.tps = Number(value); },
        "total_recognition_time": (obj, value) => { obj.recognitionTime = Number(value) / 1000; },
        "inspection_time": (obj, value) => { obj.inspectionTime = Number(value) / 1000; },
        "total_execution_time": (obj, value) => { obj.executionTime = Number(value) / 1000; },
        "slice_turns": (obj, value) => { obj.turns = Number(value); },
        "session_name": (obj, value) => { obj.session = value; },
    };

    const stepKeyMap: { [key: string]: (step: Step, value: string) => void } = {
        "name": (step, value) => { step.name = value as StepName; },
        "slice_turns": (step, value) => { step.turns = Number(value); },
        "time": (step, value) => { step.time = Number(value) / 1000; },
        "case": (step, value) => { step.case = value; },
        "turns_per_second": (step, value) => { step.tps = Number(value); },
        "recognition_time": (step, value) => { step.recognitionTime = Number(value) / 1000; },
        "execution_time": (step, value) => { step.executionTime = Number(value) / 1000; },
    };

    // Resolve each header column to its setter once, instead of re-parsing the key on every row.
    const TIME_COLUMNS: { [key: string]: number } = { "time": 0, "pickup_time": 1, "putdown_time": 2, "solving_time": 3 };
    const columnSetters = keys.map((key): ColumnSetter | undefined => {
        if (!key.startsWith("step_")) return keyMap[key];
        const stepIndex = +key[5];
        const stepKey = key.split("_").slice(2).join("_");
        if (stepKey === "recorded_moves") {
            return (obj, value, scratch) => {
                const moveTimings = parseRecordedMoves(value);
                if (moveTimings.length > 0) scratch.moves[stepIndex] = moveTimings;
            };
        }
        if (stepKey === "cumulative_time") {
            return (obj, value, scratch) => {
                const sec = Number(value) / 1000;
                if (Number.isFinite(sec) && sec >= 0) scratch.cumulativeSec[stepIndex] = sec;
            };
        }
        const setStep = stepKeyMap[stepKey];
        return setStep ? (obj, value) => setStep(obj.steps[stepIndex], value) : undefined;
    });
    const timeColumns = keys.map((key) => TIME_COLUMNS[key] ?? -1);
    const columnCount = columnSetters.length;

    const formedArr: Solve[] = [];
    const stepCount = GetEmptySolve().steps.length;
    // Reused across rows; the parser is single threaded, so one set of scratch buffers is enough.
    const scratch: RowScratch = { moves: new Array(stepCount).fill(null), cumulativeSec: new Array(stepCount).fill(-1) };
    const times = [0, 0, 0, 0];
    const total = stringVal.length;

    for (let lineStart = headerEnd + 1; lineStart < total;) {
        let lineEnd = stringVal.indexOf("\n", lineStart);
        if (lineEnd < 0) lineEnd = total;
        // Exports are CRLF, so drop the carriage return rather than leaving it on the last cell.
        let end = lineEnd;
        if (end > lineStart && stringVal.charCodeAt(end - 1) === 13) end--;
        if (end <= lineStart) { lineStart = lineEnd + 1; continue; }

        const obj = GetEmptySolve();
        for (let i = 0; i < stepCount; i++) { scratch.moves[i] = null; scratch.cumulativeSec[i] = -1; }
        times[0] = times[1] = times[2] = times[3] = 0;

        // Walk the row once, only materialising the cells that something actually reads.
        // Two thirds of Cubeast's 164 columns are ignored, so skipping those slices matters.
        // Separators inside [...] (step cases such as "[FL,BR]->FR 30") are not cell boundaries.
        let depth = 0, cellStart = lineStart, index = 0;
        for (let i = lineStart; i <= end; i++) {
            const c = i === end ? splitterCode : stringVal.charCodeAt(i);
            if (c === 91) depth++;
            else if (c === 93) depth--;
            else if (c === splitterCode && depth === 0) {
                if (index < columnCount) {
                    const setter = columnSetters[index];
                    const timeColumn = timeColumns[index];
                    if (setter !== undefined || timeColumn >= 0) {
                        const value = stringVal.slice(cellStart, i);
                        if (timeColumn >= 0) times[timeColumn] = Number(value) || 0;
                        setter?.(obj, value, scratch);
                    }
                }
                index++;
                cellStart = i + 1;
            }
        }

        const [rawTimeMs, pickupTimeMs, putdownTimeMs, solvingTimeMs] = times;

        // After parsing the row, adjust Cubeast Solve.time to represent in-hand time:
        // prefer solving_time, else subtract pickup/putdown from time, else use raw time.
        if (obj.source === 'cubeast') {
            const finalMs = solvingTimeMs > 0 ? solvingTimeMs
                : rawTimeMs > 0 ? rawTimeMs - pickupTimeMs - putdownTimeMs
                : 0;
            if (finalMs !== 0) {
                obj.time = finalMs / 1000;
                if (obj.time < 1) obj.isCorrupt = true;
            }
        }

        let prevEndTsMs: number | null = null;
        let recognitionTotal = 0, executionTotal = 0, preAufTotal = 0, postAufTotal = 0, turnsTotal = 0;
        for (let i = 0; i < obj.steps.length; i++) {
            const step = obj.steps[i];
            const moveTimings = scratch.moves[i];
            if (moveTimings !== null && moveTimings.length > 0) {
                const isCross = step.name === StepName.Cross;
                const csvCumulativeSec = scratch.cumulativeSec[i];
                const crossExecFallback = !isCross ? 0
                    : step.executionTime > 0 ? step.executionTime
                    : Math.max(csvCumulativeSec, 0);
                const seg = computeStepSegments(moveTimings, prevEndTsMs, step.name);
                step.recognitionTime = seg.recognition;
                step.preAufTime = seg.preAuf;
                step.postAufTime = seg.postAuf;
                const segmentExec = seg.preAuf + seg.coreExecution + seg.postAuf;
                step.executionTime = isCross
                    ? effectiveCrossExecutionSec(moveTimings, segmentExec, crossExecFallback)
                    : segmentExec;
                step.time = step.recognitionTime + step.executionTime;
                let moves = moveTimings[0].move;
                for (let m = 1; m < moveTimings.length; m++) moves += " " + moveTimings[m].move;
                step.moves = moves;
                step.turns = moveTimings.length;
                if (step.time > 0) step.tps = step.turns / step.time;
                prevEndTsMs = moveTimings[moveTimings.length - 1].timestamp;
            } else {
                step.preAufTime = 0;
                step.postAufTime = 0;
                if (prevEndTsMs != null && step.time > 0) {
                    prevEndTsMs += step.time * 1000;
                }
            }
            recognitionTotal += step.recognitionTime;
            executionTotal += step.executionTime;
            preAufTotal += step.preAufTime;
            postAufTotal += step.postAufTime;
            turnsTotal += step.turns;
        }
        obj.recognitionTime = recognitionTotal;
        obj.executionTime = executionTotal;
        obj.preAufTime = preAufTotal;
        obj.postAufTime = postAufTotal;
        obj.turns = turnsTotal;

        obj.source = 'cubeast';
        obj.rawSource = 'cubeast';

        formedArr.push(obj);
        lineStart = lineEnd + 1;
    }

    return formedArr.sort((a: Solve, b: Solve) => a.date.getTime() - b.date.getTime());
}

function parseAcubemyCsv(stringVal: string, splitter: string): Solve[] {

    type AcubemyStepDef = { index: number; name: StepName; movesField: string };

    const ACUBEMY_STEP_DEFS: AcubemyStepDef[] = [
        { index: 0, name: StepName.Cross, movesField: "cross_moves" },
        { index: 1, name: StepName.F2L_1, movesField: "f2l_pair1_moves" },
        { index: 2, name: StepName.F2L_2, movesField: "f2l_pair2_moves" },
        { index: 3, name: StepName.F2L_3, movesField: "f2l_pair3_moves" },
        { index: 4, name: StepName.F2L_4, movesField: "f2l_pair4_moves" },
        { index: 5, name: StepName.OLL, movesField: "oll_moves" },
        { index: 6, name: StepName.PLL, movesField: "pll_moves" },
    ];

    const [keys, ...rows] = stringVal
        .trim()
        .split("\n")
        .map((item) => item.split(splitter));

    const buildKeyIndex = (header: string[]): Record<string, number> => {
        const index: Record<string, number> = {};
        header.forEach((key, i) => {
            if (!(key in index)) {
                index[key] = i;
            }
        });
        return index;
    };

    const keyIndex = buildKeyIndex(keys);

    const makeRowAccessors = (row: string[]) => {
        const get = (name: string): string => {
            const idx = keyIndex[name];
            return typeof idx === "number" && idx >= 0 ? row[idx] ?? "" : "";
        };
        const getNumber = (name: string): number => {
            const v = get(name);
            return v ? Number(v) : 0;
        };
        return { get, getNumber };
    };

    const initAcubemySteps = (
        steps: Solve["steps"],
        get: (name: string) => string
    ) => {
        for (const def of ACUBEMY_STEP_DEFS) {
            const s = steps[def.index];
            const moves = get(def.movesField);
            s.name = def.name;
            s.time = 0;
            s.recognitionTime = 0;
            s.executionTime = 0;
            s.turns = countMovesExcludingRotations(moves);
            if (moves) {
                s.moves = stripRotationsFromMoveString(moves);
            }
        }
    };

    const initEmptyMethodSteps = (solve: Solve, method: MethodName) => {
        const stepNames = Const.MethodSteps[method];
        for (let i = 0; i < solve.steps.length; i++) {
            const s = solve.steps[i];
            const name = stepNames[i] ?? stepNames[stepNames.length - 1] ?? StepName.Cross;
            s.name = name;
            s.time = 0;
            s.recognitionTime = 0;
            s.executionTime = 0;
            s.preAufTime = 0;
            s.postAufTime = 0;
            s.turns = 0;
            s.tps = 0;
            s.moves = '';
            s.case = '';
        }
    };

    const normalizeAcubemyLastLayerCases = (
        steps: Solve["steps"],
        ollCaseRaw: string,
        pllCaseRaw: string
    ) => {
        const ollStep = steps[5];
        if (ollStep) {
            ollStep.name = StepName.OLL;
            if (ollCaseRaw) {
                ollStep.case = ollCaseRaw === "-1" ? "Solved" : ollCaseRaw;
            }
        }

        const pllStep = steps[6];
        if (pllStep) {
            pllStep.name = StepName.PLL;
            if (pllCaseRaw) {
                pllStep.case = pllCaseRaw === "Unknown" ? "Solved" : pllCaseRaw;
            }
        }
    };

    const computeAcubemySolveTurnsAndTps = (
        solve: Solve,
        solutionMoves: string | undefined | null
    ) => {
        const totalTurns = countMovesExcludingRotations(solutionMoves);
        solve.turns = totalTurns;
        if (solve.time > 0) {
            solve.tps = totalTurns / solve.time;
        } else {
            solve.tps = 0;
        }
    };

    /** Strips rotations from solution and move_times in parallel so lengths stay in sync. */
    const stripRotationsFromSolutionAndTimes = (
        solutionMovesRaw: string | undefined | null,
        moveTimesRaw: string | undefined | null
    ): { solutionNoRot: string; moveTimesNoRot: string } => {
        const solutionTokens = tokenizeMoves(solutionMovesRaw);
        if (!solutionTokens.length || !moveTimesRaw || !moveTimesRaw.trim()) {
            return { solutionNoRot: '', moveTimesNoRot: '' };
        }
        const timeTokens = normalizeMovesString(moveTimesRaw)
            .split(/\s+/)
            .filter((t) => t.length > 0)
            .map((t) => Number(t));
        if (solutionTokens.length !== timeTokens.length) {
            return { solutionNoRot: '', moveTimesNoRot: '' };
        }
        const keptMoves: string[] = [];
        const keptTimes: number[] = [];
        for (let i = 0; i < solutionTokens.length; i++) {
            if (ROTATIONS.has(solutionTokens[i].toLowerCase())) continue;
            keptMoves.push(solutionTokens[i]);
            keptTimes.push(timeTokens[i]);
        }
        return {
            solutionNoRot: keptMoves.join(' '),
            moveTimesNoRot: keptTimes.join(' '),
        };
    };

    type StepRange = {
        startIdx: number;
        endIdx: number;
    };

    /** solutionMovesRaw and moveTimesRaw must already have rotations stripped (use stripRotationsFromSolutionAndTimes). */
    const recomputeAcubemyStepTimes = (
        solve: Solve,
        stepDefs: AcubemyStepDef[],
        solutionMovesRaw: string | undefined | null,
        moveTimesRaw: string | undefined | null,
        aufMoves: Set<string> = AUF_MOVES,
        crossCsvExecutionFallbackSec = 0
    ) => {
        const solutionTokens = tokenizeMoves(solutionMovesRaw);
        if (!solutionTokens.length || !moveTimesRaw || !moveTimesRaw.trim()) {
            return;
        }

        const timeTokens = normalizeMovesString(moveTimesRaw)
            .split(/\s+/)
            .filter((t) => t.length > 0)
            .map((t) => Number(t));

        if (solutionTokens.length !== timeTokens.length || solutionTokens.length === 0) {
            return;
        }

        const matchStepRange = (
            stepMoves: string,
            searchFrom: number
        ): StepRange | null => {
            const tokens = tokenizeMoves(stepMoves);
            if (tokens.length === 0) return null;
            const first = tokens[0];
            for (let i = searchFrom; i <= solutionTokens.length - tokens.length; i++) {
                if (solutionTokens[i] !== first) continue;
                let ok = true;
                for (let j = 1; j < tokens.length; j++) {
                    if (solutionTokens[i + j] !== tokens[j]) {
                        ok = false;
                        break;
                    }
                }
                if (!ok) continue;
                return {
                    startIdx: i,
                    endIdx: i + tokens.length - 1,
                };
            }
            return null;
        };

        const steps = solve.steps;
        const stepRanges: (StepRange | null)[] = [];
        let searchFrom = 0;
        for (const def of stepDefs) {
            const s = steps[def.index];
            const movesString = s.moves as string | undefined;
            const range = movesString ? matchStepRange(movesString, searchFrom) : null;
            stepRanges[def.index] = range;
            if (range) {
                searchFrom = range.endIdx + 1;
            }
        }

        let prevEndIdx: number | null = null;
        let accumulatedRecMs = 0;
        let accumulatedExecMs = 0;
        let accumulatedPreAufMs = 0;
        let accumulatedPostAufMs = 0;

        for (const def of stepDefs) {
            const s = steps[def.index];
            const range = stepRanges[def.index];

            if (!range) {
                s.recognitionTime = 0;
                s.executionTime = 0;
                s.preAufTime = 0;
                s.postAufTime = 0;
                s.time = 0;
                s.tps = 0;
                continue;
            }

            const moveTimings: MoveTiming[] = [];
            for (let k = range.startIdx; k <= range.endIdx; k++) {
                moveTimings.push({ move: solutionTokens[k], timestamp: timeTokens[k] });
            }

            const prevEndTsMs = prevEndIdx == null ? null : timeTokens[prevEndIdx];
            const seg = computeStepSegments(moveTimings, prevEndTsMs, s.name, aufMoves);

            s.recognitionTime = seg.recognition;
            s.preAufTime = seg.preAuf;
            s.postAufTime = seg.postAuf;
            const segmentExec = seg.preAuf + seg.coreExecution + seg.postAuf;
            s.executionTime =
                def.name === StepName.Cross
                    ? effectiveCrossExecutionSec(
                          moveTimings,
                          segmentExec,
                          crossCsvExecutionFallbackSec
                      )
                    : segmentExec;
            s.time = s.recognitionTime + s.executionTime;

            if (s.time > 0 && s.turns > 0) {
                s.tps = s.turns / s.time;
            }

            accumulatedRecMs += seg.recognition * 1000;
            accumulatedExecMs += s.executionTime * 1000;
            accumulatedPreAufMs += seg.preAuf * 1000;
            accumulatedPostAufMs += seg.postAuf * 1000;
            prevEndIdx = range.endIdx;
        }

        solve.recognitionTime = accumulatedRecMs / 1000;
        solve.executionTime = accumulatedExecMs / 1000;
        solve.preAufTime = accumulatedPreAufMs / 1000;
        solve.postAufTime = accumulatedPostAufMs / 1000;
    };

    const formedArr = rows.map((item) => {
        const solve = GetEmptySolve();

        const { get, getNumber } = makeRowAccessors(item);

        solve.source = 'acubemy';
        solve.rawSource = 'acubemy';

        const solveId = get("solve_id");
        solve.id = `acubemy-${solveId}`;
        solve.rawSourceId = solveId;

        const dateStr = get("date");
        if (dateStr) {
            solve.date = new Date(dateStr);
        }

        solve.time = getNumber("total_time") / 1000;
        if (solve.time < 1) {
            solve.isCorrupt = true;
        }

        // Acubemy exports don't include inspection time. Keep it as `null` unless the column exists.
        const inspectionTimeRaw = get("inspection_time");
        const inspectionMs = inspectionTimeRaw ? Number(inspectionTimeRaw) : NaN;
        solve.inspectionTime = Number.isFinite(inspectionMs) && inspectionMs >= 0
            ? inspectionMs / 1000
            : null;

        solve.scramble = get("scramble");

        solve.session = get("session_name");

        const analysisType = get("analysis_type")?.toUpperCase() ?? "";
        if (analysisType.includes("ROUX")) {
            solve.method = MethodName.Roux;
        } else if (analysisType.includes("ZZ")) {
            solve.method = MethodName.ZZ;
        } else if (analysisType.includes("CFOP")) {
            solve.method = MethodName.CFOP;
        }

        const crossFace = get("cross_face");
        if (crossFace) {
            switch (crossFace) {
                case "D":
                    solve.crossColor = CrossColor.White;
                    break;
                case "U":
                    solve.crossColor = CrossColor.Yellow;
                    break;
                case "F":
                    solve.crossColor = CrossColor.Green;
                    break;
                case "B":
                    solve.crossColor = CrossColor.Blue;
                    break;
                case "R":
                    solve.crossColor = CrossColor.Red;
                    break;
                case "L":
                    solve.crossColor = CrossColor.Orange;
                    break;
                default:
                    solve.crossColor = CrossColor.Unknown;
                    break;
            }
        }

        const steps = solve.steps;
        const ollCaseRaw = get("oll_case_id");
        const pllCaseRaw = get("pll_case_name");

        if (solve.method === MethodName.CFOP) {
            initAcubemySteps(steps, get);
            normalizeAcubemyLastLayerCases(steps, ollCaseRaw, pllCaseRaw);
        } else {
            initEmptyMethodSteps(solve, solve.method);
        }

        const solutionMovesRaw = get("solution") || get("raw_solution");
        const moveTimesRaw = get("move_times");
        const { solutionNoRot, moveTimesNoRot } = stripRotationsFromSolutionAndTimes(solutionMovesRaw, moveTimesRaw);

        computeAcubemySolveTurnsAndTps(solve, solutionNoRot || solutionMovesRaw);

        const crossExecMs = getNumber("cross_execution_time");
        const crossTimeMs = getNumber("cross_time");
        const crossCsvExecutionFallbackSec =
            crossExecMs > 0
                ? crossExecMs / 1000
                : crossTimeMs > 0
                  ? crossTimeMs / 1000
                  : 0;

        if (solve.method === MethodName.CFOP && solutionNoRot && moveTimesNoRot) {
            const solveAufMoves = getAufMovesForSolve(solve);
            recomputeAcubemyStepTimes(
                solve,
                ACUBEMY_STEP_DEFS,
                solutionNoRot,
                moveTimesNoRot,
                solveAufMoves,
                crossCsvExecutionFallbackSec
            );
        }

        return solve;
    });

    const sorted = formedArr.sort((a: Solve, b: Solve) => {
        return a.date.getTime() - b.date.getTime();
    });

    return sorted;
}

export function parseCsv(stringVal: string, splitter: string): Solve[] {
    // Only the first line is needed, so avoid splitting the whole 45MB export to find it.
    const firstBreak = stringVal.indexOf("\n");
    const header = (firstBreak < 0 ? stringVal : stringVal.slice(0, firstBreak)).trim();

    if (header.includes("id,date,dnf,time,solving_method")) {
        return parseCubeastCsv(stringVal, splitter);
    }

    if (header.includes("solve_id,date,total_time")) {
        return parseAcubemyCsv(stringVal, splitter);
    }

    // default to cubeast parser for backward compatibility
    return parseCubeastCsv(stringVal, splitter);
}
