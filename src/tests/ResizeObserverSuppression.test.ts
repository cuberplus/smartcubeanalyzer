/** @jest-environment jsdom */
import { describe, expect, test } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Chart.js and react-data-grid trip the browser's benign "ResizeObserver loop"
 * warning when charts resize (notably while changing filters). The dev server's
 * error overlay turns that warning into a full-screen "Uncaught runtime error",
 * so it is suppressed with a window error listener.
 *
 * The suppression relies on stopImmediatePropagation, which only silences
 * listeners registered *after* ours. The dev overlay registers its listener as
 * the bundle loads, so a suppressor living in src/index.tsx is always too late.
 * It therefore has to sit in public/theme-init.js, which index.html loads ahead
 * of the bundle. These tests guard both the behavior and that ordering, since
 * moving the listener "somewhere tidier" silently breaks it.
 */

const PUBLIC_DIR = join(__dirname, '..', '..', 'public');
const themeInit = readFileSync(join(PUBLIC_DIR, 'theme-init.js'), 'utf8');
const indexHtml = readFileSync(join(PUBLIC_DIR, 'index.html'), 'utf8');
const indexTsx = readFileSync(join(__dirname, '..', 'index.tsx'), 'utf8');

const RESIZE_OBSERVER_MESSAGES = [
    'ResizeObserver loop completed with undelivered notifications.',
    'ResizeObserver loop limit exceeded',
];

/**
 * Runs public/theme-init.js the way the browser does, then dispatches an error
 * event and reports whether a listener registered afterwards (standing in for
 * the dev server's overlay) still saw it.
 */
function dispatchErrorAfterThemeInit(message: string): { reachedLaterListener: boolean; defaultPrevented: boolean } {
    localStorage.clear();
    // jsdom has no media query support; theme-init.js falls back to it when no theme is stored.
    if (!window.matchMedia) {
        Object.assign(window, { matchMedia: () => ({ matches: false, addEventListener() { }, removeEventListener() { } }) });
    }
    // eslint-disable-next-line no-new-func
    new Function(themeInit).call(window);

    let reachedLaterListener = false;
    const overlayListener = () => { reachedLaterListener = true; };
    window.addEventListener('error', overlayListener);

    const event = new ErrorEvent('error', { message, cancelable: true });
    window.dispatchEvent(event);
    window.removeEventListener('error', overlayListener);

    return { reachedLaterListener, defaultPrevented: event.defaultPrevented };
}

describe('ResizeObserver warning suppression', () => {
    test.each(RESIZE_OBSERVER_MESSAGES)('%s never reaches the error overlay', (message) => {
        const { reachedLaterListener, defaultPrevented } = dispatchErrorAfterThemeInit(message);
        expect(reachedLaterListener).toBe(false);
        expect(defaultPrevented).toBe(true);
    });

    test('unrelated runtime errors are still reported', () => {
        const { reachedLaterListener, defaultPrevented } = dispatchErrorAfterThemeInit('TypeError: x is not a function');
        expect(reachedLaterListener).toBe(true);
        expect(defaultPrevented).toBe(false);
    });

    test('theme-init.js still applies the theme before paint', () => {
        dispatchErrorAfterThemeInit('noop');
        expect(document.documentElement.getAttribute('data-bs-theme')).toMatch(/^(dark|light)$/);
    });
});

describe('suppression is registered early enough to work', () => {
    test('the listener lives in theme-init.js, not in the bundle', () => {
        expect(themeInit).toContain('stopImmediatePropagation');
        // In src/index.tsx it would run after the overlay registers its own listener.
        expect(indexTsx).not.toContain('stopImmediatePropagation');
        expect(indexTsx).not.toContain('ResizeObserver loop');
    });

    test('index.html loads theme-init.js before the bundle', () => {
        expect(indexHtml).toContain('theme-init.js');
        // CRA injects the bundle at the end of <body>, so the script has to be
        // in the markup ahead of that closing tag to win the race.
        expect(indexHtml.indexOf('theme-init.js')).toBeLessThan(indexHtml.indexOf('</body>'));
        expect(indexHtml).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/);
    });
});
