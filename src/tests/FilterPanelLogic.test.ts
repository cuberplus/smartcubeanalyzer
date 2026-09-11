import { describe, expect, test } from '@jest/globals';
import { FilterPanel } from '../Components/FilterPanel';
import { Const } from '../Helpers/Constants';
import {
    CrossColor,
    Filters,
    MethodName,
    Solve,
    SolveCleanliness,
    SolveLuckiness,
    StepName,
} from '../Helpers/Types';
import { makeCfopSteps, makeSolve, makeSolves, makeStep } from './testUtils';

function permissiveFilters(overrides: Partial<Filters> = {}): Filters {
    return {
        sources: ['cubeast', 'acubemy'],
        startDate: new Date('2000-01-01'),
        endDate: new Date('2100-01-01'),
        fastestTime: 0,
        slowestTime: 300,
        crossColors: [
            CrossColor.White, CrossColor.Yellow, CrossColor.Blue,
            CrossColor.Green, CrossColor.Orange, CrossColor.Red, CrossColor.Unknown,
        ],
        pllCases: Const.PllCases.map(x => x.value),
        ollCases: Const.OllCases.map(x => x.value),
        steps: Const.MethodSteps[MethodName.CFOP],
        solveCleanliness: Const.solveCleanliness.map(x => x.value),
        solveLuckiness: Const.solveLuckiness.map(x => x.value),
        method: MethodName.CFOP,
        sessions: [],
        lowestInspection: 0,
        highestInspection: 300,
        ...overrides,
    };
}

/** A solve that passes the permissive filters above. */
function passingSolve(overrides: Partial<Solve> = {}): Solve {
    return makeSolve({
        steps: makeCfopSteps().map(s =>
            s.name === StepName.OLL || s.name === StepName.PLL ? { ...s, case: 'Solved' } : s
        ),
        ...overrides,
    });
}

describe('FilterPanel.passesFilters', () => {
    test('accepts a solve that matches every filter', () => {
        expect(FilterPanel.passesFilters(passingSolve(), permissiveFilters())).toBe(true);
    });

    test('always rejects corrupt solves', () => {
        expect(FilterPanel.passesFilters(passingSolve({ isCorrupt: true }), permissiveFilters())).toBe(false);
    });

    test('rejects solves solved with a different method', () => {
        const solve = passingSolve({ method: MethodName.Roux });
        expect(FilterPanel.passesFilters(solve, permissiveFilters())).toBe(false);
    });

    test('rejects solves from an unselected source', () => {
        const filters = permissiveFilters({ sources: ['cubeast'] });
        expect(FilterPanel.passesFilters(passingSolve({ source: 'acubemy' }), filters)).toBe(false);
    });

    test('rejects solves with an unselected cross color', () => {
        const filters = permissiveFilters({ crossColors: [CrossColor.Yellow] });
        expect(FilterPanel.passesFilters(passingSolve({ crossColor: CrossColor.White }), filters)).toBe(false);
    });

    test('rejects solves outside the date range', () => {
        const filters = permissiveFilters({
            startDate: new Date('2024-06-01'),
            endDate: new Date('2024-06-30'),
        });
        expect(FilterPanel.passesFilters(passingSolve({ date: new Date('2024-01-01') }), filters)).toBe(false);
        expect(FilterPanel.passesFilters(passingSolve({ date: new Date('2024-12-01') }), filters)).toBe(false);
        expect(FilterPanel.passesFilters(passingSolve({ date: new Date('2024-06-15') }), filters)).toBe(true);
    });

    test('rejects solves outside the time range', () => {
        const filters = permissiveFilters({ fastestTime: 10, slowestTime: 20 });
        expect(FilterPanel.passesFilters(passingSolve({ time: 5 }), filters)).toBe(false);
        expect(FilterPanel.passesFilters(passingSolve({ time: 25 }), filters)).toBe(false);
        expect(FilterPanel.passesFilters(passingSolve({ time: 15 }), filters)).toBe(true);
    });

    test('rejects solves outside the inspection range', () => {
        const filters = permissiveFilters({ lowestInspection: 5, highestInspection: 10 });
        expect(FilterPanel.passesFilters(passingSolve({ inspectionTime: 2 }), filters)).toBe(false);
        expect(FilterPanel.passesFilters(passingSolve({ inspectionTime: 20 }), filters)).toBe(false);
    });

    test('keeps solves whose source never reported inspection time', () => {
        const filters = permissiveFilters({ lowestInspection: 5, highestInspection: 10 });
        expect(FilterPanel.passesFilters(passingSolve({ inspectionTime: null }), filters)).toBe(true);
    });

    test('rejects solves from an unselected session', () => {
        const filters = permissiveFilters({ sessions: ['Practice'] });
        expect(FilterPanel.passesFilters(passingSolve({ session: 'Other' }), filters)).toBe(false);
        expect(FilterPanel.passesFilters(passingSolve({ session: 'Practice' }), filters)).toBe(true);
    });

    test('keeps solves with no session even when sessions are filtered', () => {
        const filters = permissiveFilters({ sessions: ['Practice'] });
        expect(FilterPanel.passesFilters(passingSolve({ session: '' }), filters)).toBe(true);
    });

    test('rejects solves whose PLL case is deselected', () => {
        const filters = permissiveFilters({ pllCases: ['T'] });
        expect(FilterPanel.passesFilters(passingSolve(), filters)).toBe(false);
    });

    test('rejects solves whose OLL case is deselected', () => {
        const filters = permissiveFilters({ ollCases: ['Solved'], pllCases: ['Solved'] });
        const solve = passingSolve({
            steps: makeCfopSteps().map(s =>
                s.name === StepName.OLL ? { ...s, case: 'Sune' } : s.name === StepName.PLL ? { ...s, case: 'Solved' } : s
            ),
        });
        expect(FilterPanel.passesFilters(solve, filters)).toBe(false);
    });

    test('does not apply last-layer case filters to non-CFOP methods', () => {
        const filters = permissiveFilters({ method: MethodName.Roux, pllCases: [], ollCases: [] });
        const solve = passingSolve({ method: MethodName.Roux });
        expect(FilterPanel.passesFilters(solve, filters)).toBe(true);
    });

    test('respects the clean / mistake selection', () => {
        const cleanOnly = permissiveFilters({ solveCleanliness: [SolveCleanliness.Clean] });
        expect(FilterPanel.passesFilters(passingSolve({ isMistake: true }), cleanOnly)).toBe(false);
        expect(FilterPanel.passesFilters(passingSolve({ isMistake: false }), cleanOnly)).toBe(true);

        const mistakesOnly = permissiveFilters({ solveCleanliness: [SolveCleanliness.Mistake] });
        expect(FilterPanel.passesFilters(passingSolve({ isMistake: false }), mistakesOnly)).toBe(false);
        expect(FilterPanel.passesFilters(passingSolve({ isMistake: true }), mistakesOnly)).toBe(true);
    });

    test('respects the full-step / skip selection', () => {
        const fullStepOnly = permissiveFilters({ solveLuckiness: [SolveLuckiness.FullStep] });
        expect(FilterPanel.passesFilters(passingSolve({ isFullStep: false }), fullStepOnly)).toBe(false);
        expect(FilterPanel.passesFilters(passingSolve({ isFullStep: true }), fullStepOnly)).toBe(true);

        const skipsOnly = permissiveFilters({ solveLuckiness: [SolveLuckiness.Skip] });
        expect(FilterPanel.passesFilters(passingSolve({ isFullStep: true }), skipsOnly)).toBe(false);
        expect(FilterPanel.passesFilters(passingSolve({ isFullStep: false }), skipsOnly)).toBe(true);
    });
});

