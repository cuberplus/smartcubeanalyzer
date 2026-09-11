import { afterEach, describe, expect, test } from '@jest/globals';
import { GetDemoData } from '../Helpers/SampleData';

const globalAny = globalThis as any;
const env = process.env as Record<string, string | undefined>;
const originalPublicUrl = env.PUBLIC_URL;
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
    if (originalPublicUrl === undefined) delete env.PUBLIC_URL;
    else env.PUBLIC_URL = originalPublicUrl;
    globalAny.window = originalWindow;
    globalAny.fetch = originalFetch;
});

describe('GetDemoData', () => {
    test('resolves the CSV relative to PUBLIC_URL when it is set', async () => {
        env.PUBLIC_URL = '/smartcubeanalyzer';
        const calls = mockFetch({ ok: true, text: 'a,b' });
        await GetDemoData();
        expect(calls[0]).toBe('/smartcubeanalyzer/demo-solves.csv');
    });

    test('does not double up the slash when PUBLIC_URL ends with one', async () => {
        env.PUBLIC_URL = '/smartcubeanalyzer/';
        const calls = mockFetch({ ok: true });
        await GetDemoData();
        expect(calls[0]).toBe('/smartcubeanalyzer/demo-solves.csv');
    });

    test('falls back to the page location when PUBLIC_URL is not set', async () => {
        delete env.PUBLIC_URL;
        setWindowLocation('https://cuberplus.com', '/smartcubeanalyzer');
        const calls = mockFetch({ ok: true });
        await GetDemoData();
        expect(calls[0]).toBe('https://cuberplus.com/smartcubeanalyzer/demo-solves.csv');
    });

    test('works when the page path already ends with a slash', async () => {
        delete env.PUBLIC_URL;
        setWindowLocation('https://cuberplus.com', '/smartcubeanalyzer/');
        const calls = mockFetch({ ok: true });
        await GetDemoData();
        expect(calls[0]).toBe('https://cuberplus.com/smartcubeanalyzer/demo-solves.csv');
    });

    test('works when the app is served from the site root', async () => {
        delete env.PUBLIC_URL;
        setWindowLocation('http://localhost:3000', '/');
        const calls = mockFetch({ ok: true });
        await GetDemoData();
        expect(calls[0]).toBe('http://localhost:3000/demo-solves.csv');
    });

    test('returns the CSV text on success', async () => {
        env.PUBLIC_URL = '/app';
        mockFetch({ ok: true, text: 'time,date\n10,2024-01-01' });
        await expect(GetDemoData()).resolves.toBe('time,date\n10,2024-01-01');
    });

    test('rejects when the demo CSV cannot be fetched', async () => {
        env.PUBLIC_URL = '/app';
        mockFetch({ ok: false });
        await expect(GetDemoData()).rejects.toThrow('Failed to load demo data');
    });
});
