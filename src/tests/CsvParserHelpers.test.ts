import { describe, expect, test } from '@jest/globals';
import {
    AUF_MOVES,
    ROTATIONS,
    aufMovesForFace,
    computeStepSegments,
    countMovesExcludingRotations,
    effectiveCrossExecutionSec,
    getAufMovesForSolve,
    parseRecordedMoves,
    stripRotationsFromMoveString,
    tokenizeMoves,
} from '../Helpers/CsvParser';
import { CrossColor, StepName } from '../Helpers/Types';

const BEFORE_CUTOFF = new Date('2025-10-01T00:00:00.000Z');
const AFTER_CUTOFF = new Date('2025-11-01T00:00:00.000Z');

function acubemySolve(crossColor: CrossColor, date = BEFORE_CUTOFF) {
    return { source: 'acubemy' as const, date, crossColor };
}

describe('aufMovesForFace', () => {
    test('includes every notation variant of the face', () => {
        expect(Array.from(aufMovesForFace('R')).sort())
            .toEqual(["R", "R'", "R2", "R2'", "R3", "R3'"].sort());
    });

    test('produces disjoint sets for different faces', () => {
        const u = aufMovesForFace('U');
        const d = aufMovesForFace('D');
        expect(Array.from(u).some(m => d.has(m))).toBe(false);
    });
});

describe('getAufMovesForSolve', () => {
    test('uses standard U-face AUF for Cubeast solves', () => {
        expect(getAufMovesForSolve({ source: 'cubeast', date: BEFORE_CUTOFF, crossColor: CrossColor.White }))
            .toBe(AUF_MOVES);
    });

    test('uses standard U-face AUF for Acubemy solves on or after the remap cutoff', () => {
        expect(getAufMovesForSolve(acubemySolve(CrossColor.Orange, AFTER_CUTOFF))).toBe(AUF_MOVES);
    });

    test('uses standard U-face AUF when the solve date is invalid', () => {
        expect(getAufMovesForSolve(acubemySolve(CrossColor.Orange, new Date('nonsense')))).toBe(AUF_MOVES);
    });

    test.each([
        [CrossColor.White, 'U'],   // cross on D → AUF on U
        [CrossColor.Yellow, 'D'],  // cross on U → AUF on D
        [CrossColor.Orange, 'R'],  // cross on L → AUF on R
        [CrossColor.Red, 'L'],     // cross on R → AUF on L
        [CrossColor.Green, 'B'],   // cross on F → AUF on B
        [CrossColor.Blue, 'F'],    // cross on B → AUF on F
    ])('remaps %s cross to %s-face AUF for legacy Acubemy solves', (color, face) => {
        const moves = getAufMovesForSolve(acubemySolve(color as CrossColor));
        expect(moves.has(face)).toBe(true);
        expect(moves.has(`${face}'`)).toBe(true);
        expect(moves.size).toBe(6);
    });

    test('falls back to U-face AUF when the cross color is unknown', () => {
        const moves = getAufMovesForSolve(acubemySolve(CrossColor.Unknown));
        expect(moves.has('U')).toBe(true);
    });
});

describe('parseRecordedMoves', () => {
    test('returns an empty list for empty or whitespace input', () => {
        expect(parseRecordedMoves('')).toEqual([]);
        expect(parseRecordedMoves('   ')).toEqual([]);
        expect(parseRecordedMoves(undefined!)).toEqual([]);
    });

    test('parses each move and its timestamp', () => {
        expect(parseRecordedMoves('U[100] R[250]')).toEqual([
            { move: 'U', timestamp: 100 },
            { move: 'R', timestamp: 250 },
        ]);
    });

    test('skips tokens with no timestamp', () => {
        expect(parseRecordedMoves('U R[250]')).toEqual([{ move: 'R', timestamp: 250 }]);
    });

    test('filters out rotations', () => {
        expect(parseRecordedMoves("y[10] R[20] x'[30]")).toEqual([{ move: 'R', timestamp: 20 }]);
    });

    test('handles multiple spaces between tokens', () => {
        expect(parseRecordedMoves('U[1]    R[2]')).toHaveLength(2);
    });
});

