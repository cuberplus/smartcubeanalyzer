import React from "react";
import { ChartPanelProps, ChartPanelState, ChartType, CaseStats, CrossColor, FastestSolve, MethodName, OllEdgeOrientation, PllCornerPermutation, Solve, StepName, StreakData } from "../Helpers/Types";
import { Chart as ChartJS, ChartData, CategoryScale, Point } from 'chart.js/auto';
import { calculateAverage, calculateMovingAverage, calculateMovingPercentage, calculateMovingStdDev, reduceDataset, splitIntoChunks, getTypicalAverages, calculateMovingAverageChopped } from "../Helpers/MathHelpers";
import { createOptions, buildChartHtml } from "../Helpers/ChartHelpers";
import { Row, Tooltip } from "react-bootstrap";
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { Const } from "../Helpers/Constants";
import DataGrid, { CellClickArgs } from 'react-data-grid';
import 'react-data-grid/lib/styles.css';
import 'chartjs-adapter-moment';
import { analyzeStepMoves, computeCaseFailureStats, computeSolveEfficiency, coreMovesCount } from "../Helpers/MoveAnalysis";

export class ChartPanel extends React.Component<ChartPanelProps, ChartPanelState> {
    state: ChartPanelState = { solves: [] };

    getEmptyChartData() {
        let data: ChartData<"line"> = {
            labels: [],
            datasets: []
        }
        return data;
    }

    buildRunningAverageData() {
        let movingAverage = calculateMovingAverage(this.props.solves.map(x => x.time), this.props.windowSize);

        let labels = [];
        for (let i = 1; i <= movingAverage.length; i++) {
            labels.push(i.toString())
        };

        movingAverage = reduceDataset(movingAverage, this.props.pointsPerGraph);
        labels = reduceDataset(labels, this.props.pointsPerGraph);

        let data: ChartData<"line"> = {
            labels,
            datasets: [{
                label: `Average Time Of ${this.props.windowSize}`,
                data: movingAverage
            }]
        }

        return data;
    }

    buildRunningStdDevData() {
        let movingAverage = calculateMovingStdDev(this.props.solves.map(x => x.time), this.props.windowSize);

        let labels = [];
        for (let i = 1; i <= movingAverage.length; i++) {
            labels.push(i.toString())
        };

        movingAverage = reduceDataset(movingAverage, this.props.pointsPerGraph);
        labels = reduceDataset(labels, this.props.pointsPerGraph);

        let data: ChartData<"line"> = {
            labels,
            datasets: [{
                label: `Average StdDev Of ${this.props.windowSize}`,
                data: movingAverage
            }]
        }

        return data;
    }

    buildRunningTpsData() {
        let movingAverage = calculateMovingAverage(this.props.solves.map(x => x.tps), this.props.windowSize);
        let movingAverageDuringExecution = calculateMovingAverage(this.props.solves.map(x => (x.turns / x.executionTime)), this.props.windowSize)

        let labels = [];
        for (let i = 1; i <= movingAverage.length; i++) {
            labels.push(i.toString())
        };

        movingAverage = reduceDataset(movingAverage, this.props.pointsPerGraph);
        movingAverageDuringExecution = reduceDataset(movingAverageDuringExecution, this.props.pointsPerGraph)
        labels = reduceDataset(labels, this.props.pointsPerGraph);

        let data: ChartData<"line"> = {
            labels,
            datasets: [{
                label: `Average TPS Of ${this.props.windowSize}`,
                data: movingAverage
            },
            {
                label: `Average TPS During Execution Of ${this.props.windowSize}`,
                data: movingAverageDuringExecution
            }]
        }

        return data;
    }

    buildRunningInspectionData() {
        let movingInspection = calculateMovingAverage(this.props.solves.map(x => x.inspectionTime), this.props.windowSize);

        let labels = [];
        for (let i = 1; i <= movingInspection.length; i++) {
            labels.push(i.toString())
        };

        movingInspection = reduceDataset(movingInspection, this.props.pointsPerGraph);
        labels = reduceDataset(labels, this.props.pointsPerGraph);

        let data: ChartData<"line"> = {
            labels,
            datasets: [{
                label: `Average Inspection Of ${this.props.windowSize}`,
                data: movingInspection
            }]
        }

        return data;
    }

