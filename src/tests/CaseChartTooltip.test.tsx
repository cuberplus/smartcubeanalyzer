/** @jest-environment jsdom */
import { describe, expect, test } from '@jest/globals';
import { ChartType } from '../Helpers/Types';
import { createOptions, shortSegmentName, withCaseTooltip } from '../Helpers/ChartHelpers';
import { SEGMENT_COLORS } from '../Helpers/ChartColors';

/**
 * The per-case chart stacks recognition against one or more execution segments,
 * so hovering it should describe the whole bar: every segment in the colour it
 * is drawn with, plus a total.
 */

/** Only the fields the tooltip callbacks actually read. */
type HoveredSegment = {
    datasetIndex: number;
    dataset: { label: string };
    parsed: { y: number };
};

const TWO_SEGMENT: HoveredSegment[] = [
    { datasetIndex: 0, dataset: { label: 'Average recognition time for each case in past 1000 solves' }, parsed: { y: 0.5 } },
    { datasetIndex: 1, dataset: { label: 'Average execution time for each case in past 1000 solves' }, parsed: { y: 1.5 } },
];

/** Recognition, then execution split three ways, as 4-segment timing reports it. */
const FOUR_SEGMENT: HoveredSegment[] = [
    { datasetIndex: 0, dataset: { label: 'Recognition (past 1000)' }, parsed: { y: 0.5 } },
    { datasetIndex: 1, dataset: { label: 'Pre-AUF (past 1000)' }, parsed: { y: 0.25 } },
    { datasetIndex: 2, dataset: { label: 'Execution (past 1000)' }, parsed: { y: 1.0 } },
    { datasetIndex: 3, dataset: { label: 'Post-AUF (past 1000)' }, parsed: { y: 0.25 } },
];

function tooltip() {
    const options = withCaseTooltip(
        createOptions(ChartType.Bar, 'Case', 'Time (s)', false, true, false, false)
    );
    const plugin = options.plugins.tooltip;
    return {
        options,
        itemSort: plugin.itemSort as (a: HoveredSegment, b: HoveredSegment) => number,
        beforeBody: plugin.callbacks.beforeBody as (items: HoveredSegment[]) => string,
        label: plugin.callbacks.label as (item: HoveredSegment) => string,
    };
}

/** The tooltip as the user reads it: the total, then the sorted segment rows. */
function linesFor(segments: HoveredSegment[]): string[] {
    const { itemSort, beforeBody, label } = tooltip();
    const shown = [...segments].sort(itemSort);
    return [beforeBody(segments), ...shown.map(label)];
}

describe('shortSegmentName', () => {
    test('trims the window off the 4-segment labels', () => {
        expect(shortSegmentName('Recognition (past 1000)')).toBe('Recognition');
        expect(shortSegmentName('Pre-AUF (past 250)')).toBe('Pre-AUF');
        expect(shortSegmentName('Post-AUF (past 250)')).toBe('Post-AUF');
    });

    test('reduces the sentence-length 2-segment labels to one word', () => {
        expect(shortSegmentName('Average recognition time for each case in past 1000 solves')).toBe('Recognition');
        expect(shortSegmentName('Average execution time for each case in past 1000 solves')).toBe('Execution');
    });

    test('leaves a label it does not recognise alone', () => {
        expect(shortSegmentName('Something Else')).toBe('Something Else');
        expect(shortSegmentName('')).toBe('');
    });
});

describe('per-case chart tooltip', () => {
    test('leads with the total, then names each segment from the top of the bar down', () => {
        expect(linesFor(TWO_SEGMENT)).toEqual([
            '■ Total: 2.000s',
            'Execution: 1.500s',
            'Recognition: 0.500s',
        ]);
    });

    test('keeps the AUF segments visible when 4-segment timing is on', () => {
        expect(linesFor(FOUR_SEGMENT)).toEqual([
            '■ Total: 2.000s',
            'Post-AUF: 0.250s',
            'Execution: 1.000s',
            'Pre-AUF: 0.250s',
            'Recognition: 0.500s',
        ]);
    });

    test('the total covers every segment, however many there are', () => {
        const { beforeBody } = tooltip();
        expect(beforeBody(TWO_SEGMENT)).toBe(beforeBody(FOUR_SEGMENT));
    });

    test('the total is marked with a square of its own', () => {
        const { beforeBody } = tooltip();
        expect(beforeBody(TWO_SEGMENT).startsWith('■ ')).toBe(true);
    });

    test('segment squares are left to the chart, so they match the bars', () => {
        // Recognition is blue and execution is red in the bar itself; the tooltip
        // gets those colours for free by keeping one line per dataset.
        const { label } = tooltip();
        expect(label(TWO_SEGMENT[0])).toContain('Recognition');
        expect(label(TWO_SEGMENT[1])).toContain('Execution');
        expect(SEGMENT_COLORS.recognition).not.toBe(SEGMENT_COLORS.execution);
    });

    test('hovering anywhere in a column describes the whole bar', () => {
        expect(tooltip().options.interaction).toEqual({ mode: 'index', intersect: false });
    });

    test('a case with no execution still reports a total', () => {
        const segments: HoveredSegment[] = [
            { datasetIndex: 0, dataset: { label: 'Recognition (past 1000)' }, parsed: { y: 0.75 } },
            { datasetIndex: 1, dataset: { label: 'Execution (past 1000)' }, parsed: { y: 0 } },
        ];
        expect(linesFor(segments)).toEqual([
            '■ Total: 0.750s',
            'Execution: 0.000s',
            'Recognition: 0.750s',
        ]);
    });

    test('the axis and scale options are left untouched', () => {
        const base = createOptions(ChartType.Bar, 'Case', 'Time (s)', true, true, false, true);
        const withTooltip = withCaseTooltip(base);
        expect(withTooltip.scales).toEqual(base.scales);
        expect(withTooltip.maintainAspectRatio).toBe(base.maintainAspectRatio);
    });
});
