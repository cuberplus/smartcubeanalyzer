import React from "react";
import { createPortal } from "react-dom";
import moment from "moment";
import DatePicker from "react-datepicker";
import Select from "react-select";
import { MultiSelect } from "react-multi-select-component";
import { CrossColor, FilterPanelProps, FilterPanelState, Filters, getStep, KeysOfType, MethodName, Option, OptionGroup, Solve, SolveCleanliness, SolveLuckiness, Step, StepName } from "../Helpers/Types";
import { ChartPanel } from "./ChartPanel";
import { GroupedMultiSelect } from "./GroupedMultiSelect";
import { calculateMovingAverage, calculateMovingStdDev } from "../Helpers/MathHelpers";
import { FormControl, Card, Row, Offcanvas, Col, Button, Tooltip, OverlayTrigger, Alert, Container, CardText, Spinner } from 'react-bootstrap';
import { Const } from "../Helpers/Constants";
import { CalculateAllSessionOptions, CalculateBenchmarkTimes, CalculateWindowSize } from "../Helpers/CubeHelpers";
import ReactSwitch from "react-switch";

/** react-bootstrap's FormControl accepts input, select and textarea events, so borrow its own handler type. */
type FormControlChangeHandler = NonNullable<React.ComponentProps<typeof FormControl>['onChange']>;

function defaultDateRange(): Pick<Filters, 'startDate' | 'endDate'> {
    return {
        startDate: moment().subtract(5, 'years').startOf('day').toDate(),
        endDate: moment().endOf('day').toDate(),
    };
}

function datePickerFormat(): string {
    if (typeof navigator !== 'undefined' && /^en-US$/i.test(navigator.language ?? '')) {
        return 'MM/dd/yyyy';
    }
    return 'dd/MM/yyyy';
}

export class FilterPanel extends React.Component<FilterPanelProps, FilterPanelState> {
    state: FilterPanelState = {
        allSolves: [],
        filteredSolves: [],
        compressedSolves: [],
        lastAppliedSolves: [],
        lastAppliedFilters: null,
        lastAppliedWindowSize: Const.DefaultWindowSize,
        filters: {
            sources: ['cubeast', 'acubemy'],
            ...defaultDateRange(),
            fastestTime: 0,
            slowestTime: 300,
            crossColors: [CrossColor.White, CrossColor.Yellow, CrossColor.Blue, CrossColor.Green, CrossColor.Orange, CrossColor.Red, CrossColor.Unknown],
            pllCases: Const.PllCases.map(x => x.value),
            ollCases: Const.OllCases.map(x => x.value),
            steps: [StepName.Cross, StepName.F2L_1, StepName.F2L_2, StepName.F2L_3, StepName.F2L_4, StepName.OLL, StepName.PLL],
            solveCleanliness: Const.solveCleanliness.map(x => x.value),
            solveLuckiness: Const.solveLuckiness.map(x => x.value),
            method: MethodName.CFOP,
            sessions: [],
            lowestInspection: 0,
            highestInspection: 300
        },
        chosenSteps: FilterPanel.getStepOptionsForMethod(MethodName.CFOP),
        chosenColors: [
            { label: CrossColor.White, value: CrossColor.White },
            { label: CrossColor.Yellow, value: CrossColor.Yellow },
            { label: CrossColor.Red, value: CrossColor.Red },
            { label: CrossColor.Orange, value: CrossColor.Orange },
            { label: CrossColor.Blue, value: CrossColor.Blue },
            { label: CrossColor.Green, value: CrossColor.Green },
            { label: CrossColor.Unknown, value: CrossColor.Unknown },
        ],
        chosenSessions: [],
        chosenSources: [
            { label: 'Cubeast', value: 'cubeast' },
            { label: 'Acubemy', value: 'acubemy' }
        ],
        solveCleanliness: Const.solveCleanliness,
        solveLuckiness: Const.solveLuckiness,
        chosenPLLs: Const.PllCases,
        chosenOLLs: Const.OllCases,
        tabKey: 1,
        autoWindowSize: true,
        autoBenchmarks: true,
        windowSize: Const.DefaultWindowSize,
        pointsPerGraph: 100,
        showFilters: false,
        showTestAlert: false,
        badTime: 20,
        goodTime: 15,
        method: { label: MethodName.CFOP, value: MethodName.CFOP },
        useLogScale: false,
        use4SegmentTiming: false
    }