    buildRunningTurnsData() {
        /*
        this.props.solves.forEach((solve, index) => {
            const turnList = solve.steps.map(s => s.moves).filter(Boolean).join(' ');
            console.debug(`[Average Turns] solve ${index + 1}: moveCount=${solve.turns}, turnList="${turnList}"`);
        });
        */
        let movingAverage = calculateMovingAverage(this.props.solves.map(x => x.turns), this.props.windowSize);

        let labels = [];
        for (let i = 1; i <= movingAverage.length; i++) {
            labels.push(i.toString())
        };

        movingAverage = reduceDataset(movingAverage, this.props.pointsPerGraph);
        labels = reduceDataset(labels, this.props.pointsPerGraph);

        let data: ChartData<"line"> = {
            labels,
            datasets: [{
                label: `Average Turns Of ${this.props.windowSize}`,
                data: movingAverage
            }]
        }

        return data;
    }

    buildRunningRecognitionExecution() {
        const colors = {
            recognition: 'rgb(54, 162, 235)',
            preAuf: 'rgb(153, 102, 255)',
            execution: 'rgb(255, 99, 132)',
            postAuf: 'rgb(255, 159, 64)',
        };
        let movingRecognition = calculateMovingAverage(this.props.solves.map(x => x.recognitionTime), this.props.windowSize);
        let labels = [];
        for (let i = 1; i <= movingRecognition.length; i++) {
            labels.push(i.toString());
        }
        movingRecognition = reduceDataset(movingRecognition, this.props.pointsPerGraph);
        labels = reduceDataset(labels, this.props.pointsPerGraph);

        if (this.props.use4SegmentTiming) {
            const movingPreAuf = reduceDataset(calculateMovingAverage(this.props.solves.map(x => x.preAufTime), this.props.windowSize), this.props.pointsPerGraph);
            const movingCoreExec = reduceDataset(calculateMovingAverage(this.props.solves.map(x => x.executionTime - x.preAufTime - x.postAufTime), this.props.windowSize), this.props.pointsPerGraph);
            const movingPostAuf = reduceDataset(calculateMovingAverage(this.props.solves.map(x => x.postAufTime), this.props.windowSize), this.props.pointsPerGraph);

            const hasPreAuf = movingPreAuf.some(v => v > 0);
            const hasPostAuf = movingPostAuf.some(v => v > 0);

            const datasets: ChartData<"line">["datasets"] = [];
            datasets.push({ label: `Average Recognition Of ${this.props.windowSize}`, data: movingRecognition, borderColor: colors.recognition, backgroundColor: colors.recognition });
            if (hasPreAuf) {
                datasets.push({ label: `Average Pre-AUF Of ${this.props.windowSize}`, data: movingPreAuf, borderColor: colors.preAuf, backgroundColor: colors.preAuf });
            }
            datasets.push({ label: `Average Execution Of ${this.props.windowSize}`, data: movingCoreExec, borderColor: colors.execution, backgroundColor: colors.execution });
            if (hasPostAuf) {
                datasets.push({ label: `Average Post-AUF Of ${this.props.windowSize}`, data: movingPostAuf, borderColor: colors.postAuf, backgroundColor: colors.postAuf });
            }

            return {
                labels,
                datasets,
            } as ChartData<"line">;
        }

        let movingExecution = reduceDataset(calculateMovingAverage(this.props.solves.map(x => x.executionTime), this.props.windowSize), this.props.pointsPerGraph);
        return {
            labels,
            datasets: [
                { label: `Average Recognition Of ${this.props.windowSize}`, data: movingRecognition, borderColor: colors.recognition, backgroundColor: colors.recognition },
                { label: `Average Execution Of ${this.props.windowSize}`, data: movingExecution, borderColor: colors.execution, backgroundColor: colors.execution },
            ],
        } as ChartData<"line">;
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
        let totals: { [step in StepName]?: number } = {};
        for (let i = 0; i < this.props.steps.length; i++) {
            totals[this.props.steps[i]] = 0;
        }

        let recentSolves = this.props.solves.slice(-this.props.windowSize);
        for (let i = 0; i < recentSolves.length; i++) {
            for (let j = 0; j < this.props.steps.length; j++) {
                totals[recentSolves[i].steps[j].name]! += recentSolves[i].steps[j].time;
            }
        }

        let labels: string[] = [];
        let values: number[] = [];

        for (let key in totals) {
            labels.push(key);
            values.push(totals[key as StepName]! / recentSolves.length);
        }

        // TODO: make the colors consistent
        let data: ChartData<"doughnut"> = {
            labels: labels,
            datasets: [{
                label: `Seconds each step takes (of recent ${this.props.windowSize})`,
                data: values
            }]
        }

        return data;
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
        let checkIfBad = (time: number) => { return time > badTime };
        let checkIfGood = (time: number) => { return time < goodTime }

        let movingPercentBad = calculateMovingPercentage(this.props.solves.map(x => x.time), this.props.windowSize, checkIfBad);
        let movingPercentGood = calculateMovingPercentage(this.props.solves.map(x => x.time), this.props.windowSize, checkIfGood);

        let labels = [];
        for (let i = 1; i <= movingPercentBad.length; i++) {
            labels.push(i.toString())
        };

        movingPercentBad = reduceDataset(movingPercentBad, this.props.pointsPerGraph);
        movingPercentGood = reduceDataset(movingPercentGood, this.props.pointsPerGraph);
        labels = reduceDataset(labels, this.props.pointsPerGraph);

        let data: ChartData<"line"> = {
            labels,
            datasets: [{
                label: `Percentage of good solves over last ${this.props.windowSize}`,
                data: movingPercentGood
            },
            {
                label: `Percentage of bad solves over last ${this.props.windowSize}`,
                data: movingPercentBad
            }]
        }

        return data;
    }

