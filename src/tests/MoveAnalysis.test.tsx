import { describe, expect, test } from '@jest/globals';
import { analyzeStepMoves, computeCaseFailureStats, computeAufInefficiency, computeSolveEfficiency } from '../Helpers/MoveAnalysis';
import { GetEmptySolve, GetEmptyStep } from '../Helpers/CubeHelpers';
import { CaseStats, StepName } from '../Helpers/Types';

describe('analyzeStepMoves', () => {
    test('empty string returns zeroes', () => {
        const result = analyzeStepMoves("");
        expect(result).toEqual({ originalTurns: 0, simplifiedTurns: 0, wastedMoves: 0, redundantPairs: [] });
    });

    test('U followed by U\' cancels completely', () => {
        const result = analyzeStepMoves("U U'");
        expect(result.wastedMoves).toBe(2);
        expect(result.simplifiedTurns).toBe(0);
        expect(result.redundantPairs).toHaveLength(1);
        expect(result.redundantPairs[0].moves).toBe("U U'");
    });

    test('U U merges to U2 (no waste in slice-turn metric)', () => {
        const result = analyzeStepMoves("U U");
        expect(result.originalTurns).toBe(2);
        expect(result.simplifiedTurns).toBe(1);
        expect(result.wastedMoves).toBe(1);
    });

    test('U U U merges to U\' (single turn)', () => {
        const result = analyzeStepMoves("U U U");
        expect(result.originalTurns).toBe(3);
        expect(result.simplifiedTurns).toBe(1);
        expect(result.wastedMoves).toBe(2);
    });

    test('U U U U cancels to identity', () => {
        const result = analyzeStepMoves("U U U U");
        expect(result.simplifiedTurns).toBe(0);
        expect(result.wastedMoves).toBe(4);
    });

    test('U2 followed by U2 cancels', () => {
        const result = analyzeStepMoves("U2 U2");
        expect(result.simplifiedTurns).toBe(0);
        expect(result.wastedMoves).toBe(2);
    });

    test('R U R\' has no cancellation', () => {
        const result = analyzeStepMoves("R U R'");
        expect(result.wastedMoves).toBe(0);
        expect(result.simplifiedTurns).toBe(3);
        expect(result.redundantPairs).toHaveLength(0);
    });

    test('R R\' U cancels R R\' but leaves U', () => {
        const result = analyzeStepMoves("R R' U");
        expect(result.simplifiedTurns).toBe(1);
        expect(result.wastedMoves).toBe(2);
        expect(result.redundantPairs).toHaveLength(1);
    });

    test('does not cancel across different faces', () => {
        const result = analyzeStepMoves("R U R U");
        expect(result.wastedMoves).toBe(0);
        expect(result.simplifiedTurns).toBe(4);
    });

    test('handles U3 as equivalent to U\'', () => {
        const result = analyzeStepMoves("U U3");
        expect(result.simplifiedTurns).toBe(0);
        expect(result.wastedMoves).toBe(2);
    });

    test('complex real algorithm has no waste', () => {
        const result = analyzeStepMoves("R U R' U' R' F R F'");
        expect(result.wastedMoves).toBe(0);
    });

    test('algorithm with redundancy at end', () => {
        const result = analyzeStepMoves("R U R' F F'");
        expect(result.wastedMoves).toBe(2);
        expect(result.simplifiedTurns).toBe(3);
    });
});

