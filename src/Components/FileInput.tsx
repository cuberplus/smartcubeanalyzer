import React from "react";
import { FileInputProps, FileInputState, MethodName, Solve, StepName } from "../Helpers/Types";
import { parseCsv } from "../Helpers/CsvParser";
import { FilterPanel } from "./FilterPanel";
import { GetDemoData } from "../Helpers/SampleData"
import { Button, Form, FormControl, Card, Row, Col, ButtonGroup, Navbar, Container } from "react-bootstrap";
import { HelpPanel } from "./HelpPanel";
import { CalculateMostUsedMethod, CalculateWindowSize, CalculateAllSessionOptions } from "../Helpers/CubeHelpers";
import { Option } from "react-multi-select-component"
import ReactGA from 'react-ga4';
import { ThemeContext } from "../contexts/ThemeContext";

const CFOP_PRESETS: { label: string; steps: StepName[] }[] = [
    { label: 'Cross+1',    steps: [StepName.Cross, StepName.F2L_1] },
    { label: 'All F2L',   steps: [StepName.F2L_1, StepName.F2L_2, StepName.F2L_3, StepName.F2L_4] },
    { label: 'OLL',       steps: [StepName.OLL] },
    { label: 'PLL',       steps: [StepName.PLL] },
    { label: 'Full Solve', steps: [StepName.Cross, StepName.F2L_1, StepName.F2L_2, StepName.F2L_3, StepName.F2L_4, StepName.OLL, StepName.PLL] },
];

export class FileInput extends React.Component<FileInputProps, FileInputState> {
    state: FileInputState = { solves: [], showHelpModal: false, isParsing: false, currentMethod: MethodName.CFOP };

    private filterPanelRef = React.createRef<FilterPanel>();

    constructor(props: FileInputProps) {
        super(props);
        ReactGA.initialize('G-BHXNCQ3K0D');
    }

    showFileData() {
        let dataset = (document.getElementById("uploaded_data") as HTMLInputElement);
        let files: FileList = dataset.files as FileList;

        if (!files || files.length === 0) {
            return;
        }

        this.setState({ isParsing: true });

        const filePromises: Promise<Solve[]>[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files.item(i);
            if (!file) continue;
            const textPromise = file.text().then((value: string) => parseCsv(value, ','));
            filePromises.push(textPromise);
        }

        Promise.all(filePromises)
            .then((results: Solve[][]) => {
                const solveList: Solve[] = results.flat();
                solveList.sort((a, b) => a.date.getTime() - b.date.getTime());

                const method = CalculateMostUsedMethod(solveList);
                const suggestedMethod: Option = { label: method, value: method };
                const suggestedSessions = CalculateAllSessionOptions(solveList);
                const suggestedWindowSize = CalculateWindowSize(solveList.length);

                this.setState({
                    solves: solveList,
                    suggestedMethod,
                    suggestedSessions,
                    suggestedWindowSize,
                    showTestAlert: false,
                    currentMethod: method as MethodName,
                });

                ReactGA.event({
                    category: 'DataLoaded',
                    action: 'Loaded User Data',
                    value: solveList.length
                });
            })
            .catch((err) => {
                console.error('Failed to parse uploaded data:', err);
            })
            .finally(() => {
                this.setState({ isParsing: false });
            });
    };

    showTestData() {
        this.setState({ isParsing: true });

        GetDemoData()
            .then((csv) => {
                const solveList: Solve[] = parseCsv(csv, ',');
                const method = CalculateMostUsedMethod(solveList);
                const suggestedMethod: Option = { label: method, value: method };
                const suggestedSessions = CalculateAllSessionOptions(solveList);
                const suggestedWindowSize = CalculateWindowSize(solveList.length);

                this.setState({
                    solves: solveList,
                    suggestedMethod,
                    suggestedSessions,
                    suggestedWindowSize,
                    showTestAlert: true,
                    currentMethod: method as MethodName,
                });

                ReactGA.event({
                    category: 'DataLoaded',
                    action: 'Loaded Test Data',
                    value: solveList.length
                });
            })
            .catch((err) => {
                console.error('Failed to load demo data:', err);
            })
            .finally(() => {
                this.setState({ isParsing: false });
            });
    }

