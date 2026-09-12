/** @jest-environment jsdom */
import { describe, expect, test } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { RenderCellProps } from 'react-data-grid';
import { algoCols } from '../Components/ChartPanel';
import { speedCubeDbUrl } from '../Helpers/ChartHelpers';
import { Const } from '../Helpers/Constants';
import { AlgoPracticeRow, StepName } from '../Helpers/Types';

/**
 * The Algorithm Practice grid links each case to its SpeedCubeDB page. The slugs
 * below were taken from speedcubedb.com's own OLL and PLL index pages, so these
 * tests fail if our case values ever drift away from the ones the site serves.
 */

const SPEEDCUBEDB_PLL_SLUGS = [
    'Aa', 'Ab', 'E', 'F', 'Ga', 'Gb', 'Gc', 'Gd', 'H', 'Ja', 'Jb',
    'Na', 'Nb', 'Ra', 'Rb', 'T', 'Ua', 'Ub', 'V', 'Y', 'Z',
];

function algoRow(caseName: string): AlgoPracticeRow {
    return {
        case: caseName, total: 5, failed: 1, failureRate: '20.0%',
        avgMoves: '9.0', expectedMoves: 9, avgWasted: '0.5', avgTime: '1.500',
    };
}

function renderCase(step: StepName, caseName: string): HTMLElement {
    const column = algoCols(step)[0];
    const props = { row: algoRow(caseName) } as RenderCellProps<AlgoPracticeRow>;
    const { container } = render(<>{column.renderCell?.(props)}</>);
    return container;
}

describe('speedCubeDbUrl', () => {
    test('every OLL case links to its numbered SpeedCubeDB page', () => {
        const ollNumbers = Const.OllCases.filter(c => c.value !== 'Solved');
        expect(ollNumbers).toHaveLength(57);
        for (const c of ollNumbers) {
            expect(speedCubeDbUrl(StepName.OLL, c.value))
                .toBe(`https://speedcubedb.com/a/3x3/OLL/OLL_${c.value}`);
        }
    });

    test('every PLL case links to its perm page', () => {
        const perms = Const.PllCases.filter(c => c.value !== 'Solved');
        for (const c of perms) {
            expect(speedCubeDbUrl(StepName.PLL, c.value))
                .toBe(`https://speedcubedb.com/a/3x3/PLL/${c.value}`);
        }
    });

    test('our PLL case values match the slugs SpeedCubeDB actually publishes', () => {
        const ours = Const.PllCases.filter(c => c.value !== 'Solved').map(c => c.value).sort();
        expect(ours).toEqual([...SPEEDCUBEDB_PLL_SLUGS].sort());
    });

    test('a skipped step has no algorithm page to link to', () => {
        expect(speedCubeDbUrl(StepName.OLL, 'Solved')).toBeNull();
        expect(speedCubeDbUrl(StepName.PLL, 'Solved')).toBeNull();
    });

    test('steps other than OLL and PLL are not linked', () => {
        expect(speedCubeDbUrl(StepName.Cross, '1')).toBeNull();
        expect(speedCubeDbUrl(StepName.F2L_1, 'T')).toBeNull();
    });

    test('an unrecognised case is not linked rather than guessed at', () => {
        expect(speedCubeDbUrl(StepName.OLL, '58')).toBeNull();
        expect(speedCubeDbUrl(StepName.OLL, '')).toBeNull();
        expect(speedCubeDbUrl(StepName.PLL, 'Qq')).toBeNull();
    });

    test('a case cannot be used to point the link somewhere else', () => {
        // Cases originate in user-supplied CSVs, so they are matched against the
        // known list rather than substituted into the URL.
        expect(speedCubeDbUrl(StepName.PLL, '../../evil')).toBeNull();
        expect(speedCubeDbUrl(StepName.OLL, '1/../../evil')).toBeNull();
        expect(speedCubeDbUrl(StepName.PLL, 'T"onmouseover="alert(1)')).toBeNull();
        expect(speedCubeDbUrl(StepName.OLL, 'javascript:alert(1)')).toBeNull();
    });

    test('OLL and PLL never collide on the same URL', () => {
        const urls = [
            ...Const.OllCases.map(c => speedCubeDbUrl(StepName.OLL, c.value)),
            ...Const.PllCases.map(c => speedCubeDbUrl(StepName.PLL, c.value)),
        ].filter((u): u is string => u !== null);
        expect(new Set(urls).size).toBe(urls.length);
    });
});

describe('Algorithm Practice case cells', () => {
    test('a known OLL case renders as a link to SpeedCubeDB', () => {
        renderCase(StepName.OLL, '21');
        const link = screen.getByRole('link', { name: '21' });
        expect(link.getAttribute('href')).toBe('https://speedcubedb.com/a/3x3/OLL/OLL_21');
    });

    test('a known PLL case renders as a link to SpeedCubeDB', () => {
        renderCase(StepName.PLL, 'Ga');
        const link = screen.getByRole('link', { name: 'Ga' });
        expect(link.getAttribute('href')).toBe('https://speedcubedb.com/a/3x3/PLL/Ga');
    });

    test('links open in a new tab without handing it control of this one', () => {
        renderCase(StepName.PLL, 'T');
        const link = screen.getByRole('link', { name: 'T' });
        expect(link.getAttribute('target')).toBe('_blank');
        expect(link.getAttribute('rel')).toContain('noopener');
        expect(link.getAttribute('rel')).toContain('noreferrer');
    });

    test('the link carries the class that stretches it over the whole cell', () => {
        // The click target is widened in CSS, so the hook it depends on is asserted here.
        renderCase(StepName.OLL, '7');
        expect(screen.getByRole('link', { name: '7' }).className).toContain('algo-case-link');
    });

    test('Solved renders as plain text so there is no dead link', () => {
        const container = renderCase(StepName.PLL, 'Solved');
        expect(container.textContent).toBe('Solved');
        expect(screen.queryByRole('link')).toBeNull();
    });

    test('an unknown case still shows its name, just without a link', () => {
        const container = renderCase(StepName.OLL, 'Bogus');
        expect(container.textContent).toBe('Bogus');
        expect(screen.queryByRole('link')).toBeNull();
    });
});

describe('clickable cell styling', () => {
    const css = readFileSync(join(__dirname, '..', 'CSS', 'Style.css'), 'utf8');

    function ruleFor(selector: string): string {
        const start = css.indexOf(selector);
        expect(start).toBeGreaterThan(-1);
        return css.slice(start, css.indexOf('}', start));
    }

    test('the case link fills its cell so the whole box is clickable', () => {
        const rule = ruleFor('.algo-case-link {');
        expect(rule).toContain('block-size: 100%');
        // Cancels the grid's 8px cell padding so the click target reaches the edges.
        expect(rule).toContain('margin-inline: -8px');
    });

    test('the fastest-solves grid marks its cells as clickable', () => {
        const rule = ruleFor('.clickable-grid .rdg-row .rdg-cell {');
        expect(rule).toContain('cursor: pointer');
        expect(rule).toContain('underline');
    });

    test('the fastest-solves grid is the one wired up to open solves', () => {
        const panel = readFileSync(join(__dirname, '..', 'Components', 'ChartPanel.tsx'), 'utf8');
        const grid = panel.split('\n').find(l => l.includes('onCellClick={this.openSolveSource}'));
        expect(grid).toContain('clickable-grid');
    });
});
