import type { ChartData } from 'chart.js/auto';
import {
    calculateMovingAverage,
    calculateMovingPercentage,
    calculateMovingAverageChopped,
    makeLabels,
    reduceDataset,
} from '../Helpers/MathHelpers';
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
import { applyPaletteToChartData, SEGMENT_COLORS } from '../Helpers/ChartColors';
import { analyzeStepMoves, computeCaseFailureStats, computeSolveEfficiency } from '../Helpers/MoveAnalysis';
import { getAufMovesForSolve } from '../Helpers/CsvParser';
import { Const } from '../Helpers/Constants';
import {
    AlgoPracticeRow,
    CaseStats,
    FastestSolve,
    getStep,
    MethodName,
    RecordRow,
    Solve,
    StepName,
    StreakData,
    StreakRow,
} from '../Helpers/Types';

interface WorkerInput {
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
    recordHistoryAllDays: boolean;
}

// ── Streak helpers ───────────────────────────────────────────────────────────

function isPreviousDay(date1: Date, date2: Date): boolean {
    const day1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate());
    const day2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());
    return (day2.getTime() - day1.getTime()) / (1000 * 60 * 60 * 24) === 1;
}

function buildStreakData(fastestSolveEachDay: { [key: string]: number }, targetTime: number): StreakData {
    const daysSorted = Object.keys(fastestSolveEachDay).sort();
    let streak = 0;
    let longestStreak = 0;
    for (let i = 0; i < daysSorted.length; i++) {
        if (i > 0 && !isPreviousDay(new Date(daysSorted[i - 1]), new Date(daysSorted[i]))) {
            streak = 0;
        }
        if (fastestSolveEachDay[daysSorted[i]] < targetTime) {
            streak++;
            longestStreak = Math.max(longestStreak, streak);
        } else {
            streak = 0;
        }
    }
    return { longestStreak, currentStreak: streak };
}

function buildAllStreakRows(solves: Solve[]): StreakRow[] {
    const fastestSolveEachDay: { [key: string]: number } = {};
    for (const solve of solves) {
        const day = solve.date.toLocaleDateString('en-CA');
        if (fastestSolveEachDay[day]) {
            fastestSolveEachDay[day] = Math.min(fastestSolveEachDay[day], solve.time);
        } else {
            fastestSolveEachDay[day] = solve.time;
        }
    }
    const targets = [5, 10, 15, 20, 30, 10000] as const;
    const labels: { [k: number]: string } = { 5: 'Sub-5', 10: 'Sub-10', 15: 'Sub-15', 20: 'Sub-20', 30: 'Sub-30', 10000: 'Overall' };
    return targets.map(t => {
        const s = buildStreakData(fastestSolveEachDay, t);
        const longest = String(s.longestStreak);
        const current = String(s.currentStreak);
        return {
            time: labels[t],
            longeststreak: longest,
            currentstreak: longest === current && current !== '0' ? `${current} 🔥` : current,
        };
    });
}

// ── Records ──────────────────────────────────────────────────────────────────

function buildRecordRows(solves: Solve[]): RecordRow[] {
    const times = solves.map(x => x.time);
    const single = Math.min.apply(null, times.length ? times : [Infinity]);
    const ao5 = Math.min.apply(null, calculateMovingAverage(times, 5));
    const ao12 = Math.min.apply(null, calculateMovingAverageChopped(times, 12, 1));
    const ao100 = Math.min.apply(null, calculateMovingAverageChopped(times, 100, 5));
    const ao1000 = Math.min.apply(null, calculateMovingAverageChopped(times, 1000, 50));
    return [
        { recordType: 'Single', time: single.toFixed(3) },
        { recordType: 'Ao5', time: ao5.toFixed(3) },
        { recordType: 'Ao12', time: ao12.toFixed(3) },
        { recordType: 'Ao100', time: ao100.toFixed(3) },
        { recordType: 'Ao1000', time: ao1000.toFixed(3) },
    ];
}