    static passesFilters(solve: Solve, filters: Filters) {
        if (solve.isCorrupt) {
            return false;
        }
        if (solve.method != filters.method) {
            return false;
        }
        if (filters.sources.indexOf(solve.source) < 0) {
            return false;
        }
        if (filters.crossColors.indexOf(solve.crossColor) < 0) {
            return false;
        }
        if (solve.date < filters.startDate || solve.date > filters.endDate) {
            return false;
        }
        if (solve.time < filters.fastestTime || solve.time > filters.slowestTime) {
            return false;
        }
        // Acubemy exports may not report inspection time. Those solves should not be excluded by inspection filters.
        if (solve.inspectionTime != null) {
            if (solve.inspectionTime < filters.lowestInspection || solve.inspectionTime > filters.highestInspection) {
                return false;
            }
        }
        // Only filter by session when the solve has a session set; avoids excluding rows where session wasn't parsed (e.g. CSV column alignment).
        if (filters.sessions.length > 0 && (solve.session !== '' && solve.session != null) && filters.sessions.indexOf(solve.session) < 0) {
            return false;
        }

        // TODO: check case logic properly
        const pllStep = getStep(solve, StepName.PLL);
        if (solve.method == MethodName.CFOP && pllStep?.case !== undefined && filters.pllCases.indexOf(pllStep.case) < 0) {
            return false;
        }
        const ollStep = getStep(solve, StepName.OLL);
        if (solve.method == MethodName.CFOP && ollStep?.case !== undefined && filters.ollCases.indexOf(ollStep.case) < 0) {
            return false;
        }

        // If total time or any step is 3 standard deviations away, remove it
        if (filters.solveCleanliness.indexOf(SolveCleanliness.Clean) < 0 && !solve.isMistake) {
            return false;
        }
        if (filters.solveCleanliness.indexOf(SolveCleanliness.Mistake) < 0 && solve.isMistake) {
            return false;
        }

        if (filters.solveLuckiness.indexOf(SolveLuckiness.FullStep) < 0 && solve.isFullStep) {
            return false;
        }
        if (filters.solveLuckiness.indexOf(SolveLuckiness.Skip) < 0 && !solve.isFullStep) {
            return false;
        }

        return true;
    }

    static getMistakeMap(values: number[], windowSize: number): boolean[] {
        let average = calculateMovingAverage(values, windowSize);
        let stdDev = calculateMovingStdDev(values, windowSize);

        let mistakes: boolean[] = [];

        for (let i = 0; i < values.length; i++) {
            let index = Math.max(0, i - windowSize);
            let isMistake = values[i] > (average[index] + (3 * stdDev[index]));
            mistakes.push(isMistake);
        }

        return mistakes;
    }

    // For each step, check if it is 3 standard deviations more than the average
    static markAllMistakes(allSolves: Solve[], windowSize: number): Solve[] {
        if (allSolves.length == 0) {
            return [];
        }

        let mistakes: boolean[][] = [];

        mistakes.push(this.getMistakeMap(allSolves.map(x => x.time), windowSize));
        allSolves[0].steps.forEach(({ name }, i) => {
            // Steps are usually in the same slot in every solve, so check that slot before scanning.
            const times = allSolves.map(x => (x.steps[i]?.name === name ? x.steps[i] : x.steps.find(s => s.name === name))?.time ?? 0);
            mistakes.push(this.getMistakeMap(times, windowSize));
        });

        let newSolves: Solve[] = [];

        for (let i = 0; i < allSolves.length; i++) {
            newSolves.push(allSolves[i]);
            newSolves[i].isMistake = false;
            for (let j = 0; j < mistakes.length; j++) {
                if (mistakes[j][i]) {
                    newSolves[i].isMistake = true;
                    continue;
                }
            }
        }

        return newSolves;
    }

    static markAllLuckiness(allSolves: Solve[]): Solve[] {
        let newSolves: Solve[] = [];

        for (let i = 0; i < allSolves.length; i++) {
            newSolves.push(allSolves[i]);
            let numSteps = Const.MethodSteps[newSolves[i].method].length;
            for (let j = 0; j < numSteps; j++) {
                if (newSolves[i].steps[j].executionTime === 0) {
                    newSolves[i].isFullStep = false;
                    break;
                }
            }
        }

        return newSolves;
    }

    static applyFiltersToSolves(allSolves: Solve[], filters: Filters, windowSize: number): Solve[] {
        let solvesWithMistakesMarked = this.markAllMistakes(allSolves, windowSize);
        let solvesWithLuckinessMarked = this.markAllLuckiness(solvesWithMistakesMarked);

        let filteredSolves: Solve[] = [];
        solvesWithLuckinessMarked.forEach(x => {
            if (this.passesFilters(x, filters)) {
                filteredSolves.push(x);
            }
        })

        return filteredSolves;
    }

