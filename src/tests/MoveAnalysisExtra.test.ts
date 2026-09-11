import { describe, expect, test } from '@jest/globals';
import {
    analyzeStepMoves,
    computeAufInefficiency,
    computeCaseFailureStats,
    computeSolveEfficiency,
    coreMovesCount,
} from '../Helpers/MoveAnalysis';
import { aufMovesForFace } from '../Helpers/CsvParser';
import { CaseStats, StepName } from '../Helpers/Types';
import { makeSolve, makeStep } from './testUtils';

describe('analyzeStepMoves notation handling', () => {
    test('treats an empty move string as no moves', () => {
        expect(analyzeStepMoves('')).toEqual({
            originalTurns: 0, simplifiedTurns: 0, wastedMoves: 0, redundantPairs: [],
        });
    });

    test('understands the U3 / U3\' quarter-turn notation used by some exports', () => {
        // U3 is three quarter turns, so U U3 cancels completely.
        const result = analyzeStepMoves("U U3");
        expect(result.simplifiedTurns).toBe(0);
        expect(result.wastedMoves).toBe(2);
    });

    test("understands the 2' notation as a half turn", () => {
        const result = analyzeStepMoves("R2' R2");
        expect(result.simplifiedTurns).toBe(0);
    });

    test('ignores unrecognised tokens instead of throwing', () => {
        expect(analyzeStepMoves('R ??? U').originalTurns).toBe(2);
    });

    test('counts rotations as turns, unlike coreMovesCount', () => {
        expect(analyzeStepMoves("y R U").originalTurns).toBe(3);
    });

    test('cancels opposing rotations against each other', () => {
        expect(analyzeStepMoves("y y'").simplifiedTurns).toBe(0);
    });

    test('counts wide moves as a single turn', () => {
        expect(analyzeStepMoves("Rw U").originalTurns).toBe(2);
    });

    test('counts slice moves', () => {
        expect(analyzeStepMoves("M U M'").originalTurns).toBe(3);
    });

    test('merges same-face turns into a half turn and flags the saving', () => {
        const result = analyzeStepMoves('R R');
        expect(result.originalTurns).toBe(2);
        expect(result.simplifiedTurns).toBe(1);
        expect(result.wastedMoves).toBe(1);
        expect(result.redundantPairs).toHaveLength(1);
        expect(result.redundantPairs[0].moves).toBe('R R');
    });

    test('does not flag a merge that saves nothing', () => {
        // R2 then R is still one turn before and after on that face, no waste beyond the merge.
        const result = analyzeStepMoves('R2 R');
        expect(result.wastedMoves).toBe(1);
    });

    test('cancels a move against its inverse and records the pair indices', () => {
        const result = analyzeStepMoves("R U U' R'");
        expect(result.simplifiedTurns).toBe(0);
        expect(result.redundantPairs.map(p => [p.startIdx, p.endIdx])).toEqual([[1, 2], [0, 3]]);
    });

    test('reports no waste for an already optimal sequence', () => {
        const result = analyzeStepMoves("R U R' U'");
        expect(result.wastedMoves).toBe(0);
        expect(result.redundantPairs).toHaveLength(0);
    });
});

describe('coreMovesCount', () => {
    test('returns zero for an empty move string', () => {
        expect(coreMovesCount('')).toBe(0);
    });

    test('strips leading and trailing AUF moves', () => {
        expect(coreMovesCount("U R U R' U'")).toBe(3);
    });

    test('keeps AUF moves that occur inside the algorithm', () => {
        expect(coreMovesCount("R U R'")).toBe(3);
    });

    test('excludes rotations from the count', () => {
        expect(coreMovesCount("y R U R' y'")).toBe(3);
    });

    test('returns zero when every move is AUF or a rotation', () => {
        expect(coreMovesCount("U U' y")).toBe(0);
    });

    test('honors a remapped AUF face', () => {
        expect(coreMovesCount("D R F D'", aufMovesForFace('D'))).toBe(2);
    });
});

