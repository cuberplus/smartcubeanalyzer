/** @jest-environment jsdom */
import { describe, expect, test } from '@jest/globals';
import { FilterPanel } from '../Components/FilterPanel';
import { CrossColor, MethodName, StepName } from '../Helpers/Types';

/**
 * Characterization tests for FilterPanel's state handlers. The panel's pure
 * logic is covered elsewhere; these pin the setState behaviour so the handlers
 * can be collapsed into generic helpers without changing what the UI does.
 */

type AnyPanel = any;

function newPanel(props: any = { solves: [] }): AnyPanel {
    const panel: AnyPanel = new (FilterPanel as any)(props);
    panel.setState = (update: any) => {
        const patch = typeof update === 'function' ? update(panel.state) : update;
        panel.state = { ...panel.state, ...patch };
    };
    return panel;
}

const initialFilters = () => newPanel().state.filters;

/** Runs a handler against a fake component and returns the resulting state. */
function runHandler(handler: (panel: AnyPanel) => void, seed: Record<string, any> = {}): any {
    const panel = newPanel();
    panel.state = { ...panel.state, ...seed };
    handler(panel);
    return panel.state;
}

const opts = (...values: string[]) => values.map(v => ({ label: v, value: v }));

describe('FilterPanel multi-select handlers', () => {
    const cases: Array<[string, (p: AnyPanel, list: any[]) => void, string, string, string[]]> = [
        ['cross colors', (p, l) => p.crossColorsChanged(l), 'crossColors', 'chosenColors', [CrossColor.White, CrossColor.Red]],
        ['sessions', (p, l) => p.chosenSessionsChanged(l), 'sessions', 'chosenSessions', ['morning', 'evening']],
        ['sources', (p, l) => p.sourcesChanged(l), 'sources', 'chosenSources', ['cubeast']],
        ['PLL cases', (p, l) => p.pllChanged(l), 'pllCases', 'chosenPLLs', ['Aa', 'Ab']],
        ['OLL cases', (p, l) => p.ollChanged(l), 'ollCases', 'chosenOLLs', ['OLL 1']],
        ['cleanliness', (p, l) => p.setCleanliness(l), 'solveCleanliness', 'solveCleanliness', ['Clean']],
        ['luckiness', (p, l) => p.setLuckiness(l), 'solveLuckiness', 'solveLuckiness', ['Fullstep']],
    ];

    test.each(cases)('%s writes values to filters and the raw list to state', (_name, call, filterKey, stateKey, values) => {
        const list = opts(...values);
        const state = runHandler(p => call(p, list));
        expect(state.filters[filterKey]).toEqual(values);
        // Cleanliness and luckiness reuse one key for both, so compare accordingly.
        expect(state[stateKey]).toEqual(stateKey === filterKey ? list : list);
    });

    test.each(cases)('%s leaves the other filters untouched', (_name, call, filterKey) => {
        const before = initialFilters();
        const state = runHandler(p => call(p, opts('x')));
        for (const key of Object.keys(before)) {
            if (key !== filterKey) expect(state.filters[key]).toEqual(before[key]);
        }
    });

    test.each(cases)('%s clears the filter when nothing is selected', (_name, call, filterKey) => {
        const state = runHandler(p => call(p, []));
        expect(state.filters[filterKey]).toEqual([]);
    });
});