    static compressSolves(solves: Solve[], steps: StepName[]): Solve[] {
        let newSolves: Solve[] = [];

        solves.forEach((solve) => {
            let newSteps: Step[] = solve.steps.filter((x) => steps.find((y) => y === x.name));

            const stepExecutionTime = newSteps.reduce((sum, current) => sum + current.executionTime, 0);
            const stepRecognitionTime = newSteps.reduce((sum, current) => sum + current.recognitionTime, 0);
            const stepPreAufTime = newSteps.reduce((sum, current) => sum + current.preAufTime, 0);
            const stepPostAufTime = newSteps.reduce((sum, current) => sum + current.postAufTime, 0);
            const stepTime = newSteps.reduce((sum, current) => sum + current.time, 0);
            const stepTurns = newSteps.reduce((sum, current) => sum + current.turns, 0);

            const turns = stepTurns > 0 ? stepTurns : solve.turns;

            let tps: number;
            if (stepTime > 0 && turns > 0) {
                tps = turns / stepTime;
            } else {
                tps = solve.tps;
            }

            let newSolve: Solve = {
                id: solve.id,
                source: solve.source,
                rawSourceId: solve.rawSourceId,
                rawSource: solve.rawSource,
                time: stepTime,
                date: solve.date,
                crossColor: solve.crossColor,
                scramble: solve.scramble,
                tps: tps,
                inspectionTime: solve.inspectionTime,
                recognitionTime: stepRecognitionTime,
                executionTime: stepExecutionTime,
                preAufTime: stepPreAufTime,
                postAufTime: stepPostAufTime,
                turns: turns,
                steps: newSteps,
                isCorrupt: solve.isCorrupt,
                method: solve.method,
                session: solve.session,
                isMistake: solve.isMistake,
                isFullStep: solve.isFullStep
            };

            newSolves.push(newSolve);
        });

        return newSolves;
    }

    static getDerivedStateFromProps(nextProps: FilterPanelProps, prevState: FilterPanelState) {
        const inputsUnchanged =
            nextProps.solves === prevState.lastAppliedSolves &&
            prevState.filters === prevState.lastAppliedFilters &&
            prevState.windowSize === prevState.lastAppliedWindowSize;

        if (inputsUnchanged) {
            return {
                allSolves: nextProps.solves,
                filteredSolves: prevState.filteredSolves,
                compressedSolves: prevState.compressedSolves,
                lastAppliedSolves: prevState.lastAppliedSolves,
                lastAppliedFilters: prevState.lastAppliedFilters,
                lastAppliedWindowSize: prevState.lastAppliedWindowSize,
                method: prevState.method,
                chosenSteps: prevState.chosenSteps,
                filters: prevState.filters,
                chosenColors: prevState.chosenColors,
                chosenPLLs: prevState.chosenPLLs,
                chosenOLLs: prevState.chosenOLLs,
                chosenSessions: prevState.chosenSessions,
                chosenSources: prevState.chosenSources,
                tabKey: prevState.tabKey,
                autoWindowSize: prevState.autoWindowSize,
                autoBenchmarks: prevState.autoBenchmarks,
                windowSize: prevState.windowSize,
                pointsPerGraph: prevState.pointsPerGraph,
                showFilters: prevState.showFilters,
                showTestAlert: prevState.showTestAlert,
                solveCleanliness: prevState.solveCleanliness,
                solveLuckiness: prevState.solveLuckiness,
                badTime: prevState.badTime,
                goodTime: prevState.goodTime,
                useLogScale: prevState.useLogScale,
                use4SegmentTiming: prevState.use4SegmentTiming
            };
        }

        let newState: FilterPanelState = {
            // Assume all props stay the same
            allSolves: prevState.allSolves,
            filteredSolves: prevState.filteredSolves,
            compressedSolves: prevState.compressedSolves,
            lastAppliedSolves: prevState.lastAppliedSolves,
            lastAppliedFilters: prevState.lastAppliedFilters,
            lastAppliedWindowSize: prevState.lastAppliedWindowSize,
            method: prevState.method,
            chosenSteps: prevState.chosenSteps,
            filters: prevState.filters,
            chosenColors: prevState.chosenColors,
            chosenPLLs: prevState.chosenPLLs,
            chosenOLLs: prevState.chosenOLLs,
            chosenSessions: prevState.chosenSessions,
            chosenSources: prevState.chosenSources,
            tabKey: prevState.tabKey,
            autoWindowSize: prevState.autoWindowSize,
            autoBenchmarks: prevState.autoBenchmarks,
            windowSize: prevState.windowSize,
            pointsPerGraph: prevState.pointsPerGraph,
            showFilters: prevState.showFilters,
            showTestAlert: prevState.showTestAlert,
            solveCleanliness: prevState.solveCleanliness,
            solveLuckiness: prevState.solveLuckiness,
            badTime: prevState.badTime,
            goodTime: prevState.goodTime,
            useLogScale: prevState.useLogScale,
            use4SegmentTiming: prevState.use4SegmentTiming
        }

        // Update anything that needs it
        newState.allSolves = nextProps.solves;
        const solvesChanged = nextProps.solves !== prevState.lastAppliedSolves;
        if (solvesChanged) {
            if (nextProps.suggestedMethod !== undefined) {
                const method = nextProps.suggestedMethod.value as MethodName;
                newState.method = nextProps.suggestedMethod;
                newState.filters = { ...newState.filters, method, steps: Const.MethodSteps[method] };
                newState.chosenSteps = FilterPanel.getStepOptionsForMethod(method);
            }
            if (nextProps.suggestedSessions !== undefined) {
                newState.chosenSessions = nextProps.suggestedSessions;
                newState.filters = { ...newState.filters, sessions: nextProps.suggestedSessions.map(x => x.value) };
            }
            if (nextProps.suggestedWindowSize !== undefined) {
                newState.windowSize = nextProps.suggestedWindowSize;
            }
            if (nextProps.showTestAlert !== undefined) {
                newState.showTestAlert = nextProps.showTestAlert;
            }
        }
        if (newState.autoWindowSize) {
            const firstPass = FilterPanel.applyFiltersToSolves(nextProps.solves, newState.filters, newState.windowSize);
            newState.windowSize = CalculateWindowSize(firstPass.length);
        } else if (!Number.isFinite(newState.windowSize) || newState.windowSize < 5) {
            newState.windowSize = 5;
        }
        newState.filteredSolves = FilterPanel.applyFiltersToSolves(nextProps.solves, newState.filters, newState.windowSize);
        if (newState.autoBenchmarks) {
            const bench = CalculateBenchmarkTimes(newState.filteredSolves);
            newState.goodTime = bench.goodTime;
            newState.badTime = bench.badTime;
        }
        newState.compressedSolves = FilterPanel.compressSolves(newState.filteredSolves, newState.filters.steps);
        newState.lastAppliedSolves = nextProps.solves;
        newState.lastAppliedFilters = newState.filters;
        newState.lastAppliedWindowSize = newState.windowSize;
        return newState;
    }

