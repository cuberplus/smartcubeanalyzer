import { describe, expect, test } from '@jest/globals';
import {
    calculate90thPercentile,
    calculateAverage,
    calculateMovingAverage,
    calculateMovingAverageChopped,
    calculateMovingPercentage,
    calculateMovingStdDev,
    calculateStandardDeviation,
    getTypicalAverages,
    makeLabels,
    reduceDataset,
    splitIntoChunks,
    sumArray,
} from '../Helpers/MathHelpers';
import { Const } from '../Helpers/Constants';

describe('sumArray / calculateAverage edge cases', () => {
    test('sumArray returns zero for an empty array', () => {
        expect(sumArray([])).toBe(0);
    });

    test('sumArray handles negative values', () => {
        expect(sumArray([5, -3, -2])).toBe(0);
    });

    test('calculateAverage returns NaN for an empty array', () => {
        expect(Number.isNaN(calculateAverage([]))).toBe(true);
    });

    test('calculateAverage of a single value is that value', () => {
        expect(calculateAverage([7.5])).toBe(7.5);
    });
});

describe('calculateStandardDeviation', () => {
    test('is zero for identical values', () => {
        expect(calculateStandardDeviation([9, 9, 9, 9])).toBe(0);
    });

    test('only considers the most recent StdDevWindow samples', () => {
        const noisyHistory = Array.from({ length: 50 }, (_, i) => (i % 2 === 0 ? 0 : 1000));
        const steadyRecent = Array.from({ length: Const.StdDevWindow }, () => 10);
        expect(calculateStandardDeviation([...noisyHistory, ...steadyRecent])).toBe(0);
    });
});

describe('calculate90thPercentile', () => {
    test('only considers the most recent window of solves', () => {
        const data = [...Array.from({ length: 20 }, () => 100), ...Array.from({ length: 10 }, () => 5)];
        expect(calculate90thPercentile(data, 10)).toBe(5);
    });

    test('uses the whole dataset when it is shorter than the window', () => {
        expect(calculate90thPercentile([1, 2, 3], 100)).toBe(2);
    });

    test('rounds the result up to a whole second', () => {
        expect(calculate90thPercentile([1.2, 1.4, 1.6], 3)).toBe(2);
    });
});

describe('calculateMovingAverage', () => {
    test('returns no points when there are fewer solves than the window', () => {
        expect(calculateMovingAverage([1, 2], 5)).toEqual([]);
    });

    test('returns exactly one point when solves equal the window', () => {
        expect(calculateMovingAverage([2, 4, 6], 3)).toEqual([4]);
    });

    test('produces n - window + 1 points', () => {
        expect(calculateMovingAverage([1, 2, 3, 4, 5, 6], 2)).toHaveLength(5);
    });
});

describe('calculateMovingAverageChopped validation', () => {
    test('rejects a non-positive chop', () => {
        expect(() => calculateMovingAverageChopped([1, 2, 3], 3, 0)).toThrow('Bad chop');
        expect(() => calculateMovingAverageChopped([1, 2, 3], 3, -1)).toThrow('Bad chop');
    });

    test('rejects a chop that would remove the entire window', () => {
        expect(() => calculateMovingAverageChopped([1, 2, 3, 4], 4, 2)).toThrow('Bad chop');
    });

    test('returns no points when there are fewer solves than the window', () => {
        expect(calculateMovingAverageChopped([1, 2, 3], 5, 1)).toEqual([]);
    });
});

describe('calculateMovingPercentage', () => {
    test('returns no points when there are fewer values than the window', () => {
        expect(calculateMovingPercentage([1, 2], 5, () => true)).toEqual([]);
    });

    test('returns 100 when every value matches', () => {
        expect(calculateMovingPercentage([1, 1, 1], 3, (v) => v === 1)).toEqual([100]);
    });

    test('returns 0 when no value matches', () => {
        expect(calculateMovingPercentage([1, 1, 1], 3, (v) => v === 2)).toEqual([0]);
    });

    test('slides the window as values enter and leave', () => {
        // windows: [1,1,0] → 66.6, [1,0,0] → 33.3, [0,0,0] → 0
        const result = calculateMovingPercentage([1, 1, 0, 0, 0], 3, (v) => v === 1);
        expect(result).toHaveLength(3);
        expect(result[0]).toBeCloseTo(66.67, 1);
        expect(result[1]).toBeCloseTo(33.33, 1);
        expect(result[2]).toBe(0);
    });
});

