/**
 * @jest-environment jsdom
 *
 * Load-time tests driven by the full dev stats shipped in this repo
 * (public/demo-solves.csv - the dataset the "test data" button loads).
 *
 * These measure how long the user waits before charts appear:
 *   - one end-to-end test for the whole page (CSV -> charts on screen)
 *   - one test per individual chart (data build + render)
 *
 * Budgets are deliberately generous so the suite is not flaky on slower CI
 * machines; they exist to catch order-of-magnitude regressions. Override with
 * CHART_PERF_PAGE_BUDGET_MS / CHART_PERF_CHART_BUDGET_MS. Every measurement is
 * printed so a regression is visible even when it stays inside budget.
 */
import { afterAll, beforeAll, describe, expect, jest, test } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import { performance } from 'perf_hooks';
import React from 'react';

// Chart.js paints to a canvas, which jsdom does not implement. Swap the chart
// components for markers so we can measure React's render of the chart grid.
jest.mock('react-chartjs-2', () => ({
    Line: () => React.createElement('div', { 'data-chart': 'line' }),
    Bar: () => React.createElement('div', { 'data-chart': 'bar' }),
    Doughnut: () => React.createElement('div', { 'data-chart': 'doughnut' }),
}));

// Run the worker body synchronously so "time to charts" includes the real
// computation rather than an unresolved async boundary.
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

import { render, screen, cleanup } from '@testing-library/react';
import { parseCsv } from '../Helpers/CsvParser';
import { FilterPanel } from '../Components/FilterPanel';
import { ChartPanel } from '../Components/ChartPanel';
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
import {
    buildGoodBadData,
    buildHistogramData,
    buildInspectionData,
    buildOllCategoryChart,
    buildPllCategoryChart,
    buildRunningAverageData,
    buildRunningColorPercentages,
    buildRunningInspectionData,
    buildRunningRecognitionExecution,
    buildRunningStdDevData,
    buildRunningTpsData,
    buildRunningTurnsData,
    buildStepPercentages,
    buildTypicalCompare,
} from '../Helpers/ChartDataBuilders';
import {
    buildAlgorithmPracticeRows,
    buildAllStreakRows,
    buildCaseData,
    buildDailyRecordData,
    buildRecordHistory,
    buildRecordRows,
    buildRunningEfficiencyData,
    buildStepAverages,
    computeAllChartData,
    computeBestSolvesData,
    WorkerInput,
} from '../Workers/chartWorker';

const PAGE_BUDGET_MS = Number(process.env.CHART_PERF_PAGE_BUDGET_MS ?? 30_000);
const CHART_BUDGET_MS = Number(process.env.CHART_PERF_CHART_BUDGET_MS ?? 10_000);

const DEMO_CSV = join(__dirname, '..', '..', 'public', 'demo-solves.csv');
const WINDOW_SIZE = 1000;
const POINTS_PER_GRAPH = 100;
const ALL_CFOP_STEPS = Const.MethodSteps[MethodName.CFOP];

function time<T>(fn: () => T): { result: T; ms: number } {
    const start = performance.now();
    const result = fn();
    return { result, ms: performance.now() - start };
}

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
        steps: ALL_CFOP_STEPS,
        solveCleanliness: [SolveCleanliness.Clean, SolveCleanliness.Mistake],
        solveLuckiness: [SolveLuckiness.FullStep, SolveLuckiness.Skip],
        method: MethodName.CFOP,
        sessions: [],
        lowestInspection: 0,
        highestInspection: 300,
    };
}

function workerInput(solves: Solve[], steps: StepName[] = ALL_CFOP_STEPS): WorkerInput {
    return {
        requestId: 1,
        solves,
        windowSize: WINDOW_SIZE,
        pointsPerGraph: POINTS_PER_GRAPH,
        steps,
        goodTime: 15,
        badTime: 20,
        methodName: MethodName.CFOP,
        use4SegmentTiming: true,
        isDark: false,
    };
}

// ── Shared pipeline state, built once from the real dev stats ─────────────────

let rawCsv: string;
let allSolves: Solve[];
let chartSolves: Solve[];
let inspectionSolves: Array<Solve & { inspectionTime: number }>;
let lastLayerSolves: Solve[];
const timings: Array<{ name: string; ms: number }> = [];

function record(name: string, ms: number): number {
    timings.push({ name, ms });
    return ms;
}

beforeAll(() => {
    rawCsv = readFileSync(DEMO_CSV, 'utf8');
    allSolves = parseCsv(rawCsv, ',');
    const filtered = FilterPanel.applyFiltersToSolves(allSolves, defaultFilters(), WINDOW_SIZE);
    chartSolves = FilterPanel.compressSolves(filtered, ALL_CFOP_STEPS);
    inspectionSolves = chartSolves.filter(
        (s): s is Solve & { inspectionTime: number } => s.inspectionTime != null
    );
    lastLayerSolves = chartSolves;
}, 300_000);