    /** Multi-selects all behave the same: raw options in state, their values in filters. */
    setMulti(filterKey: keyof Filters, stateKey: keyof FilterPanelState, selectedList: Option[]) {
        this.setState(prev => {
            const filters: Filters = { ...prev.filters, [filterKey]: selectedList.map(x => x.value) };
            return { ...prev, filters, [stateKey]: selectedList };
        });
    }

    setFilter<K extends keyof Filters>(filterKey: K, value: Filters[K]) {
        this.setState(prev => {
            const filters: Filters = { ...prev.filters, [filterKey]: value };
            return { ...prev, filters };
        });
    }

    setNumberFilter(filterKey: KeysOfType<Filters, number>, event: React.ChangeEvent<HTMLInputElement>) {
        this.setFilter(filterKey, parseInt(event.target.value));
    }

    setField<K extends keyof FilterPanelState>(stateKey: K, value: FilterPanelState[K]) {
        this.setState(prev => ({ ...prev, [stateKey]: value }));
    }

    setNumberField(stateKey: KeysOfType<FilterPanelState, number>, event: React.ChangeEvent<HTMLInputElement>) {
        this.setField(stateKey, parseInt(event.target.value));
    }

    crossColorsChanged(selectedList: Option[]) { this.setMulti('crossColors', 'chosenColors', selectedList); }

    chosenSessionsChanged(selectedList: Option[]) { this.setMulti('sessions', 'chosenSessions', selectedList); }

    sourcesChanged(selectedList: Option[]) { this.setMulti('sources', 'chosenSources', selectedList); }

    pllChanged(selectedList: Option[]) { this.setMulti('pllCases', 'chosenPLLs', selectedList); }

    ollChanged(selectedList: Option[]) { this.setMulti('ollCases', 'chosenOLLs', selectedList); }

    setCleanliness(selectedList: Option[]) { this.setMulti('solveCleanliness', 'solveCleanliness', selectedList); }

    setLuckiness(selectedList: Option[]) { this.setMulti('solveLuckiness', 'solveLuckiness', selectedList); }

    windowSizeChanged(newWindowSize: number) {
        this.setState({
            windowSize: newWindowSize
        })
    }

