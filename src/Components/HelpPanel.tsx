import React from "react";
import { HelpPanelProps, HelpPanelState } from "../Helpers/Types";
import { Button, Modal } from "react-bootstrap";

export class HelpPanel extends React.Component<HelpPanelProps, HelpPanelState> {
    render() {
        return (
            <Modal
                show={this.props.showHelpPanel}
                onHide={() => { this.props.onCloseHandler() }}
                size="xl"
            >
                <Modal.Header closeButton>
                    <Modal.Title>Cubeast Analyzer</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <section className="mb-4">
                        <h5>Getting started</h5>
                        <p>
                            To get started, export your solves as CSV files from your training platforms and then upload them here.
                        </p>
                    </section>

                    <section className="mb-4">
                        <h5>Export your solves</h5>

                        <div className="mb-4">
                            <h6>From Cubeast</h6>
                            <p>
                                First,{" "}
                                <a href="https://app.cubeast.com/log/solves">
                                    export your solves as a CSV
                                </a>{" "}
                                from Cubeast.
                            </p>
                            <div className="text-center">
                                <a href="https://app.cubeast.com/log/solves">
                                    <img
                                        className="img-fluid w-75"
                                        src={require("../Assets/CubeastCsv.png")}
                                        alt="Cubeast export solves as CSV"
                                    />
                                </a>
                            </div>
                        </div>

                        <div className="mb-4">
                            <p>
                                Then{" "}
                                <a href="https://app.cubeast.com/exports">
                                    download your CSV exports
                                </a>{" "}
                                from Cubeast.
                            </p>
                            <div className="text-center">
                                <a href="https://app.cubeast.com/exports">
                                    <img
                                        className="img-fluid w-75"
                                        src={require("../Assets/CubeastDownload.png")}
                                        alt="Cubeast download CSV exports page"
                                    />
                                </a>
                            </div>
                        </div>

                        <div className="mb-3">
                            <h6>From Acubemy</h6>
                            <p>
                                For Acubemy, export your solves as a CSV from{" "}
                                <strong>Settings &gt; Export Data</strong> (requires a premium account).
                            </p>
                        </div>
                    </section>

                    <section className="mb-4">
                        <h5>Upload to Cubeast Analyzer</h5>
                        <p>
                            Finally, upload one or more CSV files (from Cubeast and/or Acubemy) to Cubeast Analyzer to see your combined stats.
                        </p>
                        <div className="text-center">
                            <img
                                className="img-fluid w-75"
                                src={require("../Assets/AnalyzerSteps.png")}
                                alt="Steps to upload CSV files into Cubeast Analyzer"
                            />
                        </div>
                    </section>

                    <section>
                        <h5>Make the most of your stats</h5>
                        <p>
                            To get actionable data out of this tool, spend some time exploring your solves until you can answer questions like:
                        </p>
                        <ol>
                            <li>What is causing the worst 10% of your solves?</li>
                            <li>What is your slowest step, and what is your slowest case?</li>
                            <li>What makes your good solves different from your bad solves?</li>
                        </ol>
                    </section>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => { this.props.onCloseHandler() }}>
                        Close
                    </Button>
                </Modal.Footer>
            </Modal>
        )
    }
}