    buildOllCategoryChart(ollStepIndex: number) {
        let checkIfDot = (ollCase: string) => { return Const.OllEdgeOrientationMapping.get(ollCase) == OllEdgeOrientation.Dot };
        let checkIfLine = (ollCase: string) => { return Const.OllEdgeOrientationMapping.get(ollCase) == OllEdgeOrientation.Line };
        let checkIfAngle = (ollCase: string) => { return Const.OllEdgeOrientationMapping.get(ollCase) == OllEdgeOrientation.Angle };
        let checkIfCross = (ollCase: string) => { return Const.OllEdgeOrientationMapping.get(ollCase) == OllEdgeOrientation.Cross };

        let movingPercentDot = calculateMovingPercentage(this.props.solves.map(x => x.steps[ollStepIndex].case), this.props.windowSize, checkIfDot);
        let movingPercentLine = calculateMovingPercentage(this.props.solves.map(x => x.steps[ollStepIndex].case), this.props.windowSize, checkIfLine);
        let movingPercentAngle = calculateMovingPercentage(this.props.solves.map(x => x.steps[ollStepIndex].case), this.props.windowSize, checkIfAngle);
        let movingPercentCross = calculateMovingPercentage(this.props.solves.map(x => x.steps[ollStepIndex].case), this.props.windowSize, checkIfCross);

        let labels = [];
        for (let i = 1; i <= movingPercentDot.length; i++) {
            labels.push(i.toString())
        };

        movingPercentDot = reduceDataset(movingPercentDot, this.props.pointsPerGraph);
        movingPercentLine = reduceDataset(movingPercentLine, this.props.pointsPerGraph);
        movingPercentAngle = reduceDataset(movingPercentAngle, this.props.pointsPerGraph);
        movingPercentCross = reduceDataset(movingPercentCross, this.props.pointsPerGraph);

        labels = reduceDataset(labels, this.props.pointsPerGraph);

        let data: ChartData<"line"> = {
            labels,
            datasets: [
                {
                    label: `Percentage of OLL Dot Cases over last ${this.props.windowSize}`,
                    data: movingPercentDot
                },
                {
                    label: `Percentage of OLL Line Cases over last ${this.props.windowSize}`,
                    data: movingPercentLine
                },
                {
                    label: `Percentage of OLL Angle Cases over last ${this.props.windowSize}`,
                    data: movingPercentAngle
                },
                {
                    label: `Percentage of OLL Cross Cases over last ${this.props.windowSize}`,
                    data: movingPercentCross
                }
            ]
        }

        return data;
    }

