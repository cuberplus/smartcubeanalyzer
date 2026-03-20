import { describe, expect, test } from '@jest/globals';
import {
    buildRunningAverageData,
    buildRunningStdDevData,
    buildRunningTpsData,
    buildRunningInspectionData,
    buildRunningTurnsData,
    buildRunningRecognitionExecution,
    buildHistogramData,
    buildGoodBadData,
    buildRunningColorPercentages,
    buildStepPercentages,
    buildOllCategoryChart,
    buildPllCategoryChart,
    buildInspectionData,
    shouldShowInspectionCharts,
    buildTypicalCompare,
} from '../Helpers/ChartDataBuilders';
import { CrossColor, MethodName, Solve, StepName } from '../Helpers/Types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeStep(name: StepName, time: number, caseName = '') {
    return {
        name, time,
        executionTime: time * 0.7,
        recognitionTime: time * 0.3,
        preAufTime: 0,
        postAufTime: 0,
        turns: 5,
        tps: 5 / time,
        moves: '',
        case: caseName,
    };
}

function makeSolve(overrides: Partial<Solve> = {}): Solve {
    return {
        id: 'test',
        source: 'cubeast',
        time: 20,
        date: new Date('2024-01-01'),
        crossColor: CrossColor.White,
        scramble: '',
        tps: 5,
        inspectionTime: 8,
        recognitionTime: 2,
        executionTime: 18,
        preAufTime: 0,
        postAufTime: 0,
        turns: 50,
        steps: [
            makeStep(StepName.Cross,  2),
            makeStep(StepName.F2L_1,  4),
            makeStep(StepName.F2L_2,  4),
            makeStep(StepName.F2L_3,  4),
            makeStep(StepName.F2L_4,  4),
            makeStep(StepName.OLL,    3, 'Solved'),
            makeStep(StepName.PLL,    3, 'Solved'),
        ],
        isCorrupt: false,
        method: MethodName.CFOP,
        session: '',
        isMistake: false,
        isFullStep: true,
        ...overrides,
    };
}

function makeSolves(count: number, overrides: Partial<Solve> = {}): Solve[] {
    return Array.from({ length: count }, () => makeSolve(overrides));
}

// ── buildRunningAverageData ───────────────────────────────────────────────────

describe('buildRunningAverageData', () => {
    test('returns empty datasets when solves < windowSize', () => {
        const result = buildRunningAverageData(makeSolves(3), 5, 500);
        expect(result.datasets[0].data).toHaveLength(0);
        expect(result.labels).toHaveLength(0);
    });

    test('labels and data have the same length', () => {
        const solves = makeSolves(10);
        const result = buildRunningAverageData(solves, 5, 500);
        expect(result.labels).toHaveLength(result.datasets[0].data.length);
    });

    test('average is correct for uniform solve times', () => {
        const solves = makeSolves(5, { time: 15 });
        const result = buildRunningAverageData(solves, 5, 500);
        // window = 5, all times 15 → single average = 15
        expect(result.datasets[0].data[0]).toBeCloseTo(15);
    });

    test('dataset label contains window size', () => {
        const result = buildRunningAverageData(makeSolves(5), 5, 500);
        expect(result.datasets[0].label).toContain('5');
    });
});

// ── buildRunningStdDevData ────────────────────────────────────────────────────

describe('buildRunningStdDevData', () => {
    test('returns empty datasets when solves < windowSize', () => {
        const result = buildRunningStdDevData(makeSolves(3), 5, 500);
        expect(result.datasets[0].data).toHaveLength(0);
    });

    test('std dev is 0 for identical times', () => {
        const solves = makeSolves(5, { time: 20 });
        const result = buildRunningStdDevData(solves, 5, 500);
        expect(result.datasets[0].data[0]).toBeCloseTo(0);
    });

    test('std dev is positive for varying times', () => {
        const times = [10, 15, 20, 25, 30];
        const solves = times.map(t => makeSolve({ time: t }));
        const result = buildRunningStdDevData(solves, 5, 500);
        expect(result.datasets[0].data[0] as number).toBeGreaterThan(0);
    });
});

// ── buildRunningTpsData ───────────────────────────────────────────────────────

describe('buildRunningTpsData', () => {
    test('returns two datasets (average TPS and execution TPS)', () => {
        const result = buildRunningTpsData(makeSolves(5), 5, 500);
        expect(result.datasets).toHaveLength(2);
    });

    test('returns empty data when solves < windowSize', () => {
        const result = buildRunningTpsData(makeSolves(3), 5, 500);
        expect(result.datasets[0].data).toHaveLength(0);
        expect(result.datasets[1].data).toHaveLength(0);
    });
});