describe('computeAufInefficiency', () => {
    test('counts leading and trailing AUF moves separately', () => {
        const step = makeStep(StepName.PLL, 3, { moves: "U U R U R' U2" });
        const result = computeAufInefficiency(step);
        expect(result.preAufMoves).toBe(2);
        expect(result.postAufMoves).toBe(1);
    });

    test('sums the reported AUF time', () => {
        const step = makeStep(StepName.PLL, 3, { moves: "R U R'", preAufTime: 0.2, postAufTime: 0.15 });
        expect(computeAufInefficiency(step).totalAufTime).toBeCloseTo(0.35);
    });

    test('flags a solve as high cost when more than two AUF moves are used', () => {
        const step = makeStep(StepName.PLL, 3, { moves: "U U R U' U'" });
        expect(computeAufInefficiency(step).isHighCost).toBe(true);
    });

    test('flags a solve as high cost when AUF time exceeds half a second', () => {
        const step = makeStep(StepName.PLL, 3, { moves: "R U R'", preAufTime: 0.6 });
        expect(computeAufInefficiency(step).isHighCost).toBe(true);
    });

    test('is not high cost for a cheap single AUF', () => {
        const step = makeStep(StepName.PLL, 3, { moves: "U R U R'", preAufTime: 0.1 });
        expect(computeAufInefficiency(step).isHighCost).toBe(false);
    });
});

describe('computeCaseFailureStats expected move count', () => {
    function solveWith(id: string, moves: string, time: number, caseName = 'T') {
        return makeSolve({ id, steps: [makeStep(StepName.PLL, time, { case: caseName, moves, turns: 5 })] });
    }

    test('ignores solves with no case on the step', () => {
        const solves = [makeSolve({ steps: [makeStep(StepName.PLL, 2)] })];
        expect(computeCaseFailureStats(solves, StepName.PLL)).toEqual([]);
    });

    test('ignores solves that do not contain the step at all', () => {
        const solves = [makeSolve({ steps: [makeStep(StepName.Cross, 2)] })];
        expect(computeCaseFailureStats(solves, StepName.PLL)).toEqual([]);
    });

    test('excludes the Solved (skip) pseudo-case', () => {
        const solves = [solveWith('a', 'R U', 1, 'Solved'), solveWith('b', 'R U', 1)];
        const stats = computeCaseFailureStats(solves, StepName.PLL);
        expect(stats.map(s => s.caseName)).toEqual(['T']);
    });

    test('uses the median of two instances as the expected move count', () => {
        // Trailing U moves are AUF and excluded, so core counts are 1 and 4.
        const stats = computeCaseFailureStats(
            [solveWith('a', 'R U', 1), solveWith('b', 'R U F B', 1)],
            StepName.PLL
        );
        expect(stats[0].expectedMovesBase).toBe(2.5);
    });

    test('uses the most common move count when instances repeat', () => {
        const stats = computeCaseFailureStats(
            [
                solveWith('a', 'R U F', 1),
                solveWith('b', 'R U F', 1),
                solveWith('c', "R U F B L D R' U' F", 1),
            ],
            StepName.PLL
        );
        expect(stats[0].expectedMovesBase).toBe(3);
    });

    test('falls back to the median when every instance has a distinct move count', () => {
        const stats = computeCaseFailureStats(
            [
                solveWith('a', 'R F', 1),
                solveWith('b', 'R F B', 1),
                solveWith('c', 'R F B L', 1),
            ],
            StepName.PLL
        );
        expect(stats[0].expectedMovesBase).toBe(3);
    });

    test('allows a two move tolerance before calling a solve a failure', () => {
        const stats = computeCaseFailureStats([solveWith('a', 'R U F', 1)], StepName.PLL);
        expect(stats[0].expectedMoves).toBe(stats[0].expectedMovesBase + 2);
    });

    test('flags an instance as failed only when it is both long and slow', () => {
        const solves = [
            solveWith('a', 'R U F', 1),
            solveWith('b', 'R U F', 1),
            solveWith('slow-and-long', "R U F B L D R' U' F B L D", 10),
            solveWith('fast-but-long', "R U F B L D R' U' F B L D", 0.1),
        ];
        const stats = computeCaseFailureStats(solves, StepName.PLL);
        const failedIds = stats[0].instances.filter(i => i.failed).map(i => i.solveId);
        expect(failedIds).toEqual(['slow-and-long']);
        expect(stats[0].failureCount).toBe(1);
        expect(stats[0].failureRate).toBeCloseTo(25);
    });

    test('sorts cases by failure rate, worst first', () => {
        const solves = [
            solveWith('good1', 'R U F', 1, 'U'),
            solveWith('good2', 'R U F', 1, 'U'),
            solveWith('bad1', 'R U F', 1, 'T'),
            solveWith('bad2', "R U F B L D R' U' F B L D", 10, 'T'),
        ];
        const stats = computeCaseFailureStats(solves, StepName.PLL);
        expect(stats[0].caseName).toBe('T');
        expect(stats[0].failureRate).toBeGreaterThan(stats[1].failureRate);
    });

    test('reports the average core move count per case', () => {
        // 'R U' has one core move (trailing U is AUF), 'R U F B' has four.
        const stats = computeCaseFailureStats(
            [solveWith('a', 'R U', 1), solveWith('b', 'R U F B', 1)],
            StepName.PLL
        );
        expect(stats[0].avgMoves).toBe(2.5);
        expect(stats[0].totalCount).toBe(2);
    });
});