describe('computeAufInefficiency', () => {
    test('step with no moves returns zeroes', () => {
        const step = { ...GetEmptyStep(), moves: "" };
        const result = computeAufInefficiency(step);
        expect(result.preAufMoves).toBe(0);
        expect(result.postAufMoves).toBe(0);
        expect(result.isHighCost).toBe(false);
    });

    test('step with leading and trailing AUF', () => {
        const step = { ...GetEmptyStep(), moves: "U R U R' U'", preAufTime: 0.1, postAufTime: 0.1 };
        const result = computeAufInefficiency(step);
        expect(result.preAufMoves).toBe(1);
        expect(result.postAufMoves).toBe(1);
        expect(result.isHighCost).toBe(false);
    });

    test('step with high AUF time is flagged', () => {
        const step = { ...GetEmptyStep(), moves: "U R U R' U'", preAufTime: 0.3, postAufTime: 0.3 };
        const result = computeAufInefficiency(step);
        expect(result.totalAufTime).toBeCloseTo(0.6);
        expect(result.isHighCost).toBe(true);
    });

    test('step with many AUF moves is flagged', () => {
        const step = { ...GetEmptyStep(), moves: "U U2 R U R' U'", preAufTime: 0.1, postAufTime: 0.1 };
        const result = computeAufInefficiency(step);
        expect(result.preAufMoves).toBe(2);
        expect(result.postAufMoves).toBe(1);
        expect(result.isHighCost).toBe(true);
    });
});

describe('computeCaseFailureStats', () => {
    function makeSolveWithPll(id: string, caseName: string, moves: string, turns: number, stepTime: number = 1) {
        const solve = GetEmptySolve();
        solve.id = id;
        solve.steps[6] = { ...GetEmptyStep(), name: StepName.PLL, case: caseName, moves, turns, time: stepTime };
        return solve;
    }

    test('groups by case and computes stats', () => {
        const normalAlg = "U R U' R' U' F R2 U' R' U' R U R' F' U'";
        const failedAlg = "U R U' R' U' F R2 U' R' U' R U R' F' U2 R U' R' U' F R2 U' R' U' R U R' F' U'";
        const solves = [
            makeSolveWithPll("1", "T", normalAlg, 14),
            makeSolveWithPll("2", "T", normalAlg, 14),
            makeSolveWithPll("3", "T", normalAlg, 14),
            makeSolveWithPll("4", "T", normalAlg, 14),
            makeSolveWithPll("5", "T", normalAlg, 14),
            makeSolveWithPll("6", "T", normalAlg, 14),
            makeSolveWithPll("7", "T", normalAlg, 14),
            makeSolveWithPll("8", "T", normalAlg, 14),
            makeSolveWithPll("9", "T", normalAlg, 14),
            makeSolveWithPll("10", "T", normalAlg, 14),
            makeSolveWithPll("11", "T", failedAlg, 28, 2),
        ];

        const stats = computeCaseFailureStats(solves, 6);
        const tCase = stats.find(s => s.caseName === "T");
        expect(tCase).toBeDefined();
        expect(tCase!.totalCount).toBe(11);
        expect(tCase!.failureCount).toBeGreaterThanOrEqual(1);
        expect(tCase!.failureRate).toBeGreaterThan(0);
    });

    test('skips Solved cases', () => {
        const solves = [
            makeSolveWithPll("1", "Solved", "U'", 1),
            makeSolveWithPll("2", "T", "R U R'", 3),
        ];

        const stats = computeCaseFailureStats(solves, 6);
        expect(stats.find(s => s.caseName === "Solved")).toBeUndefined();
        expect(stats.find(s => s.caseName === "T")).toBeDefined();
    });

    test('returns empty for no solves', () => {
        const stats = computeCaseFailureStats([], 6);
        expect(stats).toEqual([]);
    });

    test('expectedMovesBase is raw mode/median, expectedMoves is base plus tolerance', () => {
        // All T cases have 14 core moves → mode 14, so expectedMovesBase 14, expectedMoves 16
        const alg = "R U R' U' R' F R2 U' R' U' R U R' F'";
        const solves = [
            makeSolveWithPll("1", "T", alg, 14, 1),
            makeSolveWithPll("2", "T", alg, 14, 1),
            makeSolveWithPll("3", "T", alg, 14, 1),
        ];
        const stats = computeCaseFailureStats(solves, 6);
        const tCase = stats.find(s => s.caseName === "T");
        expect(tCase).toBeDefined();
        expect(tCase!.expectedMovesBase).toBe(14);
        expect(tCase!.expectedMoves).toBe(16);
    });
});

