import { describe, expect, test } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * react-data-grid's stylesheet is served from public/ instead of being imported,
 * because the production CSS minifier merges its @layer blocks and drops
 * declarations - it gave the sortable-header classes the column-resize-handle
 * rule and merged the measuring cell into the ordinary cell, which collapsed
 * every grid header to a single character on the live site while the dev server
 * looked fine. public/ is copied to the build untouched.
 *
 * The cost of that is a copy that can silently fall behind the package, so it is
 * compared here on every run.
 */

const ROOT = join(__dirname, '..', '..');
const VENDORED = join(ROOT, 'public', 'react-data-grid.css');
const PACKAGED = join(ROOT, 'node_modules', 'react-data-grid', 'lib', 'styles.css');
const INDEX_HTML = join(ROOT, 'public', 'index.html');
const CHART_PANEL = join(ROOT, 'src', 'Components', 'ChartPanel.tsx');

describe('the vendored react-data-grid stylesheet', () => {
    test('is identical to the one the installed package ships', () => {
        expect(readFileSync(VENDORED, 'utf8')).toBe(readFileSync(PACKAGED, 'utf8'));
    });

    test('is linked from index.html so the build copies it verbatim', () => {
        const html = readFileSync(INDEX_HTML, 'utf8');
        expect(html).toContain('%PUBLIC_URL%/react-data-grid.css');
    });

    test('is not also imported, which would reintroduce the minified copy', () => {
        expect(readFileSync(CHART_PANEL, 'utf8')).not.toContain('react-data-grid/lib/styles.css');
    });

    test('still contains the header rules the minifier was destroying', () => {
        const css = readFileSync(VENDORED, 'utf8');
        // The sortable header lays its name out with flex; the measuring cell has
        // to stay hidden or it takes up a column and pushes the headers sideways.
        expect(css).toContain('rdg.SortableHeaderCell');
        expect(css).toContain('rdg.MeasuringCell');
        expect(css).toMatch(/rdg\.MeasuringCell\s*\{[^}]*visibility:\s*hidden/);
    });
});