describe('FilterPanel.getMistakeMap', () => {
    test('returns one entry per value', () => {
        expect(FilterPanel.getMistakeMap([1, 2, 3, 4, 5], 2)).toHaveLength(5);
    });

    test('flags nothing for a steady run of solves', () => {
        const map = FilterPanel.getMistakeMap(Array.from({ length: 20 }, () => 10), 5);
        expect(map.every(m => m === false)).toBe(true);
    });

    test('flags a solve far above the recent average', () => {
        const values = [...Array.from({ length: 20 }, () => 10), 100];
        const map = FilterPanel.getMistakeMap(values, 5);
        expect(map[map.length - 1]).toBe(true);
    });

    test('flags nothing when there are fewer values than the window', () => {
        expect(FilterPanel.getMistakeMap([1, 500], 5)).toEqual([false, false]);
    });
});

describe('FilterPanel.markAllMistakes', () => {
    test('returns an empty array for no solves', () => {
        expect(FilterPanel.markAllMistakes([], 5)).toEqual([]);
    });

    test('marks nothing for a consistent run of solves', () => {
        const solves = makeSolves(20, { time: 20 });
        const marked = FilterPanel.markAllMistakes(solves, 5);
        expect(marked.every(s => s.isMistake === false)).toBe(true);
    });

    test('marks a solve whose total time is a huge outlier', () => {
        const solves = [...makeSolves(20, { time: 20 }), makeSolve({ id: 'outlier', time: 500 })];
        const marked = FilterPanel.markAllMistakes(solves, 5);
        expect(marked[marked.length - 1].isMistake).toBe(true);
    });

    test('marks a solve where a single step is a huge outlier', () => {
        const solves = [
            ...makeSolves(20, { time: 20 }),
            makeSolve({
                id: 'bad-oll',
                time: 20,
                steps: makeCfopSteps([2, 4, 4, 4, 4, 300, 3]),
            }),
        ];
        const marked = FilterPanel.markAllMistakes(solves, 5);
        expect(marked[marked.length - 1].isMistake).toBe(true);
    });

    test('returns one solve per input solve', () => {
        expect(FilterPanel.markAllMistakes(makeSolves(7), 5)).toHaveLength(7);
    });
});

