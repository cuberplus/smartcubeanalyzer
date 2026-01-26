import React from "react";
import moment from "moment";
import DatePicker from "react-datepicker";
import Select from "react-select";
import { MultiSelect, Option } from "react-multi-select-component";
import { CrossColor, FilterPanelProps, FilterPanelState, Filters, MethodName, Solve, SolveCleanliness, SolveLuckiness, Step, StepName } from "../Helpers/Types";
import { ChartPanel } from "./ChartPanel";
import { calculateMovingAverage, calculateMovingStdDev } from "../Helpers/MathHelpers";
import { FormControl, Card, Row, Offcanvas, Col, Button, Tooltip, OverlayTrigger, Alert, Container, CardText } from 'react-bootstrap';
import { Const } from "../Helpers/Constants";
import { CalculateAllSessionOptions } from "../Helpers/CubeHelpers";
import ReactSwitch from "react-switch";

export class FilterPanel extends React.Component<FilterPanelProps, FilterPanelState> {
    state: FilterPanelState = {
        allSolves: [],
        filteredSolves: [],
        filters: {
            startDate: moment.utc("1700-01-01").toDate(),
            endDate: moment.utc("2300-01-01").toDate(),
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
        solveCleanliness: Const.solveCleanliness,
        solveLuckiness: Const.solveLuckiness,
        chosenPLLs: Const.PllCases,
        chosenOLLs: Const.OllCases,
        tabKey: 1,
        windowSize: Const.DefaultWindowSize,
        pointsPerGraph: 100,
        showFilters: false,
        showTestAlert: false,
        badTime: 20,
        goodTime: 15,
        method: { label: MethodName.CFOP, value: MethodName.CFOP },
        useLogScale: false
    }

    static passesFilters(solve: Solve, filters: Filters) {
        if (solve.isCorrupt) {
            return false;
        }
        if (solve.method != filters.method) {
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
        if (solve.inspectionTime < filters.lowestInspection || solve.inspectionTime > filters.highestInspection) {
            return false;
        }
        if (filters.sessions.indexOf(solve.session) < 0) {
            return false;
        }

        // TODO: check case logic properly
        if (solve.method == MethodName.CFOP && solve.steps[6].case !== undefined && filters.pllCases.indexOf(solve.steps[6].case) < 0) {
            return false;
        }
        if (solve.method == MethodName.CFOP && solve.steps[5].case !== undefined && filters.ollCases.indexOf(solve.steps[5].case) < 0) {
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
        for (let i = 0; i < allSolves[0].steps.length; i++) {
            mistakes.push(this.getMistakeMap(allSolves.map(x => x.steps[i].time), windowSize))
        }

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
                if (newSolves[i].steps[j].time === 0) {
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

    static getDerivedStateFromProps(nextProps: FilterPanelProps, prevState: FilterPanelState) {
        let newState: FilterPanelState = {
            // Assume all props stay the same
            allSolves: prevState.allSolves,
            filteredSolves: prevState.filteredSolves,
            method: prevState.method,
            chosenSteps: prevState.chosenSteps,
            filters: prevState.filters,
            chosenColors: prevState.chosenColors,
            chosenPLLs: prevState.chosenPLLs,
            chosenOLLs: prevState.chosenOLLs,
            chosenSessions: prevState.chosenSessions,
            tabKey: prevState.tabKey,
            windowSize: prevState.windowSize,
            pointsPerGraph: prevState.pointsPerGraph,
            showFilters: prevState.showFilters,
            showTestAlert: prevState.showTestAlert,
            solveCleanliness: prevState.solveCleanliness,
            solveLuckiness: prevState.solveLuckiness,
            badTime: prevState.badTime,
            goodTime: prevState.goodTime,
            useLogScale: prevState.useLogScale
        }

        // Update anything that needs it
        newState.allSolves = nextProps.solves;
        newState.filteredSolves = FilterPanel.applyFiltersToSolves(nextProps.solves, prevState.filters, newState.windowSize);
        if (newState.windowSize >= newState.filteredSolves.length) {
            newState.windowSize = Math.max(5, Math.ceil(newState.filteredSolves.length / 4));
        }

        return newState;
    }

    crossColorsChanged(selectedList: any[]) {
        let selectedColors: CrossColor[] = selectedList.map(x => x.value);
        let newFilters: Filters = this.state.filters;
        newFilters.crossColors = selectedColors;

        this.setState({
            filters: newFilters,
            chosenColors: selectedList
        })
    }

    windowSizeChanged(newWindowSize: number) {
        this.setState({
            windowSize: newWindowSize
        })
    }

    chosenStepsChanged(selectedList: any[]) {
        let selectedSteps: StepName[] = selectedList.map(x => x.value);
        let allSteps = Const.MethodSteps[this.state.filters.method];

        // Sort the steps to match the order in the method
        let sortOrder = Object.fromEntries(allSteps.map((k, i) => [k, i + 1]));
        selectedSteps.sort((a, b) =>
            (sortOrder[a] || Number.MAX_VALUE) - (sortOrder[b] || Number.MAX_VALUE)
        );

        let newFilters: Filters = this.state.filters;
        newFilters.steps = selectedSteps;

        this.setState({
            filters: newFilters,
            chosenSteps: selectedList
        })
    }

    chosenSessionsChanged(selectedList: any[]) {
        let selectedSessions: string[] = selectedList.map(x => x.value);
        let newFilters: Filters = this.state.filters;
        newFilters.sessions = selectedSessions;

        this.setState({
            filters: newFilters,
            chosenSessions: selectedList
        })
    }

    static getStepOptionsForMethod(method: MethodName) {
        let options: Option[] = [];
        Const.MethodSteps[method].forEach(x => {
            options.push({ label: x, value: x });
        })
        return options;
    }

    getMethodOptions() {
        let options: Option[] = [];
        Object.values(MethodName).forEach(x => {
            options.push({ label: x, value: x });
        })
        return options;
    }

    getSessionOptions() {
        return CalculateAllSessionOptions(this.props.solves);
    }

    methodChanged(newValue: Option | null) {
        let newMethod: MethodName = newValue!.value;
        let newFilters: Filters = this.state.filters;
        newFilters.method = newMethod;
        newFilters.steps = Const.MethodSteps[newMethod];

        this.setState({
            method: newValue!,
            filters: newFilters,
            chosenSteps: FilterPanel.getStepOptionsForMethod(newMethod)
        })
    }

    pllChanged(selectedList: any[]) {
        let selectedPlls: string[] = selectedList.map(x => x.value);
        let newFilters: Filters = this.state.filters;
        newFilters.pllCases = selectedPlls;

        this.setState({
            filters: newFilters,
            chosenPLLs: selectedList
        })
    }

    ollChanged(selectedList: any[]) {
        let selectedOlls: string[] = selectedList.map(x => x.value);
        let newFilters: Filters = this.state.filters;
        newFilters.ollCases = selectedOlls;

        this.setState({
            filters: newFilters,
            chosenOLLs: selectedList
        })
    }

    setStartDate(newStartDate: Date) {
        let newFilters: Filters = this.state.filters;
        newFilters.startDate = newStartDate;
        this.setState({ filters: newFilters })
    }

    setEndDate(newEndDate: Date) {
        let newFilters: Filters = this.state.filters;
        newFilters.startDate = newEndDate;
        this.setState({ filters: newFilters })
    }

    setSlowestSolve(event: React.ChangeEvent<HTMLInputElement>) {
        let newFilters: Filters = this.state.filters;
        newFilters.slowestTime = parseInt(event.target.value);
        this.setState({ filters: newFilters })
    }

    setFastestSolve(event: React.ChangeEvent<HTMLInputElement>) {
        let newFilters: Filters = this.state.filters;
        newFilters.fastestTime = parseInt(event.target.value);
        this.setState({ filters: newFilters })
    }

    setLowestInspection(event: React.ChangeEvent<HTMLInputElement>) {
        let newFilters: Filters = this.state.filters;
        newFilters.lowestInspection = parseInt(event.target.value);
        this.setState({ filters: newFilters })
    }

    setHighestInspection(event: React.ChangeEvent<HTMLInputElement>) {
        let newFilters: Filters = this.state.filters;
        newFilters.highestInspection = parseInt(event.target.value);
        this.setState({ filters: newFilters })
    }

    setBadTime(event: React.ChangeEvent<HTMLInputElement>) {
        this.setState({ badTime: parseInt(event.target.value) })
    }

    setGoodTime(event: React.ChangeEvent<HTMLInputElement>) {
        this.setState({ goodTime: parseInt(event.target.value) })
    }

    setWindowSize(event: React.ChangeEvent<HTMLInputElement>) {
        this.setState({ windowSize: parseInt(event.target.value) })
    }

    setPointsPerGraph(event: React.ChangeEvent<HTMLInputElement>) {
        this.setState({ pointsPerGraph: parseInt(event.target.value) })
    }

    setUseLogScale(checked: boolean) {
        this.setState({ useLogScale: checked });
    }

    setCleanliness(selectedList: any[]) {
        let newFilters: Filters = this.state.filters;
        newFilters.solveCleanliness = selectedList.map(x => x.value);

        this.setState({
            solveCleanliness: selectedList,
            filters: newFilters,
        })
    }

    setLuckiness(selectedList: any[]) {
        let newFilters: Filters = this.state.filters;
        newFilters.solveLuckiness = selectedList.map(x => x.value);

        this.setState({
            solveLuckiness: selectedList,
            filters: newFilters,
        })
    }

    setTestAlert(showTestAlert: boolean) {
        this.setState({ showTestAlert: showTestAlert })
    }

    tabSelect(key: any) {
        this.setState({ tabKey: key });
    }

    showFilters() {
        this.setState({ showFilters: true });
    }

    hideFilters() {
        this.setState({ showFilters: false });
    }

    hideAlert() {
        this.setState({ showTestAlert: false });
    }

    // This function takes the filters, and creates a new solve based on them.
    // For example, if only Cross and F2L Pair 1 are selected, then it sums up the times for only those
    // fields, and leaves the rest intact.
    compressSolves(solves: Solve[]) {
        let newSolves: Solve[] = [];

        solves.forEach((solve) => {
            let newSteps: Step[] = solve.steps.filter((x) => {
                return this.state.filters.steps.find((y) => y == x.name);
            });

            let newSolve: Solve = {
                id: solve.id,
                crossColor: solve.crossColor,
                date: solve.date,
                inspectionTime: solve.inspectionTime,
                executionTime: newSteps.reduce((sum, current) => sum + current.executionTime, 0),
                recognitionTime: newSteps.reduce((sum, current) => sum + current.recognitionTime, 0),
                isCorrupt: solve.isCorrupt,
                method: solve.method,
                scramble: solve.scramble,
                time: newSteps.reduce((sum, current) => sum + current.time, 0),
                turns: newSteps.reduce((sum, current) => sum + current.turns, 0),
                tps: newSteps.reduce((sum, current) => sum + current.time, 0) === 0
                    ? 0
                    : newSteps.reduce((sum, current) => sum + current.turns, 0) / newSteps.reduce((sum, current) => sum + current.time, 0),
                isFullStep: solve.isFullStep,
                isMistake: solve.isMistake,
                steps: newSteps,
                session: solve.session
            };

            newSolves.push(newSolve);
        });

        return newSolves;
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

    render() {
        let filters: JSX.Element = (<></>);
        if (this.state.allSolves.length > 0) {
            filters = (
                <Container>
                    {this.createFilterHtml(
                        <Select
                            options={this.getMethodOptions()}
                            value={this.state.method}
                            onChange={this.methodChanged.bind(this)}
                        />,
                        "Which Method?",
                        "This dropdown lets you choose which method to show solves for."
                    )}
                    {this.createFilterHtml(
                        <MultiSelect
                            options={this.getSessionOptions()}
                            value={this.state.chosenSessions}
                            onChange={this.chosenSessionsChanged.bind(this)}
                            labelledBy="Select"
                        />,
                        "Which Sessions?",
                        "This dropdown lets you choose which method to show solves for."
                    )}
                    {this.createFilterHtml(
                        <MultiSelect
                            options={FilterPanel.getStepOptionsForMethod(this.state.filters.method)}
                            value={this.state.chosenSteps}
                            onChange={this.chosenStepsChanged.bind(this)}
                            labelledBy="Select"
                        />,
                        "Which step to drill down?",
                        "This dropdown lets you choose which step to see more information about. This only affects data in the 'Step Drilldown' tab."
                    )}

                    <br />
                    <br />

                    {this.createFilterHtml(
                        <></>,
                        `Showing ${this.state.filteredSolves.length} / ${this.state.allSolves.length} solves`,
                        "If you notice that not all your solves are appearing, even when no filters are chosen, either those solves are corrupt, or cubeast exported a comma in its CSV incorrectly."
                    )}

                    {this.createFilterHtml(
                        <MultiSelect
                            options={[
                                { label: CrossColor.White, value: CrossColor.White },
                                { label: CrossColor.Yellow, value: CrossColor.Yellow },
                                { label: CrossColor.Red, value: CrossColor.Red },
                                { label: CrossColor.Orange, value: CrossColor.Orange },
                                { label: CrossColor.Blue, value: CrossColor.Blue },
                                { label: CrossColor.Green, value: CrossColor.Green },
                                { label: CrossColor.Unknown, value: CrossColor.Unknown }
                            ]}
                            value={this.state.chosenColors}
                            onChange={this.crossColorsChanged.bind(this)}
                            labelledBy="Select"
                        />,
                        "Cross Color",
                        "Pick the starting cross color"
                    )}

                    {this.createFilterHtml(
                        <div className="row">
                            <div className="form-outline col-6" >
                                <FormControl min="0" max="300" type="number" id="fastestSolve" value={this.state.filters.fastestTime} onChange={this.setFastestSolve.bind(this)} />
                            </div>
                            <div className="form-outline col-6" >
                                <FormControl min="0" max="300" type="number" id="slowestSolve" value={this.state.filters.slowestTime} onChange={this.setSlowestSolve.bind(this)} />
                            </div>
                        </div>,
                        "Solve Times",
                        "Choose slowest and fastest solves to keep"
                    )}

                    {this.createFilterHtml(
                        <MultiSelect
                            options={Const.solveCleanliness}
                            value={this.state.solveCleanliness}
                            onChange={this.setCleanliness.bind(this)}
                            labelledBy="Select"
                        />,
                        "Solve Cleanliness",
                        "Choose whether to show messed up solves or clean solves. The definition of a mistake is: Any solve that took 3 standard deviations more than average OR any step that took 3 standard deviations more than average for that step"
                    )}

                    {this.createFilterHtml(
                        <MultiSelect
                            options={Const.solveLuckiness}
                            value={this.state.solveLuckiness}
                            onChange={this.setLuckiness.bind(this)}
                            labelledBy="Select"
                        />,
                        "Solve Luckiness",
                        "Choose whether to show fullstep solves, or solves with skips in them"
                    )}

                    {this.createFilterHtml(
                        <MultiSelect
                            options={Const.PllCases}
                            value={this.state.chosenPLLs}
                            onChange={this.pllChanged.bind(this)}
                            labelledBy="Select"
                        />,
                        "PLL Cases",
                        "Choose which PLL Cases to show. This will not work if you do not have Cubeast Premium. I suggest using this simply to keep/remove skips."
                    )}

                    {this.createFilterHtml(
                        <MultiSelect
                            options={Const.OllCases}

                            value={this.state.chosenOLLs}
                            onChange={this.ollChanged.bind(this)}
                            labelledBy="Select"
                        />,
                        "OLL Cases",
                        "Choose which OLL Cases to show. This will not work if you do not have Cubeast Premium. I suggest using this simply to keep/remove skips."
                    )}

                    {this.createFilterHtml(
                        <FormControl min="5" max="10000" type="number" id="windowSize" value={this.state.windowSize} onChange={this.setWindowSize.bind(this)} />,
                        "Sliding Window Size",
                        "Choose the sliding window size. For example, the default is to show the average of 1000 solves, over time. If you see no data, you should try lowering this value."
                    )}

                    {this.createFilterHtml(
                        <FormControl min="5" max="10000" type="number" id="pointsPerGraph" value={this.state.pointsPerGraph} onChange={this.setPointsPerGraph.bind(this)} />,
                        "Points Per Graph",
                        "Choose how many points to show on each chart. If this value is set too high, you may see performance issues."
                    )}

                    {this.createFilterHtml(
                        <div className="row">
                            <div className="form-outline col-6" >
                                <FormControl min="0" max="100000" type="number" id="lowestInspection" value={this.state.filters.lowestInspection} onChange={this.setLowestInspection.bind(this)} />
                            </div>
                            <div className="form-outline col-6" >
                                <FormControl min="0" max="100000" type="number" id="highestInspection" value={this.state.filters.highestInspection} onChange={this.setHighestInspection.bind(this)} />
                            </div>
                        </div>,
                        "Inspection Time",
                        "Choose lowest and highest inspection times to keep"
                    )}

                    {this.createFilterHtml(
                        <ReactSwitch id="useLogScale" checked={this.state.useLogScale} onChange={this.setUseLogScale.bind(this)} />,
                        "Use Logarithmic Scale",
                        "Use a Logarithmic Scale for the Y axis. If you are unsure what this means, leave it disabled"
                    )}

                    {this.createFilterHtml(
                        <div className="row">
                            <div className="form-outline col-6" >
                                <FormControl min="0" max="300" type="number" id="goodTime" value={this.state.goodTime} onChange={this.setGoodTime.bind(this)} />
                            </div>
                            <div className="form-outline col-6" >
                                <FormControl min="0" max="300" type="number" id="badTime" value={this.state.badTime} onChange={this.setBadTime.bind(this)} />
                            </div>
                        </div>,
                        "Benchmarks",
                        "Choose what you consider a 'good' solve and a 'bad' solve"
                    )}

                    {this.createFilterHtml(
                        <DatePicker selected={this.state.filters.startDate} onChange={this.setStartDate.bind(this)} />,
                        "Pick Start Date",
                        "Choose start date"
                    )}

                    {this.createFilterHtml(
                        <DatePicker selected={this.state.filters.endDate} onChange={this.setEndDate.bind(this)} />,
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
                    <Row>
                        <Alert show={this.state.showTestAlert} variant={"warning"}>
                            <Alert.Heading>Warning: Viewing Test Data</Alert.Heading>
                            These are not your solves, these are the dev's personal solves, just to show off the capabilities of this website! To view your solves, upload a CSV file, and click "Display My Stats"
                            <div className="d-flex justify-content-end">
                                <Button onClick={() => this.hideAlert()} variant="warning">
                                    Close
                                </Button>
                            </div>
                        </Alert>
                        <Col className="col-auto m-0 p-0">
                            <Container className="m-0 p-0">
                                <Button className="position-fixed" onClick={this.showFilters.bind(this)}>
                                    <CardText>
                                        →
                                    </CardText>
                                </Button>
                                <Button onClick={this.showFilters.bind(this)} style={{ visibility: "hidden" }}>
                                    <CardText>
                                        →
                                    </CardText>
                                </Button>
                            </Container>
                        </Col>
                        <Col>
                            <ChartPanel
                                windowSize={this.state.windowSize}
                                solves={this.compressSolves(this.state.filteredSolves)}
                                pointsPerGraph={this.state.pointsPerGraph}
                                methodName={this.state.filters.method}
                                goodTime={this.state.goodTime}
                                badTime={this.state.badTime}
                                steps={this.state.filters.steps}
                                useLogScale={this.state.useLogScale}
                            />
                        </Col>
                    </Row>
                </div >
            );
        }

        return (
            <main className="body">
                <section className="dashboard">
                    <Offcanvas show={this.state.showFilters} onHide={this.hideFilters.bind(this)}>
                        <Offcanvas.Header closeButton>
                            <Offcanvas.Title>Choose solves to show!</Offcanvas.Title>
                        </Offcanvas.Header>
                        <Offcanvas.Body>
                            {filters}
                        </Offcanvas.Body>
                    </Offcanvas>
                    {analysis}
                </section>
            </main >
        )
    }
}