describe('computeSolveEfficiency', () => {
    test('solve with no moves has efficiency 1', () => {
        const solve = GetEmptySolve();
        const result = computeSolveEfficiency(solve);
        expect(result.moveEfficiency).toBe(1);
        expect(result.hadOllFailure).toBe(false);
        expect(result.hadPllFailure).toBe(false);
    });

    test('solve with redundant moves has efficiency < 1', () => {
        const solve = GetEmptySolve();
        solve.steps[0] = { ...GetEmptyStep(), moves: "R R' U R U'" };
        const result = computeSolveEfficiency(solve);
        expect(result.moveEfficiency).toBeLessThan(1);
    });

    test('solve with clean moves has efficiency 1', () => {
        const solve = GetEmptySolve();
        solve.steps[0] = { ...GetEmptyStep(), moves: "R U R' U'" };
        const result = computeSolveEfficiency(solve);
        expect(result.moveEfficiency).toBe(1);
    });

    test('hadOllFailure is true when OLL case stats have instance.failed true for this solve', () => {
        const solve = GetEmptySolve();
        solve.id = 'solve-1';
        solve.steps[5] = { ...GetEmptyStep(), name: StepName.OLL, case: 'T', moves: 'R U R\' U\'', turns: 4, time: 1 };
        const ollStats: CaseStats = {
            caseName: 'T',
            totalCount: 1,
            failureCount: 1,
            failureRate: 100,
            avgMoves: 4,
            expectedMovesBase: 8,
            expectedMoves: 10,
            instances: [{ solveId: 'solve-1', turns: 4, failed: true }]
        };
        const ollMap = new Map<string, CaseStats>([['T', ollStats]]);
        const result = computeSolveEfficiency(solve, ollMap, undefined);
        expect(result.hadOllFailure).toBe(true);
        expect(result.hadPllFailure).toBe(false);
    });

    test('hadPllFailure is true when PLL case stats have instance.failed true for this solve', () => {
        const solve = GetEmptySolve();
        solve.id = 'solve-2';
        solve.steps[6] = { ...GetEmptyStep(), name: StepName.PLL, case: 'Ua', moves: 'R U\' R U R U R U\' R\'', turns: 9, time: 1 };
        const pllStats: CaseStats = {
            caseName: 'Ua',
            totalCount: 1,
            failureCount: 1,
            failureRate: 100,
            avgMoves: 9,
            expectedMovesBase: 10,
            expectedMoves: 12,
            instances: [{ solveId: 'solve-2', turns: 9, failed: true }]
        };
        const pllMap = new Map<string, CaseStats>([['Ua', pllStats]]);
        const result = computeSolveEfficiency(solve, undefined, pllMap);
        expect(result.hadOllFailure).toBe(false);
        expect(result.hadPllFailure).toBe(true);
    });

    test('hadOllFailure is false when instance has failed false', () => {
        const solve = GetEmptySolve();
        solve.id = 'solve-3';
        solve.steps[5] = { ...GetEmptyStep(), name: StepName.OLL, case: 'T', moves: 'R U R\' U\'', turns: 4, time: 0.5 };
        const ollStats: CaseStats = {
            caseName: 'T',
            totalCount: 1,
            failureCount: 0,
            failureRate: 0,
            avgMoves: 4,
            expectedMovesBase: 8,
            expectedMoves: 10,
            instances: [{ solveId: 'solve-3', turns: 4, failed: false }]
        };
        const ollMap = new Map<string, CaseStats>([['T', ollStats]]);
        const result = computeSolveEfficiency(solve, ollMap, undefined);
        expect(result.hadOllFailure).toBe(false);
    });
});
