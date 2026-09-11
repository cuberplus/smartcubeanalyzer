/**
 * @jest-environment jsdom
 */
/**
 * End-to-end regression test for loading the bundled dev stats through the UI.
 *
 * Guards the two symptoms of a broken CSV parse, which unit tests on individual
 * helpers do not catch: the app reporting only a handful of solves, and every
 * chart rendering flat zeroes.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import React from 'react';

const mockChartProps: any[] = [];

jest.mock('react-chartjs-2', () => ({
    Line: (props: any) => { mockChartProps.push(props); return React.createElement('div', { 'data-chart': 'line' }); },
    Bar: (props: any) => { mockChartProps.push(props); return React.createElement('div', { 'data-chart': 'bar' }); },
    Doughnut: (props: any) => { mockChartProps.push(props); return React.createElement('div', { 'data-chart': 'doughnut' }); },
}));

// Run the worker body synchronously so the charts have data once React settles.
jest.mock('../Workers/createChartWorker', () => ({
    createChartWorker: () => {
        const { computeAllChartData: compute } = require('../Workers/chartWorker');
        const worker: any = {
            onmessage: null,
            postMessage(input: any) {
                const chartData = compute(input);
                worker.onmessage?.({ data: { requestId: input.requestId, chartData } });
            },
            terminate() { },
        };
        return worker;
    },
}));

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FileInput } from '../Components/FileInput';
import { GetDemoData } from '../Helpers/SampleData';
import { parseCsv } from '../Helpers/CsvParser';

const DEMO_CSV = join(__dirname, '..', '..', 'public', 'demo-solves.csv');
const EXPECTED_SOLVES = 21793;
// Two solves in the demo data are corrupt and are dropped by the default filters.
const EXPECTED_SHOWN = 21791;

let rawCsv: string;

beforeAll(() => {
    rawCsv = readFileSync(DEMO_CSV, 'utf8');
    const g = globalThis as any;
    if (!g.ResizeObserver) {
        g.ResizeObserver = class { observe() { } unobserve() { } disconnect() { } };
    }
    if (!g.CSS) g.CSS = { supports: () => false, escape: (value: string) => value };
    if (!g.matchMedia) {
        g.matchMedia = () => ({ matches: false, addListener() { }, removeListener() { }, addEventListener() { }, removeEventListener() { } });
    }
    g.fetch = () => Promise.resolve({ ok: true, text: () => Promise.resolve(rawCsv) });
});

function numbersIn(data: any): number[] {
    const datasets = data?.datasets ?? [];
    return datasets.flatMap((set: any) => (set?.data ?? []).filter((v: any) => typeof v === 'number'));
}

describe('fetching the demo CSV', () => {
    const globalAny = globalThis as any;
    let originalFetch: any;

    beforeEach(() => { originalFetch = globalAny.fetch; });
    afterEach(() => { globalAny.fetch = originalFetch; });

    test('asks for CSV so a base-path redirect resolves instead of the SPA fallback', async () => {
        let seenInit: any = null;
        globalAny.fetch = (_url: string, init: any) => {
            seenInit = init;
            return Promise.resolve({ ok: true, text: () => Promise.resolve('id,date\n1,2024-01-01') });
        };
        await GetDemoData();
        expect(seenInit?.headers?.Accept).toBe('text/csv');
    });

    test('fails loudly when the server answers with a web page', async () => {
        // A dev server or host that cannot find the CSV serves index.html. Parsing
        // that as a CSV used to yield ~49 junk solves and charts of flat zeroes.
        globalAny.fetch = () => Promise.resolve({
            ok: true,
            text: () => Promise.resolve('<!DOCTYPE html>\n<html lang="en">\n<head></head>\n<body></body>\n</html>'),
        });
        await expect(GetDemoData()).rejects.toThrow(/web page/);
    });
});

describe('loading the bundled dev stats through the UI', () => {
    test('every row of the demo CSV becomes a solve', () => {
        // The parser must not silently drop rows, e.g. by mis-splitting columns
        // that contain commas inside brackets.
        const rows = rawCsv.trim().split('\n').length - 1;
        const solves = parseCsv(rawCsv, ',');
        expect(solves.length).toBe(rows);
        expect(solves.length).toBe(EXPECTED_SOLVES);
        expect(solves.filter(s => s.time > 0).length).toBeGreaterThan(solves.length - 5);
        expect(solves.filter(s => s.turns > 0).length).toBeGreaterThan(solves.length * 0.9);
        expect(solves.filter(s => !Number.isNaN(s.date.getTime())).length).toBe(solves.length);
    });

    test(
        'the app shows every solve and charts plot real numbers',
        async () => {
            mockChartProps.length = 0;
            render(React.createElement(FileInput));

            fireEvent.click(screen.getByText('Display Test Stats!'));

            await waitFor(() => expect(mockChartProps.length).toBeGreaterThan(0), { timeout: 240_000 });

            fireEvent.click(screen.getByLabelText('Open filters'));
            const label = await screen.findByText(/Showing .* solves/);
            const [shown, total] = (label.textContent?.match(/\d+/g) ?? []).map(Number);
            expect(total).toBe(EXPECTED_SOLVES);
            expect(shown).toBe(EXPECTED_SHOWN);

            // The reported failure rendered every chart as a flat line of zeroes,
            // so require each chart to plot real values, not just the set overall.
            expect(mockChartProps.length).toBeGreaterThan(10);
            const flatCharts = mockChartProps
                .map(p => numbersIn(p.data))
                .filter(values => values.length > 0 && values.every(v => v === 0));
            expect(flatCharts).toEqual([]);

            const plotted = mockChartProps.flatMap(p => numbersIn(p.data));
            expect(plotted.length).toBeGreaterThan(0);
            expect(plotted.filter(v => v !== 0).length).toBeGreaterThan(plotted.length * 0.5);
        },
        300_000
    );
});
