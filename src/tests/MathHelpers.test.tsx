import { sumArray, calculateAverage, calculateStandardDeviation, calculate90thPercentile, calculateMovingAverage, calculateMovingAverageChopped, calculateMovingStdDev, calculateMovingPercentage, reduceDataset, splitIntoChunks, getTypicalAverages } from '../Helpers/MathHelpers';
import { describe, expect, test } from '@jest/globals';

test('sumArray sums the elements of an array', () => {
    expect(sumArray([1, 2, 3, 4])).toBe(10);
});

test('calculateAverage calculates the average of an array', () => {
    expect(calculateAverage([1, 2, 3, 4])).toBe(2.5);
});

test('calculateStandardDeviation calculates the standard deviation of an array', () => {
    expect(calculateStandardDeviation([1, 2, 3, 4])).toBeCloseTo(1.118, 3);
});

test('calculate90thPercentile calculates the 90th percentile of an array', () => {
    expect(calculate90thPercentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 10)).toBe(9);
});

test('calculateMovingAverage calculates the moving average of an array', () => {
    expect(calculateMovingAverage([1, 2, 3, 4, 5], 3)).toEqual([2, 3, 4]);
});

describe('calculateMovingAverageChopped', () => {
    test('basic chop=1 case', () => {
        // window=5, chop=1 → drop 1 lo + 1 hi, average middle 3
        // windows: [1,2,3,4,5]→3, [2,3,4,5,6]→4, ..., [6,7,8,9,10]→8  (n-w+1 = 6 results)
        expect(calculateMovingAverageChopped([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5, 1)).toEqual([3, 4, 5, 6, 7, 8]);
    });

    test('chop=2 drops two lo and two hi', () => {
        // window=7, chop=2 → average middle 3
        // [1,2,3,4,5,6,7] → (3+4+5)/3 = 4
        // [2,3,4,5,6,7,8] → (4+5+6)/3 = 5
        // [3,4,5,6,7,8,9] → (5+6+7)/3 = 6
        expect(calculateMovingAverageChopped([1, 2, 3, 4, 5, 6, 7, 8, 9], 7, 2)).toEqual([4, 5, 6]);
    });

    test('produces same result as brute-force reference', () => {
        function bruteForce(data: number[], w: number, chop: number): number[] {
            const result: number[] = [];
            for (let i = 0; i <= data.length - w; i++) {
                const sorted = data.slice(i, i + w).sort((a, b) => a - b);
                const mid = sorted.slice(chop, w - chop);
                result.push(mid.reduce((a, b) => a + b, 0) / mid.length);
            }
            return result;
        }
        const data = [15, 3, 9, 7, 2, 11, 5, 8, 4, 13, 6, 10, 1, 12, 14];
        const r1 = calculateMovingAverageChopped(data, 5, 1);
        const r2 = bruteForce(data, 5, 1);
        expect(r1.length).toBe(r2.length);
        r1.forEach((v, i) => expect(v).toBeCloseTo(r2[i], 6));
    });

    test('handles duplicate values correctly', () => {
        // [3,3,3,3,3] window=5 chop=1 → (3+3+3)/3 = 3
        expect(calculateMovingAverageChopped([3, 3, 3, 3, 3], 5, 1)).toEqual([3]);
        // duplicates spanning lo/mid/hi boundary
        const data = [1, 3, 3, 3, 5, 3, 3, 3, 1];
        const r = calculateMovingAverageChopped(data, 5, 1);
        r.forEach(v => expect(Number.isFinite(v)).toBe(true));
    });

    test('returns empty array when data shorter than window', () => {
        expect(calculateMovingAverageChopped([1, 2, 3], 5, 1)).toEqual([]);
    });

    test('returns single element when data length equals window', () => {
        // [2,4,6,8,10] window=5 chop=1 → drop 2 and 10, average (4+6+8)/3=6
        expect(calculateMovingAverageChopped([2, 4, 6, 8, 10], 5, 1)).toEqual([6]);
    });

    test('throws on bad chop (chop*2 >= window)', () => {
        expect(() => calculateMovingAverageChopped([1, 2, 3, 4, 5], 4, 2)).toThrow();
    });

    test('throws on non-positive chop', () => {
        expect(() => calculateMovingAverageChopped([1, 2, 3, 4, 5], 5, 0)).toThrow();
    });

    test('chopLo/included/chopHi stay fixed size throughout (invariant via brute-force comparison)', () => {
        // Verified indirectly: if sizes drift the sums would diverge from brute-force
        function bruteForce(data: number[], w: number, chop: number): number[] {
            const result: number[] = [];
            for (let i = 0; i <= data.length - w; i++) {
                const sorted = data.slice(i, i + w).sort((a, b) => a - b);
                const mid = sorted.slice(chop, w - chop);
                result.push(mid.reduce((a, b) => a + b, 0) / mid.length);
            }
            return result;
        }
        const data = Array.from({ length: 200 }, () => Math.round(Math.random() * 100));
        const r1 = calculateMovingAverageChopped(data, 12, 1);
        const r2 = bruteForce(data, 12, 1);
        expect(r1.length).toBe(r2.length);
        r1.forEach((v, i) => expect(v).toBeCloseTo(r2[i], 6));
    });
});

test('calculateMovingStdDev calculates the moving standard deviation of an array', () => {
    expect(calculateMovingStdDev([1, 2, 3, 4, 5], 3)).toEqual([1, 1, 1]);
});

test('calculateMovingPercentage calculates the moving percentage of an array', () => {
    const criteria = (value: number) => {return value > 2};
    expect(calculateMovingPercentage([1, 2, 3, 4, 5], 3, criteria)).toEqual([33.33333333333333, 66.66666666666666, 100]);
});

test('reduceDataset reduces the dataset to the specified number of points', () => {
    expect(reduceDataset([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5)).toEqual([1, 3, 5, 7, 9, 10]);
});

test('splitIntoChunks splits the array into the specified number of chunks', () => {
    console.log(splitIntoChunks([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 3));
    expect(splitIntoChunks([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 3)).toEqual([[1, 2, 3, 4], [5, 6, 7, 8], [9, 10]]);
});

test('getTypicalAverages calculates the typical averages based on user average', () => {
    expect(getTypicalAverages(25)).toEqual([3.5, 12.7, 3.8, 5]);
});