    chosenStepsChanged(selectedList: Option<StepName>[]) {
        let selectedSteps: StepName[] = selectedList.map(x => x.value);
        let allSteps = Const.MethodSteps[this.state.filters.method];

        // Sort the steps to match the order in the method
        let sortOrder = Object.fromEntries(allSteps.map((k, i) => [k, i + 1]));
        selectedSteps.sort((a, b) =>
            (sortOrder[a] || Number.MAX_VALUE) - (sortOrder[b] || Number.MAX_VALUE)
        );

        this.setState({
            filters: { ...this.state.filters, steps: selectedSteps },
            chosenSteps: selectedList
        })
    }

    static toOptions<T extends string>(values: readonly T[]): Option<T>[] {
        return values.map(x => ({ label: x, value: x }));
    }

    static getStepOptionsForMethod(method: MethodName) {
        return FilterPanel.toOptions(Const.MethodSteps[method]);
    }

    getMethodOptions(): Option<MethodName>[] {
        return FilterPanel.toOptions(Object.values(MethodName));
    }

    getSessionOptions() {
        return CalculateAllSessionOptions(this.props.solves);
    }

    methodChanged(newValue: Option<MethodName> | null) {
        if (!newValue) return;
        const newMethod = newValue.value;
        this.setState({
            method: newValue,
            filters: { ...this.state.filters, method: newMethod, steps: Const.MethodSteps[newMethod] },
            chosenSteps: FilterPanel.getStepOptionsForMethod(newMethod)
        });
        this.props.onMethodChange?.(newMethod);
    }

    applyStepsPreset(steps: StepName[]) {
        this.setState({
            filters: { ...this.state.filters, steps },
            chosenSteps: FilterPanel.toOptions(steps),
        });
    }

    setStartDate(newStartDate: Date) { this.setFilter('startDate', newStartDate); }

    setEndDate(newEndDate: Date) { this.setFilter('endDate', newEndDate); }

    setSlowestSolve(event: React.ChangeEvent<HTMLInputElement>) { this.setNumberFilter('slowestTime', event); }

    setFastestSolve(event: React.ChangeEvent<HTMLInputElement>) { this.setNumberFilter('fastestTime', event); }

    setLowestInspection(event: React.ChangeEvent<HTMLInputElement>) { this.setNumberFilter('lowestInspection', event); }

    setHighestInspection(event: React.ChangeEvent<HTMLInputElement>) { this.setNumberFilter('highestInspection', event); }

    setBadTime(event: React.ChangeEvent<HTMLInputElement>) { this.setNumberField('badTime', event); }

    setGoodTime(event: React.ChangeEvent<HTMLInputElement>) { this.setNumberField('goodTime', event); }

    setWindowSize(event: React.ChangeEvent<HTMLInputElement>) {
        const parsedWindowSize = parseInt(event.target.value);
        this.setState({
            windowSize: Number.isFinite(parsedWindowSize) ? Math.max(5, parsedWindowSize) : 5
        })
    }

    setAutoWindowSize(checked: boolean) {
        this.setState((prevState) => {
            if (!checked) {
                return { autoWindowSize: false, windowSize: prevState.windowSize };
            }

            return {
                autoWindowSize: true,
                windowSize: CalculateWindowSize(prevState.filteredSolves.length)
            };
        });
    }

    setAutoBenchmarks(checked: boolean) {
        if (!checked) {
            this.setState({ autoBenchmarks: false });
            return;
        }

        const baseSolves = this.state.filteredSolves.length > 0 ? this.state.filteredSolves : this.state.allSolves;
        const bench = CalculateBenchmarkTimes(baseSolves);
        this.setState({
            autoBenchmarks: true,
            goodTime: bench.goodTime,
            badTime: bench.badTime
        });
    }

    setPointsPerGraph(event: React.ChangeEvent<HTMLInputElement>) { this.setNumberField('pointsPerGraph', event); }

    setUseLogScale(checked: boolean) { this.setField('useLogScale', checked); }

    setUse4SegmentTiming(checked: boolean) { this.setField('use4SegmentTiming', checked); }

    setTestAlert(showTestAlert: boolean) { this.setField('showTestAlert', showTestAlert); }

    tabSelect(key: number) { this.setField('tabKey', key); }

    showFilters() { this.setField('showFilters', true); }

    hideFilters() { this.setField('showFilters', false); }

