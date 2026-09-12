import { Card, CardText, Col, OverlayTrigger, Ratio, Tooltip } from "react-bootstrap";
import type { TooltipItem } from "chart.js";
import { ChartType, StepName } from "./Types";
import { DARK_AXIS_COLORS } from "./ChartColors";
import { Const } from "./Constants";

/** The total is not one of the stacked segments, so it gets its own neutral marker. */
const TOTAL_SQUARE = "\u25A0";

/**
 * SpeedCubeDB documents each last-layer algorithm on its own page, slugged by
 * case: OLL uses "OLL_<n>" and PLL uses the perm letters ("Aa", "T", ...), which
 * are exactly the values held in Const.OllCases / Const.PllCases.
 *
 * The case is matched against those lists instead of being interpolated into the
 * URL directly, so a malformed case coming out of a CSV can never steer the link
 * somewhere unexpected. Returns null when there is no page to link to, which
 * covers "Solved" (a skipped step, not an algorithm) and any unknown case.
 */
export function speedCubeDbUrl(step: StepName, caseName: string): string | null {
    const cases = step === StepName.OLL ? Const.OllCases
        : step === StepName.PLL ? Const.PllCases
        : null;
    if (cases === null || caseName === "Solved") return null;
    const known = cases.some(c => c.value === caseName);
    if (!known) return null;
    return step === StepName.OLL
        ? `https://speedcubedb.com/a/3x3/OLL/OLL_${caseName}`
        : `https://speedcubedb.com/a/3x3/PLL/${caseName}`;
}

export function createTooltip(description: string) {
    const tooltip = (
        <Tooltip id="tooltip">
            {description}
        </Tooltip>
    );
    return tooltip;
}

export function buildChartHtml(chart: JSX.Element, title: string, tooltip: string): JSX.Element {
    return (
        <Col key={title} className="col-12 col-md-6">
            <Card className="p-2 p-md-3 shadow-sm">
                <OverlayTrigger placement="top" overlay={createTooltip(tooltip)}>
                    <CardText className="text-center fw-bold">
                        {title} ⓘ
                    </CardText>
                </OverlayTrigger>
                <Ratio aspectRatio="4x3">
                    {chart}
                </Ratio>
            </Card>
        </Col>
    )
}

interface ScaleTitle { display?: boolean; text?: string; color?: string; }
interface ScaleGrid { color?: string; }
interface ScaleTicks { autoSkip?: boolean; maxRotation?: number; color?: string; }

interface ScaleOptions {
    title?: ScaleTitle;
    grid?: ScaleGrid;
    ticks?: ScaleTicks;
    stacked?: boolean;
    type?: 'logarithmic' | 'timeseries';
    timeseries?: { units: string; displayFormats: Record<string, string> };
}

export interface CubeChartOptions {
    maintainAspectRatio: boolean;
    spanGaps?: boolean;
    scales?: Record<string, ScaleOptions>;
}

/**
 * Bar-only, and kept separate from CubeChartOptions because a TooltipItem<'bar'>
 * callback is not assignable to the line charts that share the base options.
 */
export interface CaseChartOptions extends CubeChartOptions {
    interaction: { mode: 'index'; intersect: boolean };
    plugins: {
        tooltip: {
            itemSort: (a: TooltipItem<'bar'>, b: TooltipItem<'bar'>) => number;
            callbacks: {
                beforeBody: (items: TooltipItem<'bar'>[]) => string;
                label: (item: TooltipItem<'bar'>) => string;
            };
        };
    };
}

/**
 * The legend spells out which window each segment covers, which makes for a very
 * wide tooltip. "Average recognition time for each case in past 1000 solves" and
 * "Recognition (past 1000)" both become "Recognition".
 */
export function shortSegmentName(datasetLabel: string): string {
    const verbose = /^Average (.+?) time for each case/i.exec(datasetLabel);
    if (verbose === null) return datasetLabel.replace(/\s*\(past .*$/, '');
    return verbose[1].charAt(0).toUpperCase() + verbose[1].slice(1);
}

/**
 * The per-case chart stacks recognition against its execution segments, and
 * execution is split further into pre-AUF / execution / post-AUF when 4-segment
 * timing is on. Hovering one segment only tells a solver part of the story, so
 * the whole bar is shown at once: the total first, then one line per segment in
 * the order they are stacked from the top down, each keeping its bar's colour.
 */
export function withCaseTooltip(options: CubeChartOptions): CaseChartOptions {
    return {
        ...options,
        // Hovering anywhere in a case's column describes the whole bar, rather
        // than only the segment directly under the cursor.
        interaction: { mode: 'index', intersect: false },
        plugins: {
            tooltip: {
                // Recognition is drawn at the bottom of the bar, so reversing
                // the datasets reads the column from the top down.
                itemSort: (a: TooltipItem<'bar'>, b: TooltipItem<'bar'>) => b.datasetIndex - a.datasetIndex,
                callbacks: {
                    beforeBody: (items: TooltipItem<'bar'>[]) => {
                        let total = 0;
                        for (const item of items) total += Number(item.parsed.y);
                        return `${TOTAL_SQUARE} Total: ${total.toFixed(3)}s`;
                    },
                    label: (item: TooltipItem<'bar'>) =>
                        `${shortSegmentName(item.dataset.label ?? '')}: ${Number(item.parsed.y).toFixed(3)}s`,
                },
            },
        },
    };
}

const darkScaleOptions = {
    grid: { color: DARK_AXIS_COLORS.grid },
    ticks: { color: DARK_AXIS_COLORS.label },
    title: { color: DARK_AXIS_COLORS.label },
};

function applyDarkScaleOptions(scales: Record<string, ScaleOptions>): void {
    for (const [key, s] of Object.entries(scales)) {
        scales[key] = {
            ...s,
            grid: { ...s.grid, ...darkScaleOptions.grid },
            ticks: { ...s.ticks, ...darkScaleOptions.ticks },
            title: { ...s.title, ...darkScaleOptions.title },
        };
    }
}

export function createOptions(chartType: ChartType, xAxis: string, yAxis: string, useLogScale: boolean, isStacked: boolean = true, isDateChart: boolean = false, isDark: boolean = false): CubeChartOptions {
    const chartOptions: CubeChartOptions = { maintainAspectRatio: false };

    if (chartType === ChartType.Doughnut) return chartOptions;

    if (chartType !== ChartType.Line && chartType !== ChartType.Bar) {
        console.log("Unknown chart type: " + chartType);
        return chartOptions;
    }

    const x: ScaleOptions = { title: { display: true, text: xAxis } };
    const y: ScaleOptions = { title: { display: true, text: yAxis } };

    if (chartType === ChartType.Line) {
        chartOptions.spanGaps = true;
        if (isDateChart) {
            x.type = 'timeseries';
            x.timeseries = { units: 'quarter', displayFormats: { quarter: 'MMM yyyy' } };
        }
    } else {
        x.stacked = isStacked;
        x.ticks = { autoSkip: true, maxRotation: 45 };
        y.stacked = isStacked;
    }

    if (useLogScale) y.type = 'logarithmic';

    chartOptions.scales = { x, y };
    if (isDark) applyDarkScaleOptions(chartOptions.scales);

    return chartOptions;
}