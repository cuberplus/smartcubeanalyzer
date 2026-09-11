/**
 * @jest-environment jsdom
 */
/**
 * The version footer is the only thing on the page that tells a user which
 * build they are looking at, so it must render and must match the constant
 * that gets bumped at release time.
 */
import { describe, expect, jest, test } from '@jest/globals';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { APP_VERSION } from '../Helpers/Version';

jest.mock('../Components/FileInput', () => ({ FileInput: () => React.createElement('div') }));
jest.mock('react-ga4', () => ({ __esModule: true, default: { initialize: () => { }, send: () => { } } }));

const App = require('../Components/App').default;

describe('version footer', () => {
    test('is a plain three part version number', () => {
        expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });

    test('renders at the bottom of the page', () => {
        const { container } = render(React.createElement(App));

        expect(screen.getByText(`v${APP_VERSION}`)).toBeTruthy();
        const footer = container.querySelector('footer.app-version');
        expect(footer).toBeTruthy();
        // Last element on the page, so it sits below the charts.
        expect(footer?.parentElement?.lastElementChild).toBe(footer);
    });
});
