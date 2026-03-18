import { GetEmptyStep, GetEmptySolve, CalculateWindowSize, CalculateMostUsedMethod, CalculateAllSessionOptions  } from '../Helpers/CubeHelpers';
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
        inspectionTime: 0,
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
        { ...GetEmptySolve(), method: MethodName.CFOP }
    ];
    expect(CalculateMostUsedMethod(solves)).toBe(MethodName.CFOP);
});

test('CalculateWindowSize returns the correct window size', () => {
    expect(CalculateWindowSize(4000)).toBe(1000);
    expect(CalculateWindowSize(2000)).toBe(500);
});

test('CalculateAllSessionOptions returns unique session options', () => {
    const solves: Solve[] = [
        { ...GetEmptySolve(), session: "Session1" },
        { ...GetEmptySolve(), session: "Session2" },
        { ...GetEmptySolve(), session: "Session1" }
    ];
    expect(CalculateAllSessionOptions(solves)).toEqual([
        { label: "Session1", value: "Session1" },
        { label: "Session2", value: "Session2" }
    ]);
});