    buildPllCategoryChart(pllStepIndex: number) {
        let checkIfSolved = (pllCase: string) => { return Const.PllCornerPermutationMapping.get(pllCase) == PllCornerPermutation.Solved };
        let checkIfAdjacent = (pllCase: string) => { return Const.PllCornerPermutationMapping.get(pllCase) == PllCornerPermutation.Adjacent };
        let checkIfDiagonal = (pllCase: string) => { return Const.PllCornerPermutationMapping.get(pllCase) == PllCornerPermutation.Diagonal };

        let movingPercentSolved = calculateMovingPercentage(this.props.solves.map(x => x.steps[pllStepIndex].case), this.props.windowSize, checkIfSolved);
        let movingPercentAdjacent = calculateMovingPercentage(this.props.solves.map(x => x.steps[pllStepIndex].case), this.props.windowSize, checkIfAdjacent);
        let movingPercentDiagonal = calculateMovingPercentage(this.props.solves.map(x => x.steps[pllStepIndex].case), this.props.windowSize, checkIfDiagonal);

        let labels = [];
        for (let i = 1; i <= movingPercentSolved.length; i++) {
            labels.push(i.toString())
        };

        movingPercentSolved = reduceDataset(movingPercentSolved, this.props.pointsPerGraph);
        movingPercentAdjacent = reduceDataset(movingPercentAdjacent, this.props.pointsPerGraph);
        movingPercentDiagonal = reduceDataset(movingPercentDiagonal, this.props.pointsPerGraph);

        labels = reduceDataset(labels, this.props.pointsPerGraph);

        let data: ChartData<"line"> = {
            labels,
            datasets: [
                {
                    label: `Percentage of PLL Solved Corner Cases over last ${this.props.windowSize}`,
                    data: movingPercentSolved
                },
                {
                    label: `Percentage of PLL Adjacent Corner Cases over last ${this.props.windowSize}`,
                    data: movingPercentAdjacent
                },
                {
                    label: `Percentage of PLL Diagonal Corner Cases over last ${this.props.windowSize}`,
                    data: movingPercentDiagonal
                }
            ]
        }

        return data;
    }