describe('calculateMovingStdDev', () => {
    test('returns no points for a NaN window', () => {
        expect(calculateMovingStdDev([1, 2, 3], NaN)).toEqual([]);
    });

    test('returns no points when there are fewer solves than the window', () => {
        expect(calculateMovingStdDev([1, 2], 5)).toEqual([]);
    });

    test('is approximately zero for identical values, never NaN', () => {
        const result = calculateMovingStdDev([5, 5, 5, 5, 5], 3);
        result.forEach((v) => expect(v).toBeCloseTo(0, 6));
    });

    test('produces n - window + 1 points', () => {
        expect(calculateMovingStdDev([1, 5, 2, 8, 3, 9], 3)).toHaveLength(4);
    });
});

describe('reduceDataset', () => {
    test('returns the original array when it already fits', () => {
        const values = [1, 2, 3];
        expect(reduceDataset(values, 10)).toBe(values);
    });

    test('reduces a large array to roughly the requested number of points', () => {
        const reduced = reduceDataset(Array.from({ length: 1000 }, (_, i) => i), 100);
        expect(reduced.length).toBeLessThanOrEqual(101);
        expect(reduced.length).toBeGreaterThanOrEqual(100);
    });

    test('always keeps the first and last data points', () => {
        const values = Array.from({ length: 1000 }, (_, i) => i);
        const reduced = reduceDataset(values, 100);
        expect(reduced[0]).toBe(0);
        expect(reduced[reduced.length - 1]).toBe(999);
    });

    test('does not duplicate the last point when it lands on the sampling stride', () => {
        const values = Array.from({ length: 11 }, (_, i) => i);
        const reduced = reduceDataset(values, 6);
        expect(reduced[reduced.length - 1]).toBe(10);
        expect(reduced[reduced.length - 2]).not.toBe(10);
    });
});

describe('makeLabels', () => {
    test('labels start at 1 and are strings', () => {
        expect(makeLabels(3, 500)).toEqual(['1', '2', '3']);
    });

    test('returns no labels for a length of zero', () => {
        expect(makeLabels(0, 500)).toEqual([]);
    });

    test('reduces labels the same way as the data', () => {
        const labels = makeLabels(1000, 100);
        const data = reduceDataset(Array.from({ length: 1000 }, (_, i) => i), 100);
        expect(labels).toHaveLength(data.length);
        expect(labels[labels.length - 1]).toBe('1000');
    });
});

describe('splitIntoChunks', () => {
    test('splits evenly when the length divides cleanly', () => {
        expect(splitIntoChunks([1, 2, 3, 4, 5, 6], 3)).toEqual([[1, 2], [3, 4], [5, 6]]);
    });

    test('always returns the requested number of chunks', () => {
        expect(splitIntoChunks([1, 2, 3], 7)).toHaveLength(7);
    });

    test('pads with empty chunks when there are too few values', () => {
        const chunks = splitIntoChunks([1, 2], 5);
        expect(chunks[0]).toEqual([1]);
        expect(chunks[4]).toEqual([]);
    });

    test('returns empty chunks for an empty input', () => {
        expect(splitIntoChunks([], 3)).toEqual([[], [], []]);
    });
});

describe('getTypicalAverages', () => {
    test('returns zeroes for a non-finite average', () => {
        expect(getTypicalAverages(NaN)).toEqual([0, 0, 0, 0]);
        expect(getTypicalAverages(Infinity)).toEqual([0, 0, 0, 0]);
    });

    test('splits sum to the user average', () => {
        [6, 9, 11, 14, 18, 23, 28, 35, 45, 90].forEach((avg) => {
            expect(sumArray(getTypicalAverages(avg))).toBeCloseTo(avg, 6);
        });
    });

    test('returns cross, F2L, OLL and PLL in that order with F2L largest', () => {
        const splits = getTypicalAverages(20);
        expect(splits).toHaveLength(4);
        expect(Math.max(...splits)).toBe(splits[1]);
    });

    test('scales proportionally with the user average', () => {
        const slow = getTypicalAverages(40);
        const fast = getTypicalAverages(20);
        expect(slow[0]).toBeGreaterThan(fast[0]);
    });

    test('uses the slowest bucket for very slow averages', () => {
        expect(sumArray(getTypicalAverages(600))).toBeCloseTo(600, 6);
    });
});
