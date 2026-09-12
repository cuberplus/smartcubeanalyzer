/**
 * @jest-environment jsdom
 *
 * Charts built from per-step timings are hidden when the data has none.
 *
 * Acubemy records Roux and ZZ solves as a single block: the step names exist but
 * every timing is zero. Rendering the step charts anyway produced a wall of flat
 * zeroes, which reads as a broken site rather than as missing data.
 */
import { beforeAll, describe, expect, jest, test } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import React from 'react';

interface ChartMockProps { children?: React.ReactNode }

jest.mock('react-chartjs-2', () => ({
    Line: () => React.createElement('div', { 'data-chart': 'line' }),
    Bar: () => React.createElement('div', { 'data-chart': 'bar' }),
    Doughnut: () => React.createElement('div', { 'data-chart': 'doughnut' }),
}));

jest.mock('../Workers/createChartWorker', () => ({
    createChartWorker: () => {
        const { computeAllChartData: compute } = require('../Workers/chartWorker') as typeof import('../Workers/chartWorker');
        const worker: { onmessage: ((e: MessageEvent) => void) | null; postMessage(input: WorkerInput): void; terminate(): void } = {
            onmessage: null,
            postMessage(input: WorkerInput) {
                const chartData = compute(input);
                worker.onmessage?.(new MessageEvent('message', { data: { requestId: input.requestId, chartData } }));
            },
            terminate() { },
        };
        return worker;
    },
}));

import { render, screen, waitFor } from '@testing-library/react';
import { ChartPanel } from '../Components/ChartPanel';
import { FilterPanel } from '../Components/FilterPanel';
import { parseCsv } from '../Helpers/CsvParser';
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
import type { WorkerInput } from '../Workers/chartWorker';

/** Charts that are built purely from per-step timings. */
const STEP_TIMING_CHARTS = [
    'Average Recognition and Execution',
    'Average Time by Step',
    'Percentage of the Solve Each Step Took',
    'Time Per Step, Compared to Typical Solver',
];

/** A representative chart that needs nothing but the solve total. */
const ALWAYS_PRESENT = 'Average Time';

/** Chart titles render with a trailing tooltip marker. */
function chartTitle(title: string): string {
    return `${title} \u24D8`;
}

function filtersFor(method: MethodName): Filters {
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
        steps: Const.MethodSteps[method],
        solveCleanliness: [SolveCleanliness.Clean, SolveCleanliness.Mistake],
        solveLuckiness: [SolveLuckiness.FullStep, SolveLuckiness.Skip],
        method,
        sessions: [],
        lowestInspection: 0,
        highestInspection: 300,
    };
}

function prepare(file: string, method: MethodName): Solve[] {
    const raw = readFileSync(join(__dirname, '..', '..', 'public', 'demo', file), 'utf8');
    const filters = filtersFor(method);
    const kept = FilterPanel.applyFiltersToSolves(parseCsv(raw, ','), filters, 1_000);
    return FilterPanel.compressSolves(kept, filters.steps);
}

async function renderCharts(solves: Solve[], method: MethodName) {
    render(React.createElement(ChartPanel, {
        solves,
        windowSize: 1_000,
        pointsPerGraph: 100,
        steps: Const.MethodSteps[method],
        goodTime: 15,
        badTime: 20,
        methodName: method,
        useLogScale: false,
        use4SegmentTiming: true,
    } as React.ComponentProps<typeof ChartPanel>));
    await waitFor(() => expect(screen.queryByText(chartTitle(ALWAYS_PRESENT))).not.toBeNull(), { timeout: 60_000 });
}

beforeAll(() => {
    if (!('ResizeObserver' in globalThis)) {
        Object.assign(globalThis, { ResizeObserver: class { observe() { } unobserve() { } disconnect() { } } });
    }
    if (!('CSS' in globalThis)) Object.assign(globalThis, { CSS: { supports: () => false, escape: (value: string) => value } });
    if (!('matchMedia' in globalThis)) {
        Object.assign(globalThis, {
            matchMedia: () => ({ matches: false, addListener() { }, removeListener() { }, addEventListener() { }, removeEventListener() { } }),
        });
    }
});

describe('an Acubemy export viewed as Roux, which has no step timings', () => {
    let solves: Solve[];

    beforeAll(() => { solves = prepare('acubemy.csv', MethodName.Roux); });

    test('the data really does lack step timings but still has solve totals', () => {
        expect(solves.length).toBeGreaterThan(0);
        expect(solves.some(s => s.steps.some(step => step.time > 0))).toBe(false);
        expect(solves.every(s => s.time > 0)).toBe(true);
    });

    test('every step-timing chart is hidden', async () => {
        await renderCharts(solves, MethodName.Roux);
        for (const title of STEP_TIMING_CHARTS) {
            expect(screen.queryByText(chartTitle(title))).toBeNull();
        }
    }, 120_000);

    test('charts that only need the solve total are still shown', async () => {
        await renderCharts(solves, MethodName.Roux);
        for (const title of ['Average Time', 'Average Turns Per Second', 'Current Records']) {
            expect(screen.queryByText(chartTitle(title))).not.toBeNull();
        }
    }, 120_000);
});

describe('a Cubeast export that does have step timings', () => {
    let solves: Solve[];

    beforeAll(() => { solves = prepare('cfop-small.csv', MethodName.CFOP); });

    test('the data has step timings', () => {
        expect(solves.some(s => s.steps.some(step => step.time > 0))).toBe(true);
    });

    test('the step charts are still shown', async () => {
        // The guard must only fire for data that genuinely has nothing to plot.
        await renderCharts(solves, MethodName.CFOP);
        for (const title of STEP_TIMING_CHARTS) {
            expect(screen.queryByText(chartTitle(title))).not.toBeNull();
        }
    }, 120_000);
});