    buildTypicalCompare() {
        // This chart was built using data sourced from here:
        // https://www.cubeskills.com/blog/cfop-solve-splits-tool

        // Get users's average for each step, and average overall
        // If there are no solves, return an empty comparison chart
        if (this.props.solves.length === 0) {
            let labels = ['Cross', 'F2L', 'OLL', 'PLL'];
            let zeroes = [0, 0, 0, 0];
            let data: ChartData<"bar"> = {
                labels,
                datasets: [
                    {
                        label: `Your average by step over last ${this.props.windowSize}`,
                        data: zeroes
                    },
                    {
                        label: `Typical cuber's average by step, using your average time`,
                        data: zeroes
                    }
                ]
            };
            return data;
        }

        let average = calculateAverage(this.props.solves.map(x => x.time).slice(-this.props.windowSize));
        if (!Number.isFinite(average)) {
            let labels = ['Cross', 'F2L', 'OLL', 'PLL'];
            let zeroes = [0, 0, 0, 0];
            let data: ChartData<"bar"> = {
                labels,
                datasets: [
                    {
                        label: `Your average by step over last ${this.props.windowSize}`,
                        data: zeroes
                    },
                    {
                        label: `Typical cuber's average by step, using your average time`,
                        data: zeroes
                    }
                ]
            };
            return data;
        }
        let crossAverage = calculateAverage(this.props.solves.map(x => x.steps[0].time).slice(-this.props.windowSize));
        let f2l1Average = calculateAverage(this.props.solves.map(x => x.steps[1].time).slice(-this.props.windowSize));
        let f2l2Average = calculateAverage(this.props.solves.map(x => x.steps[2].time).slice(-this.props.windowSize));
        let f2l3Average = calculateAverage(this.props.solves.map(x => x.steps[3].time).slice(-this.props.windowSize));
        let f2l4Average = calculateAverage(this.props.solves.map(x => x.steps[4].time).slice(-this.props.windowSize));
        let ollAverage = calculateAverage(this.props.solves.map(x => x.steps[5].time).slice(-this.props.windowSize));
        let pllAverage = calculateAverage(this.props.solves.map(x => x.steps[6].time).slice(-this.props.windowSize));
        let f2lAverage = f2l1Average + f2l2Average + f2l3Average + f2l4Average;
        let yourAverages = [crossAverage, f2lAverage, ollAverage, pllAverage];

        // Get typical solver's average for each step, and overall
        let typicalAverages = getTypicalAverages(average);

        // Get percent differences
        //let differences = [0, 0, 0, 0]
        //let colors = ["green", "green", "green", "green"]
        //for (let i = 0; i < 4; i++) {
        //    differences[i] = (yourAverages[i] - typicalAverages[i]) / typicalAverages[i] * 100;
        //    if (differences[i] >= 0) {
        //        colors[i] = "red";
        //    }
        //}

        let labels = ['Cross', 'F2L', 'OLL', 'PLL'];
        let data: ChartData<"bar"> = {
            labels,
            datasets: [
                {
                    label: `Your average by step over last ${this.props.windowSize}`,
                    data: yourAverages
                },
                {
                    label: `Typical cuber's average by step, using your average time`,
                    data: typicalAverages
                },
                //{
                //    label: `Percent difference between your solves and typical solvers (lower is good)`,
                //    data: differences,
                //    backgroundColor: colors
                //}
            ]
        }

        return data;
    }

    buildHistogramData() {
        let recentSolves = this.props.solves.map(x => x.time).slice(-this.props.windowSize);

        let histogram = new Map<number, number>();

        for (let i = 0; i < recentSolves.length; i++) {
            let val: number = Math.trunc(recentSolves[i]);
            if (!histogram.get(val)) {
                histogram.set(val, 0);
            }
            histogram.set(val, histogram.get(val)! + 1)
        }

        let arr = Array.from(histogram).sort((a, b) => {
            return a[0] - b[0];
        })

        let labels = arr.map(a => a[0]);
        let values = arr.map(a => a[1]);

        let data: ChartData<"bar"> = {
            labels: labels,
            datasets: [{
                label: `Number of solves by time (of recent ${this.props.windowSize})`,
                data: values
            }]
        }

        return data;
    }

    buildInspectionData() {
        let recentSolves = this.props.solves.slice(-this.props.windowSize);
        recentSolves.sort((a, b) => {
            return a.inspectionTime - b.inspectionTime;
        })

        let chunkedArr: Solve[][] = splitIntoChunks(recentSolves, Const.InspectionGraphChunks);

        let labels: string[] = [];
        let values: number[] = [];

        for (let i = 0; i < Const.InspectionGraphChunks; i++) {
            labels.push("~" + calculateAverage(chunkedArr[i].map(x => x.inspectionTime)).toFixed(2).toString());
            values.push(calculateAverage(chunkedArr[i].map(x => x.time)));
        }

        let data: ChartData<"bar"> = {
            labels: labels,
            datasets: [{
                label: `Solve time by inspection time (of recent ${this.props.windowSize})`,
                data: values
            }]
        }

        return data;
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
        //let ao100 = calculateMovingAverageChopped(this.props.solves.map(x => x.time), 100, 5);
        //let ao1000 = calculateMovingAverageChopped(this.props.solves.map(x => x.time), 1000, 50);

        // Start initial records
        let records = {
            single: this.buildRecordDataset(dates, single),
            ao5: this.buildRecordDataset(dates.slice(4), ao5),
            ao12: this.buildRecordDataset(dates.slice(11), ao12),
            //ao100: this.buildRecordDataset(dates.slice(99), ao100),
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
                //{
                //    label: `Record Ao100`,
                //    data: records.ao100
                //},
                //{
                //    label: `Record Ao1000`,
                //    data: records.ao1000
                //}
            ]
        }

