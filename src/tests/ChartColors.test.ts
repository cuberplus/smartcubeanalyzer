import { describe, expect, test } from '@jest/globals';
import type { ChartData } from 'chart.js/auto';
import {
    applyPaletteToChartData,
    SEGMENT_COLORS,
    DARK_AXIS_COLORS,
} from '../Helpers/ChartColors';

function lineData(datasetCount: number, pointsPerDataset = 3): ChartData<'line'> {
    return {
        labels: Array.from({ length: pointsPerDataset }, (_, i) => String(i)),
        datasets: Array.from({ length: datasetCount }, (_, i) => ({
            label: `series ${i}`,
            data: Array.from({ length: pointsPerDataset }, () => 1),
        })),
    };
}

describe('SEGMENT_COLORS / DARK_AXIS_COLORS', () => {
    test('exposes a distinct color for each of the four solve segments', () => {
        const values = Object.values(SEGMENT_COLORS);
        expect(values).toHaveLength(4);
        expect(new Set(values).size).toBe(4);
        values.forEach(v => expect(v).toMatch(/^rgb\(\d+, \d+, \d+\)$/));
    });

    test('dark axis colors are semi-transparent white', () => {
        expect(DARK_AXIS_COLORS.grid).toContain('rgba(255,255,255');
        expect(DARK_AXIS_COLORS.label).toContain('rgba(255,255,255');
    });
});

describe('applyPaletteToChartData', () => {
    test('returns input unchanged when there are no datasets', () => {
        const empty = { labels: [], datasets: [] } as ChartData<'line'>;
        expect(applyPaletteToChartData(empty, false)).toBe(empty);
    });

    test('returns input unchanged when data is null or undefined', () => {
        expect(applyPaletteToChartData(null as any, false)).toBeNull();
        expect(applyPaletteToChartData(undefined as any, true)).toBeUndefined();
    });

    test('assigns a border and background color to every uncolored dataset', () => {
        const result = applyPaletteToChartData(lineData(3), false);
        result.datasets.forEach(ds => {
            expect((ds as any).borderColor).toMatch(/^rgb\(/);
            expect((ds as any).backgroundColor).toMatch(/^rgba\(/);
        });
    });

    test('gives consecutive datasets different colors', () => {
        const result = applyPaletteToChartData(lineData(3), false);
        const borders = result.datasets.map(ds => (ds as any).borderColor);
        expect(new Set(borders).size).toBe(3);
    });

    test('light and dark palettes differ', () => {
        const light = applyPaletteToChartData(lineData(2), false);
        const dark = applyPaletteToChartData(lineData(2), true);
        expect((dark.datasets[0] as any).borderColor).not.toBe((light.datasets[0] as any).borderColor);
    });

    test('preserves datasets that already define a borderColor', () => {
        const data = lineData(1);
        (data.datasets[0] as any).borderColor = 'Yellow';
        const result = applyPaletteToChartData(data, false);
        expect((result.datasets[0] as any).borderColor).toBe('Yellow');
        expect((result.datasets[0] as any).backgroundColor).toBeUndefined();
    });

    test('preserves datasets that already define only a backgroundColor', () => {
        const data = lineData(1);
        (data.datasets[0] as any).backgroundColor = SEGMENT_COLORS.recognition;
        const result = applyPaletteToChartData(data, false);
        expect((result.datasets[0] as any).backgroundColor).toBe(SEGMENT_COLORS.recognition);
    });

    test('wraps around the palette when there are more datasets than colors', () => {
        const result = applyPaletteToChartData(lineData(13), false);
        expect((result.datasets[12] as any).borderColor).toBe((result.datasets[0] as any).borderColor);
    });

    test('perPointColors assigns one color per data point', () => {
        const data = lineData(1, 4);
        const result = applyPaletteToChartData(data, false, true);
        const bg = (result.datasets[0] as any).backgroundColor;
        const border = (result.datasets[0] as any).borderColor;
        expect(Array.isArray(bg)).toBe(true);
        expect(bg).toHaveLength(4);
        expect(border).toHaveLength(4);
        expect(new Set(bg).size).toBe(4);
    });

    test('perPointColors falls back to a single color when the dataset has no points', () => {
        const data = { labels: [], datasets: [{ label: 'empty', data: [] }] } as ChartData<'line'>;
        const result = applyPaletteToChartData(data, false, true);
        expect(Array.isArray((result.datasets[0] as any).backgroundColor)).toBe(false);
    });

    test('does not mutate the input datasets', () => {
        const data = lineData(2);
        applyPaletteToChartData(data, false);
        expect((data.datasets[0] as any).borderColor).toBeUndefined();
    });
});