function buildRecordDatasetDaily(dates: Date[], times: number[]) {
    if (dates.length === 0) return [];

    // Step 1: group by day, keep the minimum value per day
    const dayMap: { [key: string]: { date: Date; value: number } } = {};
    for (let i = 0; i < dates.length; i++) {
        const day = dates[i].toLocaleDateString('en-CA');
        if (!dayMap[day] || times[i] < dayMap[day].value) {
            dayMap[day] = { date: dates[i], value: times[i] };
        }
    }
    const sortedKeys = Object.keys(dayMap).sort();
    const dayData = sortedKeys.map(k => dayMap[k]);

    // Step 2: build the record history (only keep days that set a new PB)
    const records: { date: Date; value: number }[] = [dayData[0]];
    for (let i = 1; i < dayData.length; i++) {
        if (dayData[i].value < records[records.length - 1].value) {
            records.push(dayData[i]);
        }
    }

    return records.map(r => ({ x: r.date, y: r.value }));
}

function buildRecordHistory(solves: Solve[], allDays: boolean) {
    const dates = solves.map(x => x.date);
    const times = solves.map(x => x.time);
    const ao5 = calculateMovingAverage(times, 5);
    const ao12 = calculateMovingAverageChopped(times, 12, 1);
    const ao100 = calculateMovingAverageChopped(times, 100, 5);
    const ao1000 = calculateMovingAverageChopped(times, 1000, 50);

    // When allDays is on, expose the full solve date range so ChartPanel can set
    // min/max on the 'time' scale — no null anchors needed, avoids rendering issues.
    let xAxisMin: Date | undefined;
    let xAxisMax: Date | undefined;
    if (allDays && dates.length > 0) {
        let minMs = dates[0].valueOf();
        let maxMs = dates[0].valueOf();
        for (let i = 1; i < dates.length; i++) {
            const ms = dates[i].valueOf();
            if (ms < minMs) minMs = ms;
            if (ms > maxMs) maxMs = ms;
        }
        xAxisMin = new Date(minMs);
        xAxisMax = new Date(maxMs);
    }

    return {
        xAxisMin,
        xAxisMax,
        datasets: [
            { label: 'Record Single', data: buildRecordDatasetDaily(dates, times) },
            { label: 'Record Ao5', data: buildRecordDatasetDaily(dates.slice(4), ao5) },
            { label: 'Record Ao12', data: buildRecordDatasetDaily(dates.slice(11), ao12) },
            { label: 'Record Ao100', data: buildRecordDatasetDaily(dates.slice(99), ao100) },
            { label: 'Record Ao1000', data: buildRecordDatasetDaily(dates.slice(999), ao1000) },
        ],
    };
}

// ── Per-step charts ──────────────────────────────────────────────────────────

function buildStepAverages(solves: Solve[], steps: StepName[], windowSize: number, pointsPerGraph: number) {
    if (solves.length === 0 || steps.length === 0) {
        return { labels: [], datasets: [] };
    }
    const datasets = steps.map((stepName) => {
        let average = calculateMovingAverage(solves.map(x => getStep(x, stepName)?.time ?? 0), windowSize);
        average = reduceDataset(average, pointsPerGraph);
        return { label: `${stepName} Average of ${windowSize}`, data: average };
    });
    const labels = makeLabels(datasets[0].data.length, pointsPerGraph);
    return { labels, datasets };
}

function buildDailyRecordData(solves: Solve[]) {
    const fastestSolveEachDay: { [key: string]: number } = {};
    for (const solve of solves) {
        const day = solve.date.toLocaleDateString('en-CA');
        fastestSolveEachDay[day] = fastestSolveEachDay[day]
            ? Math.min(fastestSolveEachDay[day], solve.time)
            : solve.time;
    }
    const labels = Object.keys(fastestSolveEachDay).sort();
    return {
        labels,
        datasets: [{ label: 'Fastest Solve Each Day', data: labels.map(d => fastestSolveEachDay[d]) }],
    };
}

function buildSolvesPerPeriodData(solves: Solve[], period: 'day' | 'week' | 'month') {
    const counts: { [key: string]: number } = {};
    for (const solve of solves) {
        let key: string;
        if (period === 'day') {
            key = solve.date.toLocaleDateString('en-CA');
        } else if (period === 'week') {
            const d = new Date(solve.date);
            const day = d.getDay();
            const diff = d.getDate() - day + (day === 0 ? -6 : 1);
            d.setDate(diff);
            key = d.toLocaleDateString('en-CA');
        } else {
            key = solve.date.toISOString().slice(0, 7);
        }
        counts[key] = (counts[key] ?? 0) + 1;
    }
    const labels = Object.keys(counts).sort();
    const label = period === 'day' ? 'Solves per Day' : period === 'week' ? 'Solves per Week' : 'Solves per Month';
    return { labels, datasets: [{ label, data: labels.map(k => counts[k]) }] };
}

