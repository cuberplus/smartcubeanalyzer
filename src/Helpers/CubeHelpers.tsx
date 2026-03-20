import { Option } from "./Types";
import { Const } from "./Constants";
import { CrossColor, MethodName, Solve, Step, StepName } from "./Types";
import { calculateMovingAverageChopped } from "./MathHelpers";

export function GetEmptyStep() {
    let step: Step = {
        time: 0,
        executionTime: 0,
        recognitionTime: 0,
        preAufTime: 0,
        postAufTime: 0,
        turns: 0,
        tps: 0,
        moves: "",
        case: "",
        name: StepName.Cross
    }

    return step;
}

export function GetEmptySolve() {
    let solve: Solve = {
        id: "",
        source: 'cubeast',
        rawSourceId: "",
        rawSource: "",
        time: 0,
        date: new Date(),
        crossColor: CrossColor.Unknown,
        scramble: "",
        tps: 0,
        recognitionTime: 0,
        inspectionTime: null,
        executionTime: 0,
        preAufTime: 0,
        postAufTime: 0,
        turns: 0,
        steps: [GetEmptyStep(), GetEmptyStep(), GetEmptyStep(), GetEmptyStep(), GetEmptyStep(), GetEmptyStep(), GetEmptyStep(), GetEmptyStep(), GetEmptyStep()],
        isCorrupt: false,
        method: MethodName.CFOP,
        session: "",
        isMistake: false,
        isFullStep: true
    };

    return solve;
}

export function CalculateMostUsedMethod(solves: Solve[]): MethodName {
    let counts: { [id in MethodName]: number } = {
        [MethodName.CFOP]: 0,
        [MethodName.CFOP_2OLL]: 0,
        [MethodName.CFOP_4LL]: 0,
        [MethodName.LayerByLayer]: 0,
        [MethodName.Roux]: 0,
        [MethodName.ZZ]: 0
    }

    let max = 0;
    let method = MethodName.CFOP;

    for (let i = 0; i < solves.length; i++) {
        counts[solves[i].method]++;
        if (counts[solves[i].method] > max) {
            method = solves[i].method;
            max = counts[solves[i].method];
        }
    }

    return method;
}

// If user doesn't have enough solves, choose a smaller window size to show their data
export function CalculateWindowSize(solveCount: number): number {
    if (!Number.isFinite(solveCount) || solveCount <= 0) {
        return 5;
    }

    let reducedWindowSize = Math.ceil(solveCount / 4);
    return Math.max(5, Math.min(reducedWindowSize, Const.DefaultWindowSize));
}

export function CalculateAllSessionOptions(solves: Solve[]): Option[] {
    let options: Option[] = [];
    let sessions = new Set<string>();
    solves.forEach(x => {
        sessions.add(x.session);
    });
    let uniqueSessions = Array.from(sessions.values());
    uniqueSessions.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    uniqueSessions.forEach(x => {
        options.push({ label: x, value: x })

    })
    return options;
}

export function CalculateBenchmarkTimes(solves: Solve[]): { goodTime: number; badTime: number } {
    const validSolves = solves
        .filter(s => !s.isCorrupt)
        .slice()
        .sort((a, b) => a.date.getTime() - b.date.getTime());

    const times = validSolves.map(s => s.time);

    // Keep existing defaults when we cannot compute anything meaningful.
    if (times.length === 0) {
        return { goodTime: 15, badTime: 20 };
    }

    let goodTime: number;
    if (times.length >= 100) {
        const ao100Series = calculateMovingAverageChopped(times, 100, 5);
        const ao100 = ao100Series.length > 0 ? ao100Series[ao100Series.length - 1] : times[times.length - 1];
        goodTime = Math.floor(ao100);
    } else {
        const sum = times.reduce((acc, curr) => acc + curr, 0);
        goodTime = Math.floor(sum / times.length);
    }

    const badTime = Math.ceil(goodTime * 1.25);
    return { goodTime, badTime };
}