// ── buildRunningInspectionData / buildRunningTurnsData ────────────────────────

describe('buildRunningInspectionData', () => {
    test('returns correct average for uniform inspection times', () => {
        const solves = makeSolves(5, { inspectionTime: 10 }) as Array<Solve & { inspectionTime: number }>;
        const result = buildRunningInspectionData(solves, 5, 500);
        expect(result.datasets[0].data[0]).toBeCloseTo(10);
    });
});

describe('buildRunningTurnsData', () => {
    test('returns correct average for uniform turn counts', () => {
        const solves = makeSolves(5, { turns: 40 });
        const result = buildRunningTurnsData(solves, 5, 500);
        expect(result.datasets[0].data[0]).toBeCloseTo(40);
    });
});

// ── buildRunningRecognitionExecution ─────────────────────────────────────────

describe('buildRunningRecognitionExecution', () => {
    test('2-segment mode returns recognition and execution datasets', () => {
        const result = buildRunningRecognitionExecution(makeSolves(5), 5, 500, false);
        expect(result.datasets).toHaveLength(2);
        expect(result.datasets[0].label).toContain('Recognition');
        expect(result.datasets[1].label).toContain('Execution');
    });

    test('4-segment mode with no pre/post AUF returns recognition + execution only', () => {
        // All preAufTime and postAufTime are 0 (default makeStep)
        const result = buildRunningRecognitionExecution(makeSolves(5), 5, 500, true);
        // hasPreAuf = false, hasPostAuf = false → only recognition + core execution
        expect(result.datasets).toHaveLength(2);
    });

    test('4-segment mode includes pre-AUF dataset when present', () => {
        const solves = makeSolves(5, { preAufTime: 0.3 });
        const result = buildRunningRecognitionExecution(solves, 5, 500, true);
        const labels = result.datasets.map(d => d.label ?? '');
        expect(labels.some(l => l.includes('Pre-AUF'))).toBe(true);
    });

    test('4-segment mode includes post-AUF dataset when present', () => {
        const solves = makeSolves(5, { postAufTime: 0.4 });
        const result = buildRunningRecognitionExecution(solves, 5, 500, true);
        const labels = result.datasets.map(d => d.label ?? '');
        expect(labels.some(l => l.includes('Post-AUF'))).toBe(true);
    });

    test('labels and data lengths match', () => {
        const result = buildRunningRecognitionExecution(makeSolves(10), 5, 500, false);
        for (const ds of result.datasets) {
            expect(ds.data).toHaveLength((result.labels as string[]).length);
        }
    });
});

// ── buildHistogramData ────────────────────────────────────────────────────────

describe('buildHistogramData', () => {
    test('buckets solves by truncated time', () => {
        const solves = [
            makeSolve({ time: 10.2 }),
            makeSolve({ time: 10.9 }),
            makeSolve({ time: 11.5 }),
        ];
        const result = buildHistogramData(solves, 100);
        const labels = result.labels as number[];
        const data = result.datasets[0].data as number[];
        const bucket10 = data[labels.indexOf(10)];
        const bucket11 = data[labels.indexOf(11)];
        expect(bucket10).toBe(2);
        expect(bucket11).toBe(1);
    });

    test('respects windowSize by only using last N solves', () => {
        // First solve (time=5) should be excluded when windowSize=2
        const solves = [
            makeSolve({ time: 5 }),
            makeSolve({ time: 10 }),
            makeSolve({ time: 10 }),
        ];
        const result = buildHistogramData(solves, 2);
        const labels = result.labels as number[];
        expect(labels).not.toContain(5);
        expect(labels).toContain(10);
    });

    test('single solve produces one bucket with count 1', () => {
        const result = buildHistogramData([makeSolve({ time: 15.7 })], 100);
        expect(result.labels).toEqual([15]);
        expect(result.datasets[0].data).toEqual([1]);
    });
});

// ── buildGoodBadData ──────────────────────────────────────────────────────────

