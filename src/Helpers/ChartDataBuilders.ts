/**
 * Pure functions that build chart datasets from solves and options.
 * Used by ChartPanel and can be wrapped in useMemo when using function components.
 */
import type { ChartData } from 'chart.js/auto';
import { Const } from './Constants';
import {
    calculateAverage,
    calculateMovingAverage,
    calculateMovingPercentage,
    calculateMovingStdDev,
    makeLabels,
    reduceDataset,
    splitIntoChunks,
    getTypicalAverages,
} from './MathHelpers';
import { CrossColor, getStep, Solve, StepName } from './Types';
import { OllEdgeOrientation, PllCornerPermutation } from './Types';
import { SEGMENT_COLORS } from './ChartColors';

type MovingCalcFn = (values: number[], windowSize: number) => number[];

function buildMovingLineChart(
    solves: Solve[],
    windowSize: number,
    pointsPerGraph: number,
    series: Array<{ extract: (s: Solve) => number; calcFn: MovingCalcFn; label: string }>
): ChartData<'line'> {
    const allData = series.map(s => s.calcFn(solves.map(s.extract), windowSize));
    const reducedData = allData.map(d => reduceDataset(d, pointsPerGraph));
    const labels = makeLabels(allData[0].length, pointsPerGraph);
    return {
        labels,
        datasets: series.map((s, i) => ({ label: s.label, data: reducedData[i] })),
    };
}

export function buildRunningAverageData(solves: Solve[], windowSize: number, pointsPerGraph: number): ChartData<'line'> {
    return buildMovingLineChart(solves, windowSize, pointsPerGraph, [
        { extract: x => x.time, calcFn: calculateMovingAverage, label: `Average Time Of ${windowSize}` },
    ]);
}

export function buildRunningStdDevData(solves: Solve[], windowSize: number, pointsPerGraph: number): ChartData<'line'> {
    return buildMovingLineChart(solves, windowSize, pointsPerGraph, [
        { extract: x => x.time, calcFn: calculateMovingStdDev, label: `Average StdDev Of ${windowSize}` },
    ]);
}

export function buildRunningTpsData(solves: Solve[], windowSize: number, pointsPerGraph: number): ChartData<'line'> {
    return buildMovingLineChart(solves, windowSize, pointsPerGraph, [
        { extract: x => x.tps, calcFn: calculateMovingAverage, label: `Average TPS Of ${windowSize}` },
        { extract: x => x.executionTime > 0 ? x.turns / x.executionTime : 0, calcFn: calculateMovingAverage, label: `Average TPS During Execution Of ${windowSize}` },
    ]);
}

export function buildRunningInspectionData(
    solves: Array<Solve & { inspectionTime: number }>,
    windowSize: number,
    pointsPerGraph: number
): ChartData<'line'> {
    return buildMovingLineChart(solves, windowSize, pointsPerGraph, [
        { extract: x => x.inspectionTime!, calcFn: calculateMovingAverage, label: `Average Inspection Of ${windowSize}` },
    ]);
}

export function buildRunningTurnsData(solves: Solve[], windowSize: number, pointsPerGraph: number): ChartData<'line'> {
    return buildMovingLineChart(solves, windowSize, pointsPerGraph, [
        { extract: x => x.turns, calcFn: calculateMovingAverage, label: `Average Turns Of ${windowSize}` },
    ]);
}

