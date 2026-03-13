import { Const } from "./Constants";
import { GetEmptySolve } from "./CubeHelpers";
import { Solve, CrossColor, MethodName, StepName } from "./Types";
import moment from 'moment';

const AUF_MOVES = new Set(['U', "U'", 'U2', "U2'", "U3", "U3'"]);

/** Returns duration in ms of leading AUF moves (U, U', U2, U2') from step_N_recorded_moves. */
function computeAufDurationMs(recordedMoves: string): number {
    if (!recordedMoves || !recordedMoves.trim()) return 0;
    const tokens = recordedMoves.trim().split(/\s+/);
    let firstAufTs: number | null = null;
    let lastAufTs: number | null = null;
    for (const token of tokens) {
        const m = token.match(/^(.+)\[(\d+)\]$/);
        if (!m) continue;
        const move = m[1];
        const ts = Number(m[2]);
        if (AUF_MOVES.has(move)) {
            if (firstAufTs == null) firstAufTs = ts;
            lastAufTs = ts;
        } else {
            if (firstAufTs != null) return Math.max(0, ts - firstAufTs);
            return 0;
        }
    }
    if (firstAufTs != null && lastAufTs != null) return Math.max(0, lastAufTs - firstAufTs);
    return 0;
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

function tokenizeMoves(raw: string | undefined | null): string[] {
    const normalized = normalizeMovesString(raw);
    if (!normalized) return [];
    return normalized
        .split(/\s+/)
        .filter((token) => token.length > 0);
}

function parseCubeastCsv(stringVal: string, splitter: string): Solve[] {

    // Replace commas inside [...] so split(splitter) does not break on e.g. step case "[FL,BR]->FR 30".
    // Preserves bracket content (including timestamps in step_N_recorded_moves) for AUF parsing.
    const normalized = stringVal.trim().replace(/\[[^\]]*\]/g, (m) => m.replace(/,/g, COMMA_PLACEHOLDER));

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
                console.log("Unknown solution rotation: ", value);
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
        "recorded_moves": (step, value) => {
            const aufMs = computeAufDurationMs(value);
            if (aufMs > 0) (step as any).aufDurationMs = aufMs;
        },
    };

    let formedArr = rest.map((item) => {
        let obj = GetEmptySolve();

        keys.forEach((key, index) => {
            if (key.startsWith("step_")) {
                const stepIndex = +key[5];
                const stepKey = key.split("_").slice(2).join("_");
                stepKeyMap[stepKey]?.(obj.steps[stepIndex], item[index]);
            } else {
                keyMap[key]?.(obj, item[index]);
            }
        });

        // Apply AUF adjustment: move leading AUF time from recognition to execution per step,
        // but do not apply this fix to the Cross step.
        const stepTimeMs = (s: { time: number }) => s.time * 1000;
        for (const step of obj.steps) {
            if (step.name === StepName.Cross) continue;
            const aufMs = (step as any).aufDurationMs as number | undefined;
            if (aufMs == null || aufMs <= 0) continue;
            const capMs = Math.min(aufMs, stepTimeMs(step));
            const deltaSec = capMs / 1000;
            step.recognitionTime = Math.max(0, step.recognitionTime - deltaSec);
            step.executionTime += deltaSec;
            delete (step as any).aufDurationMs;
        }
        obj.recognitionTime = obj.steps.reduce((s, st) => s + st.recognitionTime, 0);
        obj.executionTime = obj.steps.reduce((s, st) => s + st.executionTime, 0);

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
    const ROTATIONS = new Set([
        "x", "x'", "x2",
        "y", "y'", "y2",
        "z", "z'", "z2",
    ]);

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

    const countNonRotationMoves = (moves: string | undefined | null): number => {
        const tokens = tokenizeMoves(moves);
        if (!tokens.length) return 0;
        return tokens.filter((token) => !ROTATIONS.has(token.toLowerCase())).length;
    };
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
        get: (name: string) => string,
        countMoves: (moves: string | undefined | null) => number
    ) => {
        for (const def of ACUBEMY_STEP_DEFS) {
            const s = steps[def.index];
            const moves = get(def.movesField);
            s.name = def.name;
            s.time = 0;
            s.recognitionTime = 0;
            s.executionTime = 0;
            s.turns = countMoves(moves);
            if (moves) {
                s.moves = moves;
            }
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
        solutionMoves: string | undefined | null,
        countMoves: (moves: string | undefined | null) => number
    ) => {
        const totalTurns = countMoves(solutionMoves);
        solve.turns = totalTurns;
        if (solve.time > 0) {
            solve.tps = totalTurns / solve.time;
        } else {
            solve.tps = 0;
        }
    };

    type StepRange = {
        startIdx: number;
        endIdx: number;
        firstNonIdx: number | null;
        lastNonIdx: number | null;
    };

    const recomputeAcubemyStepTimes = (
        solve: Solve,
        stepDefs: AcubemyStepDef[],
        solutionMovesRaw: string | undefined | null,
        moveTimesRaw: string | undefined | null,
        rotations: Set<string>
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
                let firstNon: number | null = null;
                let lastNon: number | null = null;
                for (let k = 0; k < tokens.length; k++) {
                    const globalIdx = i + k;
                    const move = solutionTokens[globalIdx];
                    if (!rotations.has(move.toLowerCase())) {
                        if (firstNon == null) firstNon = globalIdx;
                        lastNon = globalIdx;
                    }
                }
                return {
                    startIdx: i,
                    endIdx: i + tokens.length - 1,
                    firstNonIdx: firstNon,
                    lastNonIdx: lastNon,
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

        let prevLastNonIdx: number | null = null;
        let accumulatedRecMs = 0;
        let accumulatedExecMs = 0;

        for (const def of stepDefs) {
            const s = steps[def.index];
            const range = stepRanges[def.index];

            if (!range || range.firstNonIdx == null || range.lastNonIdx == null) {
                s.recognitionTime = 0;
                s.executionTime = 0;
                s.time = 0;
                s.tps = 0;
                continue;
            }

            const execStartMs = timeTokens[range.firstNonIdx];
            const execEndMs = timeTokens[range.lastNonIdx];
            const execMs = Math.max(0, execEndMs - execStartMs);

            let recStartMs: number;
            if (prevLastNonIdx == null) {
                recStartMs = timeTokens[0];
            } else {
                recStartMs = timeTokens[prevLastNonIdx];
            }
            const recEndMs = execStartMs;
            const recMs = Math.max(0, recEndMs - recStartMs);

            s.executionTime = execMs / 1000;
            s.recognitionTime = recMs / 1000;
            s.time = s.executionTime + s.recognitionTime;

            if (s.time > 0 && s.turns > 0) {
                s.tps = s.turns / s.time;
            }

            accumulatedExecMs += execMs;
            accumulatedRecMs += recMs;
            prevLastNonIdx = range.lastNonIdx;
        }

        solve.executionTime = accumulatedExecMs / 1000;
        solve.recognitionTime = accumulatedRecMs / 1000;
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

        solve.scramble = get("scramble");

        solve.session = get("session_name");

        const analysisType = get("analysis_type");
        if (analysisType && analysisType.toUpperCase().includes("CFOP")) {
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

        initAcubemySteps(steps, get, countNonRotationMoves);
        normalizeAcubemyLastLayerCases(steps, ollCaseRaw, pllCaseRaw);

        const solutionMoves = get("solution") || get("raw_solution");
        computeAcubemySolveTurnsAndTps(solve, solutionMoves, countNonRotationMoves);

        const moveTimesRaw = get("move_times");
        if (solutionMoves && moveTimesRaw && moveTimesRaw.trim().length > 0) {
            recomputeAcubemyStepTimes(
                solve,
                ACUBEMY_STEP_DEFS,
                solutionMoves,
                moveTimesRaw,
                ROTATIONS
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