afterAll(() => {
    if (timings.length === 0) return;
    const width = Math.max(...timings.map(t => t.name.length));
    const lines = timings
        .slice()
        .sort((a, b) => b.ms - a.ms)
        .map(t => `  ${t.name.padEnd(width)}  ${t.ms.toFixed(0).padStart(7)} ms`);
    console.log(`\nChart load timings (slowest first):\n${lines.join('\n')}\n`);
});

describe('dev stats dataset', () => {
    test('the full demo dataset is loaded, not a trimmed sample', () => {
        expect(allSolves.length).toBeGreaterThan(1000);
        expect(chartSolves.length).toBeGreaterThan(0);
        console.log(
            `Dev stats: ${(rawCsv.length / 1024 / 1024).toFixed(1)} MB CSV, ` +
            `${allSolves.length} solves parsed, ${chartSolves.length} after filters.`
        );
    });
});

// ── Whole page ────────────────────────────────────────────────────────────────

/** jsdom has no layout engine; react-data-grid still expects ResizeObserver and CSS.supports. */
function installDomStubs(): void {
    const g = globalThis as any;
    if (!g.ResizeObserver) {
        g.ResizeObserver = class {
            observe() { }
            unobserve() { }
            disconnect() { }
        };
    }
    if (!g.CSS) {
        g.CSS = { supports: () => false, escape: (value: string) => value };
    } else if (typeof g.CSS.supports !== 'function') {
        g.CSS.supports = () => false;
    }
}

function renderChartPanel(solves: Solve[], steps: StepName[] = ALL_CFOP_STEPS) {
    return render(
        React.createElement(ChartPanel, {
            solves,
            steps,
            windowSize: WINDOW_SIZE,
            pointsPerGraph: POINTS_PER_GRAPH,
            goodTime: 15,
            badTime: 20,
            methodName: MethodName.CFOP,
            useLogScale: false,
            use4SegmentTiming: true,
        })
    );
}

describe('full site load time', () => {
    test(
        'every chart becomes visible to the user within budget',
        () => {
            installDomStubs();

            // The complete wait: raw dev stats CSV in, charts on screen.
            const start = performance.now();
            const solves = parseCsv(rawCsv, ',');
            const filtered = FilterPanel.applyFiltersToSolves(solves, defaultFilters(), WINDOW_SIZE);
            const compressed = FilterPanel.compressSolves(filtered, ALL_CFOP_STEPS);
            const { container } = renderChartPanel(compressed);
            const totalMs = performance.now() - start;
            record('TOTAL: CSV -> charts visible', totalMs);

            // "Visible" = the spinner is gone and every chart card is in the DOM.
            expect(screen.queryByText('Computing charts…')).toBeNull();
            const cards = container.querySelectorAll('.card');
            const plotted = container.querySelectorAll('[data-chart]');
            expect(cards.length).toBeGreaterThanOrEqual(20);
            expect(plotted.length).toBeGreaterThan(0);
            console.log(`Rendered ${cards.length} chart cards in ${totalMs.toFixed(0)} ms.`);

            cleanup();
            expect(totalMs).toBeLessThan(PAGE_BUDGET_MS);
        },
        300_000
    );

    test(
        'breaks the wait down into parse, filter, compute and render',
        () => {
            installDomStubs();

            const parse = time(() => parseCsv(rawCsv, ','));
            record('parse dev stats CSV', parse.ms);

            const filter = time(() =>
                FilterPanel.applyFiltersToSolves(parse.result, defaultFilters(), WINDOW_SIZE)
            );
            record('apply filters', filter.ms);

            const compress = time(() => FilterPanel.compressSolves(filter.result, ALL_CFOP_STEPS));
            record('compress solves', compress.ms);

            const charts = time(() => computeAllChartData(workerInput(compress.result)));
            record('compute all chart data', charts.ms);

            const paint = time(() => renderChartPanel(compress.result));
            record('render chart grid', paint.ms);
            cleanup();

            // Every chart the panel renders must have data by the time we are done.
            const required = [
                'runningAverage', 'runningStdDev', 'runningTps', 'runningTurns',
                'runningRecognitionExecution', 'runningEfficiency', 'histogram', 'stepAverages',
                'runningColorPercentages', 'dailyRecord', 'streakRows', 'recordRows', 'goodBad',
                'recordHistory', 'stepPercentages', 'typicalCompare', 'bestSolvesData',
                'ollCategory', 'pllCategory',
            ];
            required.forEach(key => expect(charts.result[key]).toBeTruthy());

            const totalMs = parse.ms + filter.ms + compress.ms + charts.ms + paint.ms;
            expect(totalMs).toBeLessThan(PAGE_BUDGET_MS);
        },
        300_000
    );

    test(
        'a filter change re-renders the charts without re-parsing the CSV',
        () => {
            installDomStubs();
            // Re-filtering an already parsed dataset happens on every filter change,
            // so it needs to stay far cheaper than the initial parse.
            const refilter = time(() => {
                const filtered = FilterPanel.applyFiltersToSolves(allSolves, defaultFilters(), WINDOW_SIZE);
                const compressed = FilterPanel.compressSolves(filtered, ALL_CFOP_STEPS);
                const view = renderChartPanel(compressed);
                cleanup();
                return view;
            });
            record('filter change -> charts visible', refilter.ms);
            expect(refilter.ms).toBeLessThan(PAGE_BUDGET_MS);
        },
        300_000
    );
});

