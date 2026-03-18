import React from "react";
import { ChartPanelProps, ChartPanelState, ChartType, CaseStats, FastestSolve, MethodName, Solve, StepName, StreakData } from "../Helpers/Types";
import { Chart as ChartJS, ChartData, CategoryScale } from 'chart.js/auto';
import { calculateAverage, calculateMovingAverage, calculateMovingPercentage, reduceDataset, calculateMovingAverageChopped } from "../Helpers/MathHelpers";
import { createOptions, buildChartHtml } from "../Helpers/ChartHelpers";
import { applyPaletteToChartData } from "../Helpers/ChartColors";
import { Row, Tooltip } from "react-bootstrap";
import { ThemeContext } from "../contexts/ThemeContext";
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { Const } from "../Helpers/Constants";
import DataGrid, { CellClickArgs } from 'react-data-grid';
import 'react-data-grid/lib/styles.css';
import 'chartjs-adapter-moment';
import { analyzeStepMoves, computeCaseFailureStats, computeSolveEfficiency, coreMovesCount } from "../Helpers/MoveAnalysis";
import {
    buildRunningAverageData as buildRunningAverageChartData,
    buildRunningStdDevData as buildRunningStdDevChartData,
    buildRunningTpsData as buildRunningTpsChartData,
    buildRunningInspectionData as buildRunningInspectionChartData,
    buildRunningTurnsData as buildRunningTurnsChartData,
    buildRunningRecognitionExecution as buildRunningRecognitionExecutionChartData,
    buildHistogramData as buildHistogramChartData,
    buildGoodBadData as buildGoodBadChartData,
    buildRunningColorPercentages as buildRunningColorPercentagesChartData,
    buildStepPercentages as buildStepPercentagesChartData,
    buildOllCategoryChart as buildOllCategoryChartData,
    buildPllCategoryChart as buildPllCategoryChartData,
    buildInspectionData as buildInspectionChartData,
    buildTypicalCompare as buildTypicalCompareChartData,
} from "../Helpers/ChartDataBuilders";

ChartJS.register(CategoryScale);

export class ChartPanel extends React.Component<ChartPanelProps, ChartPanelState> {
    static contextType = ThemeContext;
    state: ChartPanelState = { solves: [] };

    private _chartDataCache: Record<string, unknown> | null = null;
    private _lastSolvesRef: Solve[] | null = null;
    private _lastWindowSizeRef: number = 0;
    private _lastPointsPerGraphRef: number = 0;
    private _lastStepsKeyRef: string = '';
    private _lastUseLogScaleRef: boolean = false;
    private _lastGoodTimeRef: number = 0;
    private _lastBadTimeRef: number = 0;
    private _lastMethodNameRef: MethodName = MethodName.CFOP;
    private _lastUse4SegmentTimingRef: boolean = false;
    private _lastIsDarkRef: boolean = false;

    private _propsChanged(): boolean {
        const p = this.props;
        const stepsKey = p.steps.join(',');
        const isDark = (this.context as { isDark?: boolean } | undefined)?.isDark ?? false;
        return (
            this._lastSolvesRef !== p.solves ||
            this._lastWindowSizeRef !== p.windowSize ||
            this._lastPointsPerGraphRef !== p.pointsPerGraph ||
            this._lastStepsKeyRef !== stepsKey ||
            this._lastUseLogScaleRef !== p.useLogScale ||
            this._lastGoodTimeRef !== p.goodTime ||
            this._lastBadTimeRef !== p.badTime ||
            this._lastMethodNameRef !== p.methodName ||
            this._lastUse4SegmentTimingRef !== p.use4SegmentTiming ||
            this._lastIsDarkRef !== isDark
        );
    }

    private _updatePropsRefs(): void {
        const p = this.props;
        const isDark = (this.context as { isDark?: boolean } | undefined)?.isDark ?? false;
        this._lastSolvesRef = p.solves;
        this._lastWindowSizeRef = p.windowSize;
        this._lastPointsPerGraphRef = p.pointsPerGraph;
        this._lastStepsKeyRef = p.steps.join(',');
        this._lastUseLogScaleRef = p.useLogScale;
        this._lastGoodTimeRef = p.goodTime;
        this._lastBadTimeRef = p.badTime;
        this._lastMethodNameRef = p.methodName;
        this._lastUse4SegmentTimingRef = p.use4SegmentTiming;
        this._lastIsDarkRef = isDark;
    }

