import React from "react";
import { FileInputProps, FileInputState, Solve } from "../Helpers/Types";
import { parseCsv } from "../Helpers/CsvParser";
import { FilterPanel } from "./FilterPanel";
import { GetDemoData } from "../Helpers/SampleData"
import { Button, Form, FormControl, Card, Row, ButtonGroup, Navbar, Container } from "react-bootstrap";
import { HelpPanel } from "./HelpPanel";
import { CalculateMostUsedMethod, CalculateWindowSize, CalculateAllSessionOptions } from "../Helpers/CubeHelpers";
import { Option } from "react-multi-select-component"
import ReactGA from 'react-ga4';
import { ThemeContext } from "../contexts/ThemeContext";

export class FileInput extends React.Component<FileInputProps, FileInputState> {
    state: FileInputState = { solves: [], showHelpModal: false };

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

        const filePromises: Promise<Solve[]>[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files.item(i);
            if (!file) continue;
            const textPromise = file.text().then((value: string) => parseCsv(value, ','));
            filePromises.push(textPromise);
        }

        Promise.all(filePromises).then((results: Solve[][]) => {
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
                showTestAlert: false
            });

            ReactGA.event({
                category: 'DataLoaded',
                action: 'Loaded User Data',
                value: solveList.length
            });
        });
    };

    showTestData() {
        // #region agent log
        fetch('http://127.0.0.1:7299/ingest/abb27326-ebe7-4354-be17-843150181f69',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'282053'},body:JSON.stringify({sessionId:'282053',location:'FileInput.tsx:showTestData',message:'showTestData called',data:{},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        GetDemoData()
            .then((csv) => {
                // #region agent log
                fetch('http://127.0.0.1:7299/ingest/abb27326-ebe7-4354-be17-843150181f69',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'282053'},body:JSON.stringify({sessionId:'282053',location:'FileInput.tsx:after GetDemoData',message:'fetch succeeded',data:{csvLength:csv?.length},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
                // #endregion
                const solveList: Solve[] = parseCsv(csv, ',');
                // #region agent log
                fetch('http://127.0.0.1:7299/ingest/abb27326-ebe7-4354-be17-843150181f69',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'282053'},body:JSON.stringify({sessionId:'282053',location:'FileInput.tsx:after parseCsv',message:'parseCsv succeeded',data:{solveCount:solveList?.length},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{});
                // #endregion
                const method = CalculateMostUsedMethod(solveList);
                const suggestedMethod: Option = { label: method, value: method };
                const suggestedSessions = CalculateAllSessionOptions(solveList);
                const suggestedWindowSize = CalculateWindowSize(solveList.length);

                // #region agent log
                fetch('http://127.0.0.1:7299/ingest/abb27326-ebe7-4354-be17-843150181f69',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'282053'},body:JSON.stringify({sessionId:'282053',location:'FileInput.tsx:before setState',message:'about to setState with test data',data:{solveCount:solveList.length,sessionsCount:suggestedSessions?.length},timestamp:Date.now(),hypothesisId:'C'})}).catch(()=>{});
                // #endregion
                this.setState({
                    solves: solveList,
                    suggestedMethod,
                    suggestedSessions,
                    suggestedWindowSize,
                    showTestAlert: true
                });

                ReactGA.event({
                    category: 'DataLoaded',
                    action: 'Loaded Test Data',
                    value: solveList.length
                });
            })
            .catch((err) => {
                // #region agent log
                fetch('http://127.0.0.1:7299/ingest/abb27326-ebe7-4354-be17-843150181f69',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'282053'},body:JSON.stringify({sessionId:'282053',location:'FileInput.tsx:showTestData catch',message:'demo load failed',data:{err:String(err?.message || err)},timestamp:Date.now(),hypothesisId:'A-B-C'})}).catch(()=>{});
                // #endregion
                console.error('Failed to load demo data:', err);
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

                <Container className="container-fluid">
                    <br />
                    <Row>
                        <Card className="info-card col-lg-6 col-md-12 col-sm-12">
                            <Form className="m-2">
                                <h3>Upload your Cubeast and Acubemy CSV files:</h3>
                                <FormControl type="file" id="uploaded_data" accept=".csv" multiple />
                            </Form>
                            <ButtonGroup className="m-2">
                                <Button className="col-8" variant="success" onClick={() => { this.showFileData(); }}>
                                    Display My Stats!
                                </Button>
                                <Button className="col-4" onClick={() => { this.showTestData(); }}>
                                    Display Test Stats!
                                </Button>
                            </ButtonGroup>
                        </Card>
                    </Row>

                    <FilterPanel
                        solves={this.state.solves}
                        suggestedMethod={this.state.suggestedMethod}
                        suggestedSessions={this.state.suggestedSessions}
                        suggestedWindowSize={this.state.suggestedWindowSize}
                        showTestAlert={this.state.showTestAlert}
                    />
                </Container>
            </div >
        )
    }
}