describe('computeStepSegments', () => {
    const moves = (pairs: Array<[string, number]>) => pairs.map(([move, timestamp]) => ({ move, timestamp }));

    test('returns all zeroes when there are no moves', () => {
        expect(computeStepSegments([], 0, StepName.OLL))
            .toEqual({ recognition: 0, preAuf: 0, coreExecution: 0, postAuf: 0 });
    });

    test('treats the whole cross as execution with no recognition', () => {
        const result = computeStepSegments(moves([['R', 0], ['U', 500], ['F', 1500]]), null, StepName.Cross);
        expect(result).toEqual({ recognition: 0, preAuf: 0, coreExecution: 1.5, postAuf: 0 });
    });

    test('measures recognition as the gap since the previous step ended', () => {
        const result = computeStepSegments(moves([['R', 1000], ['F', 2000]]), 400, StepName.OLL);
        expect(result.recognition).toBeCloseTo(0.6);
    });

    test('reports no recognition when the previous step end is unknown', () => {
        const result = computeStepSegments(moves([['R', 1000], ['F', 2000]]), null, StepName.OLL);
        expect(result.recognition).toBe(0);
    });

    test('never reports negative recognition for out-of-order timestamps', () => {
        const result = computeStepSegments(moves([['R', 1000]]), 5000, StepName.OLL);
        expect(result.recognition).toBe(0);
    });

    test('counts leading U moves as pre-AUF', () => {
        const result = computeStepSegments(moves([['U', 0], ['R', 300], ['F', 900]]), 0, StepName.OLL);
        expect(result.preAuf).toBeCloseTo(0.3);
        expect(result.coreExecution).toBeCloseTo(0.6);
    });

    test('counts trailing U moves of a PLL as post-AUF', () => {
        const result = computeStepSegments(moves([['R', 0], ['F', 400], ['U', 900]]), 0, StepName.PLL);
        expect(result.coreExecution).toBeCloseTo(0.4);
        expect(result.postAuf).toBeCloseTo(0.5);
    });

    test('does not count trailing U moves of a non-PLL step as post-AUF', () => {
        const result = computeStepSegments(moves([['R', 0], ['F', 400], ['U', 900]]), 0, StepName.OLL);
        expect(result.postAuf).toBe(0);
    });

    test('treats an all-AUF PLL as a skip where every move is post-AUF', () => {
        const result = computeStepSegments(moves([['U', 0], ["U'", 600]]), 0, StepName.PLL);
        expect(result).toMatchObject({ preAuf: 0, coreExecution: 0, postAuf: 0.6 });
    });

    test('treats an all-AUF non-PLL step as pure execution', () => {
        const result = computeStepSegments(moves([['U', 0], ["U'", 600]]), 0, StepName.OLL);
        expect(result).toMatchObject({ preAuf: 0, coreExecution: 0.6, postAuf: 0 });
    });

    test('honors a custom AUF face set', () => {
        const result = computeStepSegments(moves([['D', 0], ['R', 400], ['F', 900]]), 0, StepName.OLL, aufMovesForFace('D'));
        expect(result.preAuf).toBeCloseTo(0.4);
    });

    test('reports no pre-AUF when the step starts on a non-AUF move', () => {
        const result = computeStepSegments(moves([['R', 0], ['F', 900]]), 0, StepName.OLL);
        expect(result.preAuf).toBe(0);
    });
});

describe('effectiveCrossExecutionSec', () => {
    test('returns the segment value when there are no move timings', () => {
        expect(effectiveCrossExecutionSec([], 1.4, 9)).toBe(1.4);
    });

    test('falls back to the CSV value for a single recorded move', () => {
        expect(effectiveCrossExecutionSec([{ move: 'R', timestamp: 100 }], 0, 1.25)).toBe(1.25);
    });

    test('falls back to the CSV value when first and last timestamps are identical', () => {
        const timings = [{ move: 'R', timestamp: 100 }, { move: 'U', timestamp: 100 }];
        expect(effectiveCrossExecutionSec(timings, 0, 2)).toBe(2);
    });

    test('keeps the measured value when the timestamp span is real', () => {
        const timings = [{ move: 'R', timestamp: 100 }, { move: 'U', timestamp: 900 }];
        expect(effectiveCrossExecutionSec(timings, 0.8, 5)).toBe(0.8);
    });

    test('does not fall back when there is no positive CSV value', () => {
        expect(effectiveCrossExecutionSec([{ move: 'R', timestamp: 1 }], 0, 0)).toBe(0);
    });
});

describe('tokenizeMoves', () => {
    test('returns an empty array for empty, null or undefined input', () => {
        expect(tokenizeMoves('')).toEqual([]);
        expect(tokenizeMoves(null)).toEqual([]);
        expect(tokenizeMoves(undefined)).toEqual([]);
        expect(tokenizeMoves('   ')).toEqual([]);
    });

    test('splits on any run of whitespace', () => {
        expect(tokenizeMoves("R  U\tR'")).toEqual(['R', 'U', "R'"]);
    });

    test('strips surrounding quotes added by exports', () => {
        expect(tokenizeMoves('"R U R\'"')).toEqual(['R', 'U', "R'"]);
    });
});

describe('countMovesExcludingRotations', () => {
    test('counts every non-rotation token', () => {
        expect(countMovesExcludingRotations("R U R' U'")).toBe(4);
    });

    test('ignores rotations', () => {
        expect(countMovesExcludingRotations("y R x' U z2 R'")).toBe(3);
    });

    test('returns zero for no moves', () => {
        expect(countMovesExcludingRotations('')).toBe(0);
        expect(countMovesExcludingRotations(null)).toBe(0);
    });
});

describe('stripRotationsFromMoveString', () => {
    test('removes rotations and preserves order', () => {
        expect(stripRotationsFromMoveString("y R U x2 R' z'")).toBe("R U R'");
    });

    test('returns an empty string for empty input', () => {
        expect(stripRotationsFromMoveString('')).toBe('');
        expect(stripRotationsFromMoveString(null)).toBe('');
        expect(stripRotationsFromMoveString('   ')).toBe('');
    });

    test('returns an empty string when every move is a rotation', () => {
        expect(stripRotationsFromMoveString("x y' z2")).toBe('');
    });

    test('ROTATIONS covers all three axes and their variants', () => {
        expect(ROTATIONS.size).toBe(12);
        ['x', 'y', 'z'].forEach(axis => {
            expect(ROTATIONS.has(axis)).toBe(true);
            expect(ROTATIONS.has(`${axis}'`)).toBe(true);
            expect(ROTATIONS.has(`${axis}2`)).toBe(true);
        });
    });
});
