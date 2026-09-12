/**
 * Parser coverage for the real exports shipped in public/demo.
 *
 * The unit tests in CsvParser.test.tsx drive single hand-written rows. These
 * drive whole exports from real users, which is where the parser has actually
 * broken before: a row silently dropped by mis-splitting a column that contains
 * a comma, a date format a single sample never exercised, or a column whose
 * casing differs between exporter versions.
 *
 * Between them the fixtures cover both export formats, all supported methods,
 * both `false`/`FALSE` spellings of the boolean columns, and rows that are
 * legitimately corrupt (DNFs and sub-second times) so the corrupt count cannot
 * drift unnoticed.
 */
import { describe, expect, test } from '@jest/globals';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { parseCsv } from '../Helpers/CsvParser';
import { FilterPanel } from '../Components/FilterPanel';
import { Const } from '../Helpers/Constants';
import { DEMO_DATASETS, DEFAULT_DEMO_FILE } from '../Helpers/SampleData';
import {
    CrossColor,
    Filters,
    MethodName,
    Solve,
    SolveCleanliness,
    SolveLuckiness,
    StepName,
    getStep,
} from '../Helpers/Types';

/** The filters the app starts with: everything selected, nothing narrowed. */
function defaultFilters(): Filters {
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
        solveCleanliness: [SolveCleanliness.Clean, SolveCleanliness.Mistake],
        solveLuckiness: [SolveLuckiness.FullStep, SolveLuckiness.Skip],
        method: MethodName.CFOP,
        sessions: [],
        lowestInspection: 0,
        highestInspection: 300,
    };
}

interface Fixture {
    /** File name under public/demo. */
    file: string;
    /** Data rows in the file; every one must become a solve. */
    rows: number;
    /** Which parser branch the header should select. */
    source: Solve['source'];
    /** Solves the parser flags as corrupt (DNF, or a sub-second time). */
    corrupt: number;
    /** Methods present, sorted. Guards the method column mapping. */
    methods: string[];
    /** Date range of the export, as YYYY-MM-DD. Guards date parsing. */
    dateRange: [string, string];
    /**
     * Whether the export carries per-step case analysis (the step_N_case
     * columns). Cubeast can export the same solves with those columns blank,
     * which leaves OLL/PLL case charts empty; see the test below.
     */
    hasCaseAnalysis: boolean;
}

const FIXTURES: Fixture[] = [
    {
        file: 'acubemy.csv',
        rows: 10_000,
        source: 'acubemy',
        corrupt: 0,
        methods: ['CFOP', 'Roux', 'ZZ'],
        dateRange: ['2024-09-12', '2026-03-18'],
        hasCaseAnalysis: true,
    },
    {
        // A large export of the same account as the bundled demo data, but taken
        // with case analysis switched off: every step_N_case column is blank.
        file: 'free-large.csv',
        rows: 34_243,
        source: 'cubeast',
        corrupt: 2,
        methods: ['CFOP'],
        dateRange: ['2022-11-10', '2026-01-25'],
        hasCaseAnalysis: false,
    },
    {
        file: 'cfop-small.csv',
        rows: 467,
        source: 'cubeast',
        corrupt: 0,
        methods: ['CFOP'],
        dateRange: ['2023-08-19', '2023-09-19'],
        hasCaseAnalysis: true,
    },
    {
        file: 'free-small.csv',
        rows: 2_010,
        source: 'cubeast',
        corrupt: 14,
        methods: ['Layer by Layer', 'Roux'],
        dateRange: ['2023-09-30', '2023-10-10'],
        hasCaseAnalysis: false,
    },
    {
        // Uses the uppercase FALSE spelling of the boolean columns.
        file: 'roux-large.csv',
        rows: 896,
        source: 'cubeast',
        corrupt: 1,
        methods: ['Roux'],
        dateRange: ['2025-07-17', '2025-08-14'],
        hasCaseAnalysis: false,
    },
    {
        file: 'roux-small.csv',
        rows: 10,
        source: 'cubeast',
        corrupt: 0,
        methods: ['Roux'],
        dateRange: ['2025-07-17', '2025-07-17'],
        hasCaseAnalysis: false,
    },
    {
        // Rows are not in date order, and one DNF row has an empty time column.
        file: 'unsorted-sample.csv',
        rows: 54,
        source: 'cubeast',
        corrupt: 2,
        methods: ['CFOP', 'CFOP (2 look OLL)'],
        dateRange: ['2024-08-01', '2024-08-08'],
        hasCaseAnalysis: true,
    },
];

