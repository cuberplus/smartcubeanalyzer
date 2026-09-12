import { ChangeEvent, createContext, useContext, useMemo, useState } from "react";
import { MultiSelect } from "react-multi-select-component";
import { Option, OptionGroup } from "../Helpers/Types";

/** Prefixed onto header rows so they can be told apart from real, selectable cases. */
const GroupPrefix = "group:";

interface GroupedMultiSelectProps {
    groups: OptionGroup[];
    value: Option[];
    onChange: (selected: Option[]) => void;
    labelledBy: string;
}

/** The props react-multi-select-component hands to a custom ItemRenderer. */
interface ItemRendererProps {
    option: Option;
    checked: boolean;
    onClick: (event: ChangeEvent<HTMLInputElement>) => void;
}

interface GroupState {
    groups: OptionGroup[];
    chosen: Set<string>;
    expanded: string[];
    toggleExpanded: (label: string) => void;
    toggleGroup: (group: OptionGroup) => void;
}

const GroupedContext = createContext<GroupState | null>(null);

/**
 * Draws a single row. This has to be a stable module-level component: the library takes
 * ItemRenderer as a component type, so an inline closure would be a new type on every
 * render and React would tear down and rebuild every row. Per-render data therefore
 * arrives through context instead of props.
 */
function GroupedItem({ option, checked, onClick }: ItemRendererProps): JSX.Element {
    const state = useContext(GroupedContext);
    const group = state?.groups.find(candidate => GroupPrefix + candidate.label === option.value);

    if (state === null || group === undefined) {
        return (
            <div className="item-renderer">
                <input type="checkbox" onChange={onClick} checked={checked} tabIndex={-1} />
                <span>{option.label}</span>
            </div>
        );
    }

    const picked = group.options.filter(entry => state.chosen.has(entry.value)).length;
    const isExpanded = state.expanded.includes(group.label);
    return (
        <div className="item-renderer group-header">
            <input
                type="checkbox"
                aria-label={`Select all ${group.label}`}
                checked={picked === group.options.length}
                ref={input => { if (input !== null) input.indeterminate = picked > 0 && picked < group.options.length; }}
                onChange={() => state.toggleGroup(group)}
                tabIndex={-1}
            />
            <button
                type="button"
                className="group-toggle"
                aria-expanded={isExpanded}
                onClick={event => { event.preventDefault(); state.toggleExpanded(group.label); }}
            >
                <span className="group-caret">{isExpanded ? "\u25BE" : "\u25B8"}</span> {option.label}
            </button>
        </div>
    );
}

/**
 * A multi-select whose options are collapsed into expandable sub-menus.
 *
 * The underlying library has no concept of groups, so headers are injected as disabled
 * options and a custom ItemRenderer draws them. Collapsed groups are dropped from the
 * option list entirely; that is safe because selections are only ever toggled one item at
 * a time, so a hidden case keeps whatever state it already had. The library's own
 * "Select All" is turned off precisely because it *would* rewrite the whole list from the
 * visible subset, silently discarding those hidden selections - each header carries its
 * own tri-state checkbox instead.
 */
export function GroupedMultiSelect({ groups, value, onChange, labelledBy }: GroupedMultiSelectProps): JSX.Element {
    const [expanded, setExpanded] = useState<string[]>([]);
    const chosen = useMemo(() => new Set(value.map(option => option.value)), [value]);
    const allCases = useMemo(() => groups.flatMap(group => group.options), [groups]);

    const options = useMemo(() => groups.flatMap(group => {
        const picked = group.options.filter(option => chosen.has(option.value)).length;
        const header: Option = {
            value: GroupPrefix + group.label,
            label: `${group.label} (${picked}/${group.options.length})`,
            disabled: true
        };
        return expanded.includes(group.label) ? [header, ...group.options] : [header];
    }), [groups, chosen, expanded]);

    const state: GroupState = {
        groups,
        chosen,
        expanded,
        toggleExpanded: label => setExpanded(previous =>
            previous.includes(label) ? previous.filter(entry => entry !== label) : [...previous, label]),
        toggleGroup: group => {
            const inGroup = new Set(group.options.map(option => option.value));
            const untouched = value.filter(option => !inGroup.has(option.value));
            const allPicked = group.options.every(option => chosen.has(option.value));
            onChange(allPicked ? untouched : [...untouched, ...group.options]);
        }
    };

    // Searching looks through every case, including those inside collapsed groups.
    const filterOptions = (visible: Option[], filter: string): Option[] => filter === ""
        ? visible
        : allCases.filter(option => option.label.toLowerCase().includes(filter.toLowerCase()));

    // Headers inflate the option count, so the "all selected" summary has to be worked out here.
    const valueRenderer = (selected: Option[]): string => selected.length > 0 && selected.length === allCases.length
        ? "All items are selected."
        : selected.map(option => option.label).join(", ");

    return (
        <GroupedContext.Provider value={state}>
            <MultiSelect
                options={options}
                value={value}
                onChange={onChange}
                labelledBy={labelledBy}
                hasSelectAll={false}
                ItemRenderer={GroupedItem}
                filterOptions={filterOptions}
                valueRenderer={valueRenderer}
            />
        </GroupedContext.Provider>
    );
}