        return data;
    }

    buildRunningColorPercentages() {
        const colors = [
            { color: CrossColor.White, label: 'White', borderColor: 'Black', backgroundColor: 'Black' },
            { color: CrossColor.Yellow, label: 'Yellow', borderColor: 'Yellow', backgroundColor: 'Yellow' },
            { color: CrossColor.Red, label: 'Red', borderColor: 'Red', backgroundColor: 'Red' },
            { color: CrossColor.Orange, label: 'Orange', borderColor: 'Orange', backgroundColor: 'Orange' },
            { color: CrossColor.Blue, label: 'Blue', borderColor: 'Blue', backgroundColor: 'Blue' },
            { color: CrossColor.Green, label: 'Green', borderColor: 'Green', backgroundColor: 'Green' }
        ];

        // Check if there are any 'Unknown' color data points
        const hasUnknownColor = this.props.solves.some(solve => solve.crossColor === CrossColor.Unknown);
        if (hasUnknownColor) {
            colors.push({ color: CrossColor.Unknown, label: 'Unknown', borderColor: 'Purple', backgroundColor: 'Purple' });
        }

        let datasets = colors.map(({ color, label, borderColor, backgroundColor }) => {
            let movingPercent = calculateMovingPercentage(this.props.solves.map(x => x.crossColor), this.props.windowSize, (crossColor: CrossColor) => crossColor == color);
            movingPercent = reduceDataset(movingPercent, this.props.pointsPerGraph);
            return {
                label: `Percentage of solves with ${label} cross over last ${this.props.windowSize}`,
                data: movingPercent,
                borderColor,
                backgroundColor
            };
        });

        let labels = [];
        for (let i = 1; i <= datasets[0].data.length; i++) {
            labels.push(i.toString());
        }
        labels = reduceDataset(labels, this.props.pointsPerGraph);

        let data: ChartData<"line"> = {
            labels,
            datasets
        };

        return data;
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
        if (this.props.methodName === MethodName.CFOP) {
            const ollFailureData = labels.map((lbl, i) => effList[parseInt(lbl, 10) - 1]?.hadOllFailure ? movingAvg[i] : null);
            const pllFailureData = labels.map((lbl, i) => effList[parseInt(lbl, 10) - 1]?.hadPllFailure ? movingAvg[i] : null);
            datasets.push(
                {
                    label: 'OLL failure',
                    data: ollFailureData,
                    showLine: false,
                    pointRadius: 6,
                    pointBackgroundColor: 'rgba(255, 99, 132, 0.8)',
                    pointBorderColor: 'rgb(255, 99, 132)',
                    pointBorderWidth: 1
                },
                {
                    label: 'PLL failure',
                    data: pllFailureData,
                    showLine: false,
                    pointRadius: 6,
                    pointBackgroundColor: 'rgba(54, 162, 235, 0.8)',
                    pointBorderColor: 'rgb(54, 162, 235)',
                    pointBorderWidth: 1
                }
            );
        }

        let data: ChartData<"line"> = { labels, datasets };
        return data;
    }

    buildBestSolves() {
        const cols = [
            { key: 'time', name: 'Time' },
            { key: 'date', name: 'Date' },
            { key: 'scramble', name: 'Scramble' },
            { key: 'id', name: 'ID' },
            { key: 'fullstep', name: "Full Step" }
        ];

        let solveCopy: Solve[] = structuredClone(this.props.solves);
        let fastest: Solve[] = solveCopy.sort((a: Solve, b: Solve) => a.time - b.time).slice(0, Const.FastestSolvesCount);
        let reduced: FastestSolve[] = fastest.map(x => {
            return {
                date: x.date.toDateString(),
                time: x.time.toFixed(3),
                scramble: x.scramble,
                id: x.id,
                fullstep: x.isFullStep ? "Yes 🔥" : "No",
                source: x.source,
                rawSourceId: x.rawSourceId
            } as FastestSolve;
        });

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
        // TODO: is there a better spot to put this?
        ChartJS.register(CategoryScale);

        let charts: JSX.Element[] = [];

        // Check if OLL and PLL are selected
        let ollIndex: number = this.props.steps.indexOf(StepName.OLL);
        let pllIndex: number = this.props.steps.indexOf(StepName.PLL);

        // Add charts that require exactly one step to be chosen
        if (this.props.steps.length == 1 && (this.props.steps[0] === StepName.OLL || this.props.steps[0] === StepName.PLL)) {
            charts.push(buildChartHtml(<Bar data={this.buildCaseData()} options={createOptions(ChartType.Bar, "Solve Number", "Time (s)", this.props.useLogScale)} />, "Average Recognition Time and Execution Time per Case", "This chart shows how long your execution/recognition took for any individual last layer algorithm, sorted by how long each took."));
            charts.push(buildChartHtml(this.buildAlgorithmPracticeTable(), "Algorithm Practice", "Per-case failure rate and move efficiency. 'Failed' means core move count exceeded mode and average time for that case, suggesting a redo or correction. 'Avg Wasted' shows redundant same-face moves that could be cancelled."));
        }

        // Add remaining charts
        charts.push(buildChartHtml(<Line data={this.buildRunningAverageData()} options={createOptions(ChartType.Line, "Solve Number", "Time (s)", this.props.useLogScale)} />, "Average Time", "This chart shows your running average"));
        charts.push(buildChartHtml(<Line data={this.buildRunningRecognitionExecution()} options={createOptions(ChartType.Line, "Solve Number", "Time (s)", this.props.useLogScale)} />, "Average Recognition and Execution", "This chart shows your running average, split up by recognition time and execution time"));
        charts.push(buildChartHtml(<Bar data={this.buildHistogramData()} options={createOptions(ChartType.Bar, "Time (s)", "Count", this.props.useLogScale)} />, "Count of Solves by How Long They Took", "This chart shows how many solves you have done in 10s, 11s, 12s, etc..."));
        charts.push(buildChartHtml(<Line data={this.buildRunningTpsData()} options={createOptions(ChartType.Line, "Solve Number", "Time (s)", this.props.useLogScale)} />, "Average Turns Per Second", "This chart shows your average turns per second. 'TPS During Execution' only counts your TPS while actively turning the cube"));
        charts.push(buildChartHtml(<Line data={this.buildRunningTurnsData()} options={createOptions(ChartType.Line, "Solve Number", "Turns", this.props.useLogScale)} />, "Average Turns", "This chart shows your average number of turns, in quarter turn metric"));
        charts.push(buildChartHtml(<Line data={this.buildRunningEfficiencyData()} options={createOptions(ChartType.Line, "Solve Number", "Efficiency %", this.props.useLogScale)} />, "Move Efficiency", "This chart shows the ratio of simplified (after cancelling redundant same-face moves) to actual move count. 100% means no wasted moves."));
        charts.push(buildChartHtml(this.buildBestSolves(), `Top ${Const.FastestSolvesCount} Fastest Solves`, `This shows your ${Const.FastestSolvesCount} fastest solves, given the filters`));
        charts.push(buildChartHtml(<Line data={this.buildRunningStdDevData()} options={createOptions(ChartType.Line, "Solve Number", "Time (s)", this.props.useLogScale)} />, "Average Standard Deviation", "This chart shows your running average's standard deviation"));
        charts.push(buildChartHtml(<Line data={this.buildRunningColorPercentages()} options={createOptions(ChartType.Line, "Solve Number", "Percentage", this.props.useLogScale)} />, "Percentage of Solves by Cross Color", "This chart shows what percentage of solves started with cross on White/Yellow/etc..."));
        charts.push(buildChartHtml(<Bar data={this.buildInspectionData()} options={createOptions(ChartType.Bar, "Inspection Time (s)", "Solve Time (s)", this.props.useLogScale)} />, "Average solve time by inspection time", "This chart shows your average, grouped up by how much inspection time (For example, the left bar is the 1/7 of your solves with the lowest inspection time, and the right bar is the 1/7 of your solves with the most inspection time)"));
        charts.push(buildChartHtml(<Line data={this.buildStepAverages()} options={createOptions(ChartType.Line, "Solve Number", "Time (s)", this.props.useLogScale)} />, "Average Time by Step", "This chart shows what percentage of your solve each step takes"));
        charts.push(buildChartHtml(<Line data={this.buildRunningInspectionData()} options={createOptions(ChartType.Line, "Solve Number", "Time (s)", this.props.useLogScale)} />, "Average Inspection Time", "This chart shows how much inspection time you use on average"));
        charts.push(buildChartHtml(this.buildAllStreakData(), "Longest Daily Streaks", "How many days in a row you've achieved solves of each time"));
        charts.push(buildChartHtml(<Line data={this.buildDailyRecordData()} options={createOptions(ChartType.Line, "Date", "Time (s)", this.props.useLogScale, true, true)} />, "Daily Fastest Solve", "This chart shows the fastest solve for each day, based on the selected filters"));
        charts.push(buildChartHtml(this.buildCurrentRecords(), "Current Records", "This chart shows your current records for Single, Ao5, Ao12, Ao100, and Ao1000"));

        // Add charts that require OLL
        if (ollIndex != -1) {
            charts.push(buildChartHtml(<Line data={this.buildOllCategoryChart(ollIndex)} options={createOptions(ChartType.Line, "Solve Number", "Percentage", this.props.useLogScale)} />, "OLL Edge Orientation", "This chart shows your percentage of OLL cases by edge orientation"));
        }

        // Add charts that require PLL
        if (pllIndex != -1) {
            charts.push(buildChartHtml(<Line data={this.buildPllCategoryChart(pllIndex)} options={createOptions(ChartType.Line, "Solve Number", "Percentage", this.props.useLogScale)} />, "PLL Corner Permutation", "This chart shows your percentage of PLL cases by corner permutation"));
        }

        // Add charts that require CFOP method (and all of its steps) to be chosen
        if (this.props.methodName == MethodName.CFOP && this.props.steps.length == Const.MethodSteps[MethodName.CFOP].length) {
            charts.push(buildChartHtml(<Bar data={this.buildTypicalCompare()} options={createOptions(ChartType.Bar, "Step Name", "Time (s)", this.props.useLogScale, false)} />, "Time Per Step, Compared to Typical Solver", "This chart shows how long each step takes, compared to a typical solver at your average. The 'typical' data is calculated based on a tool provided from Felix Zemdegs's CubeSkills blog"));
        }

        // Add charts that require 2+ steps
        if (this.props.steps.length >= 2) {
            charts.push(buildChartHtml(<Doughnut data={this.buildStepPercentages()} options={createOptions(ChartType.Doughnut, "", "", this.props.useLogScale)} />, "Percentage of the Solve Each Step Took", "This chart shows what percentage of your solve each step takes"));
        }

        // Add charts that require all steps to be chosen
        if (this.props.steps.length == Const.MethodSteps[this.props.methodName].length) {
            charts.push(buildChartHtml(<Line data={this.buildGoodBadData(this.props.goodTime, this.props.badTime)} options={createOptions(ChartType.Line, "Solve Number", "Percentage", this.props.useLogScale)} />, "Percentage of 'Good' and 'Bad' Solves", "This chart shows your running average of solves considered 'good' and 'bad'. This can be configured in the filter panel. Just set the good and bad values to times you feel are correct"));
            charts.push(buildChartHtml(<Line data={this.buildRecordHistory()} options={createOptions(ChartType.Line, "Date", "Time (s)", this.props.useLogScale, true, true)} />, "History of Records", "This chart shows your history of PBs. Note that this will only show solves that meet the criteria in your filters, so don't be alarmed if you don't see your PB here. As a note, Ao12 removes the best and worst solves of the 12. Ao100 removes the best and worst 5. Ao1000 removes the best and worst 50."))
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