/** @jest-environment jsdom */
import { describe, expect, test } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ChartPanel } from '../Components/ChartPanel';
import { FastestSolve } from '../Helpers/Types';

/**
 * Guards the site's non-dependency security properties. These are cheap to
 * regress by accident (a stray window.open, a dropped meta tag), so they are
 * asserted rather than left to review.
 */

function solve(overrides: Partial<FastestSolve>): FastestSolve {
    return {
        time: '10.00', date: '2024-01-01', scramble: 'R U', id: 'abc',
        source: 'cubeast', fullstep: '', ...overrides,
    };
}

function openSolve(row: FastestSolve): { url: string; target?: string; features?: string } {
    const calls: any[] = [];
    const original = window.open;
    (window as any).open = (...args: any[]) => { calls.push(args); return null; };
    try {
        ChartPanel.prototype.openSolveSource.call({}, { row } as any);
    } finally {
        (window as any).open = original;
    }
    expect(calls).toHaveLength(1);
    return { url: calls[0][0], target: calls[0][1], features: calls[0][2] };
}

describe('external solve links', () => {
    test('cubeast links open with noopener so the new tab cannot navigate this one', () => {
        const { url, features } = openSolve(solve({ id: 'solve-1' }));
        expect(url).toBe('https://app.cubeast.com/log/solves/solve-1');
        expect(features).toContain('noopener');
        expect(features).toContain('noreferrer');
    });

    test('acubemy links open with noopener so the new tab cannot navigate this one', () => {
        const { url, features } = openSolve(solve({ source: 'acubemy', rawSourceId: 'share-1' }));
        expect(url).toBe('https://acubemy.com/shared/share-1');
        expect(features).toContain('noopener');
        expect(features).toContain('noreferrer');
    });

    // Solve ids come from a user-supplied CSV, so they are untrusted input.
    test('a hostile id from a CSV cannot escape the intended path or origin', () => {
        const { url } = openSolve(solve({ id: '../../../evil?x=1#y' }));
        expect(url).toBe('https://app.cubeast.com/log/solves/..%2F..%2F..%2Fevil%3Fx%3D1%23y');
        expect(new URL(url).origin).toBe('https://app.cubeast.com');
    });

    test('a javascript: payload in an id stays inert', () => {
        const { url } = openSolve(solve({ source: 'acubemy', rawSourceId: 'javascript:alert(1)' }));
        expect(new URL(url).protocol).toBe('https:');
        expect(url).not.toContain('javascript:');
    });
});

describe('index.html security headers', () => {
    const html = readFileSync(join(__dirname, '..', '..', 'public', 'index.html'), 'utf8');
    const csp = /<meta http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html)?.[1] ?? '';

    test('ships a Content-Security-Policy, since GitHub Pages cannot send headers', () => {
        expect(csp).not.toBe('');
    });

    test('blocks plugins, form posts and base-tag hijacking', () => {
        expect(csp).toContain("default-src 'self'");
        expect(csp).toContain("object-src 'none'");
        expect(csp).toContain("base-uri 'self'");
        expect(csp).toContain("form-action 'none'");
    });

    test('never allows unsafe-eval or inline script', () => {
        const scriptSrc = /script-src ([^;]+)/.exec(csp)?.[1] ?? '';
        expect(csp).not.toContain("'unsafe-eval'");
        expect(scriptSrc).not.toContain("'unsafe-inline'");
    });

    // A hash would have to be regenerated whenever the build's minifier touches
    // an inline script, so the policy forbids inline script outright instead.
    test('contains no inline script to keep script-src hash-free', () => {
        expect(/<script>[\s\S]*?<\/script>/.test(html)).toBe(false);
        expect(html).toContain('theme-init.js');
    });

    test('the theme bootstrap it loads actually exists', () => {
        const script = readFileSync(join(__dirname, '..', '..', 'public', 'theme-init.js'), 'utf8');
        expect(script).toContain('data-bs-theme');
    });

    // Browsers ignore frame-ancestors in a meta tag; including it only logs a warning.
    test('omits directives that are invalid in a meta tag', () => {
        expect(csp).not.toContain('frame-ancestors');
        expect(csp).not.toContain('report-uri');
    });

    test('sends a privacy-preserving referrer policy', () => {
        expect(html).toContain('name="referrer"');
        expect(html).toContain('strict-origin-when-cross-origin');
    });
});