    helpButtonClicked() {
        this.setState({ showHelpModal: true });
    }

    closeButtonClicked() {
        this.setState({ showHelpModal: false });
    }

    render() {
        return (
            <div>
                <header className={"header"}>
                    <Navbar>
                        {this.state.solves.length > 0 && (
                            <Button
                                variant="primary"
                                className="me-3"
                                style={{ fontSize: '1.2rem', lineHeight: 1, padding: '0.35rem 0.65rem' }}
                                onClick={() => this.filterPanelRef.current?.showFilters()}
                                aria-label="Open filters"
                            >
                                &#9776;
                            </Button>
                        )}
                        <Navbar.Brand>
                            Smartcube Analyzer
                        </Navbar.Brand>
                        <Navbar.Collapse className="justify-content-end">
                            <ThemeContext.Consumer>
                                {({ isDark, setTheme }) => (
                                    <ButtonGroup size="sm" className="me-1">
                                        <Button
                                            variant={isDark ? "outline-secondary" : "primary"}
                                            onClick={() => setTheme("light")}
                                        >
                                            Light
                                        </Button>
                                        <Button
                                            variant={isDark ? "primary" : "outline-secondary"}
                                            onClick={() => setTheme("dark")}
                                        >
                                            Dark
                                        </Button>
                                    </ButtonGroup>
                                )}
                            </ThemeContext.Consumer>
                            <Button
                                className="ms-2 me-2"
                                onClick={() => { this.helpButtonClicked() }}>
                                Help
                            </Button>
                        </Navbar.Collapse>
                    </Navbar>
                </header>

                <HelpPanel showHelpPanel={this.state.showHelpModal} onCloseHandler={() => this.closeButtonClicked()} />

                <Container className="container-fluid mt-2 mt-md-3">
                    <Row className="align-items-stretch g-2 g-md-3">
                        <Col lg={6} md={12}>
                            <Card className="info-card h-100">
                                <Form className="m-2">
                                    <h3>Upload your Cubeast and Acubemy CSV files:</h3>
                                    <FormControl type="file" id="uploaded_data" accept=".csv" multiple />
                                </Form>
                                <ButtonGroup className="m-2">
                                    <Button className="col-8" variant="success" disabled={this.state.isParsing} onClick={() => { this.showFileData(); }}>
                                        {this.state.isParsing ? "Parsing..." : "Display My Stats!"}
                                    </Button>
                                    <Button className="col-4" disabled={this.state.isParsing} onClick={() => { this.showTestData(); }}>
                                        {this.state.isParsing ? "Parsing..." : "Display Test Stats!"}
                                    </Button>
                                </ButtonGroup>
                            </Card>
                        </Col>

                        {this.state.solves.length > 0 && this.state.currentMethod === MethodName.CFOP && (
                            <Col lg={6} md={12}>
                                <Card className="info-card h-100">
                                    <Card.Body>
                                        <Card.Title>Preset Step Filters</Card.Title>
                                        <div className="d-flex flex-wrap gap-2">
                                            {CFOP_PRESETS.map(preset => (
                                                <Button
                                                    key={preset.label}
                                                    variant="outline-primary"
                                                    onClick={() => this.filterPanelRef.current?.applyStepsPreset(preset.steps)}
                                                >
                                                    {preset.label}
                                                </Button>
                                            ))}
                                        </div>
                                    </Card.Body>
                                </Card>
                            </Col>
                        )}
                    </Row>

                    <FilterPanel
                        ref={this.filterPanelRef}
                        solves={this.state.solves}
                        suggestedMethod={this.state.suggestedMethod}
                        suggestedSessions={this.state.suggestedSessions}
                        suggestedWindowSize={this.state.suggestedWindowSize}
                        showTestAlert={this.state.showTestAlert}
                        isParsing={this.state.isParsing}
                        onMethodChange={(m) => this.setState({ currentMethod: m })}
                    />
                </Container>
            </div >
        )
    }
}