export function buildRunningRecognitionExecution(
    solves: Solve[],
    windowSize: number,
    pointsPerGraph: number,
    use4SegmentTiming: boolean
): ChartData<'line'> {
    const colors = SEGMENT_COLORS;
    let movingRecognition = calculateMovingAverage(solves.map((x) => x.recognitionTime), windowSize);
    const labels = makeLabels(movingRecognition.length, pointsPerGraph);
    movingRecognition = reduceDataset(movingRecognition, pointsPerGraph);

    if (use4SegmentTiming) {
        const movingPreAuf = reduceDataset(
            calculateMovingAverage(solves.map((x) => x.preAufTime), windowSize),
            pointsPerGraph
        );
        const movingCoreExec = reduceDataset(
            calculateMovingAverage(
                solves.map((x) => x.executionTime - x.preAufTime - x.postAufTime),
                windowSize
            ),
            pointsPerGraph
        );
        const movingPostAuf = reduceDataset(
            calculateMovingAverage(solves.map((x) => x.postAufTime), windowSize),
            pointsPerGraph
        );
        const hasPreAuf = movingPreAuf.some((v) => v > 0);
        const hasPostAuf = movingPostAuf.some((v) => v > 0);
        const datasets: ChartData<'line'>['datasets'] = [
            {
                label: `Average Recognition Of ${windowSize}`,
                data: movingRecognition,
                borderColor: colors.recognition,
                backgroundColor: colors.recognition,
            },
        ];
        if (hasPreAuf) {
            datasets.push({
                label: `Average Pre-AUF Of ${windowSize}`,
                data: movingPreAuf,
                borderColor: colors.preAuf,
                backgroundColor: colors.preAuf,
            });
        }
        datasets.push({
            label: `Average Execution Of ${windowSize}`,
            data: movingCoreExec,
            borderColor: colors.execution,
            backgroundColor: colors.execution,
        });
        if (hasPostAuf) {
            datasets.push({
                label: `Average Post-AUF Of ${windowSize}`,
                data: movingPostAuf,
                borderColor: colors.postAuf,
                backgroundColor: colors.postAuf,
            });
        }
        return { labels, datasets } as ChartData<'line'>;
    }

    const movingExecution = reduceDataset(
        calculateMovingAverage(solves.map((x) => x.executionTime), windowSize),
        pointsPerGraph
    );
    return {
        labels,
        datasets: [
            {
                label: `Average Recognition Of ${windowSize}`,
                data: movingRecognition,
                borderColor: colors.recognition,
                backgroundColor: colors.recognition,
            },
            {
                label: `Average Execution Of ${windowSize}`,
                data: movingExecution,
                borderColor: colors.execution,
                backgroundColor: colors.execution,
            },
        ],
    } as ChartData<'line'>;
}

export function buildHistogramData(solves: Solve[], windowSize: number): ChartData<'bar'> {
    const recentSolves = solves.map((x) => x.time).slice(-windowSize);
    const histogram = new Map<number, number>();
    for (const val of recentSolves) {
        const key = Math.trunc(val);
        histogram.set(key, (histogram.get(key) ?? 0) + 1);
    }
    const arr = Array.from(histogram).sort((a, b) => a[0] - b[0]);
    return {
        labels: arr.map((a) => a[0]),
        datasets: [
            {
                label: `Number of solves by time (of recent ${windowSize})`,
                data: arr.map((a) => a[1]),
            },
        ],
    };
}

export function buildGoodBadData(
    solves: Solve[],
    windowSize: number,
    pointsPerGraph: number,
    goodTime: number,
    badTime: number
): ChartData<'line'> {
    const checkIfBad = (time: number) => time > badTime;
    const checkIfGood = (time: number) => time < goodTime;
    let movingPercentBad = calculateMovingPercentage(
        solves.map((x) => x.time),
        windowSize,
        checkIfBad
    );
    let movingPercentGood = calculateMovingPercentage(
        solves.map((x) => x.time),
        windowSize,
        checkIfGood
    );
    const labels = makeLabels(movingPercentBad.length, pointsPerGraph);
    movingPercentBad = reduceDataset(movingPercentBad, pointsPerGraph);
    movingPercentGood = reduceDataset(movingPercentGood, pointsPerGraph);
    return {
        labels,
        datasets: [
            { label: `Percentage of good solves over last ${windowSize}`, data: movingPercentGood },
            { label: `Percentage of bad solves over last ${windowSize}`, data: movingPercentBad },
        ],
    };
}

