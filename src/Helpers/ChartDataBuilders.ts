/**
 * Pure functions that build chart datasets from solves and options.
 * Used by ChartPanel and can be wrapped in useMemo when using function components.
 */
import { ChartData } from 'chart.js/auto';
import { Const } from './Constants';
import {
    calculateAverage,
    calculateMovingAverage,
    calculateMovingPercentage,
    calculateMovingStdDev,
    reduceDataset,
    splitIntoChunks,
    getTypicalAverages,
} from './MathHelpers';
import { CrossColor, Solve, StepName } from './Types';
import { OllEdgeOrientation, PllCornerPermutation } from './Types';

export function buildRunningAverageData(
    solves: Solve[],
    windowSize: number,
    pointsPerGraph: number
): ChartData<'line'> {
    let movingAverage = calculateMovingAverage(solves.map((x) => x.time), windowSize);
    let labels = Array.from({ length: movingAverage.length }, (_, i) => (i + 1).toString());
    movingAverage = reduceDataset(movingAverage, pointsPerGraph);
    labels = reduceDataset(labels, pointsPerGraph);
    return {
        labels,
        datasets: [{ label: `Average Time Of ${windowSize}`, data: movingAverage }],
    };
}

export function buildRunningStdDevData(
    solves: Solve[],
    windowSize: number,
    pointsPerGraph: number
): ChartData<'line'> {
    let movingStdDev = calculateMovingStdDev(solves.map((x) => x.time), windowSize);
    let labels = Array.from({ length: movingStdDev.length }, (_, i) => (i + 1).toString());
    movingStdDev = reduceDataset(movingStdDev, pointsPerGraph);
    labels = reduceDataset(labels, pointsPerGraph);
    return {
        labels,
        datasets: [{ label: `Average StdDev Of ${windowSize}`, data: movingStdDev }],
    };
}

export function buildRunningTpsData(
    solves: Solve[],
    windowSize: number,
    pointsPerGraph: number
): ChartData<'line'> {
    let movingTps = calculateMovingAverage(solves.map((x) => x.tps), windowSize);
    let movingTpsExecution = calculateMovingAverage(
        solves.map((x) => (x.executionTime > 0 ? x.turns / x.executionTime : 0)),
        windowSize
    );
    let labels = Array.from({ length: movingTps.length }, (_, i) => (i + 1).toString());
    movingTps = reduceDataset(movingTps, pointsPerGraph);
    movingTpsExecution = reduceDataset(movingTpsExecution, pointsPerGraph);
    labels = reduceDataset(labels, pointsPerGraph);
    return {
        labels,
        datasets: [
            { label: `Average TPS Of ${windowSize}`, data: movingTps },
            { label: `Average TPS During Execution Of ${windowSize}`, data: movingTpsExecution },
        ],
    };
}

export function buildRunningInspectionData(
    solves: Solve[],
    windowSize: number,
    pointsPerGraph: number
): ChartData<'line'> {
    let movingInspection = calculateMovingAverage(solves.map((x) => x.inspectionTime), windowSize);
    let labels = Array.from({ length: movingInspection.length }, (_, i) => (i + 1).toString());
    movingInspection = reduceDataset(movingInspection, pointsPerGraph);
    labels = reduceDataset(labels, pointsPerGraph);
    return {
        labels,
        datasets: [{ label: `Average Inspection Of ${windowSize}`, data: movingInspection }],
    };
}

export function buildRunningTurnsData(
    solves: Solve[],
    windowSize: number,
    pointsPerGraph: number
): ChartData<'line'> {
    let movingAverage = calculateMovingAverage(solves.map((x) => x.turns), windowSize);
    let labels = Array.from({ length: movingAverage.length }, (_, i) => (i + 1).toString());
    movingAverage = reduceDataset(movingAverage, pointsPerGraph);
    labels = reduceDataset(labels, pointsPerGraph);
    return {
        labels,
        datasets: [{ label: `Average Turns Of ${windowSize}`, data: movingAverage }],
    };
}

