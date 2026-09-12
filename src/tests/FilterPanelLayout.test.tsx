/** @jest-environment jsdom */
/**
 * The sidebar is a long list of filter cards, and their order is deliberate: the solve
 * count sits at the top, the filters that pick *which* solves to look at come next, and
 * the method/session/display settings sit below the spacer. Nothing enforces that order
 * except the sequence of calls in render(), so pin it here.
 */
import { describe, expect, test } from '@jest/globals';
import { FilterPanel } from '../Components/FilterPanel';
import { FilterPanelState, Solve } from '../Helpers/Types';
import { makeSolve } from './testUtils';

/** Renders the panel and records the title of each filter card, in order. */
function cardTitles(solves: Solve[]): string[] {
    const panel = new FilterPanel({ solves });
    const seeded: FilterPanelState = { ...panel.state, allSolves: solves, filteredSolves: solves };
    Object.assign(panel, { state: seeded });

    const titles: string[] = [];
    const original = panel.createFilterHtml.bind(panel);
    Object.assign(panel, {
        createFilterHtml: (filter: JSX.Element, title: string, tooltip: string): JSX.Element => {
            titles.push(title);
            return original(filter, title, tooltip);
        }
    });

    panel.render();
    return titles;
}

describe('filter sidebar layout', () => {
    const solves = [makeSolve()];

    test('orders the filter cards the way the sidebar is meant to read', () => {
        expect(cardTitles(solves)).toEqual([
            'Showing 1 / 1 solves',
            'Which step to drill down?',
            'PLL Cases',
            'OLL Cases',
            'Solve Cleanliness',
            'Solve Luckiness',
            'Cross Color',
            'Solve Times',
            'Inspection Time',
            'Which Method?',
            'Which Sessions?',
            'Source',
            'Sliding Window Size',
            'Points Per Graph',
            'Use Logarithmic Scale',
            '4-Segment Timing',
            'Benchmarks',
            'Pick Start Date',
            'Pick End Date'
        ]);
    });

    test('leads with the solve count so it reads as a heading', () => {
        expect(cardTitles(solves)[0]).toBe('Showing 1 / 1 solves');
    });

    test('keeps the case filters directly under the step drilldown', () => {
        const titles = cardTitles(solves);
        const drilldown = titles.indexOf('Which step to drill down?');

        expect(titles.slice(drilldown + 1, drilldown + 3)).toEqual(['PLL Cases', 'OLL Cases']);
        // Cleanliness and luckiness follow the case filters.
        expect(titles.slice(drilldown + 3, drilldown + 5)).toEqual(['Solve Cleanliness', 'Solve Luckiness']);
    });

    test('groups method, sessions and source immediately above the window size', () => {
        const titles = cardTitles(solves);
        const method = titles.indexOf('Which Method?');

        expect(titles.slice(method, method + 4)).toEqual([
            'Which Method?',
            'Which Sessions?',
            'Source',
            'Sliding Window Size'
        ]);
    });

    test('keeps the two time ranges together', () => {
        const titles = cardTitles(solves);
        const solveTimes = titles.indexOf('Solve Times');

        expect(titles[solveTimes + 1]).toBe('Inspection Time');
    });

    test('renders the spacer between the cross color and the solve times', () => {
        const panel = new FilterPanel({ solves });
        Object.assign(panel, { state: { ...panel.state, allSolves: solves, filteredSolves: solves } });

        const markup = JSON.stringify(panel.render(), (_key, value: unknown) =>
            typeof value === 'function' ? undefined : value);

        const crossColor = markup.indexOf('Pick the starting cross color');
        const spacer = markup.indexOf('"br"', crossColor);
        const solveTimes = markup.indexOf('Choose slowest and fastest solves to keep');

        expect(crossColor).toBeGreaterThan(-1);
        expect(spacer).toBeGreaterThan(crossColor);
        expect(solveTimes).toBeGreaterThan(spacer);
    });
});
