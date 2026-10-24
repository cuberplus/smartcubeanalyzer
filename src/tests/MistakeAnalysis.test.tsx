/** @jest-environment jsdom */
import React from 'react';
import { describe, expect, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';
import { MistakeChart } from '../Components/MistakeChart';
import { MISTAKES, MistakeKind, markMistakes, summarizeMistakes } from '../Helpers/MistakeAnalysis';
import { analyzeMoveMistakes } from '../Helpers/MoveAnalysis';
import { CrossColor, MethodName, Solve, Step, StepName } from '../Helpers/Types';
import { FilterPanel } from '../Components/FilterPanel';
import { makeCfopSteps, makeSolve, makeSolves, makeStep } from './testUtils';

const classify = (steps: Step[]) => markMistakes([makeSolve({ steps })], 5)[0].mistakes?.map(m => m.kind);
const caseSolve = (name: StepName, moves = "R U R'", overrides: Partial<Solve> = {}) =>
    makeSolve({ steps: [makeStep(name, 3, { case: 'test case', moves })], ...overrides });

describe('specific mistake reasons', () => {
    test('retains reasons rather than only a boolean, and clears old reasons on recalculation', () => {
        const solve = makeSolve({ steps: [makeStep(StepName.Cross, 2, { turns: 9 })] });
        markMistakes([solve], 5);
        expect(solve.mistakes?.map(m => m.kind)).toEqual(['crossMoves']);
        expect(solve.isMistake).toBe(true);
        solve.steps[0].turns = 8;
        markMistakes([solve], 5);
        expect(solve.mistakes).toEqual([]);
        expect(solve.isMistake).toBe(false);
    });

    test('uses strict, explicit cross and per-pair move thresholds and deduplicates pair mistakes', () => {
        expect(classify([
            makeStep(StepName.Cross, 2, { turns: 8 }),
            makeStep(StepName.F2L_1, 3, { turns: 12 }),
        ])).toEqual([]);
        expect(classify([
            makeStep(StepName.Cross, 2, { turns: 9 }),
            makeStep(StepName.F2L_1, 3, { turns: 13 }),
            makeStep(StepName.F2L_2, 3, { turns: 14 }),
        ])).toEqual(['crossMoves', 'f2lMoves']);
        expect(classify(makeCfopSteps().map(s => ({ ...s, turns: Infinity })))).toEqual([]);
    });

    test.each([StepName.OLL, StepName.PLL])('learns extra %s moves per case, with tolerance and at least five observations', name => {
        const base = makeSolves(4).map((_, i) => caseSolve(name, "R U R'", { id: `base-${i}` }));
        const extra = caseSolve(name, "R U R' F U F' R U R'", { id: 'extra' });
        markMistakes([...base.slice(0, 3), extra], 5);
        expect(extra.mistakes?.map(m => m.kind)).not.toContain(name === StepName.OLL ? 'ollMoves' : 'pllMoves');
        markMistakes([...base, extra], 5);
        expect(extra.mistakes?.map(m => m.kind)).toContain(name === StepName.OLL ? 'ollMoves' : 'pllMoves');
        const atTolerance = caseSolve(name, "R U R' F R", { id: 'tolerance' });
        markMistakes([...base, atTolerance], 5);
        expect(atTolerance.mistakes?.map(m => m.kind)).not.toContain(name === StepName.OLL ? 'ollMoves' : 'pllMoves');
    });

    test('does not contaminate case baselines with missing moves, skips, or another method', () => {
        const base = makeSolves(4).map(() => caseSolve(StepName.OLL));
        const extra = caseSolve(StepName.OLL, "R U R' F U F' R U R'");
        const missing = makeSolves(10).map(() => caseSolve(StepName.OLL, ''));
        markMistakes([...base.slice(0, 3), ...missing, extra], 5);
        expect(extra.mistakes?.map(m => m.kind)).not.toContain('ollMoves');
        extra.method = MethodName.CFOP_2OLL;
        markMistakes([...base, extra], 5);
        expect(extra.mistakes?.map(m => m.kind)).not.toContain('ollMoves');
        extra.method = MethodName.CFOP;
        extra.steps[0].case = 'Solved';
        markMistakes([...base, extra], 5);
        expect(extra.mistakes?.map(m => m.kind)).not.toContain('ollMoves');
    });

    test('excludes AUF when comparing case move counts', () => {
        const base = makeSolves(4).map(() => caseSolve(StepName.PLL));
        const extraAuf = caseSolve(StepName.PLL, "U U U R U R' U U U");
        markMistakes([...base, extraAuf], 5);
        expect(extraAuf.mistakes?.map(m => m.kind)).not.toContain('pllMoves');
    });

    test.each([
        [StepName.F2L_1, 'f2lPause'], [StepName.F2L_4, 'f2lPause'],
        [StepName.OLL, 'ollRecognition'], [StepName.PLL, 'pllRecognition'],
    ])('labels long recognition for %s without confusing execution with recognition', (name, kind) => {
        expect(classify([makeStep(name as StepName, 10, { recognitionTime: 2 })])).not.toContain(kind);
        expect(classify([makeStep(name as StepName, 10, { recognitionTime: 2.01 })])).toContain(kind);
        expect(classify([makeStep(name as StepName, 1, { recognitionTime: 2.01 })])).not.toContain(kind);
    });

    test('detects inverse moves, treating rotations, invalid tokens and different faces as barriers', () => {
        expect(analyzeMoveMistakes(['U', "U'", 'R2', 'R2']).map(m => m.kind)).toEqual(['singleUndo', 'singleUndo']);
        expect(analyzeMoveMistakes(['U2', 'R2', 'x', "x'", 'R', "L'"])).toEqual([]);
        expect(analyzeMoveMistakes(['R', 'x', "R'"])).toEqual([]);
        expect(analyzeMoveMistakes(['R', '???', "R'"])).toEqual([]);
        expect(analyzeMoveMistakes(['Rw', "Rw'", 'M', "M'"]).map(m => m.kind)).toEqual(['singleUndo', 'singleUndo']);
    });

    test('distinguishes AUF/internal undos, attributes them to their step, and deduplicates each kind', () => {
        const solve = makeSolve({ steps: [
            makeStep(StepName.PLL, 3, { moves: "U U' R U R' U U'" }),
            makeStep(StepName.OLL, 3, { moves: "R U U' F" }),
            makeStep(StepName.F2L_1, 3, { moves: "U U'" }),
        ] });
        markMistakes([solve], 5);
        expect(solve.mistakes).toEqual([
            { kind: 'singleUndo', step: StepName.PLL, auf: true },
            { kind: 'singleUndo', step: StepName.OLL, auf: false },
            { kind: 'singleUndo', step: StepName.F2L_1, auf: false },
        ]);
        expect(classify([makeStep(StepName.PLL, 3, { moves: "U U'" })])).toEqual(['singleUndo']);
    });

    test('counts maximal inverse sequences as multi-move undos, without also tagging their nested single undo', () => {
        expect(analyzeMoveMistakes(['R', 'U', "U'", "R'"])).toEqual([{ kind: 'sequenceUndo', auf: false }]);
        expect(analyzeMoveMistakes(['R', 'U', 'F', "F'", "U'", "R'"])).toEqual([{ kind: 'sequenceUndo', auf: false }]);
        expect(analyzeMoveMistakes(['R', "R'", 'R', "R'"])).toEqual([
            { kind: 'singleUndo', auf: false }, { kind: 'singleUndo', auf: false },
        ]);
        expect(classify([makeStep(StepName.Cross, 3, { moves: "R U U' R' F F'" })])).toEqual(['sequenceUndo', 'singleUndo']);
        expect(classify([makeStep(StepName.PLL, 3, { moves: "U U U' U'" })])).toContain('sequenceUndo');
    });

    test.each(['U U2', 'U3', 'U4', "U3'", 'U8', 'U U U', 'U U', 'R R2', 'Rw3'])('flags redundant turning: %s', moves => {
        expect(classify([makeStep(StepName.PLL, 3, { moves })])).toContain('redundantTurns');
    });

    test('keeps a normal U2 clean and assigns redundant AUF turns to the correct stage', () => {
        expect(classify([makeStep(StepName.PLL, 3, { moves: 'U2' })])).toEqual([]);
        const solve = makeSolve({ steps: [makeStep(StepName.PLL, 3, { moves: "U4 R U R'" })] });
        markMistakes([solve], 5);
        expect(solve.mistakes).toContainEqual({ kind: 'redundantTurns', step: StepName.PLL, auf: true });
    });

    test('uses the legacy Acubemy AUF face, not an assumed U face', () => {
        const solve = makeSolve({
            source: 'acubemy', date: new Date('2025-01-01'), crossColor: CrossColor.Yellow,
            steps: [makeStep(StepName.PLL, 3, { moves: "D D' R U R'" })],
        });
        markMistakes([solve], 5);
        expect(solve.mistakes).toEqual([{ kind: 'singleUndo', step: StepName.PLL, auf: true }]);
        solve.date = new Date('2026-01-01');
        markMistakes([solve], 5);
        expect(solve.mistakes).toEqual([{ kind: 'singleUndo', step: StepName.PLL, auf: false }]);
    });

    test('counts only post-AUF over 0.5 seconds, independently of pre-AUF', () => {
        expect(classify([makeStep(StepName.PLL, 3, { preAufTime: 1 })])).toEqual([]);
        expect(classify([makeStep(StepName.PLL, 3, { preAufTime: 0.3, postAufTime: 0.21 })])).toEqual([]);
        expect(classify([makeStep(StepName.PLL, 3, { preAufTime: 1, postAufTime: 0.5 })])).toEqual([]);
        expect(classify([makeStep(StepName.PLL, 3, { postAufTime: 0.51 })])).toEqual(['slowAuf']);
        expect(classify([makeStep(StepName.PLL, 3, { preAufTime: NaN, postAufTime: 0.51 })])).toEqual(['slowAuf']);
        expect(MISTAKES.slowAuf.rule).toContain('Pre-AUF is excluded');
    });

    test('flags slow post-AUF only for plausible last-layer timings', () => {
        expect(classify([makeStep(StepName.OLL, 3, { postAufTime: 0.51 })])).toEqual(['slowAuf']);
        expect(classify([makeStep(StepName.Cross, 3, { postAufTime: 1 })])).toEqual([]);
        for (const postAufTime of [Infinity, NaN, -1]) {
            expect(classify([makeStep(StepName.PLL, 3, { postAufTime })])).toEqual([]);
        }
        expect(classify([makeStep(StepName.PLL, 3, { executionTime: 0.5, postAufTime: 0.51 })])).toEqual([]);
        expect(classify([makeStep(StepName.PLL, 0, { postAufTime: 1 })])).toEqual([]);
    });

    test('retains specific timing-outlier reasons, including steps missing from the first solve', () => {
        const data = [...makeSolves(20), makeSolve({
            id: 'slow', time: 500,
            steps: [makeStep(StepName.OLL, 300, { recognitionTime: 0 })],
        })];
        markMistakes(data, 5);
        expect(data[data.length - 1].mistakes?.map(m => m.kind)).toEqual(expect.arrayContaining(['slowSolve', 'slowStep']));
        const missing = [...makeSolves(20, { steps: [] }), makeSolve({ steps: [makeStep(StepName.OLL, 300)] })];
        markMistakes(missing, 5);
        expect(missing[missing.length - 1].mistakes?.map(m => m.kind)).toContain('slowStep');
    });

    test('no move or recognition data does not invent specific errors or a late-cross diagnosis', () => {
        const solve = makeSolve({ steps: makeCfopSteps().map(s => ({ ...s, turns: 0, time: 0, moves: '', recognitionTime: 0 })) });
        markMistakes([solve], 5);
        expect(solve.mistakes).toEqual([]);
        expect(solve.isMistake).toBe(false);
        expect(markMistakes([], 5)).toEqual([]);
    });

    test('keeps the cleanliness filter consistent with the detailed list', () => {
        const solve = makeSolve({ steps: [makeStep(StepName.Cross, 2, { turns: 9 })] });
        expect(markMistakes([solve], 5)[0].isMistake).toBe(true);
        expect(solve.mistakes?.map(m => m.kind)).toContain('crossMoves');
        expect(FilterPanel.compressSolves([solve], [StepName.Cross])[0].mistakes).toEqual(solve.mistakes);
    });
});

describe('recent mistake counts', () => {
    test('uses exactly the selected recent sliding window, and excludes corrupt solves', () => {
        const data = Array.from({ length: 12 }, (_, i) => makeSolve({
            id: String(i), date: new Date(2024, 0, 1, 0, 0, i),
            mistakes: i < 2 ? [{ kind: 'crossMoves' }] : [{ kind: 'singleUndo', step: StepName.PLL, auf: true }],
        }));
        const before = data.map(s => s.id);
        const summary = summarizeMistakes(data.slice().reverse(), 10);
        expect(summary.sampleCount).toBe(10);
        expect(summary.counts.find(r => r.kind === 'crossMoves')?.count).toBe(0);
        expect(summary.counts[0]).toEqual({ kind: 'singleUndo', step: StepName.PLL, auf: true, count: 10 });
        expect(data.map(s => s.id)).toEqual(before);
        const corrupt = makeSolve({ isCorrupt: true, date: new Date('2030-01-01'), mistakes: [{ kind: 'crossMoves' }] });
        expect(summarizeMistakes([...data, corrupt], 10)).toEqual(summary);
        expect(summarizeMistakes(data, 12).counts.find(r => r.kind === 'crossMoves')?.count).toBe(2);
        expect(summarizeMistakes(data, 0).sampleCount).toBe(0);
        expect(summarizeMistakes(data, Infinity).sampleCount).toBe(0);
        expect(summarizeMistakes(data, 100).sampleCount).toBe(12);
    });

    test('counts each type once per solve, allows overlapping types, and keeps zero-count categories', () => {
        const summary = summarizeMistakes([
            makeSolve({ mistakes: [{ kind: 'crossMoves' }, { kind: 'crossMoves' }, { kind: 'f2lMoves' }] }),
            makeSolve({ mistakes: [{ kind: 'f2lMoves' }] }),
            makeSolve(),
        ], 10);
        expect(summary.sampleCount).toBe(3);
        expect(summary.counts[0]).toEqual({ kind: 'f2lMoves', count: 2 });
        expect(summary.counts.find(r => r.kind === 'crossMoves')?.count).toBe(1);
        expect(summary.counts).toHaveLength(Object.keys(MISTAKES).length - 3);
        expect(summarizeMistakes([], 10).counts.every(row => row.count === 0)).toBe(true);
    });

    test('keeps single/multi undos in different steps and AUF contexts as separate chart rows', () => {
        const summary = summarizeMistakes([makeSolve({ mistakes: [
            { kind: 'singleUndo', step: StepName.Cross },
            { kind: 'singleUndo', step: StepName.F2L_1 },
            { kind: 'sequenceUndo', step: StepName.F2L_1 },
            { kind: 'singleUndo', step: StepName.PLL, auf: true },
            { kind: 'singleUndo', step: StepName.PLL, auf: false },
        ] })], 5);
        expect(summary.counts.filter(r => r.count === 1)).toHaveLength(5);
    });

    test('renders a ranked, accessible count chart with visible counts and documented rules', () => {
        render(<MistakeChart summary={summarizeMistakes([makeSolve({ mistakes: [{ kind: 'singleUndo', step: StepName.PLL, auf: true }] })], 5)} />);
        expect(screen.getByRole('region', { name: 'Mistakes' })).toBeTruthy();
        expect(screen.getByRole('heading', { name: 'Mistakes in the last 1 solve' })).toBeTruthy();
        expect(screen.getByRole('listitem', { name: 'PLL AUF: Single-move undo: 1 of 1 solves' })).toBeTruthy();
        expect(screen.getByText('1')).toBeTruthy();
        expect(screen.getByText('How mistakes are detected')).toBeTruthy();
        const label = screen.getByRole('button', { name: 'About PLL AUF: Single-move undo' });
        expect(label.textContent).toBe('PLL AUF: Single-move undo ⓘ');
        expect(label.classList.contains('text-decoration-none')).toBe(true);
    });

    test('uses capitalized mistake names and calls excess moves an inefficient solution', () => {
        for (const kind of ['crossMoves', 'f2lMoves', 'ollMoves', 'pllMoves'] as const) {
            expect(MISTAKES[kind].label).toMatch(/: Inefficient solution$/);
        }
        for (const { label } of Object.values(MISTAKES)) {
            expect(label).not.toMatch(/extra moves/i);
            expect(label.split(': ').pop()).toMatch(/^[A-Z]/);
        }
    });

    test('scales bars to the most frequent mistake while preserving solve counts', () => {
        render(<MistakeChart summary={{ windowSize: 1000, sampleCount: 10, counts: [
            { kind: 'crossMoves', count: 4 },
            { kind: 'f2lMoves', count: 2 },
            { kind: 'ollMoves', count: 0 },
        ] }} />);
        expect(screen.getAllByRole('progressbar', { hidden: true }).map(bar => bar.getAttribute('aria-valuenow')))
            .toEqual(['100', '50', '0']);
        for (const row of screen.getAllByRole('listitem')) {
            expect(row.innerHTML).toContain('--bs-progress-bar-bg: rgb(255, 99, 132)');
        }
        expect(screen.getByText('4')).toBeTruthy();
        expect(screen.getByText('2')).toBeTruthy();
        expect(screen.queryByText(/\d+ \/ \d+/)).toBeNull();
        expect(screen.queryByText(/Selected sliding window:/)).toBeNull();
    });

    test('keeps zero-count bars empty when no mistakes were detected', () => {
        render(<MistakeChart summary={summarizeMistakes([], 100)} />);
        expect(screen.getAllByRole('progressbar', { hidden: true }).every(bar => bar.getAttribute('aria-valuenow') === '0')).toBe(true);
    });

    test('starts compact and lets the user expand to full height and collapse again', () => {
        render(<MistakeChart summary={summarizeMistakes([], 100)} />);
        const content = screen.getByRole('group', { name: 'Mistakes details' });
        const expand = screen.getByRole('button', { name: 'Expand' });
        expect(expand.getAttribute('aria-expanded')).toBe('false');
        expect(expand.getAttribute('aria-controls')).toBe(content.id);
        expect(content.classList.contains('ratio-4x3')).toBe(true);
        fireEvent.click(expand);
        const collapse = screen.getByRole('button', { name: 'Collapse' });
        expect(collapse.getAttribute('aria-expanded')).toBe('true');
        expect(screen.getByRole('button', { name: 'About Cross: Inefficient solution' })).toBeTruthy();
        fireEvent.click(collapse);
        expect(screen.getByRole('button', { name: 'Expand' }).getAttribute('aria-expanded')).toBe('false');
    });

    test.each(Object.keys(MISTAKES) as MistakeKind[])('explains %s in a concise, keyboard-accessible tooltip', async kind => {
        render(<MistakeChart summary={{ windowSize: 5, sampleCount: 1, counts: [{ kind, count: 1 }] }} />);
        const button = screen.getByRole('button', { name: `About ${MISTAKES[kind].label}` });
        expect(screen.queryByRole('tooltip')).toBeNull();
        fireEvent.focus(button);
        const tooltip = await screen.findByRole('tooltip');
        expect(tooltip.textContent).toBe(MISTAKES[kind].rule);
        expect(tooltip.textContent!.split(/\s+/).length).toBeLessThanOrEqual(35);
        fireEvent.blur(button);
    });

    test('provides distinct tooltip targets for the same mistake in different steps', async () => {
        render(<MistakeChart summary={{ windowSize: 5, sampleCount: 1, counts: [
            { kind: 'singleUndo', step: StepName.Cross, count: 1 },
            { kind: 'singleUndo', step: StepName.PLL, auf: true, count: 1 },
        ] }} />);
        fireEvent.mouseOver(screen.getByText('PLL AUF: Single-move undo ⓘ'));
        expect((await screen.findByRole('tooltip')).id).toBe('mistake-singleUndo:PLL:auf');
    });
});
