/** @jest-environment jsdom */
import React, { useState } from 'react';
import { describe, expect, test } from '@jest/globals';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ChartCard, buildChartHtml } from '../Helpers/ChartHelpers';

function StatefulChart() {
    const [value, setValue] = useState(0);
    return <button type="button" onClick={() => setValue(value + 1)}>Value {value}</button>;
}

describe('experimental chart expansion', () => {
    test('offers a correctly cased desktop-only control on a normal chart', () => {
        render(buildChartHtml(<div>Plot</div>, 'Average Time', 'Your rolling average'));
        const region = screen.getByRole('region', { name: 'Average Time' });
        const expand = within(region).getByRole('button', { name: 'Expand' });
        expect(expand.getAttribute('aria-expanded')).toBe('false');
        expect(expand.classList.contains('d-none')).toBe(true);
        expect(expand.classList.contains('d-md-block')).toBe(true);
        const content = screen.getByRole('group', { name: 'Average Time details' });
        expect(expand.getAttribute('aria-controls')).toBe(content.id);
        expect(content.classList.contains('ratio-4x3')).toBe(true);
        fireEvent.click(expand);
        expect(within(region).getByRole('button', { name: 'Collapse' }).getAttribute('aria-expanded')).toBe('true');
        expect(region.classList.contains('chart-card-expanded')).toBe(true);
        fireEvent.click(within(region).getByRole('button', { name: 'Collapse' }));
        expect(region.classList.contains('chart-card-expanded')).toBe(false);
    });

    test('expands cards independently and preserves interactive chart state', () => {
        render(<>
            <ChartCard title="First"><StatefulChart /></ChartCard>
            <ChartCard title="Second"><div>Another plot</div></ChartCard>
        </>);
        const first = within(screen.getByRole('region', { name: 'First' }));
        const second = within(screen.getByRole('region', { name: 'Second' }));
        expect(first.getByRole('button', { name: 'Expand' }).getAttribute('aria-controls'))
            .not.toBe(second.getByRole('button', { name: 'Expand' }).getAttribute('aria-controls'));
        fireEvent.click(first.getByRole('button', { name: 'Value 0' }));
        fireEvent.click(first.getByRole('button', { name: 'Expand' }));
        expect(first.getByRole('button', { name: 'Value 1' })).toBeTruthy();
        expect(second.getByRole('button', { name: 'Expand' }).getAttribute('aria-expanded')).toBe('false');
        fireEvent.click(first.getByRole('button', { name: 'Collapse' }));
        expect(first.getByRole('button', { name: 'Value 1' })).toBeTruthy();
    });
});