describe('FilterPanel numeric handlers', () => {
    const evt = (value: string) => ({ target: { value } }) as any;

    const filterCases: Array<[string, (p: AnyPanel, e: any) => void, string]> = [
        ['slowest solve', (p, e) => p.setSlowestSolve(e), 'slowestTime'],
        ['fastest solve', (p, e) => p.setFastestSolve(e), 'fastestTime'],
        ['lowest inspection', (p, e) => p.setLowestInspection(e), 'lowestInspection'],
        ['highest inspection', (p, e) => p.setHighestInspection(e), 'highestInspection'],
    ];

    test.each(filterCases)('%s parses the input into filters', (_n, call, key) => {
        expect(runHandler(p => call(p, evt('42'))).filters[key]).toBe(42);
    });

    test.each(filterCases)('%s parses a partial number the same way parseInt does', (_n, call, key) => {
        expect(runHandler(p => call(p, evt('12abc'))).filters[key]).toBe(12);
        expect(runHandler(p => call(p, evt(''))).filters[key]).toBeNaN();
    });

    const stateCases: Array<[string, (p: AnyPanel, e: any) => void, string]> = [
        ['bad time', (p, e) => p.setBadTime(e), 'badTime'],
        ['good time', (p, e) => p.setGoodTime(e), 'goodTime'],
        ['points per graph', (p, e) => p.setPointsPerGraph(e), 'pointsPerGraph'],
    ];

    test.each(stateCases)('%s parses the input into top level state', (_n, call, key) => {
        expect(runHandler(p => call(p, evt('7')))[key]).toBe(7);
    });

    test('window size is clamped to a minimum of five', () => {
        expect(runHandler(p => p.setWindowSize(evt('100'))).windowSize).toBe(100);
        expect(runHandler(p => p.setWindowSize(evt('1'))).windowSize).toBe(5);
        expect(runHandler(p => p.setWindowSize(evt(''))).windowSize).toBe(5);
    });
});

describe('FilterPanel date and toggle handlers', () => {
    test('start and end dates write through to filters', () => {
        const start = new Date('2024-02-03T00:00:00Z');
        const end = new Date('2024-05-06T00:00:00Z');
        expect(runHandler(p => p.setStartDate(start)).filters.startDate).toBe(start);
        expect(runHandler(p => p.setEndDate(end)).filters.endDate).toBe(end);
    });

    const toggles: Array<[string, (p: AnyPanel, v: boolean) => void, string]> = [
        ['log scale', (p, v) => p.setUseLogScale(v), 'useLogScale'],
        ['4 segment timing', (p, v) => p.setUse4SegmentTiming(v), 'use4SegmentTiming'],
        ['test alert', (p, v) => p.setTestAlert(v), 'showTestAlert'],
    ];

    test.each(toggles)('%s toggles both ways', (_n, call, key) => {
        expect(runHandler(p => call(p, true))[key]).toBe(true);
        expect(runHandler(p => call(p, false))[key]).toBe(false);
    });

    test('showing and hiding the filter drawer flips one flag', () => {
        expect(runHandler(p => p.showFilters()).showFilters).toBe(true);
        expect(runHandler(p => p.hideFilters(), { showFilters: true }).showFilters).toBe(false);
    });

    test('selecting a tab stores the key', () => {
        expect(runHandler(p => p.tabSelect(3)).tabKey).toBe(3);
    });
});

describe('FilterPanel option builders and step selection', () => {
    test('method options cover every method', () => {
        expect(newPanel().getMethodOptions()).toEqual(Object.values(MethodName).map(m => ({ label: m, value: m })));
    });

    test('step options match the steps of the method', () => {
        const options = FilterPanel.getStepOptionsForMethod(MethodName.CFOP);
        expect(options.length).toBeGreaterThan(0);
        expect(options.every(o => o.label === o.value)).toBe(true);
        expect(options.map(o => o.value)).toContain(StepName.PLL);
    });

    test('chosen steps are re-sorted into method order', () => {
        const scrambled = opts(StepName.PLL, StepName.Cross, StepName.OLL);
        const state = runHandler(p => p.chosenStepsChanged(scrambled));
        expect(state.filters.steps).toEqual([StepName.Cross, StepName.OLL, StepName.PLL]);
        expect(state.chosenSteps).toEqual(scrambled);
    });

    test('a steps preset replaces both the filter and the chosen options', () => {
        const state = runHandler(p => p.applyStepsPreset([StepName.OLL, StepName.PLL]));
        expect(state.filters.steps).toEqual([StepName.OLL, StepName.PLL]);
        expect(state.chosenSteps).toEqual(opts(StepName.OLL, StepName.PLL));
    });

    test('changing method resets steps to that method and notifies the parent', () => {
        let notified: MethodName | undefined;
        const panel = newPanel({ solves: [], onMethodChange: (m: MethodName) => { notified = m; } });
        panel.methodChanged({ label: MethodName.CFOP, value: MethodName.CFOP });
        expect(panel.state.filters.method).toBe(MethodName.CFOP);
        expect(panel.state.filters.steps.length).toBeGreaterThan(0);
        expect(notified).toBe(MethodName.CFOP);
    });
});