function readFixture(file: string): string {
    return readFileSync(join(__dirname, '..', '..', 'public', 'demo', file), 'utf8');
}

function isoDay(date: Date): string {
    return date.toISOString().slice(0, 10);
}

describe.each(FIXTURES)('$file', (fixture: Fixture) => {
    const raw = readFixture(fixture.file);
    const solves = parseCsv(raw, ',');
    const sound = solves.filter(s => !s.isCorrupt);

    test('every data row becomes a solve', () => {
        // A parser that mis-splits a column containing a comma drops rows here
        // rather than failing outright, so compare against the raw line count.
        expect(raw.trim().split('\n').length - 1).toBe(fixture.rows);
        expect(solves.length).toBe(fixture.rows);
    });

    test('the header selects the expected parser', () => {
        expect(solves.every(s => s.source === fixture.source)).toBe(true);
    });

    test('every date parses', () => {
        expect(solves.filter(s => Number.isNaN(s.date.getTime()))).toEqual([]);
        const days = solves.map(s => isoDay(s.date)).sort();
        expect([days[0], days[days.length - 1]]).toEqual(fixture.dateRange);
    });

    test('sound solves have a positive time and turn count', () => {
        expect(solves.filter(s => s.isCorrupt).length).toBe(fixture.corrupt);
        expect(sound.length).toBe(fixture.rows - fixture.corrupt);
        expect(sound.filter(s => !(s.time > 0))).toEqual([]);
        expect(sound.filter(s => !(s.turns > 0))).toEqual([]);
    });

    test('methods are mapped, not left blank', () => {
        expect(Array.from(new Set(solves.map(s => s.method))).sort()).toEqual(fixture.methods);
    });

    test('ids are preserved and unique', () => {
        expect(solves.filter(s => !s.id)).toEqual([]);
        expect(new Set(solves.map(s => s.id)).size).toBe(fixture.rows);
    });

    test('per-step case analysis is present only when the export carries it', () => {
        // Cubeast can export the same solves with the step_N_case columns blank.
        // Those exports still parse, but every case-driven chart is empty, so the
        // distinction is worth pinning per fixture rather than discovering later.
        const withCase = solves.filter(s => s.steps.some(step => !!step.case));
        expect(withCase.length > 0).toBe(fixture.hasCaseAnalysis);
    });
});

describe('the demo dataset registry', () => {
    // The dropdown is only as good as the files behind it: a rename in public/demo
    // that misses the registry would ship a menu entry that 404s at runtime.
    test('every listed dataset exists in public', () => {
        const missing = DEMO_DATASETS.filter(d => !existsSync(join(__dirname, '..', '..', 'public', d.file)));
        expect(missing.map(d => d.file)).toEqual([]);
    });

    test('every CSV in public/demo is offered in the dropdown', () => {
        const onDisk = readdirSync(join(__dirname, '..', '..', 'public', 'demo')).filter(f => f.endsWith('.csv')).sort();
        const listed = DEMO_DATASETS.map(d => d.file).filter(f => f.startsWith('demo/')).map(f => f.slice('demo/'.length)).sort();
        expect(listed).toEqual(onDisk);
    });

    test('ids and names are unique, and the button loads the original demo data', () => {
        expect(new Set(DEMO_DATASETS.map(d => d.id)).size).toBe(DEMO_DATASETS.length);
        expect(new Set(DEMO_DATASETS.map(d => d.name)).size).toBe(DEMO_DATASETS.length);
        expect(DEFAULT_DEMO_FILE).toBe('demo-solves.csv');
    });

    test('every offered dataset parses into solves', () => {
        for (const dataset of DEMO_DATASETS) {
            const raw = readFileSync(join(__dirname, '..', '..', 'public', dataset.file), 'utf8');
            expect(parseCsv(raw, ',').length).toBeGreaterThan(0);
        }
    });
});