// ── Efficiency ───────────────────────────────────────────────────────────────

function buildRunningEfficiencyData(
    solves: Solve[],
    steps: StepName[],
    methodName: MethodName,
    windowSize: number,
    pointsPerGraph: number
) {
    if (solves.length === 0) return { labels: [], datasets: [] };

    const needOll = methodName === MethodName.CFOP;
    const needPll = methodName === MethodName.CFOP || methodName === MethodName.CFOP_2OLL;
    const allStepsSelected = steps.length === Const.MethodSteps[methodName].length;

    const ollMap = needOll
        ? new Map(computeCaseFailureStats(solves, StepName.OLL).map((s: CaseStats) => [s.caseName, s]))
        : undefined;
    const pllMap = needPll
        ? new Map(computeCaseFailureStats(solves, StepName.PLL).map((s: CaseStats) => [s.caseName, s]))
        : undefined;

    const effList = solves.map((solve: Solve) => computeSolveEfficiency(solve, ollMap, pllMap));
    const efficiencies = effList.map(e => e.moveEfficiency * 100);

    let movingAvg = calculateMovingAverage(efficiencies, windowSize);
    const labels = makeLabels(movingAvg.length, pointsPerGraph);
    movingAvg = reduceDataset(movingAvg, pointsPerGraph);

    const datasets: { label: string; data: number[] }[] = [
        { label: `Move Efficiency % (avg of ${windowSize})`, data: movingAvg },
    ];

    if (allStepsSelected && (needOll || needPll)) {
        const ollRate = needOll
            ? reduceDataset(calculateMovingPercentage(effList, windowSize, e => e.hadOllFailure), pointsPerGraph)
            : movingAvg.map(() => 0);
        const pllRate = needPll
            ? reduceDataset(calculateMovingPercentage(effList, windowSize, e => e.hadPllFailure), pointsPerGraph)
            : movingAvg.map(() => 0);
        datasets.push({ label: 'Solve efficiency', data: movingAvg.map((eff, i) => eff - ollRate[i] - pllRate[i]) });
        if (needOll) datasets.push({ label: `OLL success % (last ${windowSize})`, data: ollRate.map(r => 100 - r) });
        if (needPll) datasets.push({ label: `PLL success % (last ${windowSize})`, data: pllRate.map(r => 100 - r) });
    }

    return { labels, datasets };
}

// ── Case data (OLL/PLL single-step) ──────────────────────────────────────────