describe('buildGoodBadData', () => {
    test('returns empty data when solves < windowSize', () => {
        const result = buildGoodBadData(makeSolves(3), 5, 500, 12, 18);
        expect(result.datasets[0].data).toHaveLength(0);
    });

    test('100% good when all times below goodTime', () => {
        const solves = makeSolves(5, { time: 10 });
        const result = buildGoodBadData(solves, 5, 500, 15, 20);
        expect(result.datasets[0].data[0]).toBeCloseTo(100); // good
    });

    test('100% bad when all times above badTime', () => {
        const solves = makeSolves(5, { time: 25 });
        const result = buildGoodBadData(solves, 5, 500, 15, 20);
        expect(result.datasets[1].data[0]).toBeCloseTo(100); // bad
    });

    test('correct percentages for mixed solves', () => {
        // 2 good (< 12), 1 bad (> 18), 2 neutral — window = 5
        const solves = [10, 11, 15, 19, 20].map(t => makeSolve({ time: t }));
        const result = buildGoodBadData(solves, 5, 500, 12, 18);
        expect(result.datasets[0].data[0]).toBeCloseTo(40); // 2/5 good
        expect(result.datasets[1].data[0]).toBeCloseTo(40); // 2/5 bad
    });
});

// ── buildRunningColorPercentages ──────────────────────────────────────────────

describe('buildRunningColorPercentages', () => {
    test('returns 6 datasets for solves with known cross colors', () => {
        const solves = makeSolves(5, { crossColor: CrossColor.White });
        const result = buildRunningColorPercentages(solves, 5, 500);
        expect(result.datasets).toHaveLength(6); // White, Yellow, Red, Orange, Blue, Green
    });

    test('returns 7 datasets when Unknown cross color is present', () => {
        const solves = [
            ...makeSolves(4, { crossColor: CrossColor.White }),
            makeSolve({ crossColor: CrossColor.Unknown }),
        ];
        const result = buildRunningColorPercentages(solves, 5, 500);
        expect(result.datasets).toHaveLength(7);
    });

    test('100% white when all solves use white cross', () => {
        const solves = makeSolves(5, { crossColor: CrossColor.White });
        const result = buildRunningColorPercentages(solves, 5, 500);
        const whiteDs = result.datasets.find(d => (d.label ?? '').includes('White'))!;
        expect(whiteDs.data[0]).toBeCloseTo(100);
    });
});

// ── buildStepPercentages ──────────────────────────────────────────────────────

describe('buildStepPercentages', () => {
    test('labels match the provided steps', () => {
        const steps = [StepName.OLL, StepName.PLL];
        const result = buildStepPercentages(makeSolves(3), steps, 100);
        expect(result.labels).toEqual([StepName.OLL, StepName.PLL]);
    });

    test('values are average step times', () => {
        // OLL=3s, PLL=3s in makeStep defaults
        const solves = makeSolves(3);
        const result = buildStepPercentages(solves, [StepName.OLL, StepName.PLL], 100);
        const data = result.datasets[0].data as number[];
        expect(data[0]).toBeCloseTo(3); // OLL avg
        expect(data[1]).toBeCloseTo(3); // PLL avg
    });

    test('returns correct shape for single step', () => {
        const result = buildStepPercentages(makeSolves(5), [StepName.OLL], 100);
        expect(result.labels).toHaveLength(1);
        expect(result.datasets[0].data).toHaveLength(1);
    });
});

// ── buildOllCategoryChart / buildPllCategoryChart ─────────────────────────────

describe('buildOllCategoryChart', () => {
    test('returns 4 datasets (Dot, Line, Angle, Cross)', () => {
        const result = buildOllCategoryChart(makeSolves(5), 5, 500);
        expect(result.datasets).toHaveLength(4);
    });

    test('100% Cross when all OLL cases are Solved', () => {
        // 'Solved' maps to OllEdgeOrientation.Cross
        const solves = makeSolves(5); // makeStep sets OLL case = 'Solved'
        const result = buildOllCategoryChart(solves, 5, 500);
        const crossDs = result.datasets.find(d => (d.label ?? '').includes('Cross'))!;
        expect(crossDs.data[0]).toBeCloseTo(100);
    });

    test('100% Dot when all OLL cases are case 1', () => {
        const solves = makeSolves(5).map(s => ({
            ...s,
            steps: s.steps.map(st => st.name === StepName.OLL ? { ...st, case: '1' } : st),
        }));
        const result = buildOllCategoryChart(solves, 5, 500);
        const dotDs = result.datasets.find(d => (d.label ?? '').includes('Dot'))!;
        expect(dotDs.data[0]).toBeCloseTo(100);
    });
});

