/**
 * Centralized, theme-aware colors for Chart.js so no chart uses the default palette.
 * Ensures readable colors in both light and dark mode.
 */
import { ChartData } from 'chart.js/auto';

export type ChartColorPair = { borderColor: string; backgroundColor: string };

/** Theme-aware palette: at least 12 colors readable on light and dark backgrounds. */
const LIGHT_PALETTE: ChartColorPair[] = [
    { borderColor: 'rgb(54, 162, 235)', backgroundColor: 'rgba(54, 162, 235, 0.8)' },
    { borderColor: 'rgb(255, 99, 132)', backgroundColor: 'rgba(255, 99, 132, 0.8)' },
    { borderColor: 'rgb(75, 192, 192)', backgroundColor: 'rgba(75, 192, 192, 0.8)' },
    { borderColor: 'rgb(255, 159, 64)', backgroundColor: 'rgba(255, 159, 64, 0.8)' },
    { borderColor: 'rgb(153, 102, 255)', backgroundColor: 'rgba(153, 102, 255, 0.8)' },
    { borderColor: 'rgb(255, 205, 86)', backgroundColor: 'rgba(255, 205, 86, 0.8)' },
    { borderColor: 'rgb(0, 180, 180)', backgroundColor: 'rgba(0, 180, 180, 0.8)' },
    { borderColor: 'rgb(220, 100, 180)', backgroundColor: 'rgba(220, 100, 180, 0.8)' },
    { borderColor: 'rgb(100, 160, 100)', backgroundColor: 'rgba(100, 160, 100, 0.8)' },
    { borderColor: 'rgb(230, 120, 80)', backgroundColor: 'rgba(230, 120, 80, 0.8)' },
    { borderColor: 'rgb(120, 140, 220)', backgroundColor: 'rgba(120, 140, 220, 0.8)' },
    { borderColor: 'rgb(180, 180, 80)', backgroundColor: 'rgba(180, 180, 80, 0.8)' },
];

/** Dark mode: same hues, higher luminance for readability on dark background. */
const DARK_PALETTE: ChartColorPair[] = [
    { borderColor: 'rgb(100, 200, 255)', backgroundColor: 'rgba(100, 200, 255, 0.8)' },
    { borderColor: 'rgb(255, 130, 160)', backgroundColor: 'rgba(255, 130, 160, 0.8)' },
    { borderColor: 'rgb(100, 220, 220)', backgroundColor: 'rgba(100, 220, 220, 0.8)' },
    { borderColor: 'rgb(255, 190, 120)', backgroundColor: 'rgba(255, 190, 120, 0.8)' },
    { borderColor: 'rgb(190, 150, 255)', backgroundColor: 'rgba(190, 150, 255, 0.8)' },
    { borderColor: 'rgb(255, 230, 150)', backgroundColor: 'rgba(255, 230, 150, 0.8)' },
    { borderColor: 'rgb(80, 220, 220)', backgroundColor: 'rgba(80, 220, 220, 0.8)' },
    { borderColor: 'rgb(255, 150, 220)', backgroundColor: 'rgba(255, 150, 220, 0.8)' },
    { borderColor: 'rgb(150, 220, 150)', backgroundColor: 'rgba(150, 220, 150, 0.8)' },
    { borderColor: 'rgb(255, 160, 120)', backgroundColor: 'rgba(255, 160, 120, 0.8)' },
    { borderColor: 'rgb(160, 180, 255)', backgroundColor: 'rgba(160, 180, 255, 0.8)' },
    { borderColor: 'rgb(220, 220, 140)', backgroundColor: 'rgba(220, 220, 140, 0.8)' },
];

function getPalette(isDark: boolean): ChartColorPair[] {
    return isDark ? DARK_PALETTE : LIGHT_PALETTE;
}

function hasOwnColor(dataset: Record<string, unknown>): boolean {
    return (
        (dataset.borderColor !== undefined && dataset.borderColor !== null) ||
        (dataset.backgroundColor !== undefined && dataset.backgroundColor !== null)
    );
}

/**
 * Applies the theme-aware palette to any dataset that does not already define
 * borderColor/backgroundColor. Preserves semantic colors (e.g. cross colors, OLL/PLL markers).
 * @param perPointColors - When true (e.g. for doughnut/pie), assign an array of colors, one per data point, so each segment has a different color.
 */
export function applyPaletteToChartData<T extends 'line' | 'bar' | 'doughnut'>(
    data: ChartData<T>,
    isDark: boolean,
    perPointColors?: boolean
): ChartData<T> {
    if (!data?.datasets?.length) return data;
    const palette = getPalette(isDark);
    const datasets = data.datasets.map((ds, dsIndex) => {
        const d = ds as unknown as Record<string, unknown>;
        if (hasOwnColor(d)) return ds;
        const dataLength = Array.isArray(d.data) ? d.data.length : 0;
        if (perPointColors && dataLength > 0) {
            const backgroundColors = Array.from(
                { length: dataLength },
                (_, i) => palette[(dsIndex * 4 + i) % palette.length].backgroundColor
            );
            const borderColors = Array.from(
                { length: dataLength },
                (_, i) => palette[(dsIndex * 4 + i) % palette.length].borderColor
            );
            return {
                ...ds,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
            };
        }
        const color = palette[dsIndex % palette.length];
        return {
            ...ds,
            borderColor: color.borderColor,
            backgroundColor: color.backgroundColor,
        };
    });
    return { ...data, datasets } as ChartData<T>;
}