export function buildRunningColorPercentages(
    solves: Solve[],
    windowSize: number,
    pointsPerGraph: number,
    isDark?: boolean
): ChartData<'line'> {
    type ColorDef = { color: CrossColor; label: string; borderColor: string; backgroundColor: string };
    const whiteLineColor = isDark ? 'White' : 'Black';
    const colorDefs: ColorDef[] = [
        { color: CrossColor.White, label: 'White', borderColor: whiteLineColor, backgroundColor: whiteLineColor },
        { color: CrossColor.Yellow, label: 'Yellow', borderColor: 'Yellow', backgroundColor: 'Yellow' },
        { color: CrossColor.Red, label: 'Red', borderColor: 'Red', backgroundColor: 'Red' },
        { color: CrossColor.Orange, label: 'Orange', borderColor: 'Orange', backgroundColor: 'Orange' },
        { color: CrossColor.Blue, label: 'Blue', borderColor: 'Blue', backgroundColor: 'Blue' },
        { color: CrossColor.Green, label: 'Green', borderColor: 'Green', backgroundColor: 'Green' },
    ];
    const hasUnknown = solves.some((s) => s.crossColor === CrossColor.Unknown);
    const colors: ColorDef[] = hasUnknown
        ? [...colorDefs, { color: CrossColor.Unknown, label: 'Unknown', borderColor: 'Purple', backgroundColor: 'Purple' }]
        : colorDefs;

    const datasets = colors.map((c) => {
            let movingPercent = calculateMovingPercentage(
                solves.map((x) => x.crossColor),
                windowSize,
                (crossColor: CrossColor) => crossColor === c.color
            );
            movingPercent = reduceDataset(movingPercent, pointsPerGraph);
            return {
                label: `Percentage of solves with ${c.label} cross over last ${windowSize}`,
                data: movingPercent,
                borderColor: c.borderColor,
                backgroundColor: c.backgroundColor,
            };
        }
    );
    const labels = makeLabels(datasets[0].data.length, pointsPerGraph);
    return { labels, datasets };
}

export function buildStepPercentages(
    solves: Solve[],
    steps: StepName[],
    windowSize: number
): ChartData<'doughnut'> {
    const totals: Partial<Record<StepName, number>> = {};
    for (const step of steps) totals[step] = 0;
    const recentSolves = solves.slice(-windowSize);
    const n = recentSolves.length || 1;
    for (const solve of recentSolves) {
        for (const step of steps) {
            const stepData = getStep(solve, step);
            if (stepData) totals[step]! += stepData.time;
        }
    }
    const labels = Object.keys(totals) as string[];
    const values = labels.map((k) => (totals[k as StepName] ?? 0) / n);
    return {
        labels,
        datasets: [
            {
                label: `Seconds each step takes (of recent ${windowSize})`,
                data: values,
            },
        ],
    };
}

function buildCategoryPercentageChart(
    solves: Solve[],
    windowSize: number,
    pointsPerGraph: number,
    stepName: StepName,
    categories: Array<{ predicate: (c: string) => boolean; label: string }>
): ChartData<'line'> {
    const cases = solves.map((x) => getStep(x, stepName)?.case ?? '');
    const datasets = categories.map(({ predicate, label }) => ({
        label,
        data: reduceDataset(calculateMovingPercentage(cases, windowSize, predicate), pointsPerGraph),
    }));
    const labels = makeLabels(datasets[0].data.length, pointsPerGraph);
    return { labels, datasets };
}

export function buildOllCategoryChart(solves: Solve[], windowSize: number, pointsPerGraph: number): ChartData<'line'> {
    return buildCategoryPercentageChart(solves, windowSize, pointsPerGraph, StepName.OLL, [
        { predicate: c => Const.OllEdgeOrientationMapping.get(c) === OllEdgeOrientation.Dot,   label: `Percentage of OLL Dot Cases over last ${windowSize}` },
        { predicate: c => Const.OllEdgeOrientationMapping.get(c) === OllEdgeOrientation.Line,  label: `Percentage of OLL Line Cases over last ${windowSize}` },
        { predicate: c => Const.OllEdgeOrientationMapping.get(c) === OllEdgeOrientation.Angle, label: `Percentage of OLL Angle Cases over last ${windowSize}` },
        { predicate: c => Const.OllEdgeOrientationMapping.get(c) === OllEdgeOrientation.Cross, label: `Percentage of OLL Cross Cases over last ${windowSize}` },
    ]);
}