    private _computeAllChartData(): Record<string, unknown> {
        const ollIndex = this.props.steps.indexOf(StepName.OLL);
        const pllIndex = this.props.steps.indexOf(StepName.PLL);
        const cache: Record<string, unknown> = {
            runningAverage: this.buildRunningAverageData(),
            runningStdDev: this.buildRunningStdDevData(),
            runningTps: this.buildRunningTpsData(),
            runningInspection: this.buildRunningInspectionData(),
            runningTurns: this.buildRunningTurnsData(),
            runningRecognitionExecution: this.buildRunningRecognitionExecution(),
            runningEfficiency: this.buildRunningEfficiencyData(),
            histogram: this.buildHistogramData(),
            stepAverages: this.buildStepAverages(),
            runningColorPercentages: this.buildRunningColorPercentages(),
            inspection: this.buildInspectionData(),
            dailyRecord: this.buildDailyRecordData(),
            allStreakData: this.buildAllStreakData(),
            currentRecords: this.buildCurrentRecords(),
            goodBad: this.buildGoodBadData(this.props.goodTime, this.props.badTime),
            recordHistory: this.buildRecordHistory(),
            stepPercentages: this.buildStepPercentages(),
            typicalCompare: this.buildTypicalCompare(),
            bestSolvesData: this._computeBestSolvesData(),
        };
        if (ollIndex !== -1) cache.ollCategory = this.buildOllCategoryChart(ollIndex);
        if (pllIndex !== -1) cache.pllCategory = this.buildPllCategoryChart(pllIndex);
        if (this.props.steps.length === 1 && (this.props.steps[0] === StepName.OLL || this.props.steps[0] === StepName.PLL)) {
            cache.caseData = this.buildCaseData();
            cache.algorithmPracticeTable = this.buildAlgorithmPracticeTable();
        }
        const isDark = (this.context as { isDark?: boolean } | undefined)?.isDark ?? false;
        const chartDataKeys = [
            'runningAverage', 'runningStdDev', 'runningTps', 'runningInspection', 'runningTurns',
            'runningRecognitionExecution', 'runningEfficiency', 'histogram', 'stepAverages',
            'runningColorPercentages', 'inspection', 'dailyRecord', 'goodBad', 'recordHistory',
            'stepPercentages', 'typicalCompare', 'ollCategory', 'pllCategory', 'caseData',
        ] as const;
        for (const key of chartDataKeys) {
            const val = cache[key];
            if (val && typeof val === 'object' && 'datasets' in val && Array.isArray((val as { datasets: unknown }).datasets)) {
                const perPoint = key === 'stepPercentages';
                cache[key] = applyPaletteToChartData(val as ChartData<'line'>, isDark, perPoint);
            }
        }
        return cache;
    }

    private _computeBestSolvesData(): FastestSolve[] {
        const solveCopy = this.props.solves.slice().sort((a: Solve, b: Solve) => a.time - b.time);
        const fastest = solveCopy.slice(0, Const.FastestSolvesCount);
        return fastest.map(x => ({
            date: x.date.toDateString(),
            time: x.time.toFixed(3),
            scramble: x.scramble,
            id: x.id,
            fullstep: x.isFullStep ? "Yes 🔥" : "No",
            source: x.source,
            rawSourceId: x.rawSourceId
        } as FastestSolve));
    }

    getEmptyChartData() {
        let data: ChartData<"line"> = {
            labels: [],
            datasets: []
        }
        return data;
    }

    buildRunningAverageData() {
        return buildRunningAverageChartData(this.props.solves, this.props.windowSize, this.props.pointsPerGraph);
    }

    buildRunningStdDevData() {
        return buildRunningStdDevChartData(this.props.solves, this.props.windowSize, this.props.pointsPerGraph);
    }

    buildRunningTpsData() {
        return buildRunningTpsChartData(this.props.solves, this.props.windowSize, this.props.pointsPerGraph);
    }

    buildRunningInspectionData() {
        return buildRunningInspectionChartData(this.props.solves, this.props.windowSize, this.props.pointsPerGraph);
    }

    buildRunningTurnsData() {
        return buildRunningTurnsChartData(this.props.solves, this.props.windowSize, this.props.pointsPerGraph);
    }

    buildRunningRecognitionExecution() {
        return buildRunningRecognitionExecutionChartData(
            this.props.solves,
            this.props.windowSize,
            this.props.pointsPerGraph,
            this.props.use4SegmentTiming
        );
    }

