import { Option } from "react-multi-select-component";
import { Const } from "./Constants";
import { CrossColor, MethodName, Solve, Step, StepName } from "./Types";

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
        inspectionTime: 0,
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
        [MethodName.Roux]: 0
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
    let reducedWindowSize = Math.ceil(solveCount / 4);
    return Math.min(reducedWindowSize, Const.DefaultWindowSize);
}

export function CalculateAllSessionOptions(solves: Solve[]): Option[] {
    let options: Option[] = [];
    let sessions = new Set<string>();
    solves.forEach(x => {
        sessions.add(x.session);
    });
    let uniqueSessions = Array.from(sessions.values());
    uniqueSessions.forEach(x => {
        options.push({ label: x, value: x })

    })
    return options;
}