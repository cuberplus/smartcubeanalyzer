import React from "react";
import {
    ChartPanelProps,
    ChartPanelState,
    ChartType,
    FastestSolve,
    MethodName,
    Solve,
    StepName,
} from "../Helpers/Types";
import { Chart as ChartJS, CategoryScale } from 'chart.js/auto';
import { createOptions, buildChartHtml } from "../Helpers/ChartHelpers";
import { Row, Spinner, Tooltip } from "react-bootstrap";
import { ThemeContext } from "../contexts/ThemeContext";
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { Const } from "../Helpers/Constants";
import DataGrid, { CellClickArgs } from 'react-data-grid';
import 'react-data-grid/lib/styles.css';
import 'chartjs-adapter-moment';
import { createChartWorker } from '../Workers/createChartWorker';

ChartJS.register(CategoryScale);

/** Each watched prop is compared with !==, so only identity-comparable values belong here. */
type WatchedProp = Solve[] | number | string | boolean | MethodName;

type ThemeContextValue = { isDark?: boolean };

/** Fill the chart card / Ratio box; DataGrid defaults to ~350px without an explicit height chain. */
const chartDataGridWrapStyle: React.CSSProperties = {
    height: '100%',
    width: '100%',
    minHeight: 0,
    overflow: 'auto',
};

const chartDataGridStyle: React.CSSProperties = { height: '100%' };

// ── Static DataGrid column definitions ───────────────────────────────────────

const STREAK_COLS = [
    { key: 'time', name: 'Target Time' },
    { key: 'currentstreak', name: 'Current Streak' },
    { key: 'longeststreak', name: 'Longest Streak' },
];

const RECORD_COLS = [
    { key: 'recordType', name: 'Record Type' },
    { key: 'time', name: 'Time (s)' },
];

const ALGO_COLS = [
    { key: 'case', name: 'Case' },
    { key: 'total', name: 'Total' },
    { key: 'failed', name: 'Failed' },
    { key: 'failureRate', name: 'Failure %' },
    { key: 'avgMoves', name: 'Avg Moves' },
    { key: 'expectedMoves', name: 'Expected' },
    { key: 'avgWasted', name: 'Avg Wasted' },
    { key: 'avgTime', name: 'Avg Time (s)' },
];

const BEST_SOLVES_COLS = [
    { key: 'time', name: 'Time' },
    { key: 'date', name: 'Date' },
    { key: 'scramble', name: 'Scramble' },
    { key: 'id', name: 'ID' },
    { key: 'fullstep', name: 'Full Step' },
];

// ── Component ─────────────────────────────────────────────────────────────────

export class ChartPanel extends React.Component<ChartPanelProps, ChartPanelState & { _propsKey?: string }> {
    static contextType = ThemeContext;
    state: ChartPanelState & { _propsKey?: string } = { chartData: null, isComputing: false };

    static getDerivedStateFromProps(
        nextProps: ChartPanelProps,
        prevState: ChartPanelState & { _propsKey?: string }
    ): Partial<ChartPanelState & { _propsKey?: string }> | null {
        const propsKey = [
            nextProps.steps.join(','),
            nextProps.methodName,
        ].join('|');
        if (prevState._propsKey !== propsKey) {
            return { chartData: null, isComputing: true, _propsKey: propsKey };
        }
        return null;
    }

    private _worker: Worker | null = null;
    private _pendingRequestId = 0;

    /** Snapshot of the props the worker depends on; `solves` is compared by reference. */
    private _lastWatched: WatchedProp[] = [];

    private _isDark(): boolean {
        return (this.context as ThemeContextValue | undefined)?.isDark ?? false;
    }

    private _watched(): WatchedProp[] {
        const p = this.props;
        return [p.solves, p.windowSize, p.pointsPerGraph, p.steps.join(','), p.useLogScale,
            p.goodTime, p.badTime, p.methodName, p.use4SegmentTiming, this._isDark()];
    }

    private _propsChanged(): boolean {
        const next = this._watched();
        return next.length !== this._lastWatched.length || next.some((v, i) => v !== this._lastWatched[i]);
    }

    private _sendWork(): void {
        if (!this._worker) return;
        const p = this.props;
        this._pendingRequestId++;
        this._lastWatched = this._watched();
        this.setState({ isComputing: true, chartData: null });
        this._worker.postMessage({
            requestId: this._pendingRequestId,
            solves: p.solves,
            windowSize: p.windowSize,
            pointsPerGraph: p.pointsPerGraph,
            steps: p.steps,
            goodTime: p.goodTime,
            badTime: p.badTime,
            methodName: p.methodName,
            use4SegmentTiming: p.use4SegmentTiming,
            isDark: this._isDark(),
        });
    }

