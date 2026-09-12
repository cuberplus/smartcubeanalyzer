import { Card, CardText, Col, OverlayTrigger, Ratio, Tooltip } from "react-bootstrap";
import { ChartType } from "./Types";
import { DARK_AXIS_COLORS } from "./ChartColors";

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