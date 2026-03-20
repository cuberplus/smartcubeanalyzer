import { GetEmptyStep, GetEmptySolve, CalculateBenchmarkTimes, CalculateWindowSize, CalculateMostUsedMethod, CalculateAllSessionOptions  } from '../Helpers/CubeHelpers';
import { describe, expect, test } from '@jest/globals';
import { MethodName, Solve } from '../Helpers/Types';

test('GetEmptyStep returns an empty step', () => {
    const step = GetEmptyStep();
    expect(step).toEqual({
        time: 0,
        executionTime: 0,
        recognitionTime: 0,
        preAufTime: 0,
        postAufTime: 0,
        turns: 0,
        tps: 0,
        moves: "",
        case: "",
        name: "Cross"
    });
});

test('GetEmptySolve returns an empty solve', () => {
    const solve = GetEmptySolve();
    expect(solve).toEqual({
        id: "",
        source: "cubeast",
        rawSourceId: "",
        rawSource: "",
        time: 0,
        date: expect.any(Date),
        crossColor: "Unknown",
        scramble: "",
        tps: 0,
        recognitionTime: 0,
        inspectionTime: null,
        executionTime: 0,
        preAufTime: 0,
        postAufTime: 0,
        turns: 0,
        steps: expect.any(Array),
        isCorrupt: false,
        method: "CFOP",
        session: "",
        isMistake: false,
        isFullStep: true
    });
});

test('CalculateMostUsedMethod returns the most used method', () => {
    const solves: Solve[] = [
        { ...GetEmptySolve(), method: MethodName.CFOP },
        { ...GetEmptySolve(), method: MethodName.Roux },
        { ...GetEmptySolve(), method: MethodName.ZZ },
        { ...GetEmptySolve(), method: MethodName.CFOP }
    ];
    expect(CalculateMostUsedMethod(solves)).toBe(MethodName.CFOP);
});

test('CalculateMostUsedMethod can return ZZ', () => {
    const solves: Solve[] = [
        { ...GetEmptySolve(), method: MethodName.ZZ },
        { ...GetEmptySolve(), method: MethodName.ZZ },
        { ...GetEmptySolve(), method: MethodName.CFOP },
    ];
    expect(CalculateMostUsedMethod(solves)).toBe(MethodName.ZZ);
});

test('CalculateWindowSize returns the correct window size', () => {
    expect(CalculateWindowSize(4000)).toBe(1000);
    expect(CalculateWindowSize(2000)).toBe(500);
    expect(CalculateWindowSize(1)).toBe(5);
    expect(CalculateWindowSize(0)).toBe(5);
    expect(CalculateWindowSize(-20)).toBe(5);
    expect(CalculateWindowSize(500000)).toBe(1000);
});

test('CalculateAllSessionOptions returns unique session options sorted alphabetically', () => {
    const solves: Solve[] = [
        { ...GetEmptySolve(), session: "Zed" },
        { ...GetEmptySolve(), session: "Alpha" },
        { ...GetEmptySolve(), session: "Beta" },
        { ...GetEmptySolve(), session: "Zed" }
    ];
    expect(CalculateAllSessionOptions(solves)).toEqual([
        { label: "Alpha", value: "Alpha" },
        { label: "Beta", value: "Beta" },
        { label: "Zed", value: "Zed" }
    ]);
});

test('CalculateBenchmarkTimes returns defaults for empty list', () => {
    expect(CalculateBenchmarkTimes([])).toEqual({ goodTime: 15, badTime: 20 });
});

test('CalculateBenchmarkTimes uses mean for <100 solves', () => {
    const times = [10, 11, 12];
    const solves: Solve[] = times.map((t, i) => ({
        ...GetEmptySolve(),
        id: String(i),
        time: t,
        date: new Date(2024, 0, i + 1),
    }));

    // mean = 11 => good = floor(11) = 11, bad = ceil(11 * 1.25) = 14
    expect(CalculateBenchmarkTimes(solves)).toEqual({ goodTime: 11, badTime: 14 });
});

test('CalculateBenchmarkTimes uses current Ao100 for >=100 solves', () => {
    // First solve is outside the last 100-window so it should not affect Ao100.
    const tailTimes: number[] = [
        ...Array(5).fill(1),
        ...Array(90).fill(20),
        ...Array(5).fill(100),
    ];

    const solves: Solve[] = [
        { ...GetEmptySolve(), id: '0', time: 30, date: new Date(2024, 0, 1) },
        ...tailTimes.map((t, i) => ({
            ...GetEmptySolve(),
            id: String(i + 1),
            time: t,
            date: new Date(2024, 0, i + 2),
        })),
    ];

    // Last 100 solves have 5 smallest (1), 5 largest (100), and 90 middle (20).
    // Ao100(trimmed mean of middle 90) = 20 => bad = ceil(20 * 1.25) = 25
    expect(CalculateBenchmarkTimes(solves)).toEqual({ goodTime: 20, badTime: 25 });
});