export function buildPllCategoryChart(solves: Solve[], windowSize: number, pointsPerGraph: number): ChartData<'line'> {
    return buildCategoryPercentageChart(solves, windowSize, pointsPerGraph, StepName.PLL, [
        { predicate: c => Const.PllCornerPermutationMapping.get(c) === PllCornerPermutation.Solved,   label: `Percentage of PLL Solved Corner Cases over last ${windowSize}` },
        { predicate: c => Const.PllCornerPermutationMapping.get(c) === PllCornerPermutation.Adjacent, label: `Percentage of PLL Adjacent Corner Cases over last ${windowSize}` },
        { predicate: c => Const.PllCornerPermutationMapping.get(c) === PllCornerPermutation.Diagonal, label: `Percentage of PLL Diagonal Corner Cases over last ${windowSize}` },
    ]);
}

export function buildInspectionData(
    solves: Array<Solve & { inspectionTime: number }>,
    windowSize: number
): ChartData<'bar'> {
    const recentSolves = solves.slice(-windowSize).sort((a, b) => a.inspectionTime - b.inspectionTime);
    const chunkedArr = splitIntoChunks(recentSolves, Const.InspectionGraphChunks);
    const labels: string[] = [];
    const values: number[] = [];
    for (let i = 0; i < Const.InspectionGraphChunks; i++) {
        labels.push('~' + calculateAverage(chunkedArr[i].map((x) => x.inspectionTime)).toFixed(2));
        values.push(calculateAverage(chunkedArr[i].map((x) => x.time)));
    }
    return {
        labels,
        datasets: [
            {
                label: `Solve time by inspection time (of recent ${windowSize})`,
                data: values,
            },
        ],
    };
}

export function shouldShowInspectionCharts(solves: Solve[]): boolean {
    if (solves.length === 0) return false;
    if (solves.every((s) => s.source === 'acubemy')) return false;
    return solves.some((s) => s.inspectionTime != null);
}

export function buildTypicalCompare(solves: Solve[], windowSize: number): ChartData<'bar'> {
    const labels = ['Cross', 'F2L', 'OLL', 'PLL'];
    const zeroes = [0, 0, 0, 0];
    if (solves.length === 0) {
        return {
            labels,
            datasets: [
                { label: `Your average by step over last ${windowSize}`, data: zeroes },
                { label: `Typical cuber's average by step, using your average time`, data: zeroes },
            ],
        };
    }
    const average = calculateAverage(solves.map((x) => x.time).slice(-windowSize));
    if (!Number.isFinite(average)) {
        return {
            labels,
            datasets: [
                { label: `Your average by step over last ${windowSize}`, data: zeroes },
                { label: `Typical cuber's average by step, using your average time`, data: zeroes },
            ],
        };
    }
    if (!solves[0].steps || solves[0].steps.length < 7) {
        return {
            labels,
            datasets: [
                { label: `Your average by step over last ${windowSize}`, data: zeroes },
                { label: `Typical cuber's average by step, using your average time`, data: zeroes },
            ],
        };
    }
    const crossAverage = calculateAverage(solves.map((x) => getStep(x, StepName.Cross)?.time ?? 0).slice(-windowSize));
    const f2l1 = calculateAverage(solves.map((x) => getStep(x, StepName.F2L_1)?.time ?? 0).slice(-windowSize));
    const f2l2 = calculateAverage(solves.map((x) => getStep(x, StepName.F2L_2)?.time ?? 0).slice(-windowSize));
    const f2l3 = calculateAverage(solves.map((x) => getStep(x, StepName.F2L_3)?.time ?? 0).slice(-windowSize));
    const f2l4 = calculateAverage(solves.map((x) => getStep(x, StepName.F2L_4)?.time ?? 0).slice(-windowSize));
    const ollAverage = calculateAverage(solves.map((x) => getStep(x, StepName.OLL)?.time ?? 0).slice(-windowSize));
    const pllAverage = calculateAverage(solves.map((x) => getStep(x, StepName.PLL)?.time ?? 0).slice(-windowSize));
    const f2lAverage = f2l1 + f2l2 + f2l3 + f2l4;
    const yourAverages = [crossAverage, f2lAverage, ollAverage, pllAverage];
    const typicalAverages = getTypicalAverages(average);
    return {
        labels,
        datasets: [
            { label: `Your average by step over last ${windowSize}`, data: yourAverages },
            { label: `Typical cuber's average by step, using your average time`, data: typicalAverages },
        ],
    };
}