    componentDidMount() {
        this._worker = createChartWorker();
        this._worker.onmessage = (e: MessageEvent) => {
            if (e.data.requestId !== this._pendingRequestId) return; // stale response
            this.setState({ chartData: e.data.chartData, isComputing: false });
        };
        this._sendWork();
    }

    componentDidUpdate(_prevProps: ChartPanelProps) {
        if (this._propsChanged()) {
            this._sendWork();
        }
    }

    componentWillUnmount() {
        this._worker?.terminate();
        this._worker = null;
    }

    openSolveSource(params: CellClickArgs<FastestSolve>) {
        const url = params.row.source === 'acubemy' && params.row.rawSourceId
            ? "https://acubemy.com/shared/" + encodeURIComponent(params.row.rawSourceId)
            : "https://app.cubeast.com/log/solves/" + encodeURIComponent(params.row.id);
        window.open(url, '_blank', 'noopener,noreferrer');
    }

    createTooltip(description: string): JSX.Element {
        return (
            <Tooltip id="tooltip">
                {description}
            </Tooltip>
        );
    }

    render() {
        const { chartData } = this.state;
        const p = this.props;
        const isDark = this._isDark();

        if (!chartData) {
            return (
                <div style={{ padding: '2rem', textAlign: 'center' }}>
                    <Spinner animation="border" />
                    <div>Computing charts…</div>
                </div>
            );
        }

        const c = chartData;
        const charts: JSX.Element[] = [];

        const hasOll = p.steps.includes(StepName.OLL);
        const hasPll = p.steps.includes(StepName.PLL);

        if (p.steps.length === 1 && (p.steps[0] === StepName.OLL || p.steps[0] === StepName.PLL) && c.caseData) {
            charts.push(buildChartHtml(
                <Bar data={c.caseData} options={createOptions(ChartType.Bar, "Case", "Time (s)", p.useLogScale, true, false, isDark)} />,
                "Average Recognition Time and Execution Time per Case",
                "This chart shows how long your execution/recognition took for any individual last layer algorithm, sorted by how long each took."
            ));
            charts.push(buildChartHtml(
                <div style={chartDataGridWrapStyle}><DataGrid style={chartDataGridStyle} rows={c.algoPracticeRows ?? []} columns={ALGO_COLS} /></div>,
                "Algorithm Practice",
                "Per-case failure rate and move efficiency. 'Failed' means core move count exceeded mode and average time for that case, suggesting a redo or correction. 'Avg Wasted' shows redundant same-face moves that could be cancelled."
            ));
        }

        charts.push(buildChartHtml(<Line data={c.runningAverage} options={createOptions(ChartType.Line, "Solve Number", "Time (s)", p.useLogScale, true, false, isDark)} />, "Average Time", "This chart shows your running average"));
        charts.push(buildChartHtml(<Line data={c.runningRecognitionExecution} options={createOptions(ChartType.Line, "Solve Number", "Time (s)", p.useLogScale, true, false, isDark)} />, "Average Recognition and Execution", "This chart shows your running average, split up by recognition time and execution time"));
        charts.push(buildChartHtml(<Bar data={c.histogram} options={createOptions(ChartType.Bar, "Time (s)", "Count", p.useLogScale, true, false, isDark)} />, "Count of Solves by How Long They Took", "This chart shows how many solves you have done in 10s, 11s, 12s, etc..."));
        charts.push(buildChartHtml(<Line data={c.runningTps} options={createOptions(ChartType.Line, "Solve Number", "Time (s)", p.useLogScale, true, false, isDark)} />, "Average Turns Per Second", "This chart shows your average turns per second. 'TPS During Execution' only counts your TPS while actively turning the cube"));
        charts.push(buildChartHtml(<Line data={c.runningTurns} options={createOptions(ChartType.Line, "Solve Number", "Turns", p.useLogScale, true, false, isDark)} />, "Average Turns", "This chart shows your average number of turns, in quarter turn metric"));
        charts.push(buildChartHtml(<Line data={c.runningEfficiency} options={createOptions(ChartType.Line, "Solve Number", "Percentage", p.useLogScale, true, false, isDark)} />, "Solve Efficiency", "This chart shows move efficiency ratio (after cancelling redundant same-face moves; 100% = no wasted moves), OLL/PLL success rates, and a combined solve efficiency (move efficiency minus failure rates)."));
        charts.push(buildChartHtml(
            <div style={chartDataGridWrapStyle}><DataGrid style={chartDataGridStyle} rows={c.bestSolvesData} columns={BEST_SOLVES_COLS} onCellClick={this.openSolveSource} /></div>,
            `Top ${Const.FastestSolvesCount} Fastest Solves`,
            `This shows your ${Const.FastestSolvesCount} fastest solves, given the filters`
        ));
        charts.push(buildChartHtml(<Line data={c.runningStdDev} options={createOptions(ChartType.Line, "Solve Number", "Time (s)", p.useLogScale, true, false, isDark)} />, "Average Standard Deviation", "This chart shows your running average's standard deviation"));
        charts.push(buildChartHtml(<Line data={c.runningColorPercentages} options={createOptions(ChartType.Line, "Solve Number", "Percentage", p.useLogScale, true, false, isDark)} />, "Percentage of Solves by Cross Color", "This chart shows what percentage of solves started with cross on White/Yellow/etc..."));
        if (c.inspection != null) {
            charts.push(buildChartHtml(<Bar data={c.inspection} options={createOptions(ChartType.Bar, "Inspection Time (s)", "Solve Time (s)", p.useLogScale, true, false, isDark)} />, "Average solve time by inspection time", "This chart shows your average, grouped up by how much inspection time (For example, the left bar is the 1/7 of your solves with the lowest inspection time, and the right bar is the 1/7 of your solves with the most inspection time)"));
        }
        charts.push(buildChartHtml(<Line data={c.stepAverages} options={createOptions(ChartType.Line, "Solve Number", "Time (s)", p.useLogScale, true, false, isDark)} />, "Average Time by Step", "This chart shows what percentage of your solve each step takes"));
        if (c.runningInspection != null) {
            charts.push(buildChartHtml(<Line data={c.runningInspection} options={createOptions(ChartType.Line, "Solve Number", "Time (s)", p.useLogScale, true, false, isDark)} />, "Average Inspection Time", "This chart shows how much inspection time you use on average"));
        }
        charts.push(buildChartHtml(<div style={chartDataGridWrapStyle}><DataGrid style={chartDataGridStyle} rows={c.streakRows} columns={STREAK_COLS} /></div>, "Longest Daily Streaks", "How many days in a row you've achieved solves of each time"));
        charts.push(buildChartHtml(<Line data={c.dailyRecord} options={createOptions(ChartType.Line, "Date", "Time (s)", p.useLogScale, true, true, isDark)} />, "Daily Fastest Solve", "This chart shows the fastest solve for each day, based on the selected filters"));
        charts.push(buildChartHtml(<div style={chartDataGridWrapStyle}><DataGrid style={chartDataGridStyle} rows={c.recordRows} columns={RECORD_COLS} /></div>, "Current Records", "This chart shows your current records for Single, Ao5, Ao12, Ao100, and Ao1000"));

        if (hasOll && c.ollCategory) {
            charts.push(buildChartHtml(<Line data={c.ollCategory} options={createOptions(ChartType.Line, "Solve Number", "Percentage", p.useLogScale, true, false, isDark)} />, "OLL Edge Orientation", "This chart shows your percentage of OLL cases by edge orientation"));
        }

        if (hasPll && c.pllCategory) {
            charts.push(buildChartHtml(<Line data={c.pllCategory} options={createOptions(ChartType.Line, "Solve Number", "Percentage", p.useLogScale, true, false, isDark)} />, "PLL Corner Permutation", "This chart shows your percentage of PLL cases by corner permutation"));
        }

        if (p.methodName === MethodName.CFOP && p.steps.length === Const.MethodSteps[MethodName.CFOP].length) {
            charts.push(buildChartHtml(<Bar data={c.typicalCompare} options={createOptions(ChartType.Bar, "Step Name", "Time (s)", p.useLogScale, false, false, isDark)} />, "Time Per Step, Compared to Typical Solver", "This chart shows how long each step takes, compared to a typical solver at your average. The 'typical' data is calculated based on a tool provided from Felix Zemdegs's CubeSkills blog"));
        }

        if (p.steps.length >= 2) {
            charts.push(buildChartHtml(<Doughnut data={c.stepPercentages} options={createOptions(ChartType.Doughnut, "", "", p.useLogScale, true, false, isDark)} />, "Percentage of the Solve Each Step Took", "This chart shows what percentage of your solve each step takes"));
        }

        if (p.steps.length === Const.MethodSteps[p.methodName].length) {
            charts.push(buildChartHtml(<Line data={c.goodBad} options={createOptions(ChartType.Line, "Solve Number", "Percentage", p.useLogScale, true, false, isDark)} />, "Percentage of 'Good' and 'Bad' Solves", "This chart shows your running average of solves considered 'good' and 'bad'. This can be configured in the filter panel. Just set the good and bad values to times you feel are correct"));
            charts.push(buildChartHtml(<Line data={c.recordHistory} options={createOptions(ChartType.Line, "Date", "Time (s)", p.useLogScale, true, true, isDark)} />, "History of Records", "This chart shows your history of PBs. Note that this will only show solves that meet the criteria in your filters, so don't be alarmed if you don't see your PB here. As a note, Ao12 removes the best and worst solves of the 12. Ao100 removes the best and worst 5. Ao1000 removes the best and worst 50."));
        }

        return (
            <div>
                <Row className="g-2 g-md-3">
                    {charts}
                </Row>
            </div>
        );
    }
}
