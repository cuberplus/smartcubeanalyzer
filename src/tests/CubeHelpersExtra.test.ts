import { describe, expect, test } from '@jest/globals';
import {
    CalculateAllSessionOptions,
    CalculateBenchmarkTimes,
    CalculateMostUsedMethod,
    CalculateWindowSize,
    GetEmptySolve,
} from '../Helpers/CubeHelpers';
import { Const } from '../Helpers/Constants';
import { MethodName } from '../Helpers/Types';
import { makeSolve, makeSolves } from './testUtils';

describe('CalculateWindowSize', () => {
    test('never goes below five, even for very few solves', () => {
        expect(CalculateWindowSize(1)).toBe(5);
        expect(CalculateWindowSize(12)).toBe(5);
    });

    test('uses a quarter of the solve count in between the bounds', () => {
        expect(CalculateWindowSize(400)).toBe(100);
    });

    test('rounds a fractional quarter up', () => {
        expect(CalculateWindowSize(41)).toBe(11);
    });

    test('caps at the default window size', () => {
        expect(CalculateWindowSize(1_000_000)).toBe(Const.DefaultWindowSize);
    });

    test('falls back to five for zero, negative or non-finite counts', () => {
        expect(CalculateWindowSize(0)).toBe(5);
        expect(CalculateWindowSize(-10)).toBe(5);
        expect(CalculateWindowSize(NaN)).toBe(5);
        expect(CalculateWindowSize(Infinity)).toBe(5);
    });
});

describe('CalculateMostUsedMethod', () => {
    test('defaults to CFOP for no solves', () => {
        expect(CalculateMostUsedMethod([])).toBe(MethodName.CFOP);
    });

    test('keeps the first method reached on a tie', () => {
        const solves = [
            makeSolve({ method: MethodName.Roux }),
            makeSolve({ method: MethodName.ZZ }),
        ];
        expect(CalculateMostUsedMethod(solves)).toBe(MethodName.Roux);
    });

    test('picks the method with the most solves regardless of order', () => {
        const solves = [
            makeSolve({ method: MethodName.ZZ }),
            ...makeSolves(3, { method: MethodName.LayerByLayer }),
            makeSolve({ method: MethodName.Roux }),
        ];
        expect(CalculateMostUsedMethod(solves)).toBe(MethodName.LayerByLayer);
    });
});

describe('CalculateAllSessionOptions', () => {
    test('returns no options for no solves', () => {
        expect(CalculateAllSessionOptions([])).toEqual([]);
    });

    test('deduplicates sessions', () => {
        const solves = makeSolves(5, { session: 'Main' });
        expect(CalculateAllSessionOptions(solves)).toEqual([{ label: 'Main', value: 'Main' }]);
    });

    test('sorts case-insensitively', () => {
        const solves = [
            makeSolve({ session: 'beta' }),
            makeSolve({ session: 'Alpha' }),
            makeSolve({ session: 'Gamma' }),
        ];
        expect(CalculateAllSessionOptions(solves).map(o => o.label)).toEqual(['Alpha', 'beta', 'Gamma']);
    });
});

describe('CalculateBenchmarkTimes', () => {
    test('sets the bad time 25% above the good time, rounded up', () => {
        const solves = makeSolves(4, { time: 20 });
        expect(CalculateBenchmarkTimes(solves)).toEqual({ goodTime: 20, badTime: 25 });
    });

    test('ignores corrupt solves', () => {
        const solves = [
            ...makeSolves(3, { time: 10 }),
            makeSolve({ time: 10_000, isCorrupt: true }),
        ];
        expect(CalculateBenchmarkTimes(solves).goodTime).toBe(10);
    });

    test('returns defaults when every solve is corrupt', () => {
        const solves = makeSolves(3, { isCorrupt: true });
        expect(CalculateBenchmarkTimes(solves)).toEqual({ goodTime: 15, badTime: 20 });
    });

    test('uses the latest Ao100 once there are 100 or more solves', () => {
        // 100 slow solves followed by 100 fast ones: the benchmark reflects recent form.
        const solves = [
            ...makeSolves(100, { time: 30 }).map((s, i) => ({ ...s, date: new Date(2024, 0, 1, 0, i) })),
            ...makeSolves(100, { time: 10 }).map((s, i) => ({ ...s, date: new Date(2024, 0, 2, 0, i) })),
        ];
        expect(CalculateBenchmarkTimes(solves).goodTime).toBe(10);
    });

    test('orders solves by date before computing the recent average', () => {
        const oldSlow = makeSolves(100, { time: 30 }).map((s, i) => ({ ...s, date: new Date(2024, 0, 1, 0, i) }));
        const newFast = makeSolves(100, { time: 10 }).map((s, i) => ({ ...s, date: new Date(2024, 0, 2, 0, i) }));
        const shuffled = [...newFast, ...oldSlow];
        expect(CalculateBenchmarkTimes(shuffled).goodTime).toBe(10);
    });

    test('floors a fractional good time', () => {
        const solves = [makeSolve({ time: 12.9 }), makeSolve({ time: 13.1 })];
        expect(CalculateBenchmarkTimes(solves).goodTime).toBe(13);
    });
});

describe('GetEmptySolve', () => {
    test('returns a fresh object each call', () => {
        const a = GetEmptySolve();
        const b = GetEmptySolve();
        a.steps[0].time = 99;
        expect(b.steps[0].time).toBe(0);
    });

    test('reports unknown inspection time rather than zero', () => {
        expect(GetEmptySolve().inspectionTime).toBeNull();
    });
});