describe('FilterPanel.markAllLuckiness', () => {
    test('returns an empty array for no solves', () => {
        expect(FilterPanel.markAllLuckiness([])).toEqual([]);
    });

    test('only inspects the steps belonging to the solve method', () => {
        const solve = makeSolve({
            method: MethodName.Roux,
            steps: [
                makeStep(StepName.LEFTBLOCK, 4),
                makeStep(StepName.RIGHTBLOCK, 4),
                makeStep(StepName.CMLL, 3),
                makeStep(StepName.LSE, 4),
            ],
        });
        expect(FilterPanel.markAllLuckiness([solve])[0].isFullStep).toBe(true);
    });
});

describe('FilterPanel.applyFiltersToSolves', () => {
    test('returns only the solves that pass the filters', () => {
        const solves = [
            passingSolve({ id: 'keep', crossColor: CrossColor.White }),
            passingSolve({ id: 'drop', crossColor: CrossColor.Yellow }),
        ];
        const filters = permissiveFilters({ crossColors: [CrossColor.White] });
        const result = FilterPanel.applyFiltersToSolves(solves, filters, 5);
        expect(result.map(s => s.id)).toEqual(['keep']);
    });

    test('returns an empty array for no solves', () => {
        expect(FilterPanel.applyFiltersToSolves([], permissiveFilters(), 5)).toEqual([]);
    });

    test('marks mistakes before filtering so the cleanliness filter can use them', () => {
        const solves = [...makeSolves(20, { time: 20 }), passingSolve({ id: 'outlier', time: 500 })];
        const filters = permissiveFilters({
            solveCleanliness: [SolveCleanliness.Mistake],
            slowestTime: 1000,
            pllCases: Const.PllCases.map(x => x.value),
        });
        const result = FilterPanel.applyFiltersToSolves(solves, filters, 5);
        expect(result.map(s => s.id)).toEqual(['outlier']);
    });
});

describe('FilterPanel.compressSolves', () => {
    test('sums recognition, execution and AUF times across the selected steps', () => {
        const solve = makeSolve({
            steps: [
                makeStep(StepName.OLL, 3, { recognitionTime: 1, executionTime: 2, preAufTime: 0.2, postAufTime: 0.1 }),
                makeStep(StepName.PLL, 4, { recognitionTime: 1.5, executionTime: 2.5, preAufTime: 0.3, postAufTime: 0.4 }),
            ],
        });
        const [compressed] = FilterPanel.compressSolves([solve], [StepName.OLL, StepName.PLL]);
        expect(compressed.recognitionTime).toBeCloseTo(2.5);
        expect(compressed.executionTime).toBeCloseTo(4.5);
        expect(compressed.preAufTime).toBeCloseTo(0.5);
        expect(compressed.postAufTime).toBeCloseTo(0.5);
    });

    test('recomputes TPS from the selected steps', () => {
        const solve = makeSolve({
            tps: 99,
            steps: [makeStep(StepName.OLL, 2, { turns: 10 })],
        });
        const [compressed] = FilterPanel.compressSolves([solve], [StepName.OLL]);
        expect(compressed.tps).toBeCloseTo(5);
    });

    test('falls back to the solve TPS when the selected steps record no time', () => {
        const solve = makeSolve({ tps: 42, steps: [makeStep(StepName.OLL, 0, { turns: 0 })] });
        const [compressed] = FilterPanel.compressSolves([solve], [StepName.OLL]);
        expect(compressed.tps).toBe(42);
    });

    test('falls back to the solve turn count when the selected steps have none', () => {
        const solve = makeSolve({ turns: 55, steps: [makeStep(StepName.OLL, 2, { turns: 0 })] });
        const [compressed] = FilterPanel.compressSolves([solve], [StepName.OLL]);
        expect(compressed.turns).toBe(55);
    });

    test('preserves identity and metadata fields', () => {
        const solve = makeSolve({ id: 'abc', session: 'Practice', scramble: "R U R'" });
        const [compressed] = FilterPanel.compressSolves([solve], [StepName.OLL]);
        expect(compressed.id).toBe('abc');
        expect(compressed.session).toBe('Practice');
        expect(compressed.scramble).toBe("R U R'");
        expect(compressed.source).toBe(solve.source);
        expect(compressed.date).toBe(solve.date);
    });

    test('produces a zero-time solve when no step matches', () => {
        const [compressed] = FilterPanel.compressSolves([makeSolve()], [StepName.CMLL]);
        expect(compressed.steps).toHaveLength(0);
        expect(compressed.time).toBe(0);
    });

    test('returns an empty array for no solves', () => {
        expect(FilterPanel.compressSolves([], [StepName.OLL])).toEqual([]);
    });
});

describe('FilterPanel.getStepOptionsForMethod', () => {
    test('returns the CFOP steps in solve order', () => {
        const options = FilterPanel.getStepOptionsForMethod(MethodName.CFOP);
        expect(options.map(o => o.value)).toEqual(Const.MethodSteps[MethodName.CFOP]);
    });

    test('uses the step name for both label and value', () => {
        const options = FilterPanel.getStepOptionsForMethod(MethodName.Roux);
        options.forEach(o => expect(o.label).toBe(o.value));
    });

    test('returns method-specific steps', () => {
        expect(FilterPanel.getStepOptionsForMethod(MethodName.ZZ).map(o => o.value))
            .toEqual([StepName.EOLINE, StepName.F2L, StepName.ZBLL]);
    });
});