function buildCaseData(solves: Solve[], steps: StepName[], windowSize: number, use4SegmentTiming: boolean) {
    const colors = SEGMENT_COLORS;
    if (steps.length !== 1 || (steps[0] !== StepName.OLL && steps[0] !== StepName.PLL)) {
        return { labels: [], datasets: [] };
    }
    const recentSolves = solves.slice(-windowSize);
    const failureStatsArr = computeCaseFailureStats(recentSolves, steps[0]);
    const failureMap: { [k: string]: CaseStats } = {};
    failureStatsArr.forEach((cs: CaseStats) => { failureMap[cs.caseName] = cs; });

    type CaseRow = { recognitionTime: number; executionTime: number; preAufTime: number; postAufTime: number; turns: number };
    const caseTimes: { [id: string]: CaseRow[] } = {};
    for (const s of recentSolves) {
        const step = getStep(s, steps[0]);
        if (!step?.case) continue;
        if (!(step.case in caseTimes)) caseTimes[step.case] = [];
        caseTimes[step.case].push({
            recognitionTime: s.recognitionTime,
            executionTime: s.executionTime - s.preAufTime - s.postAufTime,
            preAufTime: s.preAufTime,
            postAufTime: s.postAufTime,
            turns: step.turns,
        });
    }

    type CaseAgg = { label: string; recognitionTime: number; executionTime: number; preAufTime: number; postAufTime: number; avgMoves: number; failureRate: number };
    const cases: CaseAgg[] = [];
    for (const key in caseTimes) {
        const rows = caseTimes[key];
        const fs = failureMap[key];
        cases.push({
            label: key,
            recognitionTime: rows.reduce((a, r) => a + r.recognitionTime, 0) / rows.length,
            executionTime: rows.reduce((a, r) => a + r.executionTime, 0) / rows.length,
            preAufTime: rows.reduce((a, r) => a + r.preAufTime, 0) / rows.length,
            postAufTime: rows.reduce((a, r) => a + r.postAufTime, 0) / rows.length,
            avgMoves: rows.reduce((a, r) => a + r.turns, 0) / rows.length,
            failureRate: fs ? fs.failureRate : 0,
        });
    }
    cases.sort((a, b) =>
        (b.recognitionTime + b.preAufTime + b.executionTime + b.postAufTime) -
        (a.recognitionTime + a.preAufTime + a.executionTime + a.postAufTime)
    );

    const labels = cases.map(x => x.label);
    if (use4SegmentTiming) {
        const hasPreAuf = cases.some(x => x.preAufTime > 0);
        const hasPostAuf = cases.some(x => x.postAufTime > 0);
        const datasets: { label: string; data: number[]; backgroundColor: string }[] = [];
        datasets.push({ label: `Recognition (past ${windowSize})`, data: cases.map(x => x.recognitionTime), backgroundColor: colors.recognition });
        if (hasPreAuf) datasets.push({ label: `Pre-AUF (past ${windowSize})`, data: cases.map(x => x.preAufTime), backgroundColor: colors.preAuf });
        datasets.push({ label: `Execution (past ${windowSize})`, data: cases.map(x => x.executionTime), backgroundColor: colors.execution });
        if (hasPostAuf) datasets.push({ label: `Post-AUF (past ${windowSize})`, data: cases.map(x => x.postAufTime), backgroundColor: colors.postAuf });
        return { labels, datasets };
    }
    return {
        labels,
        datasets: [
            { label: `Average recognition time for each case in past ${windowSize} solves`, data: cases.map(x => x.recognitionTime), backgroundColor: colors.recognition },
            { label: `Average execution time for each case in past ${windowSize} solves`, data: cases.map(x => x.preAufTime + x.executionTime + x.postAufTime), backgroundColor: colors.execution },
        ],
    };
}

function buildAlgorithmPracticeRows(solves: Solve[], steps: StepName[], windowSize: number): AlgoPracticeRow[] {
    if (steps.length !== 1 || (steps[0] !== StepName.OLL && steps[0] !== StepName.PLL)) {
        return [];
    }
    const recentSolves = solves.slice(-windowSize);
    const caseStats = computeCaseFailureStats(recentSolves, steps[0]);
    return caseStats.map((cs: CaseStats) => {
        const matchingSolves = recentSolves.filter((s: Solve) => getStep(s, steps[0])?.case === cs.caseName);
        const avgTime = matchingSolves.length > 0
            ? matchingSolves.reduce((sum: number, s: Solve) => sum + (getStep(s, steps[0])?.time ?? 0), 0) / matchingSolves.length
            : 0;
        const avgWasted = matchingSolves.length > 0
            ? matchingSolves.reduce((sum: number, s: Solve) => sum + analyzeStepMoves(getStep(s, steps[0])?.moves ?? '', getAufMovesForSolve(s)).wastedMoves, 0) / matchingSolves.length
            : 0;
        return {
            case: cs.caseName,
            total: cs.totalCount,
            failed: cs.failureCount,
            failureRate: cs.failureRate.toFixed(1) + '%',
            avgMoves: cs.avgMoves.toFixed(1),
            expectedMoves: cs.expectedMovesBase,
            avgWasted: avgWasted.toFixed(1),
            avgTime: avgTime.toFixed(3),
        };
    });
}

// ── Best solves ───────────────────────────────────────────────────────────────

function computeBestSolvesData(solves: Solve[]): FastestSolve[] {
    return solves
        .slice()
        .sort((a, b) => a.time - b.time)
        .slice(0, Const.FastestSolvesCount)
        .map(x => ({
            date: x.date.toDateString(),
            time: x.time.toFixed(3),
            scramble: x.scramble,
            id: x.id,
            fullstep: x.isFullStep ? 'Yes 🔥' : 'No',
            source: x.source,
            rawSourceId: x.rawSourceId,
        } as FastestSolve));
}

// ── Main computation ──────────────────────────────────────────────────────────

