/**
 * @jest-environment jsdom
 */
/**
 * The OLL and PLL dropdowns hold 58 and 22 cases, so they are presented as collapsible
 * sub-menus. Two things have to hold: the grouping must stay identical to the
 * classification maps the OLL/PLL category charts are built from, and collapsing a group
 * must never quietly change which cases are selected.
 */
import { describe, expect, jest, test } from '@jest/globals';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Const } from '../Helpers/Constants';
import { Option, OptionGroup } from '../Helpers/Types';
import { GroupedMultiSelect } from '../Components/GroupedMultiSelect';

function labelsOf(group: OptionGroup): string[] {
    return group.options.map(option => option.label);
}

function valuesOf(groups: OptionGroup[]): string[] {
    return groups.flatMap(group => group.options).map(option => option.value);
}

describe('OLL and PLL sub-menu grouping', () => {
    test('PLL groups are ordered by how scrambled the corners are', () => {
        expect(Const.PllGroups.map(group => group.label)).toEqual([
            'Corners Swapped Adjacent',
            'Corners Swapped Diagonally',
            'Corners Solved'
        ]);
    });

    test('OLL groups are ordered by edge orientation shape', () => {
        expect(Const.OllGroups.map(group => group.label)).toEqual([
            'Dot Cases',
            'Line Cases',
            'Angle Cases',
            'Cross Cases'
        ]);
    });

    test('every PLL case is placed in exactly one group', () => {
        const grouped = valuesOf(Const.PllGroups);

        expect(grouped.slice().sort()).toEqual(Const.PllCases.map(c => c.value).sort());
        expect(new Set(grouped).size).toBe(grouped.length);
    });

    test('every OLL case is placed in exactly one group', () => {
        const grouped = valuesOf(Const.OllGroups);

        expect(grouped.slice().sort()).toEqual(Const.OllCases.map(c => c.value).sort());
        expect(new Set(grouped).size).toBe(grouped.length);
    });

    test('PLL group membership matches the corner permutation map behind the charts', () => {
        const expected = new Map([
            ['Corners Swapped Adjacent', 'Adjacent'],
            ['Corners Swapped Diagonally', 'Diagonal'],
            ['Corners Solved', 'Solved']
        ]);

        for (const group of Const.PllGroups) {
            for (const option of group.options) {
                expect(Const.PllCornerPermutationMapping.get(option.value)).toBe(expected.get(group.label));
            }
        }
    });

    test('OLL group membership matches the edge orientation map behind the charts', () => {
        const expected = new Map([
            ['Dot Cases', 'Dot'],
            ['Line Cases', 'Line'],
            ['Angle Cases', 'Angle'],
            ['Cross Cases', 'Cross']
        ]);

        for (const group of Const.OllGroups) {
            for (const option of group.options) {
                expect(Const.OllEdgeOrientationMapping.get(option.value)).toBe(expected.get(group.label));
            }
        }
    });

    test('the well known PLL cases land where a cuber would look for them', () => {
        const [adjacent, diagonal, solved] = Const.PllGroups;

        // A diagonal swap is the pair of corners on opposite ends of the layer.
        expect(labelsOf(diagonal)).toEqual(expect.arrayContaining(['V Perm', 'Y Perm', 'Na Perm', 'Nb Perm', 'E Perm']));
        // The edge-only perms leave every corner in place.
        expect(labelsOf(solved)).toEqual(expect.arrayContaining(['Ua Perm', 'Ub Perm', 'H Perm', 'Z Perm']));
        expect(labelsOf(adjacent)).toEqual(expect.arrayContaining(['T Perm', 'Aa Perm', 'Ja Perm', 'F Perm']));
        // No case should be claimed by two groups.
        expect(labelsOf(adjacent)).not.toEqual(expect.arrayContaining(['Y Perm']));
    });

    test('the well known OLL cases land where a cuber would look for them', () => {
        const [dot, , , cross] = Const.OllGroups;

        // No edges oriented.
        expect(labelsOf(dot)).toEqual(expect.arrayContaining(['1', '2', '3', '4', '17', '18', '19', '20']));
        expect(dot.options).toHaveLength(8);
        // OLL 21-27 are the cases that already show a cross on top.
        expect(labelsOf(cross)).toEqual(expect.arrayContaining(['21', '22', '23', '24', '25', '26', '27']));
    });
});