describe('switching an Acubemy export to Roux', () => {
    // Acubemy records Roux and ZZ solves as a single block: the step names exist
    // but carry no timings. Selecting Roux therefore selects steps whose times are
    // all zero, and compressing against them used to rewrite every solve's time to
    // 0, leaving the charts full of zeroes.
    const solves = parseCsv(readFixture('acubemy.csv'), ',');

    function rouxFilters(): Filters {
        return { ...defaultFilters(), method: MethodName.Roux, steps: Const.MethodSteps[MethodName.Roux] };
    }

    test('the export really does contain untimed Roux steps', () => {
        const roux = solves.filter(s => s.method === MethodName.Roux);
        expect(roux.length).toBeGreaterThan(0);
        expect(roux.every(s => s.time > 0)).toBe(true);
        const rouxStepNames = Const.MethodSteps[MethodName.Roux];
        expect(roux.every(s => rouxStepNames.every(name => getStep(s, name) !== undefined))).toBe(true);
        expect(roux.every(s => s.steps.every(step => step.time === 0))).toBe(true);
    });

    test('Roux solves survive the filters', () => {
        const kept = FilterPanel.applyFiltersToSolves(solves, rouxFilters(), 1_000);
        expect(kept.length).toBeGreaterThan(0);
        expect(kept.every(s => s.method === MethodName.Roux)).toBe(true);
    });

    test('compressing keeps each solve total time instead of zeroing it', () => {
        const kept = FilterPanel.applyFiltersToSolves(solves, rouxFilters(), 1_000);
        const compressed = FilterPanel.compressSolves(kept, Const.MethodSteps[MethodName.Roux]);

        expect(compressed.filter(s => !(s.time > 0))).toEqual([]);
        expect(compressed.map(s => s.time)).toEqual(kept.map(s => s.time));
        expect(compressed.filter(s => !(s.turns > 0))).toEqual([]);
    });

    test('a timed CFOP export still compresses down to the selected steps', () => {
        // The fallback must not mask a real step breakdown: selecting a subset of
        // CFOP steps reports just that subset's time, and a skipped step stays 0.
        const cfop = parseCsv(readFixture('cfop-small.csv'), ',');
        const kept = FilterPanel.applyFiltersToSolves(cfop, defaultFilters(), 1_000);
        const justPll = FilterPanel.compressSolves(kept, [StepName.PLL]);

        expect(justPll.every((s, i) => s.time < kept[i].time)).toBe(true);
        expect(justPll.every((s, i) => s.time === (getStep(kept[i], StepName.PLL)?.time ?? 0))).toBe(true);
    });
});

describe('an export with no case analysis', () => {
    // Free-tier Cubeast exports leave every step_N_case column blank. Such a
    // dataset looks healthy by every other measure - 34k rows, every date valid,
    // only 2 corrupt solves - and must stay usable: the case-driven charts have
    // nothing to show, but every other chart still has all the data it needs.
    const solves = parseCsv(readFixture('free-large.csv'), ',');

    test('parses cleanly', () => {
        expect(solves.length).toBe(34_243);
        expect(solves.filter(s => s.isCorrupt).length).toBe(2);
    });

    test('carries a PLL step whose case is blank rather than absent', () => {
        const pllCases = solves.map(s => getStep(s, StepName.PLL)?.case);
        expect(pllCases.filter(c => c === undefined).length).toBe(0);
        expect(pllCases.filter(c => c === '').length).toBe(solves.length);
    });

    // 2 solves are corrupt and 2 more report an inspection time past the default
    // 300s cap; everything else must survive.
    const EXPECTED_KEPT = 34_239;

    test('survives the default filters instead of being rejected wholesale', () => {
        // A blank case is "not reported", not a case that matches nothing. Treating
        // it as the latter filtered out all 34k solves and left the page empty.
        const kept = FilterPanel.applyFiltersToSolves(solves, defaultFilters(), 1_000);
        expect(kept.length).toBe(EXPECTED_KEPT);
    });

    test('still has the data every non-case chart needs', () => {
        const kept = FilterPanel.applyFiltersToSolves(solves, defaultFilters(), 1_000);
        expect(kept.filter(s => !(s.time > 0))).toEqual([]);
        expect(kept.filter(s => !(s.turns > 0))).toEqual([]);
        expect(kept.filter(s => !(s.tps > 0))).toEqual([]);
        expect(kept.filter(s => Number.isNaN(s.date.getTime()))).toEqual([]);
        // Step timings drive the per-step charts and survive without case names.
        expect(kept.filter(s => s.steps.some(step => step.time > 0)).length).toBe(kept.length);
    });

    test('narrowing the case filter no longer hides uncased solves', () => {
        // Deselecting cases should be a no-op for an export that reports none,
        // rather than silently emptying the page.
        const narrowed = { ...defaultFilters(), pllCases: ['T'], ollCases: ['1'] };
        expect(FilterPanel.applyFiltersToSolves(solves, narrowed, 1_000).length).toBe(EXPECTED_KEPT);
    });
});