    resetFilters() {
        const allSessions = CalculateAllSessionOptions(this.state.allSolves);
        const method = this.state.method;
        const methodName = method.value as MethodName;
        const bench = CalculateBenchmarkTimes(this.state.allSolves);
        this.setState({
            filters: {
                sources: ['cubeast', 'acubemy'],
                ...defaultDateRange(),
                fastestTime: 0,
                slowestTime: 300,
                crossColors: [CrossColor.White, CrossColor.Yellow, CrossColor.Blue, CrossColor.Green, CrossColor.Orange, CrossColor.Red, CrossColor.Unknown],
                pllCases: Const.PllCases.map(x => x.value),
                ollCases: Const.OllCases.map(x => x.value),
                steps: Const.MethodSteps[methodName],
                solveCleanliness: Const.solveCleanliness.map(x => x.value),
                solveLuckiness: Const.solveLuckiness.map(x => x.value),
                method: methodName,
                sessions: allSessions.map(x => x.value),
                lowestInspection: 0,
                highestInspection: 300,
            },
            chosenSteps: FilterPanel.getStepOptionsForMethod(methodName),
            chosenColors: [
                { label: CrossColor.White, value: CrossColor.White },
                { label: CrossColor.Yellow, value: CrossColor.Yellow },
                { label: CrossColor.Red, value: CrossColor.Red },
                { label: CrossColor.Orange, value: CrossColor.Orange },
                { label: CrossColor.Blue, value: CrossColor.Blue },
                { label: CrossColor.Green, value: CrossColor.Green },
                { label: CrossColor.Unknown, value: CrossColor.Unknown },
            ],
            chosenSessions: allSessions,
            chosenSources: [
                { label: 'Cubeast', value: 'cubeast' },
                { label: 'Acubemy', value: 'acubemy' },
            ],
            chosenPLLs: Const.PllCases,
            chosenOLLs: Const.OllCases,
            solveCleanliness: Const.solveCleanliness,
            solveLuckiness: Const.solveLuckiness,
            autoWindowSize: true,
            autoBenchmarks: true,
            badTime: bench.badTime,
            goodTime: bench.goodTime,
            useLogScale: false,
            use4SegmentTiming: false,
        });
    }

    hideAlert() {
        this.setState({ showTestAlert: false });
    }

    createTooltip(description: string) {
        const tooltip = (
            <Tooltip id="tooltip">
                {description}
            </Tooltip>
        );
        return tooltip;
    }

    createFilterHtml(filter: JSX.Element, title: string, tooltip: string): JSX.Element {
        return (
            <Col>
                <Card className="card info-card p-2">
                    <OverlayTrigger placement="auto" overlay={this.createTooltip(tooltip)}>
                        <h6>{title} ⓘ</h6>
                    </OverlayTrigger>
                    {filter}
                </Card>
            </Col>
        )
    }

    /** A multi-select filter card; every one of these shares the same wiring. */
    multiFilter<T extends string>(
        options: Option<T>[],
        value: Option<T>[],
        onChange: (v: Option<T>[]) => void,
        title: string,
        tooltip: string
    ): JSX.Element {
        return this.createFilterHtml(
            <MultiSelect options={options} value={value} onChange={onChange} labelledBy="Select" />,
            title,
            tooltip
        );
    }

    /** A multi-select filter card whose options are split into expandable sub-menus. */
    groupedMultiFilter(
        groups: OptionGroup[],
        value: Option[],
        onChange: (v: Option[]) => void,
        title: string,
        tooltip: string
    ): JSX.Element {
        return this.createFilterHtml(
            <GroupedMultiSelect groups={groups} value={value} onChange={onChange} labelledBy={title} />,
            title,
            tooltip
        );
    }

    /** A filter card holding a low/high pair of numeric inputs. */
    rangeFilter(
        max: string,
        low: { id: string; value: number; onChange: FormControlChangeHandler },
        high: { id: string; value: number; onChange: FormControlChangeHandler },
        title: string,
        tooltip: string
    ): JSX.Element {
        return this.createFilterHtml(
            <div className="row">
                {[low, high].map((f) => (
                    <div className="form-outline col-6" key={f.id}>
                        <FormControl min="0" max={max} type="number" id={f.id} value={f.value} onChange={f.onChange} />
                    </div>
                ))}
            </div>,
            title,
            tooltip
        );
    }

    /** A filter card with an "Auto" switch that disables its numeric inputs. */
    autoFilter(
        auto: { id: string; checked: boolean; onChange: (v: boolean) => void },
        min: string,
        max: string,
        fields: { id: string; value: number; onChange: FormControlChangeHandler }[],
        title: string,
        tooltip: string
    ): JSX.Element {
        return this.createFilterHtml(
            <div className="row align-items-center g-2">
                <div className="col-auto d-flex align-items-center gap-2">
                    <span className="small">Auto</span>
                    <ReactSwitch id={auto.id} checked={auto.checked} onChange={auto.onChange} />
                </div>
                {fields.map((f) => (
                    <div className="col" key={f.id}>
                        <FormControl min={min} max={max} type="number" id={f.id} value={f.value} onChange={f.onChange} disabled={auto.checked} />
                    </div>
                ))}
            </div>,
            title,
            tooltip
        );
    }

