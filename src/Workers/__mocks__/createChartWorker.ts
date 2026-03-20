export function createChartWorker(): Worker {
    return {
        postMessage: () => {},
        terminate: () => {},
        onmessage: null,
        onerror: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
    } as unknown as Worker;
}
