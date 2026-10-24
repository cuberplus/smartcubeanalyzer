import { afterEach, describe, expect, test } from '@jest/globals';
import { GetDemoData, DEFAULT_DEMO_FILE } from '../Helpers/SampleData';

/** Only the globals this suite fakes. globalThis is structurally assignable to it, so no cast is needed. */
interface TestGlobals {
    window?: { location: { origin: string; pathname: string } };
    fetch?: (url: string) => Promise<{ ok: boolean; text: () => Promise<string> }>;
}
const globalAny: TestGlobals = globalThis;
const originalWindow = globalAny.window;
const originalFetch = globalAny.fetch;

function mockFetch(response: { ok: boolean; text?: string }) {
    const calls: string[] = [];
    globalAny.fetch = (url: string) => {
        calls.push(url);
        return Promise.resolve({
            ok: response.ok,
            text: () => Promise.resolve(response.text ?? ''),
        });
    };
    return calls;
}

function setWindowLocation(origin: string, pathname: string) {
    globalAny.window = { location: { origin, pathname } };
}

afterEach(() => {
    globalAny.window = originalWindow;
    globalAny.fetch = originalFetch;
});

describe('GetDemoData', () => {
    test('resolves the CSV relative to an explicit index page', async () => {
        setWindowLocation('https://cuberplus.com', '/smartcubeanalyzer/index.html');
        const calls = mockFetch({ ok: true, text: 'a,b' });
        await GetDemoData();
        expect(calls[0]).toBe('https://cuberplus.com/smartcubeanalyzer/demo/demo-solves.csv');
    });

    test('resolves the CSV relative to an index page at the site root', async () => {
        setWindowLocation('https://cuberplus.com', '/index.html');
        const calls = mockFetch({ ok: true });
        await GetDemoData();
        expect(calls[0]).toBe('https://cuberplus.com/demo/demo-solves.csv');
    });

    test('resolves the CSV relative to the page location', async () => {
        setWindowLocation('https://cuberplus.com', '/smartcubeanalyzer');
        const calls = mockFetch({ ok: true });
        await GetDemoData();
        expect(calls[0]).toBe('https://cuberplus.com/smartcubeanalyzer/demo/demo-solves.csv');
    });

    test('works when the page path already ends with a slash', async () => {
        setWindowLocation('https://cuberplus.com', '/smartcubeanalyzer/');
        const calls = mockFetch({ ok: true });
        await GetDemoData();
        expect(calls[0]).toBe('https://cuberplus.com/smartcubeanalyzer/demo/demo-solves.csv');
    });

    test('works when the app is served from the site root', async () => {
        setWindowLocation('http://localhost:3000', '/');
        const calls = mockFetch({ ok: true });
        await GetDemoData();
        expect(calls[0]).toBe('http://localhost:3000/demo/demo-solves.csv');
    });

    test('returns the CSV text on success', async () => {
        setWindowLocation('https://cuberplus.com', '/app/');
        mockFetch({ ok: true, text: 'time,date\n10,2024-01-01' });
        await expect(GetDemoData()).resolves.toBe('time,date\n10,2024-01-01');
    });

    test('rejects when the demo CSV cannot be fetched', async () => {
        setWindowLocation('https://cuberplus.com', '/app/');
        mockFetch({ ok: false });
        await expect(GetDemoData()).rejects.toThrow('Failed to load demo data');
    });

    test('fetches the dataset the picker asked for', async () => {
        setWindowLocation('https://cuberplus.com', '/smartcubeanalyzer/');
        const calls = mockFetch({ ok: true, text: 'a,b' });
        await GetDemoData('demo/roux-small.csv');
        expect(calls[0]).toBe('https://cuberplus.com/smartcubeanalyzer/demo/roux-small.csv');
    });

    test('falls back to the original demo data when no dataset is named', async () => {
        setWindowLocation('https://cuberplus.com', '/smartcubeanalyzer/');
        const calls = mockFetch({ ok: true, text: 'a,b' });
        await GetDemoData();
        expect(calls[0]).toBe(`https://cuberplus.com/smartcubeanalyzer/${DEFAULT_DEMO_FILE}`);
    });
});