    /** A filter card holding a single on/off switch. */
    switchFilter(id: string, checked: boolean, onChange: (v: boolean) => void, title: string, tooltip: string): JSX.Element {
        return this.createFilterHtml(<ReactSwitch id={id} checked={checked} onChange={onChange} />, title, tooltip);
    }

    render() {
        let filters: JSX.Element = (<></>);
        if (this.state.allSolves.length > 0) {
            filters = (
                <Container>
                    {this.createFilterHtml(
                        <></>,
                        `Showing ${this.state.filteredSolves.length} / ${this.state.allSolves.length} solves`,
                        "If you notice that not all your solves are appearing, even when no filters are chosen, either those solves are corrupt, or the source exported a comma in its CSV incorrectly."
                    )}

                    {this.multiFilter(
                        FilterPanel.getStepOptionsForMethod(this.state.filters.method),
                        this.state.chosenSteps, this.chosenStepsChanged.bind(this),
                        "Which step to drill down?",
                        "This dropdown lets you choose which step to see more information about. This only affects data in the 'Step Drilldown' tab."
                    )}

                    {this.groupedMultiFilter(
                        Const.PllGroups, this.state.chosenPLLs, this.pllChanged.bind(this),
                        "PLL Cases",
                        "Choose which PLL Cases to show. This will not work if you do not have Cubeast Premium. I suggest using this simply to keep/remove skips."
                    )}

                    {this.groupedMultiFilter(
                        Const.OllGroups, this.state.chosenOLLs, this.ollChanged.bind(this),
                        "OLL Cases",
                        "Choose which OLL Cases to show. This will not work if you do not have Cubeast Premium. I suggest using this simply to keep/remove skips."
                    )}

                    {this.multiFilter(
                        Const.solveCleanliness, this.state.solveCleanliness, this.setCleanliness.bind(this),
                        "Solve Cleanliness",
                        "Choose whether to show messed up solves or clean solves. The definition of a mistake is: Any solve that took 3 standard deviations more than average OR any step that took 3 standard deviations more than average for that step"
                    )}

                    {this.multiFilter(
                        Const.solveLuckiness, this.state.solveLuckiness, this.setLuckiness.bind(this),
                        "Solve Luckiness",
                        "Choose whether to show fullstep solves, or solves with skips in them"
                    )}

                    {this.multiFilter(
                        FilterPanel.toOptions(Object.values(CrossColor)),
                        this.state.chosenColors, this.crossColorsChanged.bind(this),
                        "Cross Color",
                        "Pick the starting cross color"
                    )}

                    <br />
                    <br />

                    {this.rangeFilter("300",
                        { id: "fastestSolve", value: this.state.filters.fastestTime, onChange: this.setFastestSolve.bind(this) },
                        { id: "slowestSolve", value: this.state.filters.slowestTime, onChange: this.setSlowestSolve.bind(this) },
                        "Solve Times",
                        "Choose slowest and fastest solves to keep"
                    )}

                    {this.rangeFilter("100000",
                        { id: "lowestInspection", value: this.state.filters.lowestInspection, onChange: this.setLowestInspection.bind(this) },
                        { id: "highestInspection", value: this.state.filters.highestInspection, onChange: this.setHighestInspection.bind(this) },
                        "Inspection Time",
                        "Choose lowest and highest inspection times to keep"
                    )}

                    {this.createFilterHtml(
                        <Select
                            classNamePrefix="method-select"
                            options={this.getMethodOptions()}
                            value={this.state.method}
                            onChange={this.methodChanged.bind(this)}
                        />,
                        "Which Method?",
                        "This dropdown lets you choose which method to show solves for."
                    )}

                    {this.multiFilter(
                        this.getSessionOptions(), this.state.chosenSessions, this.chosenSessionsChanged.bind(this),
                        "Which Sessions?",
                        "This dropdown lets you choose which method to show solves for."
                    )}

                    {this.multiFilter(
                        [{ label: 'Cubeast', value: 'cubeast' }, { label: 'Acubemy', value: 'acubemy' }],
                        this.state.chosenSources, this.sourcesChanged.bind(this),
                        "Source",
                        "Choose which sources (Cubeast or Acubemy) to include in the analysis."
                    )}

                    {this.autoFilter(
                        { id: "autoWindowSize", checked: this.state.autoWindowSize, onChange: this.setAutoWindowSize.bind(this) },
                        "5", "10000",
                        [{ id: "windowSize", value: this.state.windowSize, onChange: this.setWindowSize.bind(this) }],
                        "Sliding Window Size",
                        "Choose the sliding window size. When Auto is enabled, the size is chosen automatically based on how many solves are shown. If you see no data, try lowering this value."
                    )}

                    {this.createFilterHtml(
                        <FormControl min="5" max="10000" type="number" id="pointsPerGraph" value={this.state.pointsPerGraph} onChange={this.setPointsPerGraph.bind(this)} />,
                        "Points Per Graph",
                        "Choose how many points to show on each chart. If this value is set too high, you may see performance issues."
                    )}

                    {this.switchFilter("useLogScale", this.state.useLogScale, this.setUseLogScale.bind(this),
                        "Use Logarithmic Scale",
                        "Use a Logarithmic Scale for the Y axis. If you are unsure what this means, leave it disabled"
                    )}

                    {this.switchFilter("use4SegmentTiming", this.state.use4SegmentTiming, this.setUse4SegmentTiming.bind(this),
                        "4-Segment Timing",
                        "Show recognition, pre-AUF, execution, and post-AUF as separate segments in timing charts. When off, shows only recognition and execution."
                    )}

                    {this.autoFilter(
                        { id: "autoBenchmarks", checked: this.state.autoBenchmarks, onChange: this.setAutoBenchmarks.bind(this) },
                        "0", "300",
                        [
                            { id: "goodTime", value: this.state.goodTime, onChange: this.setGoodTime.bind(this) },
                            { id: "badTime", value: this.state.badTime, onChange: this.setBadTime.bind(this) },
                        ],
                        "Benchmarks",
                        "Choose what you consider a 'good' solve and a 'bad' solve. When Auto is enabled, good/bad are calculated from your current Ao100 and +25% for bad."
                    )}

                    {this.createFilterHtml(
                        <DatePicker
                            selected={this.state.filters.startDate}
                            onChange={this.setStartDate.bind(this)}
                            dateFormat={datePickerFormat()}
                            popperContainer={({ children }) => createPortal(children, document.body)}
                            popperProps={{ strategy: "fixed" }}
                        />,
                        "Pick Start Date",
                        "Choose start date"
                    )}

                    {this.createFilterHtml(
                        <DatePicker
                            selected={this.state.filters.endDate}
                            onChange={this.setEndDate.bind(this)}
                            dateFormat={datePickerFormat()}
                            popperContainer={({ children }) => createPortal(children, document.body)}
                            popperProps={{ strategy: "fixed" }}
                        />,
                        "Pick End Date",
                        "Choose end date"
                    )}
                </Container>
            )
        }

        let analysis: JSX.Element = (<></>)
        if (this.state.allSolves.length > 0) {
            analysis = (
                <div>
                    <Row className="mt-3">
                        <Alert show={this.state.showTestAlert} variant={"warning"}>
                            <Alert.Heading>Warning: Viewing Test Data</Alert.Heading>
                            These are not your solves, these are the dev's personal solves, just to show off the capabilities of this website! To view your solves, upload a CSV file, and click "Display My Stats"
                            <div className="d-flex justify-content-end">
                                <Button onClick={() => this.hideAlert()} variant="warning">
                                    Close
                                </Button>
                            </div>
                        </Alert>
                        <Col>
                            <ChartPanel
                                windowSize={this.state.windowSize}
                                solves={this.state.compressedSolves}
                                pointsPerGraph={this.state.pointsPerGraph}
                                methodName={this.state.filters.method}
                                goodTime={this.state.goodTime}
                                badTime={this.state.badTime}
                                steps={this.state.filters.steps}
                                useLogScale={this.state.useLogScale}
                                use4SegmentTiming={this.state.use4SegmentTiming}
                            />
                        </Col>
                    </Row>
                </div >
            );
        }

        const loading = this.props.isParsing && this.state.allSolves.length === 0 ? (
            <Container className="py-5 text-center">
                <Spinner animation="border" role="status" />
                <div className="mt-3">Parsing CSV and preparing charts...</div>
            </Container>
        ) : null;

        return (
            <main className="body">
                <section className="dashboard">
                    <Offcanvas show={this.state.showFilters} onHide={this.hideFilters.bind(this)}>
                        <Offcanvas.Header closeButton>
                            <Offcanvas.Title className="me-3">Choose solves to show!</Offcanvas.Title>
                            <Button variant="outline-secondary" size="sm" onClick={this.resetFilters.bind(this)}>
                                Reset filters
                            </Button>
                        </Offcanvas.Header>
                        <Offcanvas.Body>
                            {filters}
                        </Offcanvas.Body>
                    </Offcanvas>
                    {loading}
                    {analysis}
                </section>
            </main >
        )
    }
}