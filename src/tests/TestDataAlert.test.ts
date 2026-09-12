/** @jest-environment jsdom */
/**
 * The test-data warning is only useful the first time. Once a user closes it,
 * the dismissal is remembered in localStorage - the same storage the light/dark
 * toggle uses - so reloading or re-loading the demo data does not bring it back.
 * The dismissal is recorded against the version that was current at the time, so
 * each new release announces itself once more.
 */
import { beforeEach, describe, expect, test } from '@jest/globals';
import { FilterPanel } from '../Components/FilterPanel';
import { FilterPanelProps, FilterPanelState } from '../Helpers/Types';
import { APP_VERSION } from '../Helpers/Version';

const TEST_ALERT_KEY = 'testAlertDismissed';

/** A real panel with React's async setState swapped for a synchronous one, so handlers run without a DOM. */
function newPanel(props: FilterPanelProps = { solves: [] }): FilterPanel {
    const panel = new FilterPanel(props);
    const setState = (update: Partial<FilterPanelState>) => Object.assign(panel, { state: { ...panel.state, ...update } });
    Object.assign(panel, { setState });
    return panel;
}

/** Runs the props-to-state step the way React would when the demo data arrives. */
function applyProps(showTestAlert: boolean): FilterPanelState {
    const props: FilterPanelProps = { solves: [], showTestAlert };
    return FilterPanel.getDerivedStateFromProps(props, newPanel().state) as FilterPanelState;
}

describe('test data warning', () => {
    beforeEach(() => localStorage.clear());

    test('shows the first time the demo data is loaded', () => {
        expect(applyProps(true).showTestAlert).toBe(true);
    });

    test('closing it records the dismissal against the running version', () => {
        const panel = newPanel();

        panel.hideAlert();

        expect(panel.state.showTestAlert).toBe(false);
        expect(localStorage.getItem(TEST_ALERT_KEY)).toBe(APP_VERSION);
    });

    test('stays closed the next time the demo data is loaded', () => {
        newPanel().hideAlert();

        expect(applyProps(true).showTestAlert).toBe(false);
    });

    test('comes back once the site is updated to a newer version', () => {
        localStorage.setItem(TEST_ALERT_KEY, '0.0.1');

        expect(applyProps(true).showTestAlert).toBe(true);
    });

    test('and can be dismissed again on the new version', () => {
        localStorage.setItem(TEST_ALERT_KEY, '0.0.1');

        newPanel().hideAlert();

        expect(localStorage.getItem(TEST_ALERT_KEY)).toBe(APP_VERSION);
        expect(applyProps(true).showTestAlert).toBe(false);
    });

    test('is not shown for a user uploading their own solves, dismissed or not', () => {
        expect(applyProps(false).showTestAlert).toBe(false);
        newPanel().hideAlert();
        expect(applyProps(false).showTestAlert).toBe(false);
    });

    test('an unrecognised stored value does not count as dismissed', () => {
        localStorage.setItem(TEST_ALERT_KEY, 'true');

        expect(applyProps(true).showTestAlert).toBe(true);
    });
});