function computeAllChartData(input: WorkerInput): Record<string, unknown> {
    const { solves, windowSize, pointsPerGraph, steps, goodTime, badTime, methodName, use4SegmentTiming, isDark, recordHistoryAllDays } = input;
    const hasOll = steps.includes(StepName.OLL);
    const hasPll = steps.includes(StepName.PLL);

    // Acubemy exports don't include inspection time. When sources are combined, only Cubeast solves
    // should contribute to inspection charts; when the dataset is Acubemy-only, hide both charts.
    const inspectionSolves = solves.filter((s): s is Solve & { inspectionTime: number } => s.inspectionTime != null);
    const showInspectionCharts = shouldShowInspectionCharts(solves) && inspectionSolves.length > 0;

    const cache: Record<string, unknown> = {
        runningAverage: buildRunningAverageData(solves, windowSize, pointsPerGraph),
        runningStdDev: buildRunningStdDevData(solves, windowSize, pointsPerGraph),
        runningTps: buildRunningTpsData(solves, windowSize, pointsPerGraph),
        runningInspection: showInspectionCharts
            ? buildRunningInspectionData(inspectionSolves, windowSize, pointsPerGraph)
            : null,
        runningTurns: buildRunningTurnsData(solves, windowSize, pointsPerGraph),
        runningRecognitionExecution: buildRunningRecognitionExecution(solves, windowSize, pointsPerGraph, use4SegmentTiming),
        runningEfficiency: buildRunningEfficiencyData(solves, steps, methodName, windowSize, pointsPerGraph),
        histogram: buildHistogramData(solves, windowSize),
        stepAverages: buildStepAverages(solves, steps, windowSize, pointsPerGraph),
        runningColorPercentages: buildRunningColorPercentages(solves, windowSize, pointsPerGraph, isDark),
        inspection: showInspectionCharts
            ? buildInspectionData(inspectionSolves, windowSize)
            : null,
        dailyRecord: buildDailyRecordData(solves),
        solvesPerDay: buildSolvesPerPeriodData(solves, 'day'),
        solvesPerWeek: buildSolvesPerPeriodData(solves, 'week'),
        solvesPerMonth: buildSolvesPerPeriodData(solves, 'month'),
        streakRows: buildAllStreakRows(solves),
        recordRows: buildRecordRows(solves),
        goodBad: buildGoodBadData(solves, windowSize, pointsPerGraph, goodTime, badTime),
        recordHistory: buildRecordHistory(solves, recordHistoryAllDays),
        stepPercentages: buildStepPercentages(solves, steps, windowSize),
        typicalCompare: buildTypicalCompare(solves, windowSize),
        bestSolvesData: computeBestSolvesData(solves),
    };

    if (hasOll) cache.ollCategory = buildOllCategoryChart(solves, windowSize, pointsPerGraph);
    if (hasPll) cache.pllCategory = buildPllCategoryChart(solves, windowSize, pointsPerGraph);
    if (steps.length === 1 && (steps[0] === StepName.OLL || steps[0] === StepName.PLL)) {
        cache.caseData = buildCaseData(solves, steps, windowSize, use4SegmentTiming);
        cache.algoPracticeRows = buildAlgorithmPracticeRows(solves, steps, windowSize);
    }

    // Apply colour palette to every plain chart-data object
    const chartDataKeys = [
        'runningAverage', 'runningStdDev', 'runningTps', 'runningInspection', 'runningTurns',
        'runningRecognitionExecution', 'runningEfficiency', 'histogram', 'stepAverages',
        'runningColorPercentages', 'inspection', 'dailyRecord', 'solvesPerDay', 'solvesPerWeek', 'solvesPerMonth', 'goodBad', 'recordHistory',
        'stepPercentages', 'typicalCompare', 'ollCategory', 'pllCategory', 'caseData',
    ] as const;
    for (const key of chartDataKeys) {
        const val = cache[key];
        if (val && typeof val === 'object' && 'datasets' in val && Array.isArray((val as { datasets: unknown }).datasets)) {
            cache[key] = applyPaletteToChartData(val as ChartData<'line'>, isDark, key === 'stepPercentages');
        }
    }

    return cache;
}

// ── Worker message handler ────────────────────────────────────────────────────

const workerGlobal = globalThis as any;
workerGlobal.onmessage = function (e: MessageEvent<WorkerInput>) {
    workerGlobal.postMessage({
        requestId: e.data.requestId,
        chartData: computeAllChartData(e.data),
    });
};