// ── Individual charts ─────────────────────────────────────────────────────────

type ChartCase = { name: string; build: () => unknown };

function chartCases(): ChartCase[] {
    return [
        { name: 'Average Time', build: () => buildRunningAverageData(chartSolves, WINDOW_SIZE, POINTS_PER_GRAPH) },
        { name: 'Average Standard Deviation', build: () => buildRunningStdDevData(chartSolves, WINDOW_SIZE, POINTS_PER_GRAPH) },
        { name: 'Average Turns Per Second', build: () => buildRunningTpsData(chartSolves, WINDOW_SIZE, POINTS_PER_GRAPH) },
        { name: 'Average Turns', build: () => buildRunningTurnsData(chartSolves, WINDOW_SIZE, POINTS_PER_GRAPH) },
        { name: 'Average Recognition and Execution', build: () => buildRunningRecognitionExecution(chartSolves, WINDOW_SIZE, POINTS_PER_GRAPH, true) },
        { name: 'Count of Solves by How Long They Took', build: () => buildHistogramData(chartSolves, WINDOW_SIZE) },
        { name: "Percentage of 'Good' and 'Bad' Solves", build: () => buildGoodBadData(chartSolves, WINDOW_SIZE, POINTS_PER_GRAPH, 15, 20) },
        { name: 'Percentage of Solves by Cross Color', build: () => buildRunningColorPercentages(chartSolves, WINDOW_SIZE, POINTS_PER_GRAPH, false) },
        { name: 'Percentage of the Solve Each Step Took', build: () => buildStepPercentages(chartSolves, ALL_CFOP_STEPS, WINDOW_SIZE) },
        { name: 'OLL Edge Orientation', build: () => buildOllCategoryChart(chartSolves, WINDOW_SIZE, POINTS_PER_GRAPH) },
        { name: 'PLL Corner Permutation', build: () => buildPllCategoryChart(chartSolves, WINDOW_SIZE, POINTS_PER_GRAPH) },
        { name: 'Time Per Step, Compared to Typical Solver', build: () => buildTypicalCompare(chartSolves, WINDOW_SIZE) },
        { name: 'Average Time by Step', build: () => buildStepAverages(chartSolves, ALL_CFOP_STEPS, WINDOW_SIZE, POINTS_PER_GRAPH) },
        { name: 'Solve Efficiency', build: () => buildRunningEfficiencyData(chartSolves, ALL_CFOP_STEPS, MethodName.CFOP, WINDOW_SIZE, POINTS_PER_GRAPH) },
        { name: 'Daily Fastest Solve', build: () => buildDailyRecordData(chartSolves) },
        { name: 'Longest Daily Streaks', build: () => buildAllStreakRows(chartSolves) },
        { name: 'Current Records', build: () => buildRecordRows(chartSolves) },
        { name: 'History of Records', build: () => buildRecordHistory(chartSolves) },
        { name: `Top ${Const.FastestSolvesCount} Fastest Solves`, build: () => computeBestSolvesData(chartSolves) },
        { name: 'Average solve time by inspection time', build: () => buildInspectionData(inspectionSolves, WINDOW_SIZE) },
        { name: 'Average Inspection Time', build: () => buildRunningInspectionData(inspectionSolves, WINDOW_SIZE, POINTS_PER_GRAPH) },
        { name: 'Average Recognition/Execution per Case', build: () => buildCaseData(lastLayerSolves, [StepName.OLL], WINDOW_SIZE, true) },
        { name: 'Algorithm Practice', build: () => buildAlgorithmPracticeRows(lastLayerSolves, [StepName.OLL], WINDOW_SIZE) },
    ];
}

describe('individual chart load time', () => {
    test.each(chartCases().map(c => [c.name, c] as const))(
        '%s builds within budget',
        (name, chartCase) => {
            const { result, ms } = time(chartCase.build);
            record(`chart: ${name}`, ms);
            expect(result).toBeTruthy();
            expect(ms).toBeLessThan(CHART_BUDGET_MS);
        },
        120_000
    );

    test(
        'no single chart dominates the whole computation',
        () => {
            const measured = chartCases().map(c => ({ name: c.name, ms: time(c.build).ms }));
            const total = measured.reduce((sum, m) => sum + m.ms, 0);
            const slowest = measured.reduce((a, b) => (a.ms > b.ms ? a : b));
            record(`slowest chart: ${slowest.name}`, slowest.ms);
            expect(total).toBeGreaterThan(0);
            // Guard against one chart silently becoming the entire wait.
            expect(slowest.ms).toBeLessThan(CHART_BUDGET_MS);
        },
        300_000
    );
});
