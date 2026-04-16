import React from "react";
import {
    AlgoPracticeRow,
    ChartPanelProps,
    ChartPanelState,
    ChartType,
    FastestSolve,
    MethodName,
    RecordRow,
    Solve,
    StepName,
    StreakRow,
} from "../Helpers/Types";
import { Chart as ChartJS, ChartData, CategoryScale } from 'chart.js/auto';
import { createOptions, buildChartHtml } from "../Helpers/ChartHelpers";
import { Row, Col, Card, ButtonGroup, Button, OverlayTrigger, Ratio, Spinner, Tooltip } from "react-bootstrap";
import { ThemeContext } from "../contexts/ThemeContext";
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { Const } from "../Helpers/Constants";
import DataGrid, { CellClickArgs } from 'react-data-grid';
import 'react-data-grid/lib/styles.css';
import 'chartjs-adapter-moment';
import { createChartWorker } from '../Workers/createChartWorker';

ChartJS.register(CategoryScale);

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
    state: ChartPanelState & { _propsKey?: string } = { chartData: null, isComputing: false, solvesPerPeriod: 'day' };

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

    // Cached prop refs for change detection
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
    private _lastRecordHistoryAllDaysRef: boolean = false;

    private _isDark(): boolean {
        return (this.context as { isDark?: boolean } | undefined)?.isDark ?? false;
    }

    private _propsChanged(): boolean {
        const p = this.props;
        const stepsKey = p.steps.join(',');
        const isDark = this._isDark();
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
            this._lastIsDarkRef !== isDark ||
            this._lastRecordHistoryAllDaysRef !== p.recordHistoryAllDays
        );
    }

    private _updatePropsRefs(): void {
        const p = this.props;
        const isDark = this._isDark();
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
        this._lastRecordHistoryAllDaysRef = p.recordHistoryAllDays;
    }

    private _sendWork(): void {
        if (!this._worker) return;
        const p = this.props;
        this._pendingRequestId++;
        this._updatePropsRefs();
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
            recordHistoryAllDays: p.recordHistoryAllDays,
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
        if (params.row.source === 'acubemy' && params.row.rawSourceId) {
            window.open("https://acubemy.com/shared/" + params.row.rawSourceId);
            return;
        }
        window.open("https://app.cubeast.com/log/solves/" + params.row.id);
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
                <Bar data={c.caseData as ChartData<"bar">} options={createOptions(ChartType.Bar, "Case", "Time (s)", p.useLogScale, true, false, isDark)} />,
                "Average Recognition Time and Execution Time per Case",
                "This chart shows how long your execution/recognition took for any individual last layer algorithm, sorted by how long each took."
            ));
            charts.push(buildChartHtml(
                <div style={chartDataGridWrapStyle}><DataGrid style={chartDataGridStyle} rows={c.algoPracticeRows as AlgoPracticeRow[]} columns={ALGO_COLS} /></div>,
                "Algorithm Practice",
                "Per-case failure rate and move efficiency. 'Failed' means core move count exceeded mode and average time for that case, suggesting a redo or correction. 'Avg Wasted' shows redundant same-face moves that could be cancelled."
            ));
        }

        charts.push(buildChartHtml(<Line data={c.runningAverage as ChartData<"line">} options={createOptions(ChartType.Line, "Solve Number", "Time (s)", p.useLogScale, true, false, isDark)} />, "Average Time", "This chart shows your running average"));
        charts.push(buildChartHtml(<Line data={c.runningRecognitionExecution as ChartData<"line">} options={createOptions(ChartType.Line, "Solve Number", "Time (s)", p.useLogScale, true, false, isDark)} />, "Average Recognition and Execution", "This chart shows your running average, split up by recognition time and execution time"));
        charts.push(buildChartHtml(<Bar data={c.histogram as ChartData<"bar">} options={createOptions(ChartType.Bar, "Time (s)", "Count", p.useLogScale, true, false, isDark)} />, "Count of Solves by How Long They Took", "This chart shows how many solves you have done in 10s, 11s, 12s, etc..."));
        charts.push(buildChartHtml(<Line data={c.runningTps as ChartData<"line">} options={createOptions(ChartType.Line, "Solve Number", "Time (s)", p.useLogScale, true, false, isDark)} />, "Average Turns Per Second", "This chart shows your average turns per second. 'TPS During Execution' only counts your TPS while actively turning the cube"));
        charts.push(buildChartHtml(<Line data={c.runningTurns as ChartData<"line">} options={createOptions(ChartType.Line, "Solve Number", "Turns", p.useLogScale, true, false, isDark)} />, "Average Turns", "This chart shows your average number of turns, in quarter turn metric"));
        charts.push(buildChartHtml(<Line data={c.runningEfficiency as ChartData<"line">} options={createOptions(ChartType.Line, "Solve Number", "Percentage", p.useLogScale, true, false, isDark)} />, "Solve Efficiency", "This chart shows move efficiency ratio (after cancelling redundant same-face moves; 100% = no wasted moves), OLL/PLL success rates, and a combined solve efficiency (move efficiency minus failure rates)."));
        charts.push(buildChartHtml(
            <div style={chartDataGridWrapStyle}><DataGrid style={chartDataGridStyle} rows={c.bestSolvesData as FastestSolve[]} columns={BEST_SOLVES_COLS} onCellClick={this.openSolveSource} /></div>,
            `Top ${Const.FastestSolvesCount} Fastest Solves`,
            `This shows your ${Const.FastestSolvesCount} fastest solves, given the filters`
        ));
        charts.push(buildChartHtml(<Line data={c.runningStdDev as ChartData<"line">} options={createOptions(ChartType.Line, "Solve Number", "Time (s)", p.useLogScale, true, false, isDark)} />, "Average Standard Deviation", "This chart shows your running average's standard deviation"));
        charts.push(buildChartHtml(<Line data={c.runningColorPercentages as ChartData<"line">} options={createOptions(ChartType.Line, "Solve Number", "Percentage", p.useLogScale, true, false, isDark)} />, "Percentage of Solves by Cross Color", "This chart shows what percentage of solves started with cross on White/Yellow/etc..."));
        if (c.inspection != null) {
            charts.push(buildChartHtml(<Bar data={c.inspection as ChartData<"bar">} options={createOptions(ChartType.Bar, "Inspection Time (s)", "Solve Time (s)", p.useLogScale, true, false, isDark)} />, "Average solve time by inspection time", "This chart shows your average, grouped up by how much inspection time (For example, the left bar is the 1/7 of your solves with the lowest inspection time, and the right bar is the 1/7 of your solves with the most inspection time)"));
        }
        charts.push(buildChartHtml(<Line data={c.stepAverages as ChartData<"line">} options={createOptions(ChartType.Line, "Solve Number", "Time (s)", p.useLogScale, true, false, isDark)} />, "Average Time by Step", "This chart shows what percentage of your solve each step takes"));
        if (c.runningInspection != null) {
            charts.push(buildChartHtml(<Line data={c.runningInspection as ChartData<"line">} options={createOptions(ChartType.Line, "Solve Number", "Time (s)", p.useLogScale, true, false, isDark)} />, "Average Inspection Time", "This chart shows how much inspection time you use on average"));
        }
        charts.push(buildChartHtml(<div style={chartDataGridWrapStyle}><DataGrid style={chartDataGridStyle} rows={c.streakRows as StreakRow[]} columns={STREAK_COLS} /></div>, "Longest Daily Streaks", "How many days in a row you've achieved solves of each time"));
        charts.push(buildChartHtml(<Line data={c.dailyRecord as ChartData<"line">} options={createOptions(ChartType.Line, "Date", "Time (s)", p.useLogScale, true, true, isDark)} />, "Daily Fastest Solve", "This chart shows the fastest solve for each day, based on the selected filters"));
        {
            const period = this.state.solvesPerPeriod;
            const periodLabels: Record<typeof period, string> = { day: 'Daily', week: 'Weekly', month: 'Monthly' };
            const periodData = { day: c.solvesPerDay, week: c.solvesPerWeek, month: c.solvesPerMonth }[period];
            const xAxisLabel = { day: 'Date', week: 'Week Starting', month: 'Month' }[period];
            charts.push(
                <Col key="solvesPerPeriod" className="col-12 col-md-6">
                    <Card className="p-2 p-md-3 shadow-sm">
                        <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-solves-period">Number of solves completed per day, week, or month</Tooltip>}>
                            <Card.Text className="text-center fw-bold">Solve Count ⓘ</Card.Text>
                        </OverlayTrigger>
                        <div className="d-flex justify-content-center mb-2">
                            <ButtonGroup size="sm">
                                {(['day', 'week', 'month'] as const).map(p => (
                                    <Button key={p} variant={period === p ? 'primary' : 'outline-secondary'}
                                        onClick={() => this.setState({ solvesPerPeriod: p })}>
                                        {periodLabels[p]}
                                    </Button>
                                ))}
                            </ButtonGroup>
                        </div>
                        <Ratio aspectRatio="4x3">
                            <Bar data={periodData as ChartData<"bar">} options={createOptions(ChartType.Bar, xAxisLabel, "Solves", false, false, false, isDark)} />
                        </Ratio>
                    </Card>
                </Col>
            );
        }
        charts.push(buildChartHtml(<div style={chartDataGridWrapStyle}><DataGrid style={chartDataGridStyle} rows={c.recordRows as RecordRow[]} columns={RECORD_COLS} /></div>, "Current Records", "This chart shows your current records for Single, Ao5, Ao12, Ao100, and Ao1000"));

        if (hasOll) {
            charts.push(buildChartHtml(<Line data={c.ollCategory as ChartData<"line">} options={createOptions(ChartType.Line, "Solve Number", "Percentage", p.useLogScale, true, false, isDark)} />, "OLL Edge Orientation", "This chart shows your percentage of OLL cases by edge orientation"));
        }

        if (hasPll) {
            charts.push(buildChartHtml(<Line data={c.pllCategory as ChartData<"line">} options={createOptions(ChartType.Line, "Solve Number", "Percentage", p.useLogScale, true, false, isDark)} />, "PLL Corner Permutation", "This chart shows your percentage of PLL cases by corner permutation"));
        }

        if (p.methodName === MethodName.CFOP && p.steps.length === Const.MethodSteps[MethodName.CFOP].length) {
            charts.push(buildChartHtml(<Bar data={c.typicalCompare as ChartData<"bar">} options={createOptions(ChartType.Bar, "Step Name", "Time (s)", p.useLogScale, false, false, isDark)} />, "Time Per Step, Compared to Typical Solver", "This chart shows how long each step takes, compared to a typical solver at your average. The 'typical' data is calculated based on a tool provided from Felix Zemdegs's CubeSkills blog"));
        }

        if (p.steps.length >= 2) {
            charts.push(buildChartHtml(<Doughnut data={c.stepPercentages as ChartData<"doughnut">} options={createOptions(ChartType.Doughnut, "", "", p.useLogScale, true, false, isDark)} />, "Percentage of the Solve Each Step Took", "This chart shows what percentage of your solve each step takes"));
        }

        if (p.steps.length === Const.MethodSteps[p.methodName].length) {
            charts.push(buildChartHtml(<Line data={c.goodBad as ChartData<"line">} options={createOptions(ChartType.Line, "Solve Number", "Percentage", p.useLogScale, true, false, isDark)} />, "Percentage of 'Good' and 'Bad' Solves", "This chart shows your running average of solves considered 'good' and 'bad'. This can be configured in the filter panel. Just set the good and bad values to times you feel are correct"));
            {
                const rh = c.recordHistory as { datasets: unknown[]; xAxisMin?: Date; xAxisMax?: Date };
                const rhOptions = createOptions(ChartType.Line, "Date", "Time (s)", p.useLogScale, true, true, isDark);
                if (p.recordHistoryAllDays) {
                    // 'timeseries' evenly spaces data points so gaps disappear; 'time' renders
                    // a continuous timeline. Also pin min/max so the axis spans all solve dates.
                    (rhOptions as any).scales.x.type = 'time';
                    const DAY_MS = 86_400_000;
                    if (rh.xAxisMin) (rhOptions as any).scales.x.min = rh.xAxisMin.valueOf() - 3 * DAY_MS;
                    if (rh.xAxisMax) (rhOptions as any).scales.x.max = rh.xAxisMax.valueOf() + 3 * DAY_MS;
                }
                charts.push(buildChartHtml(<Line data={rh as unknown as ChartData<"line">} options={rhOptions} />, "History of Records", "This chart shows your history of PBs. Note that this will only show solves that meet the criteria in your filters, so don't be alarmed if you don't see your PB here. As a note, Ao12 removes the best and worst solves of the 12. Ao100 removes the best and worst 5. Ao1000 removes the best and worst 50."));
            }
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
