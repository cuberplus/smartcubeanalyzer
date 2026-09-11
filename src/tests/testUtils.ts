/**
 * Shared fixtures for building Solve/Step objects in tests.
 * Not a test suite itself - jest's testMatch only picks up *.test.ts(x).
 */
import { CrossColor, MethodName, Solve, Step, StepName } from '../Helpers/Types';

export function makeStep(name: StepName, time: number, overrides: Partial<Step> = {}): Step {
    return {
        name,
        time,
        executionTime: time * 0.7,
        recognitionTime: time * 0.3,
        preAufTime: 0,
        postAufTime: 0,
        turns: 5,
        tps: time > 0 ? 5 / time : 0,
        moves: '',
        case: '',
        ...overrides,
    };
}

export function makeCfopSteps(stepTimes: number[] = [2, 4, 4, 4, 4, 3, 3]): Step[] {
    return [
        makeStep(StepName.Cross, stepTimes[0]),
        makeStep(StepName.F2L_1, stepTimes[1]),
        makeStep(StepName.F2L_2, stepTimes[2]),
        makeStep(StepName.F2L_3, stepTimes[3]),
        makeStep(StepName.F2L_4, stepTimes[4]),
        makeStep(StepName.OLL, stepTimes[5]),
        makeStep(StepName.PLL, stepTimes[6]),
    ];
}

export function makeSolve(overrides: Partial<Solve> = {}): Solve {
    return {
        id: 'test',
        source: 'cubeast',
        rawSourceId: 'raw-test',
        time: 24,
        date: new Date('2024-01-01T12:00:00Z'),
        crossColor: CrossColor.White,
        scramble: "R U R' U'",
        tps: 5,
        inspectionTime: 8,
        recognitionTime: 2,
        executionTime: 18,
        preAufTime: 0,
        postAufTime: 0,
        turns: 50,
        steps: makeCfopSteps(),
        isCorrupt: false,
        method: MethodName.CFOP,
        session: 'default',
        isMistake: false,
        isFullStep: true,
        ...overrides,
    };
}

export function makeSolves(count: number, overrides: Partial<Solve> = {}): Solve[] {
    return Array.from({ length: count }, (_, i) =>
        makeSolve({ id: `solve-${i}`, ...overrides })
    );
}

/** Solves on consecutive days starting at `start`, one solve per day. */
export function makeDailySolves(count: number, times: number[], start = new Date('2024-01-01T12:00:00Z')): Solve[] {
    return Array.from({ length: count }, (_, i) => {
        const date = new Date(start.getTime());
        date.setDate(date.getDate() + i);
        return makeSolve({ id: `solve-${i}`, date, time: times[i % times.length] });
    });
}
