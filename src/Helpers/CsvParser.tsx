import { Const } from "./Constants";
import { GetEmptySolve } from "./CubeHelpers";
import { Solve, CrossColor, MethodName, StepName } from "./Types";
import moment from 'moment';

export const AUF_MOVES = new Set(['U', "U'", 'U2', "U2'", "U3", "U3'"]);
export const ROTATIONS = new Set([
    "x", "x'", "x2", "x3",
    "y", "y'", "y2", "y3",
    "z", "z'", "z2", "z3"
]);
const ACUBEMY_AUF_REMAP_CUTOFF_UTC = new Date('2025-10-21T13:00:00.000Z');
const MOVE_TIMESTAMP_RE = /^(.+)\[(\d+)\]$/;
const BRACKET_CONTENT_RE = /\[[^\]]*\]/g;
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
    if (!raw || !raw.trim()) return [];
    const tokens = raw.trim().split(/\s+/);
    const result: MoveTiming[] = [];
    for (const token of tokens) {
        const m = token.match(MOVE_TIMESTAMP_RE);
        if (!m) continue;
        const move = m[1];
        if (ROTATIONS.has(move.toLowerCase())) continue;
        result.push({ move, timestamp: Number(m[2]) });
    }
    return result;
}

export type StepSegments = { recognition: number; preAuf: number; coreExecution: number; postAuf: number };

/**
 * Computes 4-segment timing from non-rotation moves and previous step end timestamp.
 * Cross: recognition=0, preAuf=0, postAuf=0, execution=all.
 * PLL skip (all U moves): preAuf=0, coreExecution=0, all time is postAuf.
 */
/** Returns duration in ms of leading AUF moves from Cubeast recorded_moves string (for fallback when no timings). */
function computeLeadingAufDurationMs(recordedMoves: string): number {
    if (!recordedMoves || !recordedMoves.trim()) return 0;
    const tokens = recordedMoves.trim().split(/\s+/);
    let firstAufTs: number | null = null;
    for (const token of tokens) {
        const m = token.match(MOVE_TIMESTAMP_RE);
        if (!m) continue;
        const move = m[1];
        const ts = Number(m[2]);
        if (AUF_MOVES.has(move)) {
            if (firstAufTs == null) firstAufTs = ts;
        } else {
            if (firstAufTs != null) return Math.max(0, ts - firstAufTs);
            return 0;
        }
    }
    let lastAufTs: number | null = null;
    for (let i = tokens.length - 1; i >= 0; i--) {
        const m = tokens[i].match(MOVE_TIMESTAMP_RE);
        if (!m) continue;
        if (AUF_MOVES.has(m[1])) lastAufTs = Number(m[2]);
        else break;
    }
    if (firstAufTs != null && lastAufTs != null) return Math.max(0, lastAufTs - firstAufTs);
    return 0;
}

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

const COMMA_PLACEHOLDER = '\x01';

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

