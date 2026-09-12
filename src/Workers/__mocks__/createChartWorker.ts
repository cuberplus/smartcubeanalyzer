export function createChartWorker(): Worker {
    const worker: Worker = {
        postMessage: () => {},
        terminate: () => {},
        onmessage: null,
        onerror: null,
        onmessageerror: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
    };
    return worker;
}