describe('computeSolveEfficiency', () => {
    test('reports full efficiency when a solve records no moves', () => {
        const solve = makeSolve({ steps: [makeStep(StepName.Cross, 2)] });
        expect(computeSolveEfficiency(solve).moveEfficiency).toBe(1);
    });

    test('reports full efficiency when nothing cancels', () => {
        const solve = makeSolve({ steps: [makeStep(StepName.Cross, 2, { moves: "R U F" })] });
        expect(computeSolveEfficiency(solve).moveEfficiency).toBe(1);
    });

    test('reports reduced efficiency when moves cancel', () => {
        const solve = makeSolve({ steps: [makeStep(StepName.Cross, 2, { moves: "R R' U F" })] });
        expect(computeSolveEfficiency(solve).moveEfficiency).toBeCloseTo(0.5);
    });

    test('aggregates efficiency across every step of the solve', () => {
        const solve = makeSolve({
            steps: [
                makeStep(StepName.Cross, 2, { moves: "R U" }),
                makeStep(StepName.OLL, 2, { moves: "F F'" }),
            ],
        });
        expect(computeSolveEfficiency(solve).moveEfficiency).toBeCloseTo(0.5);
    });

    test('reports no case failures when no stats are supplied', () => {
        const solve = makeSolve({
            steps: [makeStep(StepName.OLL, 2, { case: 'Sune', moves: 'R U' })],
        });
        const result = computeSolveEfficiency(solve);
        expect(result.hadOllFailure).toBe(false);
        expect(result.hadPllFailure).toBe(false);
    });

    test('reports an OLL failure when this solve is a flagged instance', () => {
        const solve = makeSolve({
            id: 'bad-solve',
            steps: [makeStep(StepName.OLL, 2, { case: 'Sune', moves: 'R U' })],
        });
        const stats = new Map<string, CaseStats>([[
            'Sune',
            { caseName: 'Sune', totalCount: 1, failureCount: 1, failureRate: 100, avgMoves: 9, expectedMovesBase: 7, expectedMoves: 9, instances: [{ solveId: 'bad-solve', turns: 9, failed: true }] },
        ]]);
        expect(computeSolveEfficiency(solve, stats).hadOllFailure).toBe(true);
    });

    test('reports a PLL failure when this solve is a flagged instance', () => {
        const solve = makeSolve({
            id: 'bad-solve',
            steps: [makeStep(StepName.PLL, 2, { case: 'T', moves: 'R U' })],
        });
        const stats = new Map<string, CaseStats>([[
            'T',
            { caseName: 'T', totalCount: 1, failureCount: 1, failureRate: 100, avgMoves: 20, expectedMovesBase: 14, expectedMoves: 16, instances: [{ solveId: 'bad-solve', turns: 20, failed: true }] },
        ]]);
        expect(computeSolveEfficiency(solve, undefined, stats).hadPllFailure).toBe(true);
    });

    test('reports no failure when the solve is not among the case instances', () => {
        const solve = makeSolve({
            id: 'other-solve',
            steps: [makeStep(StepName.OLL, 2, { case: 'Sune', moves: 'R U' })],
        });
        const stats = new Map<string, CaseStats>([[
            'Sune',
            { caseName: 'Sune', totalCount: 1, failureCount: 1, failureRate: 100, avgMoves: 9, expectedMovesBase: 7, expectedMoves: 9, instances: [{ solveId: 'bad-solve', turns: 9, failed: true }] },
        ]]);
        expect(computeSolveEfficiency(solve, stats).hadOllFailure).toBe(false);
    });

    test('reports no failure when the case is absent from the stats map', () => {
        const solve = makeSolve({
            steps: [makeStep(StepName.OLL, 2, { case: 'Unseen', moves: 'R U' })],
        });
        expect(computeSolveEfficiency(solve, new Map()).hadOllFailure).toBe(false);
    });
});