describe('buildPllCategoryChart', () => {
    test('returns 3 datasets (Solved, Adjacent, Diagonal)', () => {
        const result = buildPllCategoryChart(makeSolves(5), 5, 500);
        expect(result.datasets).toHaveLength(3);
    });

    test('100% Solved when all PLL cases are Solved', () => {
        const solves = makeSolves(5); // makeStep sets PLL case = 'Solved'
        const result = buildPllCategoryChart(solves, 5, 500);
        const solvedDs = result.datasets.find(d => (d.label ?? '').includes('Solved'))!;
        expect(solvedDs.data[0]).toBeCloseTo(100);
    });

    test('100% Adjacent when all PLL cases are T perm', () => {
        // 'T' maps to PllCornerPermutation.Adjacent
        const solves = makeSolves(5).map(s => ({
            ...s,
            steps: s.steps.map(st => st.name === StepName.PLL ? { ...st, case: 'T' } : st),
        }));
        const result = buildPllCategoryChart(solves, 5, 500);
        const adjDs = result.datasets.find(d => (d.label ?? '').includes('Adjacent'))!;
        expect(adjDs.data[0]).toBeCloseTo(100);
    });
});

// ── buildInspectionData ───────────────────────────────────────────────────────

describe('buildInspectionData', () => {
    test('returns 7 chunks (Const.InspectionGraphChunks)', () => {
        const result = buildInspectionData(
            makeSolves(14) as Array<Solve & { inspectionTime: number }>,
            100
        );
        expect(result.labels).toHaveLength(7);
        expect(result.datasets[0].data).toHaveLength(7);
    });

    test('labels are formatted as ~X.XX inspection averages', () => {
        const result = buildInspectionData(
            makeSolves(7, { inspectionTime: 8 }) as Array<Solve & { inspectionTime: number }>,
            100
        );
        expect((result.labels as string[])[0]).toMatch(/^~/);
    });
});

describe('shouldShowInspectionCharts', () => {
    test('returns false when all solves are Acubemy (even if inspection is missing)', () => {
        const solves: Solve[] = [
            { ...makeSolve(), source: 'acubemy', inspectionTime: null },
            { ...makeSolve({ time: 25 }), source: 'acubemy', inspectionTime: null },
        ];
        expect(shouldShowInspectionCharts(solves)).toBe(false);
    });

    test('returns true when at least one non-Acubemy solve has inspectionTime', () => {
        const solves: Solve[] = [
            { ...makeSolve({ time: 20, inspectionTime: 5 }), source: 'cubeast', inspectionTime: 5 },
            { ...makeSolve({ time: 30, inspectionTime: 0 }), source: 'acubemy', inspectionTime: null },
        ];
        expect(shouldShowInspectionCharts(solves)).toBe(true);
    });
});

// ── buildTypicalCompare ───────────────────────────────────────────────────────

describe('buildTypicalCompare', () => {
    test('returns zeroes for empty solves', () => {
        const result = buildTypicalCompare([], 100);
        expect(result.datasets[0].data).toEqual([0, 0, 0, 0]);
        expect(result.datasets[1].data).toEqual([0, 0, 0, 0]);
    });

    test('returns zeroes when average is not finite', () => {
        const solves = makeSolves(1, { time: NaN });
        const result = buildTypicalCompare(solves, 100);
        expect(result.datasets[0].data).toEqual([0, 0, 0, 0]);
    });

    test('your data sums cross + f2l + oll + pll correctly', () => {
        // makeStep: Cross=2, F2L_1-4=4 each (f2l total=16), OLL=3, PLL=3
        const solves = makeSolves(5);
        const result = buildTypicalCompare(solves, 100);
        const [cross, f2l, oll, pll] = result.datasets[0].data as number[];
        expect(cross).toBeCloseTo(2);
        expect(f2l).toBeCloseTo(16);
        expect(oll).toBeCloseTo(3);
        expect(pll).toBeCloseTo(3);
    });

    test('typical data sums to approximately the user average', () => {
        const solves = makeSolves(5, { time: 20 });
        const result = buildTypicalCompare(solves, 100);
        const typical = result.datasets[1].data as number[];
        const typicalTotal = typical.reduce((a, b) => a + b, 0);
        // The typical total is scaled to match the user's average (20s)
        expect(typicalTotal).toBeCloseTo(20, 0);
    });

    test('returns 4 labels (Cross, F2L, OLL, PLL)', () => {
        const result = buildTypicalCompare(makeSolves(5), 100);
        expect(result.labels).toEqual(['Cross', 'F2L', 'OLL', 'PLL']);
    });
});
