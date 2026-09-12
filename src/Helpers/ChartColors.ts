/**
 * Centralized, theme-aware colors for Chart.js so no chart uses the default palette.
 * Ensures readable colors in both light and dark mode.
 */
import type { ChartData, ChartDataset } from 'chart.js/auto';

// ── Raw RGB constants ─────────────────────────────────────────────────────────
// Every unique RGB combination used anywhere in the app lives here.

// Light-mode palette (also reused for segment semantic colors)
const BLUE         = 'rgb(54, 162, 235)';
const RED          = 'rgb(255, 99, 132)';
const TEAL         = 'rgb(75, 192, 192)';
const ORANGE       = 'rgb(255, 159, 64)';
const PURPLE       = 'rgb(153, 102, 255)';
const YELLOW       = 'rgb(255, 205, 86)';
const TEAL2        = 'rgb(0, 180, 180)';
const PINK         = 'rgb(220, 100, 180)';
const SAGE         = 'rgb(100, 160, 100)';
const CORAL        = 'rgb(230, 120, 80)';
const SOFT_BLUE    = 'rgb(120, 140, 220)';
const OLIVE        = 'rgb(180, 180, 80)';

// Dark-mode palette
const SKY          = 'rgb(100, 200, 255)';
const ROSE         = 'rgb(255, 130, 160)';
const AQUA         = 'rgb(100, 220, 220)';
const PEACH        = 'rgb(255, 190, 120)';
const VIOLET       = 'rgb(190, 150, 255)';
const CREAM        = 'rgb(255, 230, 150)';
const CYAN         = 'rgb(80, 220, 220)';
const MAGENTA      = 'rgb(255, 150, 220)';
const MINT         = 'rgb(150, 220, 150)';
const SALMON       = 'rgb(255, 160, 120)';
const PERIWINKLE   = 'rgb(160, 180, 255)';
const CHARTREUSE   = 'rgb(220, 220, 140)';

// ── Helper ────────────────────────────────────────────────────────────────────

/** Convert an rgb() string to rgba() with the given alpha. */
function a(rgb: string, alpha: number = 0.8): string {
    return rgb.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
}

// ── Named exports ─────────────────────────────────────────────────────────────

/** Semantic colors for the four solve-timing segments. */
export const SEGMENT_COLORS = {
    recognition: BLUE,
    preAuf:      PURPLE,
    execution:   RED,
    postAuf:     ORANGE,
} as const;

/** Colors for chart axis grid lines and tick labels in dark mode. */
export const DARK_AXIS_COLORS = {
    grid:  'rgba(255,255,255,0.15)',
    label: 'rgba(255,255,255,0.8)',
} as const;

export type ChartColorPair = { borderColor: string; backgroundColor: string };

/** Theme-aware palette: at least 12 colors readable on light and dark backgrounds. */
const LIGHT_PALETTE: ChartColorPair[] = [
    { borderColor: BLUE,       backgroundColor: a(BLUE) },
    { borderColor: RED,        backgroundColor: a(RED) },
    { borderColor: TEAL,       backgroundColor: a(TEAL) },
    { borderColor: ORANGE,     backgroundColor: a(ORANGE) },
    { borderColor: PURPLE,     backgroundColor: a(PURPLE) },
    { borderColor: YELLOW,     backgroundColor: a(YELLOW) },
    { borderColor: TEAL2,      backgroundColor: a(TEAL2) },
    { borderColor: PINK,       backgroundColor: a(PINK) },
    { borderColor: SAGE,       backgroundColor: a(SAGE) },
    { borderColor: CORAL,      backgroundColor: a(CORAL) },
    { borderColor: SOFT_BLUE,  backgroundColor: a(SOFT_BLUE) },
    { borderColor: OLIVE,      backgroundColor: a(OLIVE) },
];

/** Dark mode: same hues, higher luminance for readability on dark background. */
const DARK_PALETTE: ChartColorPair[] = [
    { borderColor: SKY,        backgroundColor: a(SKY) },
    { borderColor: ROSE,       backgroundColor: a(ROSE) },
    { borderColor: AQUA,       backgroundColor: a(AQUA) },
    { borderColor: PEACH,      backgroundColor: a(PEACH) },
    { borderColor: VIOLET,     backgroundColor: a(VIOLET) },
    { borderColor: CREAM,      backgroundColor: a(CREAM) },
    { borderColor: CYAN,       backgroundColor: a(CYAN) },
    { borderColor: MAGENTA,    backgroundColor: a(MAGENTA) },
    { borderColor: MINT,       backgroundColor: a(MINT) },
    { borderColor: SALMON,     backgroundColor: a(SALMON) },
    { borderColor: PERIWINKLE, backgroundColor: a(PERIWINKLE) },
    { borderColor: CHARTREUSE, backgroundColor: a(CHARTREUSE) },
];

function getPalette(isDark: boolean): ChartColorPair[] {
    return isDark ? DARK_PALETTE : LIGHT_PALETTE;
}

/**
 * Chart.js colour fields are "scriptable": besides a colour string they may hold a
 * gradient, a pattern, a per-point array or a callback. The palette only needs to know
 * whether one was set at all, so the concrete dataset type is used and not re-declared.
 */
function hasOwnColor(dataset: ChartDataset<'line' | 'bar' | 'doughnut'>): boolean {
    return (
        ('borderColor' in dataset && dataset.borderColor !== undefined && dataset.borderColor !== null) ||
        ('backgroundColor' in dataset && dataset.backgroundColor !== undefined && dataset.backgroundColor !== null)
    );
}

/**
 * Applies the theme-aware palette to any dataset that does not already define
 * borderColor/backgroundColor. Preserves semantic colors (e.g. cross colors, OLL/PLL markers).
 * @param perPointColors - When true (e.g. for doughnut/pie), assign an array of colors, one per data point, so each segment has a different color.
 */
export function applyPaletteToChartData<T extends 'line' | 'bar' | 'doughnut', TData, TLabel>(
    data: ChartData<T, TData, TLabel>,
    isDark: boolean,
    perPointColors?: boolean
): ChartData<T, TData, TLabel> {
    if (!data?.datasets?.length) return data;
    const palette = getPalette(isDark);
    const datasets = data.datasets.map((ds, dsIndex) => {
        if (hasOwnColor(ds as ChartDataset<'line' | 'bar' | 'doughnut'>)) return ds;
        const dataLength = Array.isArray(ds.data) ? ds.data.length : 0;
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
    return { ...data, datasets } as ChartData<T, TData, TLabel>;
}