function parseCubeastCsv(stringVal: string, splitter: string): Solve[] {
    
    // Replace commas inside [...] so split(splitter) does not break on e.g. step case "[FL,BR]->FR 30".
    // Preserves bracket content (including timestamps in step_N_recorded_moves) for AUF parsing.
    const normalized = stringVal.trim().replace(BRACKET_CONTENT_RE, (m) => m.replace(/,/g, COMMA_PLACEHOLDER));

    const [keys, ...rest] = normalized
        .split("\n")
        .map((item) => item.split(splitter));

    const keyMap: { [key: string]: (obj: Solve, value: string) => void } = {
        "id": (obj, value) => { obj.id = value; obj.rawSourceId = value; obj.source = 'cubeast'; },
        "time": (obj, value) => { obj.time = Number(value) / 1000; if (obj.time < 1) obj.isCorrupt = true; },
        "date": (obj, value) => { obj.date = moment.utc(value, 'YYYY-MM-DD hh:mm:ss').toDate(); },
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

    const stepKeyMap: { [key: string]: (step: any, value: string) => void } = {
        "name": (step, value) => { step.name = value as StepName; },
        "slice_turns": (step, value) => { step.turns = Number(value); },
        "time": (step, value) => { step.time = Number(value) / 1000; },
        "case": (step, value) => { step.case = value ? value.split(COMMA_PLACEHOLDER).join(',') : value; },
        "turns_per_second": (step, value) => { step.tps = Number(value); },
        "recognition_time": (step, value) => { step.recognitionTime = Number(value) / 1000; },
        "execution_time": (step, value) => { step.executionTime = Number(value) / 1000; },
        "cumulative_time": (step, value) => {
            const sec = Number(value) / 1000;
            if (Number.isFinite(sec) && sec >= 0) {
                (step as any)._csvCumulativeTimeSec = sec;
            }
        },
        "recorded_moves": (step, value) => {
            const moveTimings = parseRecordedMoves(value);
            if (moveTimings.length > 0) {
                (step as any)._moveTimings = moveTimings;
            } else if (value && value.trim()) {
                const aufMs = computeLeadingAufDurationMs(value);
                if (aufMs > 0) (step as any).aufDurationMs = aufMs;
            }
        },
    };

    let formedArr = rest.map((item) => {
        let obj = GetEmptySolve();

        // Track Cubeast pickup/putdown/solving times (ms) while parsing a row.
        let rawTimeMs: number | null = null;
        let pickupTimeMs: number | null = null;
        let putdownTimeMs: number | null = null;
        let solvingTimeMs: number | null = null;

        keys.forEach((key, index) => {
            const value = item[index];
            if (key === "time") {
                rawTimeMs = Number(value) || 0;
            } else if (key === "pickup_time") {
                pickupTimeMs = Number(value) || 0;
            } else if (key === "putdown_time") {
                putdownTimeMs = Number(value) || 0;
            } else if (key === "solving_time") {
                solvingTimeMs = Number(value) || 0;
            }

            if (key.startsWith("step_")) {
                const stepIndex = +key[5];
                const stepKey = key.split("_").slice(2).join("_");
                stepKeyMap[stepKey]?.(obj.steps[stepIndex], value);
            } else {
                keyMap[key]?.(obj, value);
            }
        });

        // After parsing the row, adjust Cubeast Solve.time to represent in-hand time:
        // 1) Prefer solving_time when present and > 0.
        // 2) Else, if we have time plus pickup/putdown, subtract them.
        // 3) Else, fall back to raw time.
        if (obj.source === 'cubeast') {
            let finalMs: number | null = null;
            if (solvingTimeMs != null && solvingTimeMs > 0) {
                finalMs = solvingTimeMs;
            } else if (rawTimeMs != null && rawTimeMs > 0 &&
                pickupTimeMs != null && putdownTimeMs != null &&
                (pickupTimeMs > 0 || putdownTimeMs > 0)) {
                finalMs = rawTimeMs - pickupTimeMs - putdownTimeMs;
            } else if (rawTimeMs != null && rawTimeMs > 0) {
                finalMs = rawTimeMs;
            }

            if (finalMs != null) {
                const sec = finalMs / 1000;
                obj.time = sec;
                if (sec < 1) {
                    obj.isCorrupt = true;
                }
            }
        }

        let prevEndTsMs: number | null = null;
        for (let i = 0; i < obj.steps.length; i++) {
            const step = obj.steps[i];
            const moveTimings = (step as any)._moveTimings as MoveTiming[] | undefined;
            if (moveTimings && moveTimings.length > 0) {
                const csvCumulativeSec = (step as any)._csvCumulativeTimeSec as number | undefined;
                const csvCrossExecFallback =
                    step.name === StepName.Cross
                        ? step.executionTime > 0
                            ? step.executionTime
                            : csvCumulativeSec != null && csvCumulativeSec > 0
                              ? csvCumulativeSec
                              : 0
                        : 0;
                const seg = computeStepSegments(moveTimings, prevEndTsMs, step.name);
                step.recognitionTime = seg.recognition;
                step.preAufTime = seg.preAuf;
                step.postAufTime = seg.postAuf;
                const segmentExec = seg.preAuf + seg.coreExecution + seg.postAuf;
                step.executionTime =
                    step.name === StepName.Cross
                        ? effectiveCrossExecutionSec(
                              moveTimings,
                              segmentExec,
                              csvCrossExecFallback
                          )
                        : segmentExec;
                step.time = step.recognitionTime + step.executionTime;
                step.moves = moveTimings.map((m) => m.move).join(" ");
                step.turns = moveTimings.length;
                if (step.time > 0 && step.turns > 0) {
                    step.tps = step.turns / step.time;
                }
                delete (step as any)._csvCumulativeTimeSec;
                if (moveTimings.length > 0) {
                    prevEndTsMs = moveTimings[moveTimings.length - 1].timestamp;
                }
            } else {
                step.preAufTime = 0;
                step.postAufTime = 0;
                const aufMs = (step as any).aufDurationMs as number | undefined;
                if (aufMs != null && aufMs > 0 && step.name !== StepName.Cross) {
                    const stepTimeMs = step.time * 1000;
                    const capMs = Math.min(aufMs, stepTimeMs);
                    const deltaSec = capMs / 1000;
                    step.recognitionTime = Math.max(0, step.recognitionTime - deltaSec);
                    step.executionTime += deltaSec;
                    step.preAufTime = deltaSec;
                }
                delete (step as any)._moveTimings;
                delete (step as any).aufDurationMs;
                delete (step as any)._csvCumulativeTimeSec;
                if (prevEndTsMs != null && step.time > 0) {
                    prevEndTsMs += step.time * 1000;
                }
            }
        }
        obj.recognitionTime = obj.steps.reduce((s, st) => s + st.recognitionTime, 0);
        obj.executionTime = obj.steps.reduce((s, st) => s + st.executionTime, 0);
        obj.preAufTime = obj.steps.reduce((s, st) => s + st.preAufTime, 0);
        obj.postAufTime = obj.steps.reduce((s, st) => s + st.postAufTime, 0);
        obj.turns = obj.steps.reduce((s, st) => s + st.turns, 0);

        obj.source = 'cubeast';
        obj.rawSource = 'cubeast';

        return obj;
    });

    formedArr = formedArr.sort((a: Solve, b: Solve) => {
        return a.date.getTime() - b.date.getTime();
    });

    return formedArr;
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
    const header = stringVal.trim().split("\n")[0];

    if (header.includes("id,date,dnf,time,solving_method")) {
        return parseCubeastCsv(stringVal, splitter);
    }

    if (header.includes("solve_id,date,total_time")) {
        return parseAcubemyCsv(stringVal, splitter);
    }

    // default to cubeast parser for backward compatibility
    return parseCubeastCsv(stringVal, splitter);
}