export function buildRunningRecognitionExecution(
    solves: Solve[],
    windowSize: number,
    pointsPerGraph: number,
    use4SegmentTiming: boolean
): ChartData<'line'> {
    const colors = {
        recognition: 'rgb(54, 162, 235)',
        preAuf: 'rgb(153, 102, 255)',
        execution: 'rgb(255, 99, 132)',
        postAuf: 'rgb(255, 159, 64)',
    };
    let movingRecognition = calculateMovingAverage(solves.map((x) => x.recognitionTime), windowSize);
    let labels = Array.from({ length: movingRecognition.length }, (_, i) => (i + 1).toString());
    movingRecognition = reduceDataset(movingRecognition, pointsPerGraph);
    labels = reduceDataset(labels, pointsPerGraph);

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
    let labels = Array.from({ length: movingPercentBad.length }, (_, i) => (i + 1).toString());
    movingPercentBad = reduceDataset(movingPercentBad, pointsPerGraph);
    movingPercentGood = reduceDataset(movingPercentGood, pointsPerGraph);
    labels = reduceDataset(labels, pointsPerGraph);
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
    let labels = Array.from({ length: datasets[0].data.length }, (_, i) => (i + 1).toString());
    labels = reduceDataset(labels, pointsPerGraph);
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
            const stepData = solve.steps.find((s) => s.name === step);
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

export function buildOllCategoryChart(
    solves: Solve[],
    ollStepIndex: number,
    windowSize: number,
    pointsPerGraph: number
): ChartData<'line'> {
    const checkIfDot = (c: string) => Const.OllEdgeOrientationMapping.get(c) === OllEdgeOrientation.Dot;
    const checkIfLine = (c: string) => Const.OllEdgeOrientationMapping.get(c) === OllEdgeOrientation.Line;
    const checkIfAngle = (c: string) => Const.OllEdgeOrientationMapping.get(c) === OllEdgeOrientation.Angle;
    const checkIfCross = (c: string) => Const.OllEdgeOrientationMapping.get(c) === OllEdgeOrientation.Cross;
    const cases = solves.map((x) => x.steps[ollStepIndex]?.case ?? '');
    let movingDot = reduceDataset(calculateMovingPercentage(cases, windowSize, checkIfDot), pointsPerGraph);
    let movingLine = reduceDataset(calculateMovingPercentage(cases, windowSize, checkIfLine), pointsPerGraph);
    let movingAngle = reduceDataset(calculateMovingPercentage(cases, windowSize, checkIfAngle), pointsPerGraph);
    let movingCross = reduceDataset(calculateMovingPercentage(cases, windowSize, checkIfCross), pointsPerGraph);
    let labels = Array.from({ length: movingDot.length }, (_, i) => (i + 1).toString());
    labels = reduceDataset(labels, pointsPerGraph);
    return {
        labels,
        datasets: [
            { label: `Percentage of OLL Dot Cases over last ${windowSize}`, data: movingDot },
            { label: `Percentage of OLL Line Cases over last ${windowSize}`, data: movingLine },
            { label: `Percentage of OLL Angle Cases over last ${windowSize}`, data: movingAngle },
            { label: `Percentage of OLL Cross Cases over last ${windowSize}`, data: movingCross },
        ],
    };
}

export function buildPllCategoryChart(
    solves: Solve[],
    pllStepIndex: number,
    windowSize: number,
    pointsPerGraph: number
): ChartData<'line'> {
    const checkIfSolved = (c: string) => Const.PllCornerPermutationMapping.get(c) === PllCornerPermutation.Solved;
    const checkIfAdjacent = (c: string) => Const.PllCornerPermutationMapping.get(c) === PllCornerPermutation.Adjacent;
    const checkIfDiagonal = (c: string) => Const.PllCornerPermutationMapping.get(c) === PllCornerPermutation.Diagonal;
    const cases = solves.map((x) => x.steps[pllStepIndex]?.case ?? '');
    let movingSolved = reduceDataset(calculateMovingPercentage(cases, windowSize, checkIfSolved), pointsPerGraph);
    let movingAdjacent = reduceDataset(calculateMovingPercentage(cases, windowSize, checkIfAdjacent), pointsPerGraph);
    let movingDiagonal = reduceDataset(calculateMovingPercentage(cases, windowSize, checkIfDiagonal), pointsPerGraph);
    let labels = Array.from({ length: movingSolved.length }, (_, i) => (i + 1).toString());
    labels = reduceDataset(labels, pointsPerGraph);
    return {
        labels,
        datasets: [
            { label: `Percentage of PLL Solved Corner Cases over last ${windowSize}`, data: movingSolved },
            { label: `Percentage of PLL Adjacent Corner Cases over last ${windowSize}`, data: movingAdjacent },
            { label: `Percentage of PLL Diagonal Corner Cases over last ${windowSize}`, data: movingDiagonal },
        ],
    };
}

export function buildInspectionData(solves: Solve[], windowSize: number): ChartData<'bar'> {
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
    const crossAverage = calculateAverage(solves.map((x) => x.steps[0].time).slice(-windowSize));
    const f2l1 = calculateAverage(solves.map((x) => x.steps[1].time).slice(-windowSize));
    const f2l2 = calculateAverage(solves.map((x) => x.steps[2].time).slice(-windowSize));
    const f2l3 = calculateAverage(solves.map((x) => x.steps[3].time).slice(-windowSize));
    const f2l4 = calculateAverage(solves.map((x) => x.steps[4].time).slice(-windowSize));
    const ollAverage = calculateAverage(solves.map((x) => x.steps[5].time).slice(-windowSize));
    const pllAverage = calculateAverage(solves.map((x) => x.steps[6].time).slice(-windowSize));
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
