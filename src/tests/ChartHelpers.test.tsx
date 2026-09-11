import { describe, expect, test } from '@jest/globals';
import { buildChartHtml, createOptions, createTooltip } from '../Helpers/ChartHelpers';
import { DARK_AXIS_COLORS } from '../Helpers/ChartColors';
import { ChartType } from '../Helpers/Types';

describe('createTooltip', () => {
    test('renders the supplied description inside a tooltip element', () => {
        const tooltip = createTooltip('Explains the chart');
        expect(tooltip.props.id).toBe('tooltip');
        expect(tooltip.props.children).toBe('Explains the chart');
    });
});

describe('buildChartHtml', () => {
    test('uses the title as the react key so charts are stable across re-renders', () => {
        const element = buildChartHtml(null as any, 'Running Average', 'tooltip text');
        expect(element.key).toBe('Running Average');
    });

    test('lays the chart out as a half-width column on medium screens', () => {
        const element = buildChartHtml(null as any, 'Running Average', 'tooltip text');
        expect(element.props.className).toBe('col-12 col-md-6');
    });

    test('embeds the chart element it is given', () => {
        const chart = createTooltip('a fake chart');
        const element = buildChartHtml(chart as any, 'Title', 'tooltip text');
        const json = JSON.stringify(element, (_k, v) => (typeof v === 'function' ? 'fn' : v));
        expect(json).toContain('a fake chart');
    });
});

describe('createOptions - line charts', () => {
    test('labels both axes with the supplied names', () => {
        const options: any = createOptions(ChartType.Line, 'Solve #', 'Seconds', false);
        expect(options.scales.x.title.text).toBe('Solve #');
        expect(options.scales.y.title.text).toBe('Seconds');
        expect(options.scales.x.title.display).toBe(true);
    });

    test('spans gaps and does not maintain aspect ratio', () => {
        const options: any = createOptions(ChartType.Line, 'x', 'y', false);
        expect(options.spanGaps).toBe(true);
        expect(options.maintainAspectRatio).toBe(false);
    });

    test('uses a linear y axis by default', () => {
        const options: any = createOptions(ChartType.Line, 'x', 'y', false);
        expect(options.scales.y.type).toBeUndefined();
    });

    test('switches the y axis to logarithmic when requested', () => {
        const options: any = createOptions(ChartType.Line, 'x', 'y', true);
        expect(options.scales.y.type).toBe('logarithmic');
    });

    test('uses a timeseries x axis for date charts', () => {
        const options: any = createOptions(ChartType.Line, 'x', 'y', false, true, true);
        expect(options.scales.x.type).toBe('timeseries');
        expect(options.scales.x.timeseries.displayFormats.quarter).toBe('MMM yyyy');
    });

    test('does not use a timeseries x axis for non-date charts', () => {
        const options: any = createOptions(ChartType.Line, 'x', 'y', false, true, false);
        expect(options.scales.x.type).toBeUndefined();
    });
});

describe('createOptions - bar charts', () => {
    test('stacks both axes by default', () => {
        const options: any = createOptions(ChartType.Bar, 'Case', 'Seconds', false);
        expect(options.scales.x.stacked).toBe(true);
        expect(options.scales.y.stacked).toBe(true);
    });

    test('honors an explicit unstacked request', () => {
        const options: any = createOptions(ChartType.Bar, 'Case', 'Seconds', false, false);
        expect(options.scales.x.stacked).toBe(false);
        expect(options.scales.y.stacked).toBe(false);
    });

    test('rotates crowded x tick labels rather than dropping the axis', () => {
        const options: any = createOptions(ChartType.Bar, 'Case', 'Seconds', false);
        expect(options.scales.x.ticks.autoSkip).toBe(true);
        expect(options.scales.x.ticks.maxRotation).toBe(45);
    });

    test('switches the y axis to logarithmic when requested', () => {
        const options: any = createOptions(ChartType.Bar, 'x', 'y', true);
        expect(options.scales.y.type).toBe('logarithmic');
    });
});

describe('createOptions - doughnut charts', () => {
    test('defines no scales', () => {
        const options: any = createOptions(ChartType.Doughnut, 'x', 'y', false);
        expect(options.scales).toBeUndefined();
        expect(options.maintainAspectRatio).toBe(false);
    });

    test('ignores the dark theme because there are no axes to recolor', () => {
        const options: any = createOptions(ChartType.Doughnut, 'x', 'y', false, true, false, true);
        expect(options.scales).toBeUndefined();
    });
});

describe('createOptions - unknown chart type', () => {
    test('still returns the generic options instead of throwing', () => {
        const options: any = createOptions('Radar' as ChartType, 'x', 'y', false);
        expect(options.maintainAspectRatio).toBe(false);
        expect(options.scales).toBeUndefined();
    });
});

describe('createOptions - dark theme', () => {
    test('recolors grid, ticks and titles on every axis of a line chart', () => {
        const options: any = createOptions(ChartType.Line, 'x', 'y', false, true, false, true);
        for (const axis of ['x', 'y']) {
            expect(options.scales[axis].grid.color).toBe(DARK_AXIS_COLORS.grid);
            expect(options.scales[axis].ticks.color).toBe(DARK_AXIS_COLORS.label);
            expect(options.scales[axis].title.color).toBe(DARK_AXIS_COLORS.label);
        }
    });

    test('preserves existing axis settings while recoloring', () => {
        const options: any = createOptions(ChartType.Line, 'Solve #', 'Seconds', true, true, false, true);
        expect(options.scales.x.title.text).toBe('Solve #');
        expect(options.scales.y.type).toBe('logarithmic');
        expect(options.scales.y.title.color).toBe(DARK_AXIS_COLORS.label);
    });

    test('preserves existing bar tick settings while recoloring', () => {
        const options: any = createOptions(ChartType.Bar, 'x', 'y', false, true, false, true);
        expect(options.scales.x.ticks.maxRotation).toBe(45);
        expect(options.scales.x.ticks.color).toBe(DARK_AXIS_COLORS.label);
        expect(options.scales.x.stacked).toBe(true);
    });

    test('leaves axes untouched in light mode', () => {
        const options: any = createOptions(ChartType.Line, 'x', 'y', false, true, false, false);
        expect(options.scales.x.grid).toBeUndefined();
        expect(options.scales.x.ticks).toBeUndefined();
    });
});
