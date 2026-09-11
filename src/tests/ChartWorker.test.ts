import { beforeEach, describe, expect, test } from '@jest/globals';
import { Const } from '../Helpers/Constants';
import { CrossColor, MethodName, Solve, StepName } from '../Helpers/Types';
import { makeCfopSteps, makeDailySolves, makeSolve, makeSolves, makeStep } from './testUtils';

// The worker registers its handler on the global scope at import time.
import '../Workers/chartWorker';

const workerGlobal = globalThis as any;

type WorkerRequest = {
    requestId: number;
    solves: Solve[];
    windowSize: number;
    pointsPerGraph: number;
    steps: StepName[];
    goodTime: number;
    badTime: number;
    methodName: MethodName;
    use4SegmentTiming: boolean;
    isDark: boolean;
};

const ALL_CFOP_STEPS = Const.MethodSteps[MethodName.CFOP];

function run(overrides: Partial<WorkerRequest> = {}): Record<string, any> {
    const posted: any[] = [];
    workerGlobal.postMessage = (msg: any) => posted.push(msg);
    const request: WorkerRequest = {
        requestId: 1,
        solves: makeSolves(20),
        windowSize: 5,
        pointsPerGraph: 500,
        steps: ALL_CFOP_STEPS,
        goodTime: 15,
        badTime: 25,
        methodName: MethodName.CFOP,
        use4SegmentTiming: false,
        isDark: false,
        ...overrides,
    };
    workerGlobal.onmessage({ data: request } as MessageEvent);
    expect(posted).toHaveLength(1);
    return posted[0];
}

