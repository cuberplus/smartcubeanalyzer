import { Deque } from "@datastructures-js/deque";
import { Const } from "./Constants";
import { Records } from "./Types";
var Set = require("sorted-set");

export function sumArray(data: number[]): number {
    return data.reduce((acc, curr) => acc + curr, 0);
}

export function calculateAverage(data: number[]): number {
    let mean = 0;
    for (let i = 0; i < data.length; i++) {
        mean += data[i];
    }
    mean /= data.length;

    return mean;
}

export function calculateStandardDeviation(data: number[]): number {
    let samples = data.slice(-Const.StdDevWindow);
    let mean = calculateAverage(samples)

    let variance = 0;
    for (let i = 0; i < samples.length; i++) {
        variance += Math.pow(samples[i] - mean, 2);
    }
    variance /= samples.length;

    return Math.sqrt(variance)
}

export function calculate90thPercentile(data: number[], window: number): number {
    let recentSolves = data;
    if (data.length > window) {
        recentSolves = data.slice(-window);
    }

    let sortedSolves = recentSolves.sort((a, b) => {
        return a - b;
    })

    let idx = Math.floor(.9 * sortedSolves.length); // Find 90th percentile of the window (1-indexed)
    idx = Math.max(0, idx - 1); // 0-indexed

    return Math.ceil(sortedSolves[idx]);
}

export function calculateMovingAverage(data: number[], window: number): number[] {
    let result: number[] = [];
    if (data.length < window) {
        return result;
    }
    let sum = 0;
    for (let i = 0; i < window; ++i) {
        sum += data[i];
    }
    result.push(sum / window);
    for (let i = window; i < data.length; ++i) {
        sum -= data[i - window];
        sum += data[i];
        result.push(sum / window);
    }
    return result;
};

export function calculateMovingAverageChopped(data: number[], window: number, chop: number): number[] {
    if (chop * 2 >= window) {
        throw new Error("Bad chop")
    }
    if (chop <= 0) {
        throw new Error("Bad chop")
    }

    let result: number[] = [];
    if (data.length < window) {
        return result;
    }

    var inWindow = new Set();
    var trueWindow = window - (chop * 2);
    const steps = data.length - window - 1;

    let sum = 0;
    for (let i = 0; i < window; ++i) {
        sum += data[i];
        inWindow.add(data[i]);
    }

    let minTotalHere = sumArray(inWindow.slice(0, chop));
    let maxTotalHere = sumArray(inWindow.slice(-chop));
    result.push((sum - minTotalHere - maxTotalHere) / trueWindow)

    for (let i = 0; i < steps; ++i) {
        sum -= data[i];
        sum += data[i + window];
        inWindow.del(data[i]);
        inWindow.add(data[i + window])
        let minTotalHere = sumArray(inWindow.slice(0, chop));
        let maxTotalHere = sumArray(inWindow.slice(-chop));
        result.push((sum - minTotalHere - maxTotalHere) / trueWindow)
    }

    return result;
}

export function calculateMovingPercentage(data: any[], window: number, criteria: (solve: any) => boolean): number[] {
    let result: number[] = [];
    if (data.length < window) {
        return result;
    }

    let good = 0;
    for (let i = 0; i < window; ++i) {
        if (criteria(data[i])) {
            good++;
        }
    }
    result.push(good / window * 100);
    for (let i = window; i < data.length; ++i) {
        if (criteria(data[i - window])) {
            good--;
        }
        if (criteria(data[i])) {
            good++;
        }
        result.push(good / window * 100);
    }
    return result;
}

export function calculateMovingStdDev(data: number[], window: number) {
    let result: number[] = [];
    if (Number.isNaN(window) || data.length < window) {
        return result;
    }

    let deque = new Deque<number>(new Array(window).fill(0));
    let mean = 0;
    let variance = 0;

    for (let i = 0; i < data.length; i++) {
        let oldMean = mean;
        let goingAway = deque.front();
        mean = oldMean + (data[i] - goingAway) / window;
        let newMean = mean;
        deque.pushBack(data[i]);
        if (deque.size() > window) {
            deque.popFront()
        }
        variance += (data[i] - goingAway) * ((data[i] - newMean) + (goingAway - oldMean)) / (window - 1)
        if (i >= (window - 1)) {
            result.push(Math.sqrt(variance))
        }
    }

    return result;
}

export function reduceDataset(values: any[], pointsPerGraph: number) {
    let targetPoints = pointsPerGraph;
    if (values.length <= targetPoints) {
        return values;
    }

    let reducedValues = []
    let addedLastElement: boolean = false;
    let delta = Math.floor(values.length / targetPoints);
    for (let i = 0; i < values.length; i = i + delta) {
        reducedValues.push(values[i]);
        if (i === (values.length - 1)) {
            addedLastElement = true;
        }
    }

    if (!addedLastElement) {
        reducedValues.push(values[values.length - 1]);
    }

    return reducedValues;
}

export function splitIntoChunks(values: any[], chunks: number) {
    let size: number = Math.ceil(values.length / chunks);
    return Array.from({ length: chunks }, (v, i) =>
        values.slice(i * size, i * size + size)
    );
}

// Given the user's average time, calculate what the expected splits should be
export function getTypicalAverages(userAverage: number) {
    if (!Number.isFinite(userAverage)) {
        const zeroes = [0, 0, 0, 0];
        return zeroes;
    }
    const typicalData = [
        { maxAverage: 8, splits: [.95, 4.05, 1.3, 1.7], expected: 8 },
        { maxAverage: 10, splits: [1.2, 5, 1.65, 2.15], expected: 10 },
        { maxAverage: 12, splits: [1.5, 6, 1.9, 2.6], expected: 12 },
        { maxAverage: 15, splits: [2, 7.5, 2.3, 3.2], expected: 15 },
        { maxAverage: 20, splits: [2.8, 10.2, 3, 4], expected: 20 },
        { maxAverage: 25, splits: [3.5, 12.7, 3.8, 5], expected: 25 },
        { maxAverage: 30, splits: [4, 15.5, 4.5, 6], expected: 30 },
        { maxAverage: 40, splits: [5, 21, 6, 8], expected: 40 },
        { maxAverage: 50, splits: [6, 28, 7, 9], expected: 50 },
        { maxAverage: Infinity, splits: [7, 35, 8, 10], expected: 60 }
    ];

    const { splits, expected } = typicalData.find(data => userAverage <= data.maxAverage)!;

    if (splits.reduce((a, b) => a + b, 0) !== expected) {
        console.log("There is an error with the expected splits. Please verify");
    }

    const scalar = userAverage / expected;
    return splits.map(split => split * scalar);
}