    isPreviousDay(date1: Date, date2: Date): boolean {
        const day1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate());
        const day2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());
        const timeDiff = day2.getTime() - day1.getTime();
        const dayDiff = timeDiff / (1000 * 60 * 60 * 24);
        return dayDiff === 1;
    }

    buildStreakData(fastestSolveEachDay: { [key: string]: number }, targetTime: number): StreakData {
        let daysSorted = Object.keys(fastestSolveEachDay).sort();
        let streak = 0;
        let longestStreak = 0;

        for (let i = 0; i < daysSorted.length; i++) {
            let day = daysSorted[i];
            let time = fastestSolveEachDay[day];
            if (i > 0 && !this.isPreviousDay(new Date(daysSorted[i - 1]), new Date(day))) {
                streak = 0;
            }
            if (time < targetTime) {
                streak++;
                longestStreak = Math.max(longestStreak, streak);
            } else {
                streak = 0;
            }
        }

        let streakData: StreakData = {
            longestStreak: longestStreak,
            currentStreak: streak
        };

        return streakData;
    }

    buildAllStreakData() {
        let fastestSolveEachDay: { [key: string]: number } = {};
        for (let i = 0; i < this.props.solves.length; i++) {
            let day = this.props.solves[i].date.toLocaleDateString('en-CA');
            if (fastestSolveEachDay[day]) {
                fastestSolveEachDay[day] = Math.min(fastestSolveEachDay[day], this.props.solves[i].time);
            } else {
                fastestSolveEachDay[day] = this.props.solves[i].time;
            }
        }

        let streaks: { [key: number]: StreakData } = {};
        streaks[5] = this.buildStreakData(fastestSolveEachDay, 5);
        streaks[10] = this.buildStreakData(fastestSolveEachDay, 10);
        streaks[15] = this.buildStreakData(fastestSolveEachDay, 15);
        streaks[20] = this.buildStreakData(fastestSolveEachDay, 20);
        streaks[30] = this.buildStreakData(fastestSolveEachDay, 30);
        streaks[10000] = this.buildStreakData(fastestSolveEachDay, 10000);

        let cols = [
            { key: 'time', name: 'Target Time' },
            { key: 'currentstreak', name: 'Current Streak' },
            { key: 'longeststreak', name: 'Longest Streak' }
        ]

        let rows = [
            { time: 'Sub-5', longeststreak: String(streaks[5].longestStreak), currentstreak: String(streaks[5].currentStreak) },
            { time: 'Sub-10', longeststreak: String(streaks[10].longestStreak), currentstreak: String(streaks[10].currentStreak) },
            { time: 'Sub-15', longeststreak: String(streaks[15].longestStreak), currentstreak: String(streaks[15].currentStreak) },
            { time: 'Sub-20', longeststreak: String(streaks[20].longestStreak), currentstreak: String(streaks[20].currentStreak) },
            { time: 'Sub-30', longeststreak: String(streaks[30].longestStreak), currentstreak: String(streaks[30].currentStreak) },
            { time: 'Overall', longeststreak: String(streaks[10000].longestStreak), currentstreak: String(streaks[10000].currentStreak) },
        ]

        rows = rows.map(row => ({
            ...row,
            currentstreak: row.longeststreak === row.currentstreak && row.currentstreak != '0' ? `${row.currentstreak} 🔥` : row.currentstreak
        }));

        return (<DataGrid rows={rows} columns={cols} />);
    }

    buildDailyRecordData() {
        let fastestSolveEachDay: { [key: string]: number } = {};
        for (let i = 0; i < this.props.solves.length; i++) {
            let day = this.props.solves[i].date.toLocaleDateString('en-CA');
            if (fastestSolveEachDay[day]) {
                fastestSolveEachDay[day] = Math.min(fastestSolveEachDay[day], this.props.solves[i].time);
            } else {
                fastestSolveEachDay[day] = this.props.solves[i].time;
            }
        }

        let labels = Object.keys(fastestSolveEachDay).sort();
        let dataPoints = labels.map(day => fastestSolveEachDay[day]);

        let data: ChartData<"line"> = {
            labels,
            datasets: [{
                label: "Fastest Solve Each Day",
                data: dataPoints
            }]
        };

        return data;

    }

    buildStepPercentages() {
        return buildStepPercentagesChartData(this.props.solves, this.props.steps, this.props.windowSize);
    }

    buildStepAverages() {
        if (this.props.solves.length == 0 || this.props.steps.length == 0) {
            return this.getEmptyChartData();
        }

        let datasets = [];

        for (let i = 0; i < this.props.steps.length; i++) {
            let average: number[] = calculateMovingAverage(this.props.solves.map(x => x.steps[i].time), this.props.windowSize);
            average = reduceDataset(average, this.props.pointsPerGraph);

            let dataset = {
                label: `${this.props.solves[0].steps[i].name} Average of ${this.props.windowSize}`,
                data: average
            }
            datasets.push(dataset);
        }

        let labels: string[] = [];
        for (let i = 0; i < datasets[0].data.length; i++) {
            labels.push(i.toString());
        }
        labels = reduceDataset(labels, this.props.pointsPerGraph);

        let data: ChartData<"line"> = {
            labels: labels,
            datasets: datasets
        }

        return data;
    }

    buildGoodBadData(goodTime: number, badTime: number) {
        return buildGoodBadChartData(
            this.props.solves,
            this.props.windowSize,
            this.props.pointsPerGraph,
            goodTime,
            badTime
        );
    }

    buildOllCategoryChart(ollStepIndex: number) {
        return buildOllCategoryChartData(
            this.props.solves,
            ollStepIndex,
            this.props.windowSize,
            this.props.pointsPerGraph
        );
    }

    buildPllCategoryChart(pllStepIndex: number) {
        return buildPllCategoryChartData(
            this.props.solves,
            pllStepIndex,
            this.props.windowSize,
            this.props.pointsPerGraph
        );
    }

    buildTypicalCompare() {
        return buildTypicalCompareChartData(this.props.solves, this.props.windowSize);
    }

    buildHistogramData() {
        return buildHistogramChartData(this.props.solves, this.props.windowSize);
    }

    buildInspectionData() {
        return buildInspectionChartData(this.props.solves, this.props.windowSize);
    }

    buildRecordDataset(dates: Date[], times: number[]) {
        let records = [{ x: dates[0], y: times[0] }];

        for (let i = 1; i < times.length; i++) {
            if (times[i] < records[records.length - 1].y) {
                records.push({ x: dates[i], y: times[i] });
            }
        }

        return records;
    }

    buildCurrentRecords() {
        if (this.props.solves.length == 0) {
            //return this.getEmptyChartData();
        }

        let times = this.props.solves.map(x => x.time);
        let single = Math.min.apply(null, times);
        let ao5 = Math.min.apply(null, calculateMovingAverage(times, 5));
        let ao12 = Math.min.apply(null, calculateMovingAverageChopped(times, 12, 1));
        let ao100 = Math.min.apply(null, calculateMovingAverageChopped(times, 100, 5));
        //let ao1000 = Math.min.apply(null, calculateMovingAverageChopped(times, 1000, 50));

        const cols = [
            { key: 'recordType', name: 'Record Type' },
            { key: 'time', name: 'Time (s)' }
        ];

        const rows = [
            { recordType: 'Single', time: single.toFixed(3) },
            { recordType: 'Ao5', time: ao5.toFixed(3) },
            { recordType: 'Ao12', time: ao12.toFixed(3) },
            { recordType: 'Ao100', time: ao100.toFixed(3) },
            //{ recordType: 'Ao1000', time: ao1000.toFixed(3) }
        ];

        const data = (<DataGrid rows={rows} columns={cols} />);

        return data;
    }

    buildRecordHistory()
        : ChartData<"line", {
            x: Date;
            y: number;
        }[]> {
        if (this.props.solves.length == 0) {
            //return this.getEmptyChartData();
        }

        let dates = this.props.solves.map(x => x.date);

        let single = this.props.solves.map(x => x.time);
        let ao5 = calculateMovingAverage(this.props.solves.map(x => x.time), 5);
        let ao12 = calculateMovingAverageChopped(this.props.solves.map(x => x.time), 12, 1);
        let ao100 = calculateMovingAverageChopped(this.props.solves.map(x => x.time), 100, 5);
        //let ao1000 = calculateMovingAverageChopped(this.props.solves.map(x => x.time), 1000, 50);

        // Start initial records
        let records = {
            single: this.buildRecordDataset(dates, single),
            ao5: this.buildRecordDataset(dates.slice(4), ao5),
            ao12: this.buildRecordDataset(dates.slice(11), ao12),
            ao100: this.buildRecordDataset(dates.slice(99), ao100),
            //ao1000: this.buildRecordDataset(dates.slice(999), ao1000)
        };

        // Display the charts
        let data: ChartData<"line", { x: Date, y: number }[]> = {
            datasets: [
                {
                    label: `Record Single`,
                    data: records.single
                },
                {
                    label: `Record Ao5`,
                    data: records.ao5
                },
                {
                    label: `Record Ao12`,
                    data: records.ao12
                },
                {
                    label: `Record Ao100`,
                    data: records.ao100
                },
                //{
                //    label: `Record Ao1000`,
                //    data: records.ao1000
                //}
            ]
        }

        return data;
    }

    buildRunningColorPercentages() {
        const isDark = (this.context as { isDark?: boolean } | undefined)?.isDark ?? false;
        return buildRunningColorPercentagesChartData(
            this.props.solves,
            this.props.windowSize,
            this.props.pointsPerGraph,
            isDark
        );
    }

    buildCaseData() {
        const colors = {
            recognition: 'rgb(54, 162, 235)',
            preAuf: 'rgb(153, 102, 255)',
            execution: 'rgb(255, 99, 132)',
            postAuf: 'rgb(255, 159, 64)',
        };
        if (this.props.steps.length != 1 || (this.props.steps[0] !== StepName.OLL && this.props.steps[0] !== StepName.PLL)) {
            return { labels: [], datasets: [] } as ChartData<"bar">;
        }

        let solves = this.props.solves.slice(-this.props.windowSize);
        // Compressed solves have only the selected step at index 0
        const stepIndex = 0;
        const failureStatsArr = computeCaseFailureStats(solves, stepIndex);
        const failureMap: { [caseName: string]: CaseStats } = {};
        failureStatsArr.forEach((cs: CaseStats) => { failureMap[cs.caseName] = cs; });

        type CaseRow = { recognitionTime: number; executionTime: number; preAufTime: number; postAufTime: number; turns: number };
        let caseTimes: { [id: string]: CaseRow[] } = {};
        for (let i = 0; i < solves.length; i++) {
            const s = solves[i];
            if (!(s.steps[0].case in caseTimes)) caseTimes[s.steps[0].case] = [];
            caseTimes[s.steps[0].case].push({
                recognitionTime: s.recognitionTime,
                executionTime: s.executionTime - s.preAufTime - s.postAufTime,
                preAufTime: s.preAufTime,
                postAufTime: s.postAufTime,
                turns: s.steps[0].turns,
            });
        }

        type CaseAgg = { label: string; recognitionTime: number; executionTime: number; preAufTime: number; postAufTime: number; avgMoves: number; failureRate: number };
        let cases: CaseAgg[] = [];
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
        cases.sort((a, b) => (b.recognitionTime + b.preAufTime + b.executionTime + b.postAufTime) - (a.recognitionTime + a.preAufTime + a.executionTime + a.postAufTime));

        const labels = cases.map(x => x.label);
        if (this.props.use4SegmentTiming) {
            const recognitionValues = cases.map(x => x.recognitionTime);
            const preAufValues = cases.map(x => x.preAufTime);
            const executionValues = cases.map(x => x.executionTime);
            const postAufValues = cases.map(x => x.postAufTime);

            const hasPreAuf = preAufValues.some(v => v > 0);
            const hasPostAuf = postAufValues.some(v => v > 0);

            const datasets: ChartData<"bar">["datasets"] = [];
            datasets.push({ label: `Recognition (past ${this.props.windowSize})`, data: recognitionValues, backgroundColor: colors.recognition });
            if (hasPreAuf) {
                datasets.push({ label: `Pre-AUF (past ${this.props.windowSize})`, data: preAufValues, backgroundColor: colors.preAuf });
            }
            datasets.push({ label: `Execution (past ${this.props.windowSize})`, data: executionValues, backgroundColor: colors.execution });
            if (hasPostAuf) {
                datasets.push({ label: `Post-AUF (past ${this.props.windowSize})`, data: postAufValues, backgroundColor: colors.postAuf });
            }

            return {
                labels,
                datasets,
            } as ChartData<"bar">;
        }
        const recognitionValues = cases.map(x => x.recognitionTime);
        const executionValues = cases.map(x => x.preAufTime + x.executionTime + x.postAufTime);
        return {
            labels,
            datasets: [
                { label: `Average recognition time for each case in past ${this.props.windowSize} solves`, data: recognitionValues, backgroundColor: colors.recognition },
                { label: `Average execution time for each case in past ${this.props.windowSize} solves`, data: executionValues, backgroundColor: colors.execution },
            ],
        } as ChartData<"bar">;
    }

    buildAlgorithmPracticeTable() {
        if (this.props.steps.length !== 1 || (this.props.steps[0] !== StepName.OLL && this.props.steps[0] !== StepName.PLL)) {
            return (<></>);
        }

        // Compressed solves have only the selected step at index 0
        const stepIndex = 0;
        const solves = this.props.solves.slice(-this.props.windowSize);
        const caseStats = computeCaseFailureStats(solves, stepIndex);

        // debug log for failed cases
        /*
        const solveById = new Map(solves.map((s: Solve) => [s.id, s]));
        for (const cs of caseStats) {
            if (cs.failureCount === 0) continue;
            console.log(`[Algorithm Practice] Case "${cs.caseName}" (expected moves: ${cs.expectedMoves})`);
            for (const inst of cs.instances) {
                const solve = solveById.get(inst.solveId);
                const step = solve?.steps[stepIndex];
                const moves = step?.moves ?? "";
                const coreMoves = coreMovesCount(moves);
                const stepTime = step?.time ?? 0;
                console.log(`  solveId ${inst.solveId} — moves: "${moves}" — coreMoves: ${coreMoves} — time: ${stepTime.toFixed(3)}s — failed: ${inst.failed}`);
            }
        }
        */

        type AlgoPracticeRow = {
            case: string;
            total: number;
            failed: number;
            failureRate: string;
            avgMoves: string;
            expectedMoves: number;
            avgWasted: string;
            avgTime: string;
        };

        const rows: AlgoPracticeRow[] = caseStats.map((cs: CaseStats) => {
            const matchingSolves = solves.filter((s: Solve) => s.steps[0] && s.steps[0].case === cs.caseName);
            const avgTime = matchingSolves.length > 0
                ? matchingSolves.reduce((sum: number, s: Solve) => sum + s.steps[0].time, 0) / matchingSolves.length
                : 0;
            const avgWasted = matchingSolves.length > 0
                ? matchingSolves.reduce((sum: number, s: Solve) => sum + analyzeStepMoves(s.steps[0].moves).wastedMoves, 0) / matchingSolves.length
                : 0;

            return {
                case: cs.caseName,
                total: cs.totalCount,
                failed: cs.failureCount,
                failureRate: cs.failureRate.toFixed(1) + "%",
                avgMoves: cs.avgMoves.toFixed(1),
                expectedMoves: cs.expectedMovesBase,
                avgWasted: avgWasted.toFixed(1),
                avgTime: avgTime.toFixed(3),
            };
        });

        const cols = [
            { key: 'case', name: 'Case' },
            { key: 'total', name: 'Total' },
            { key: 'failed', name: 'Failed' },
            { key: 'failureRate', name: 'Failure %' },
            { key: 'avgMoves', name: 'Avg Moves' },
            { key: 'expectedMoves', name: 'Expected' },
            { key: 'avgWasted', name: 'Avg Wasted' },
            { key: 'avgTime', name: 'Avg Time (s)' },
        ];

        return (<DataGrid rows={rows} columns={cols} />);
    }

    buildRunningEfficiencyData() {
        const solves = this.props.solves;
        if (solves.length === 0) return this.getEmptyChartData();

        const needOll = this.props.methodName === MethodName.CFOP;
        const needPll = this.props.methodName === MethodName.CFOP || this.props.methodName === MethodName.CFOP_2OLL;

        const allStepsSelected = this.props.steps.length === Const.MethodSteps[this.props.methodName].length;

        const ollMap = needOll ? new Map(computeCaseFailureStats(solves, 5).map((s: CaseStats) => [s.caseName, s])) : undefined;
        const pllMap = needPll ? new Map(computeCaseFailureStats(solves, 6).map((s: CaseStats) => [s.caseName, s])) : undefined;

        const effList = solves.map((solve: Solve) => computeSolveEfficiency(solve, ollMap, pllMap));
        const efficiencies = effList.map((e) => e.moveEfficiency * 100);

        let movingAvg = calculateMovingAverage(efficiencies, this.props.windowSize);

        let labels: string[] = [];
        for (let i = 1; i <= movingAvg.length; i++) {
            labels.push(i.toString());
        }

        movingAvg = reduceDataset(movingAvg, this.props.pointsPerGraph);
        labels = reduceDataset(labels, this.props.pointsPerGraph);

        const datasets: ChartData<"line">["datasets"] = [
            {
                label: `Move Efficiency % (avg of ${this.props.windowSize})`,
                data: movingAvg
            }
        ];
        const needOllForChart = this.props.methodName === MethodName.CFOP;
        const needPllForChart = this.props.methodName === MethodName.CFOP || this.props.methodName === MethodName.CFOP_2OLL;
        if (allStepsSelected && (needOllForChart || needPllForChart)) {
            const ollRate = needOllForChart
                ? reduceDataset(
                    calculateMovingPercentage(effList, this.props.windowSize, (e) => e.hadOllFailure),
                    this.props.pointsPerGraph
                )
                : movingAvg.map(() => 0);
            const pllRate = needPllForChart
                ? reduceDataset(
                    calculateMovingPercentage(effList, this.props.windowSize, (e) => e.hadPllFailure),
                    this.props.pointsPerGraph
                )
                : movingAvg.map(() => 0);
            const ollSuccess = ollRate.map((r) => 100 - r);
            const pllSuccess = pllRate.map((r) => 100 - r);
            const solveEfficiency = movingAvg.map((eff, i) => eff - ollRate[i] - pllRate[i]);
            datasets.push({
                label: 'Solve efficiency',
                data: solveEfficiency,
            });
            if (needOllForChart) {
                datasets.push({
                    label: `OLL success % (last ${this.props.windowSize})`,
                    data: ollSuccess,
                });
            }
            if (needPllForChart) {
                datasets.push({
                    label: `PLL success % (last ${this.props.windowSize})`,
                    data: pllSuccess,
                });
            }
        }

        let data: ChartData<"line"> = { labels, datasets };
        return data;
    }

    buildBestSolves(cachedData?: FastestSolve[]) {
        const cols = [
            { key: 'time', name: 'Time' },
            { key: 'date', name: 'Date' },
            { key: 'scramble', name: 'Scramble' },
            { key: 'id', name: 'ID' },
            { key: 'fullstep', name: "Full Step" }
        ];
        const reduced = cachedData ?? this._computeBestSolvesData();
        return (<DataGrid rows={reduced} columns={cols} onCellClick={this.openSolveSource} />);
    }

    createTooltip(description: string): JSX.Element {
        const tooltip = (
            <Tooltip id="tooltip">
                {description}
            </Tooltip>
        );
        return tooltip;
    }

    openSolveSource(params: CellClickArgs<FastestSolve>) {
        if (params.row.source === 'acubemy' && params.row.rawSourceId) {
            window.open("https://acubemy.com/shared/" + params.row.rawSourceId);
            return;
        }

        // Default / fallback to Cubeast
        window.open("https://app.cubeast.com/log/solves/" + params.row.id);
    }

    render() {
        if (!this._chartDataCache || this._propsChanged()) {
            this._chartDataCache = this._computeAllChartData();
            this._updatePropsRefs();
        }
        const c = this._chartDataCache;
        const p = this.props;
        const isDark = (this.context as { isDark?: boolean } | undefined)?.isDark ?? false;
        let charts: JSX.Element[] = [];

        let ollIndex: number = p.steps.indexOf(StepName.OLL);
        let pllIndex: number = p.steps.indexOf(StepName.PLL);

        if (p.steps.length == 1 && (p.steps[0] === StepName.OLL || p.steps[0] === StepName.PLL)) {
            charts.push(buildChartHtml(<Bar data={c.caseData as ChartData<"bar">} options={createOptions(ChartType.Bar, "Case", "Time (s)", p.useLogScale, true, false, isDark)} />, "Average Recognition Time and Execution Time per Case", "This chart shows how long your execution/recognition took for any individual last layer algorithm, sorted by how long each took."));
            charts.push(buildChartHtml(c.algorithmPracticeTable as JSX.Element, "Algorithm Practice", "Per-case failure rate and move efficiency. 'Failed' means core move count exceeded mode and average time for that case, suggesting a redo or correction. 'Avg Wasted' shows redundant same-face moves that could be cancelled."));
        }

        charts.push(buildChartHtml(<Line data={c.runningAverage as ChartData<"line">} options={createOptions(ChartType.Line, "Solve Number", "Time (s)", p.useLogScale, true, false, isDark)} />, "Average Time", "This chart shows your running average"));
        charts.push(buildChartHtml(<Line data={c.runningRecognitionExecution as ChartData<"line">} options={createOptions(ChartType.Line, "Solve Number", "Time (s)", p.useLogScale, true, false, isDark)} />, "Average Recognition and Execution", "This chart shows your running average, split up by recognition time and execution time"));
        charts.push(buildChartHtml(<Bar data={c.histogram as ChartData<"bar">} options={createOptions(ChartType.Bar, "Time (s)", "Count", p.useLogScale, true, false, isDark)} />, "Count of Solves by How Long They Took", "This chart shows how many solves you have done in 10s, 11s, 12s, etc..."));
        charts.push(buildChartHtml(<Line data={c.runningTps as ChartData<"line">} options={createOptions(ChartType.Line, "Solve Number", "Time (s)", p.useLogScale, true, false, isDark)} />, "Average Turns Per Second", "This chart shows your average turns per second. 'TPS During Execution' only counts your TPS while actively turning the cube"));
        charts.push(buildChartHtml(<Line data={c.runningTurns as ChartData<"line">} options={createOptions(ChartType.Line, "Solve Number", "Turns", p.useLogScale, true, false, isDark)} />, "Average Turns", "This chart shows your average number of turns, in quarter turn metric"));
        charts.push(buildChartHtml(<Line data={c.runningEfficiency as ChartData<"line">} options={createOptions(ChartType.Line, "Solve Number", "Percentage", p.useLogScale, true, false, isDark)} />, "Solve Efficiency", "This chart shows move efficiency ratio (after cancelling redundant same-face moves; 100% = no wasted moves), OLL/PLL success rates, and a combined solve efficiency (move efficiency minus failure rates)."));
        charts.push(buildChartHtml(this.buildBestSolves(c.bestSolvesData as FastestSolve[]), `Top ${Const.FastestSolvesCount} Fastest Solves`, `This shows your ${Const.FastestSolvesCount} fastest solves, given the filters`));
        charts.push(buildChartHtml(<Line data={c.runningStdDev as ChartData<"line">} options={createOptions(ChartType.Line, "Solve Number", "Time (s)", p.useLogScale, true, false, isDark)} />, "Average Standard Deviation", "This chart shows your running average's standard deviation"));
        charts.push(buildChartHtml(<Line data={c.runningColorPercentages as ChartData<"line">} options={createOptions(ChartType.Line, "Solve Number", "Percentage", p.useLogScale, true, false, isDark)} />, "Percentage of Solves by Cross Color", "This chart shows what percentage of solves started with cross on White/Yellow/etc..."));
        charts.push(buildChartHtml(<Bar data={c.inspection as ChartData<"bar">} options={createOptions(ChartType.Bar, "Inspection Time (s)", "Solve Time (s)", p.useLogScale, true, false, isDark)} />, "Average solve time by inspection time", "This chart shows your average, grouped up by how much inspection time (For example, the left bar is the 1/7 of your solves with the lowest inspection time, and the right bar is the 1/7 of your solves with the most inspection time)"));
        charts.push(buildChartHtml(<Line data={c.stepAverages as ChartData<"line">} options={createOptions(ChartType.Line, "Solve Number", "Time (s)", p.useLogScale, true, false, isDark)} />, "Average Time by Step", "This chart shows what percentage of your solve each step takes"));
        charts.push(buildChartHtml(<Line data={c.runningInspection as ChartData<"line">} options={createOptions(ChartType.Line, "Solve Number", "Time (s)", p.useLogScale, true, false, isDark)} />, "Average Inspection Time", "This chart shows how much inspection time you use on average"));
        charts.push(buildChartHtml(c.allStreakData as JSX.Element, "Longest Daily Streaks", "How many days in a row you've achieved solves of each time"));
        charts.push(buildChartHtml(<Line data={c.dailyRecord as ChartData<"line">} options={createOptions(ChartType.Line, "Date", "Time (s)", p.useLogScale, true, true, isDark)} />, "Daily Fastest Solve", "This chart shows the fastest solve for each day, based on the selected filters"));
        charts.push(buildChartHtml(c.currentRecords as JSX.Element, "Current Records", "This chart shows your current records for Single, Ao5, Ao12, Ao100, and Ao1000"));

        if (ollIndex != -1) {
            charts.push(buildChartHtml(<Line data={c.ollCategory as ChartData<"line">} options={createOptions(ChartType.Line, "Solve Number", "Percentage", p.useLogScale, true, false, isDark)} />, "OLL Edge Orientation", "This chart shows your percentage of OLL cases by edge orientation"));
        }

        if (pllIndex != -1) {
            charts.push(buildChartHtml(<Line data={c.pllCategory as ChartData<"line">} options={createOptions(ChartType.Line, "Solve Number", "Percentage", p.useLogScale, true, false, isDark)} />, "PLL Corner Permutation", "This chart shows your percentage of PLL cases by corner permutation"));
        }

        if (p.methodName == MethodName.CFOP && p.steps.length == Const.MethodSteps[MethodName.CFOP].length) {
            charts.push(buildChartHtml(<Bar data={c.typicalCompare as ChartData<"bar">} options={createOptions(ChartType.Bar, "Step Name", "Time (s)", p.useLogScale, false, false, isDark)} />, "Time Per Step, Compared to Typical Solver", "This chart shows how long each step takes, compared to a typical solver at your average. The 'typical' data is calculated based on a tool provided from Felix Zemdegs's CubeSkills blog"));
        }

        if (p.steps.length >= 2) {
            charts.push(buildChartHtml(<Doughnut data={c.stepPercentages as ChartData<"doughnut">} options={createOptions(ChartType.Doughnut, "", "", p.useLogScale, true, false, isDark)} />, "Percentage of the Solve Each Step Took", "This chart shows what percentage of your solve each step takes"));
        }

        if (p.steps.length == Const.MethodSteps[p.methodName].length) {
            charts.push(buildChartHtml(<Line data={c.goodBad as ChartData<"line">} options={createOptions(ChartType.Line, "Solve Number", "Percentage", p.useLogScale, true, false, isDark)} />, "Percentage of 'Good' and 'Bad' Solves", "This chart shows your running average of solves considered 'good' and 'bad'. This can be configured in the filter panel. Just set the good and bad values to times you feel are correct"));
            charts.push(buildChartHtml(<Line data={c.recordHistory as ChartData<"line">} options={createOptions(ChartType.Line, "Date", "Time (s)", p.useLogScale, true, true, isDark)} />, "History of Records", "This chart shows your history of PBs. Note that this will only show solves that meet the criteria in your filters, so don't be alarmed if you don't see your PB here. As a note, Ao12 removes the best and worst solves of the 12. Ao100 removes the best and worst 5. Ao1000 removes the best and worst 50."))
        }

        let chartRow = (
            <div>
                <Row>
                    {charts}
                </Row>
            </div>
        );

        return chartRow;
    }
}