describe('chartWorker message handling', () => {
    beforeEach(() => {
        expect(typeof workerGlobal.onmessage).toBe('function');
    });

    test('echoes the requestId so stale responses can be discarded', () => {
        expect(run({ requestId: 42 }).requestId).toBe(42);
    });

    test('returns every chart the panel renders', () => {
        const { chartData } = run();
        const expectedKeys = [
            'runningAverage', 'runningStdDev', 'runningTps', 'runningTurns',
            'runningRecognitionExecution', 'runningEfficiency', 'histogram', 'stepAverages',
            'runningColorPercentages', 'dailyRecord', 'streakRows', 'recordRows', 'goodBad',
            'recordHistory', 'stepPercentages', 'typicalCompare', 'bestSolvesData',
        ];
        expectedKeys.forEach(key => expect(chartData).toHaveProperty(key));
    });

    test('handles an empty solve list without throwing', () => {
        const { chartData } = run({ solves: [] });
        expect(chartData.runningAverage.datasets[0].data).toHaveLength(0);
        expect(chartData.stepAverages.datasets).toHaveLength(0);
        expect(chartData.bestSolvesData).toHaveLength(0);
    });

    test('applies the color palette to chart datasets', () => {
        const { chartData } = run();
        expect(chartData.runningAverage.datasets[0].borderColor).toMatch(/^rgb\(/);
    });

    test('gives each doughnut slice of stepPercentages its own color', () => {
        const { chartData } = run();
        expect(Array.isArray(chartData.stepPercentages.datasets[0].backgroundColor)).toBe(true);
    });

    test('uses different palettes for light and dark mode', () => {
        const light = run({ isDark: false }).chartData.runningAverage.datasets[0].borderColor;
        const dark = run({ isDark: true }).chartData.runningAverage.datasets[0].borderColor;
        expect(dark).not.toBe(light);
    });
});

describe('chartWorker OLL/PLL category charts', () => {
    test('includes the OLL category chart only when OLL is a selected step', () => {
        expect(run({ steps: ALL_CFOP_STEPS }).chartData.ollCategory).toBeDefined();
        expect(run({ steps: [StepName.Cross] }).chartData.ollCategory).toBeUndefined();
    });

    test('includes the PLL category chart only when PLL is a selected step', () => {
        expect(run({ steps: ALL_CFOP_STEPS }).chartData.pllCategory).toBeDefined();
        expect(run({ steps: [StepName.Cross] }).chartData.pllCategory).toBeUndefined();
    });

    test('omits case data unless a single last-layer step is selected', () => {
        const { chartData } = run({ steps: ALL_CFOP_STEPS });
        expect(chartData.caseData).toBeUndefined();
        expect(chartData.algoPracticeRows).toBeUndefined();
    });
});

describe('chartWorker case data', () => {
    function ollSolves(): Solve[] {
        return [
            makeSolve({
                id: 'a', recognitionTime: 1, executionTime: 2,
                steps: [makeStep(StepName.OLL, 3, { case: 'Sune', moves: "R U R' U R U2 R'", turns: 7 })],
            }),
            makeSolve({
                id: 'b', recognitionTime: 3, executionTime: 4,
                steps: [makeStep(StepName.OLL, 7, { case: 'Anti Sune', moves: "R U2 R' U' R U' R'", turns: 7 })],
            }),
        ];
    }

    test('builds one label per case, slowest case first', () => {
        const { chartData } = run({ solves: ollSolves(), steps: [StepName.OLL], windowSize: 2 });
        expect(chartData.caseData.labels).toEqual(['Anti Sune', 'Sune']);
    });

    test('splits recognition and execution into separate datasets', () => {
        const { chartData } = run({ solves: ollSolves(), steps: [StepName.OLL], windowSize: 2 });
        expect(chartData.caseData.datasets).toHaveLength(2);
        expect(chartData.caseData.datasets[0].data[0]).toBeCloseTo(3);
    });

    test('keeps semantic segment colors instead of the generic palette', () => {
        const { chartData } = run({ solves: ollSolves(), steps: [StepName.OLL], windowSize: 2 });
        expect(chartData.caseData.datasets[0].backgroundColor).toBe('rgb(54, 162, 235)');
    });

    test('splits out pre-AUF and post-AUF when 4-segment timing is on', () => {
        const solves = [
            makeSolve({
                id: 'a', preAufTime: 0.4, postAufTime: 0.3, executionTime: 3,
                steps: [makeStep(StepName.PLL, 3, { case: 'T', moves: "U R U R' U'", turns: 5 })],
            }),
        ];
        const { chartData } = run({ solves, steps: [StepName.PLL], windowSize: 5, use4SegmentTiming: true });
        const labels = chartData.caseData.datasets.map((d: any) => d.label);
        expect(labels.some((l: string) => l.startsWith('Pre-AUF'))).toBe(true);
        expect(labels.some((l: string) => l.startsWith('Post-AUF'))).toBe(true);
    });

    test('hides AUF datasets when no solve spent time on AUF', () => {
        const { chartData } = run({ solves: ollSolves(), steps: [StepName.OLL], windowSize: 2, use4SegmentTiming: true });
        const labels = chartData.caseData.datasets.map((d: any) => d.label);
        expect(labels.some((l: string) => l.startsWith('Pre-AUF'))).toBe(false);
        expect(labels.some((l: string) => l.startsWith('Post-AUF'))).toBe(false);
    });

    test('ignores solves whose selected step has no case', () => {
        const solves = [...ollSolves(), makeSolve({ id: 'c', steps: [makeStep(StepName.OLL, 2)] })];
        const { chartData } = run({ solves, steps: [StepName.OLL], windowSize: 5 });
        expect(chartData.caseData.labels).toHaveLength(2);
    });

    test('builds an algorithm practice row per non-solved case', () => {
        const { chartData } = run({ solves: ollSolves(), steps: [StepName.OLL], windowSize: 2 });
        expect(chartData.algoPracticeRows).toHaveLength(2);
        const row = chartData.algoPracticeRows.find((r: any) => r.case === 'Sune');
        expect(row.total).toBe(1);
        expect(row.failureRate).toMatch(/%$/);
        expect(row.avgTime).toBe('3.000');
    });
});

describe('chartWorker streaks', () => {
    test('counts a streak of consecutive days under the target', () => {
        const solves = makeDailySolves(5, [8]);
        const { chartData } = run({ solves });
        const subTen = chartData.streakRows.find((r: any) => r.time === 'Sub-10');
        expect(subTen.longeststreak).toBe('5');
    });

    test('marks the current streak with a flame when it is also the longest', () => {
        const solves = makeDailySolves(5, [8]);
        const { chartData } = run({ solves });
        const subTen = chartData.streakRows.find((r: any) => r.time === 'Sub-10');
        expect(subTen.currentstreak).toBe('5 🔥');
    });

    test('breaks the streak on a day slower than the target', () => {
        const solves = makeDailySolves(5, [8, 8, 30, 8, 8]);
        const { chartData } = run({ solves });
        const subTen = chartData.streakRows.find((r: any) => r.time === 'Sub-10');
        expect(subTen.longeststreak).toBe('2');
        expect(subTen.currentstreak).toBe('2 🔥');
    });

    test('breaks the streak when a day is skipped entirely', () => {
        const solves = makeDailySolves(3, [8]);
        const gap = makeSolve({ id: 'gap', date: new Date('2024-02-01T12:00:00Z'), time: 8 });
        const { chartData } = run({ solves: [...solves, gap] });
        const subTen = chartData.streakRows.find((r: any) => r.time === 'Sub-10');
        expect(subTen.longeststreak).toBe('3');
        expect(subTen.currentstreak).toBe('1');
    });

    test('reports no streak when every day is above the target', () => {
        const solves = makeDailySolves(4, [40]);
        const { chartData } = run({ solves });
        const subTen = chartData.streakRows.find((r: any) => r.time === 'Sub-10');
        expect(subTen.longeststreak).toBe('0');
        expect(subTen.currentstreak).toBe('0');
    });

    test('always reports the six streak targets', () => {
        const { chartData } = run();
        expect(chartData.streakRows.map((r: any) => r.time))
            .toEqual(['Sub-5', 'Sub-10', 'Sub-15', 'Sub-20', 'Sub-30', 'Overall']);
    });

    test('keeps only the fastest solve of each day', () => {
        const day = new Date('2024-03-01T12:00:00Z');
        const solves = [
            makeSolve({ id: 'slow', date: day, time: 30 }),
            makeSolve({ id: 'fast', date: day, time: 9 }),
        ];
        const { chartData } = run({ solves });
        const subTen = chartData.streakRows.find((r: any) => r.time === 'Sub-10');
        expect(subTen.longeststreak).toBe('1');
    });
});

describe('chartWorker records', () => {
    test('reports the fastest single', () => {
        const solves = makeDailySolves(10, [20, 19, 11, 25, 30, 18, 17, 16, 15, 14]);
        const { chartData } = run({ solves });
        const single = chartData.recordRows.find((r: any) => r.recordType === 'Single');
        expect(single.time).toBe('11.000');
    });

    test('reports Infinity for averages that need more solves than exist', () => {
        const { chartData } = run({ solves: makeSolves(3) });
        const ao12 = chartData.recordRows.find((r: any) => r.recordType === 'Ao12');
        expect(ao12.time).toBe('Infinity');
    });

    test('record history only moves downward', () => {
        const solves = makeDailySolves(6, [20, 25, 15, 30, 10, 12]);
        const { chartData } = run({ solves });
        const singles = chartData.recordHistory.datasets.find((d: any) => d.label === 'Record Single');
        const ys = singles.data.map((p: any) => p.y);
        expect(ys).toEqual([20, 15, 10]);
    });

    test('record history exposes a dataset per record type', () => {
        const { chartData } = run();
        expect(chartData.recordHistory.datasets.map((d: any) => d.label))
            .toEqual(['Record Single', 'Record Ao5', 'Record Ao12', 'Record Ao100']);
    });

    test('lists the fastest solves, capped and sorted ascending', () => {
        const solves = makeDailySolves(Const.FastestSolvesCount + 10, [30, 20, 10]);
        const { chartData } = run({ solves });
        expect(chartData.bestSolvesData).toHaveLength(Const.FastestSolvesCount);
        expect(Number(chartData.bestSolvesData[0].time))
            .toBeLessThanOrEqual(Number(chartData.bestSolvesData[1].time));
    });

    test('flags full-step solves in the fastest solves table', () => {
        const solves = [makeSolve({ isFullStep: true }), makeSolve({ id: 'b', isFullStep: false })];
        const { chartData } = run({ solves });
        const flags = chartData.bestSolvesData.map((s: any) => s.fullstep);
        expect(flags).toContain('Yes 🔥');
        expect(flags).toContain('No');
    });
});

describe('chartWorker daily records', () => {
    test('produces one sorted label per day', () => {
        const solves = makeDailySolves(3, [20, 15, 25]);
        const { chartData } = run({ solves });
        expect(chartData.dailyRecord.labels).toHaveLength(3);
        expect([...chartData.dailyRecord.labels].sort()).toEqual(chartData.dailyRecord.labels);
    });

    test('plots the fastest time of each day', () => {
        const day = new Date('2024-04-01T12:00:00Z');
        const solves = [
            makeSolve({ id: 'a', date: day, time: 22 }),
            makeSolve({ id: 'b', date: day, time: 13 }),
        ];
        const { chartData } = run({ solves });
        expect(chartData.dailyRecord.datasets[0].data).toEqual([13]);
    });
});

describe('chartWorker step averages', () => {
    test('creates one dataset per selected step', () => {
        const { chartData } = run({ steps: ALL_CFOP_STEPS });
        expect(chartData.stepAverages.datasets).toHaveLength(ALL_CFOP_STEPS.length);
    });

    test('labels each dataset with the step name and window size', () => {
        const { chartData } = run({ steps: [StepName.OLL], windowSize: 5 });
        expect(chartData.stepAverages.datasets[0].label).toBe('OLL Average of 5');
    });

    test('returns empty data when no steps are selected', () => {
        const { chartData } = run({ steps: [] });
        expect(chartData.stepAverages.datasets).toHaveLength(0);
        expect(chartData.stepAverages.labels).toHaveLength(0);
    });

    test('labels line up with the data points', () => {
        const { chartData } = run({ steps: [StepName.Cross], windowSize: 5 });
        expect(chartData.stepAverages.labels).toHaveLength(chartData.stepAverages.datasets[0].data.length);
    });
});

describe('chartWorker efficiency', () => {
    const efficientSolve = () =>
        makeSolve({ steps: makeCfopSteps().map(s => ({ ...s, moves: "R U R' F" })) });
    const wastefulSolve = () =>
        makeSolve({ id: 'w', steps: makeCfopSteps().map(s => ({ ...s, moves: "R R' U F" })) });

    test('returns empty data for no solves', () => {
        const { chartData } = run({ solves: [] });
        expect(chartData.runningEfficiency.datasets).toHaveLength(0);
    });

    test('reports 100% efficiency when no moves are cancellable', () => {
        const solves = Array.from({ length: 6 }, efficientSolve);
        const { chartData } = run({ solves, windowSize: 5 });
        expect(chartData.runningEfficiency.datasets[0].data[0]).toBeCloseTo(100);
    });

    test('drops below 100% when moves cancel out', () => {
        const solves = Array.from({ length: 6 }, wastefulSolve);
        const { chartData } = run({ solves, windowSize: 5 });
        expect(chartData.runningEfficiency.datasets[0].data[0]).toBeLessThan(100);
    });

    test('adds OLL and PLL success datasets when all CFOP steps are selected', () => {
        const solves = Array.from({ length: 6 }, efficientSolve);
        const { chartData } = run({ solves, windowSize: 5, steps: ALL_CFOP_STEPS });
        const labels = chartData.runningEfficiency.datasets.map((d: any) => d.label);
        expect(labels.some((l: string) => l.startsWith('OLL success'))).toBe(true);
        expect(labels.some((l: string) => l.startsWith('PLL success'))).toBe(true);
    });

    test('omits success datasets when only a subset of steps is selected', () => {
        const solves = Array.from({ length: 6 }, efficientSolve);
        const { chartData } = run({ solves, windowSize: 5, steps: [StepName.OLL] });
        expect(chartData.runningEfficiency.datasets).toHaveLength(1);
    });

    test('omits the OLL dataset for methods without a single-look OLL step', () => {
        const solves = Array.from({ length: 6 }, efficientSolve);
        const { chartData } = run({
            solves,
            windowSize: 5,
            methodName: MethodName.CFOP_2OLL,
            steps: Const.MethodSteps[MethodName.CFOP_2OLL],
        });
        const labels = chartData.runningEfficiency.datasets.map((d: any) => d.label);
        expect(labels.some((l: string) => l.startsWith('OLL success'))).toBe(false);
        expect(labels.some((l: string) => l.startsWith('PLL success'))).toBe(true);
    });

    test('omits both success datasets for methods with neither OLL nor PLL', () => {
        const solves = Array.from({ length: 6 }, efficientSolve);
        const { chartData } = run({
            solves,
            windowSize: 5,
            methodName: MethodName.Roux,
            steps: Const.MethodSteps[MethodName.Roux],
        });
        expect(chartData.runningEfficiency.datasets).toHaveLength(1);
    });
});

describe('chartWorker inspection charts', () => {
    test('builds inspection charts when Cubeast solves report inspection time', () => {
        const { chartData } = run({ solves: makeSolves(10, { inspectionTime: 9 }) });
        expect(chartData.inspection).not.toBeNull();
        expect(chartData.runningInspection).not.toBeNull();
    });

    test('suppresses inspection charts for Acubemy-only data', () => {
        const { chartData } = run({ solves: makeSolves(10, { source: 'acubemy', inspectionTime: null }) });
        expect(chartData.inspection).toBeNull();
        expect(chartData.runningInspection).toBeNull();
    });

    test('suppresses inspection charts when no solve reports inspection time', () => {
        const { chartData } = run({ solves: makeSolves(10, { inspectionTime: null }) });
        expect(chartData.inspection).toBeNull();
        expect(chartData.runningInspection).toBeNull();
    });

    test('only Cubeast solves contribute when sources are mixed', () => {
        const solves = [
            ...makeSolves(5, { inspectionTime: 5 }),
            ...makeSolves(5, { source: 'acubemy', inspectionTime: null }),
        ];
        const { chartData } = run({ solves, windowSize: 5 });
        expect(chartData.runningInspection.datasets[0].data).toHaveLength(1);
    });
});

describe('chartWorker cross color chart', () => {
    test('adds an Unknown series only when some cross color is unknown', () => {
        const known = run({ solves: makeSolves(10) }).chartData.runningColorPercentages;
        const unknown = run({ solves: makeSolves(10, { crossColor: CrossColor.Unknown }) })
            .chartData.runningColorPercentages;
        expect(known.datasets).toHaveLength(6);
        expect(unknown.datasets).toHaveLength(7);
    });
});