describe('GroupedMultiSelect', () => {
    const groups: OptionGroup[] = [
        { label: 'First', options: [{ label: 'Alpha', value: 'a' }, { label: 'Beta', value: 'b' }] },
        { label: 'Second', options: [{ label: 'Gamma', value: 'g' }] }
    ];

    function open(value: Option[] = []): { onChange: jest.Mock<(selected: Option[]) => void> } {
        const onChange = jest.fn<(selected: Option[]) => void>();
        const { container } = render(
            <GroupedMultiSelect groups={groups} value={value} onChange={onChange} labelledBy="Cases" />
        );

        const heading = container.querySelector('.dropdown-heading');
        fireEvent.click(heading as Element);
        return { onChange };
    }

    test('shows only the group headers until one is expanded', () => {
        open();

        expect(screen.getByRole('button', { name: /First/ })).toBeTruthy();
        expect(screen.getByRole('button', { name: /Second/ })).toBeTruthy();
        expect(screen.queryByText('Alpha')).toBeNull();
        expect(screen.queryByText('Gamma')).toBeNull();
    });

    test('headers report how many of their cases are selected', () => {
        open([{ label: 'Alpha', value: 'a' }]);

        expect(screen.getByRole('button', { name: /First \(1\/2\)/ })).toBeTruthy();
        expect(screen.getByRole('button', { name: /Second \(0\/1\)/ })).toBeTruthy();
    });

    test('expanding a group reveals its cases, and collapsing hides them again', async () => {
        open();
        const header = screen.getByRole('button', { name: /First/ });
        expect(header.getAttribute('aria-expanded')).toBe('false');

        fireEvent.click(header);

        expect(header.getAttribute('aria-expanded')).toBe('true');
        await waitFor(() => expect(screen.getByText('Alpha')).toBeTruthy());
        expect(screen.getByText('Beta')).toBeTruthy();
        // Expanding one group leaves the others alone.
        expect(screen.queryByText('Gamma')).toBeNull();

        fireEvent.click(header);

        await waitFor(() => expect(screen.queryByText('Alpha')).toBeNull());
    });

    test('ticking a case inside a sub-menu adds just that case', async () => {
        const { onChange } = open();
        fireEvent.click(screen.getByRole('button', { name: /First/ }));

        fireEvent.click(await screen.findByRole('checkbox', { name: 'Alpha' }));

        expect(onChange).toHaveBeenCalledWith([{ label: 'Alpha', value: 'a' }]);
    });

    test('a header checkbox selects its whole group at once', () => {
        const { onChange } = open();

        fireEvent.click(screen.getByRole('checkbox', { name: 'Select all First' }));

        expect(onChange).toHaveBeenCalledWith(groups[0].options);
    });

    test('selecting a group keeps cases that are hidden inside other collapsed groups', () => {
        const { onChange } = open([{ label: 'Gamma', value: 'g' }]);

        fireEvent.click(screen.getByRole('checkbox', { name: 'Select all First' }));

        expect(onChange).toHaveBeenCalledWith([
            { label: 'Gamma', value: 'g' },
            { label: 'Alpha', value: 'a' },
            { label: 'Beta', value: 'b' }
        ]);
    });

    test('unticking a fully selected group clears only that group', () => {
        const { onChange } = open([
            { label: 'Alpha', value: 'a' },
            { label: 'Beta', value: 'b' },
            { label: 'Gamma', value: 'g' }
        ]);

        fireEvent.click(screen.getByRole('checkbox', { name: 'Select all First' }));

        expect(onChange).toHaveBeenCalledWith([{ label: 'Gamma', value: 'g' }]);
    });

    test('a partly selected group shows an indeterminate checkbox', () => {
        open([{ label: 'Alpha', value: 'a' }]);

        const partial = screen.getByRole('checkbox', { name: 'Select all First' }) as HTMLInputElement;
        const untouched = screen.getByRole('checkbox', { name: 'Select all Second' }) as HTMLInputElement;

        expect(partial.indeterminate).toBe(true);
        expect(partial.checked).toBe(false);
        expect(untouched.indeterminate).toBe(false);
    });

    test('searching finds cases sitting inside collapsed groups', async () => {
        const { container } = render(
            <GroupedMultiSelect groups={groups} value={[]} onChange={() => { }} labelledBy="Cases" />
        );
        fireEvent.click(container.querySelector('.dropdown-heading') as Element);
        expect(screen.queryByText('Gamma')).toBeNull();

        fireEvent.change(container.querySelector('.rmsc .search input') as Element, { target: { value: 'gam' } });

        await waitFor(() => expect(screen.getByText('Gamma')).toBeTruthy());
        // Only matches are listed, and group headers step out of the way.
        expect(screen.queryByText('Alpha')).toBeNull();
        expect(screen.queryByRole('button', { name: /First/ })).toBeNull();
    });

    test('summarises a fully selected dropdown instead of listing every case', () => {
        const { container } = render(
            <GroupedMultiSelect
                groups={Const.PllGroups}
                value={Const.PllCases}
                onChange={() => { }}
                labelledBy="PLL Cases"
            />
        );

        // The header rows inflate the option count, so this only works if the count ignores them.
        expect(container.querySelector('.dropdown-heading-value')?.textContent).toBe('All items are selected.');
    });

    test('lists the chosen cases when only some are selected', () => {
        const { container } = render(
            <GroupedMultiSelect
                groups={groups}
                value={[{ label: 'Alpha', value: 'a' }]}
                onChange={() => { }}
                labelledBy="Cases"
            />
        );

        expect(container.querySelector('.dropdown-heading-value')?.textContent).toBe('Alpha');
    });
});
