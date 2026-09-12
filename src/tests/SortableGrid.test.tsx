/** @jest-environment jsdom */
import { beforeAll, describe, expect, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Column } from 'react-data-grid';
import { CellValue, SortableGrid, compareCells } from '../Components/ChartPanel';

/**
 * The data grids are sorted here rather than by react-data-grid, so both halves
 * are covered: the comparator (which has to order values that are stored as text
 * the way a solver reads them) and the header-click wiring.
 */

beforeAll(() => {
    // jsdom implements neither of these, and react-data-grid uses both: CSS.escape
    // while measuring columns, and scrollIntoView when it focuses a clicked cell.
    const g = globalThis as { CSS?: { escape(value: string): string } };
    g.CSS ??= { escape: (value: string) => value };
    Element.prototype.scrollIntoView ??= () => undefined;
});

interface Row { label: string; value: string }

const COLUMNS: Column<Row>[] = [
    { key: 'label', name: 'Label' },
    { key: 'value', name: 'Value' },
];

function renderGrid(rows: Row[]) {
    render(<SortableGrid rows={rows} columns={COLUMNS} />);
}

/** Reads the first column of each rendered row, in display order. */
function labelsInOrder(): string[] {
    return screen.getAllByRole('row')
        .slice(1) // drop the header row
        .map(r => r.querySelectorAll('[role="gridcell"]')[0]?.textContent ?? '');
}

function sortedBy(rows: Row[], key: 'label' | 'value', dir: 'ASC' | 'DESC'): string[] {
    const sign = dir === 'ASC' ? 1 : -1;
    return [...rows].sort((a, b) => sign * compareCells(a[key], b[key])).map(r => r.label);
}

describe('compareCells', () => {
    function ascending(values: CellValue[]): CellValue[] {
        return [...values].sort(compareCells);
    }

    test('numbers order numerically rather than as text', () => {
        expect(ascending([10, 2, 1, 57, 9])).toEqual([1, 2, 9, 10, 57]);
    });

    test('OLL case numbers stored as strings still order numerically', () => {
        expect(ascending(['10', '2', '1', '57', '9'])).toEqual(['1', '2', '9', '10', '57']);
    });

    test('percentages order by their value', () => {
        expect(ascending(['100.0%', '20.0%', '5.5%'])).toEqual(['5.5%', '20.0%', '100.0%']);
    });

    test('streak targets order by the number inside the label', () => {
        expect(ascending(['Sub-10', 'Sub-5', 'Sub-30', 'Sub-15', 'Sub-20']))
            .toEqual(['Sub-5', 'Sub-10', 'Sub-15', 'Sub-20', 'Sub-30']);
    });

    test('record types order by average size', () => {
        expect(ascending(['Ao100', 'Ao5', 'Ao12'])).toEqual(['Ao5', 'Ao12', 'Ao100']);
    });

    test('a streak with a flame still sorts on its number', () => {
        expect(ascending(['3 🔥', '10', '2'])).toEqual(['2', '3 🔥', '10']);
    });

    test('dates order chronologically, not by month name', () => {
        // A plain text sort would put Apr before Jan; a numeric collator would
        // compare the day first. Both are wrong.
        expect(ascending(['Mon Jan 01 2024', 'Wed Apr 03 2024', 'Sun Feb 11 2024']))
            .toEqual(['Mon Jan 01 2024', 'Sun Feb 11 2024', 'Wed Apr 03 2024']);
    });

    test('dates order across years', () => {
        expect(ascending(['Thu Dec 12 2019', 'Fri Jan 03 2020']))
            .toEqual(['Thu Dec 12 2019', 'Fri Jan 03 2020']);
    });

    test('solve times order by duration', () => {
        expect(ascending(['10.000', '9.500', '100.250', '1.000']))
            .toEqual(['1.000', '9.500', '10.000', '100.250']);
    });

    test('missing values sort without throwing', () => {
        expect(() => ascending([undefined, 'a', 1])).not.toThrow();
        expect(compareCells(undefined, undefined)).toBe(0);
    });

    test('comparison is symmetric, so ASC and DESC are exact mirrors', () => {
        const values = ['Sub-5', 'Overall', 'Sub-30', '3 🔥'];
        const asc = [...values].sort((a, b) => compareCells(a, b));
        const desc = [...values].sort((a, b) => -compareCells(a, b));
        expect(desc).toEqual([...asc].reverse());
    });
});

describe('SortableGrid', () => {
    const ROWS: Row[] = [
        { label: 'Sub-10', value: '3' },
        { label: 'Sub-5', value: '12' },
        { label: 'Sub-30', value: '1' },
    ];

    test('rows render in their given order until a header is clicked', () => {
        renderGrid(ROWS);
        expect(labelsInOrder()).toEqual(['Sub-10', 'Sub-5', 'Sub-30']);
    });

    test('clicking a column header sorts ascending by that column', () => {
        renderGrid(ROWS);
        fireEvent.click(screen.getByRole('columnheader', { name: /Label/ }));
        expect(labelsInOrder()).toEqual(sortedBy(ROWS, 'label', 'ASC'));
        expect(labelsInOrder()).toEqual(['Sub-5', 'Sub-10', 'Sub-30']);
    });

    test('clicking the same header again reverses the order', () => {
        renderGrid(ROWS);
        const header = screen.getByRole('columnheader', { name: /Label/ });
        fireEvent.click(header);
        fireEvent.click(header);
        expect(labelsInOrder()).toEqual(sortedBy(ROWS, 'label', 'DESC'));
    });

    test('every column is sortable, not just the first', () => {
        renderGrid(ROWS);
        fireEvent.click(screen.getByRole('columnheader', { name: /Value/ }));
        expect(labelsInOrder()).toEqual(sortedBy(ROWS, 'value', 'ASC'));
        expect(labelsInOrder()).toEqual(['Sub-30', 'Sub-10', 'Sub-5']);
    });

    test('sorting one column then another sorts by the new column', () => {
        renderGrid(ROWS);
        fireEvent.click(screen.getByRole('columnheader', { name: /Label/ }));
        fireEvent.click(screen.getByRole('columnheader', { name: /Value/ }));
        expect(labelsInOrder()).toEqual(sortedBy(ROWS, 'value', 'ASC'));
    });

    test('sorting does not mutate the rows it was given', () => {
        const rows: Row[] = ROWS.map(r => ({ ...r }));
        const before = rows.map(r => r.label);
        renderGrid(rows);
        fireEvent.click(screen.getByRole('columnheader', { name: /Label/ }));
        expect(rows.map(r => r.label)).toEqual(before);
    });

    /**
     * A sortable header is a flex row: the sort arrow takes a fixed slice of the
     * width, so without a floor the name is squeezed to a character or two on a
     * phone. Columns keep a usable width and the grid scrolls sideways instead.
     */
    test('columns keep a readable width on a narrow screen', () => {
        renderGrid(ROWS);
        const headers = screen.getAllByRole('columnheader');
        for (const header of headers) {
            expect(header.textContent?.length ?? 0).toBeGreaterThan(1);
        }
        const grid = screen.getByRole('grid');
        const template = grid.style.getPropertyValue('grid-template-columns');
        // Each column is sized min-content-style with a floor, not a bare fraction.
        expect(template).toContain('96px');
    });
});
