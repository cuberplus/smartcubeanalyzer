export function createChartWorker(): Worker {
    return new Worker(new URL('./chartWorker.ts', import.meta.url));
}
