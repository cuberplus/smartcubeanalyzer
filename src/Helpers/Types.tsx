// Local Option type, matching react-multi-select-component's interface, but without
// pulling in React so this file can be safely imported by Web Workers.
// The chart.js import is type-only, so it is erased before the worker bundle is built.
import type { ChartData, DefaultDataPoint } from 'chart.js/auto';

/** Every chart in this app labels its axis with strings, so TLabel is pinned rather than left as Chart.js' default. */
export type LabelledChart<T extends 'line' | 'bar' | 'doughnut', TLabel = string> = ChartData<T, DefaultDataPoint<T>, TLabel>;

export interface Option<TValue extends string = string> { value: TValue; label: string; key?: string; disabled?: boolean; }

/** A collapsible sub-menu of related options inside a single dropdown. */
export interface OptionGroup<TValue extends string = string> { label: string; options: Option<TValue>[]; }

/** The subset of T's keys whose values are assignable to V. */
export type KeysOfType<T, V> = { [K in keyof T]-?: T[K] extends V ? K : never }[keyof T];

export enum MethodName {
    CFOP = 'CFOP',
    CFOP_2OLL = 'CFOP (2 look OLL)',
    CFOP_4LL = 'CFOP (4 look LL)',
    Roux = 'Roux',
    ZZ = 'ZZ',
    LayerByLayer = 'Layer by Layer'
    // CFOP_2PLL = 'CFOP (2 look PLL)',
    // Petrus?
}

export enum CrossColor {
    White = 'White',
    Yellow = 'Yellow',
    Red = 'Red',
    Orange = 'Orange',
    Blue = 'Blue',
    Green = 'Green',
    Unknown = 'Unknown'
}

export enum StepName {
    Cross = 'Cross',
    F2L_1 = 'F2L Slot 1',
    F2L_2 = 'F2L Slot 2',
    F2L_3 = 'F2L Slot 3',
    F2L_4 = 'F2L Slot 4',
    OLL = 'OLL',
    PLL = 'PLL',
    EOLL = 'EOLL',
    COLL = 'OCLL',
    EPLL = 'EPLL',
    CPLL = 'CPOLL',
    LEFTBLOCK = 'Left block',
    RIGHTBLOCK = 'Right block',
    CMLL = 'CMLL',
    LSE = 'LSE',
    F2L = 'F2L',
    EOLINE = 'EOLine',
    ZBLL = 'ZBLL'
}

export enum ChartType {
    Line = 'Line',
    Bar = 'Bar',
    Doughnut = "Doughnut"
}

export enum SolveCleanliness {
    Clean = "Clean",
    Mistake = "Mistake",
}

export enum SolveLuckiness {
    FullStep = "FullStep",
    Skip = "Skip"
}

export enum PllCornerPermutation {
    Solved = "Solved",
    Adjacent = "Adjacent",
    Diagonal = "Diagonal"
}

export enum OllEdgeOrientation {
    Dot = "Dot",
    Line = "Line",
    Angle = "Angle",
    Cross = "Cross"
}

export interface Filters {
    crossColors: CrossColor[],
    startDate: Date,
    endDate: Date,
    slowestTime: number,
    fastestTime: number,
    pllCases: string[],
    ollCases: string[],
    steps: StepName[],
    solveCleanliness: string[],
    solveLuckiness: string[],
    method: MethodName,
    sessions: string[],
    lowestInspection: number,
    highestInspection: number,
    sources: ('cubeast' | 'acubemy')[]
}

export interface Step {
    time: number,
    executionTime: number,
    recognitionTime: number,
    preAufTime: number,
    postAufTime: number,
    turns: number,
    tps: number,
    moves: string,
    case: string,
    name: StepName
}

export interface Solve {
    id: string,
    source: 'cubeast' | 'acubemy',
    rawSourceId?: string,
    rawSource?: string,
    time: number,
    date: Date,
    crossColor: CrossColor,
    scramble: string,
    tps: number,
    // `null` means the source/CSV didn't report inspection time (e.g. Acubemy exports).
    inspectionTime: number | null,
    recognitionTime: number,
    executionTime: number,
    preAufTime: number,
    postAufTime: number,
    turns: number,
    steps: Step[],
    isCorrupt: boolean,
    method: MethodName,
    session: string,
    isMistake: boolean,
    isFullStep: boolean
}

/** Returns the step with the given name from a solve's steps array. */
export function getStep(solve: Solve, name: StepName): Step | undefined {
    return solve.steps.find(s => s.name === name);
}

export interface FilterPanelProps {
    solves: Solve[],
    suggestedMethod?: Option<MethodName>,
    suggestedSessions?: Option[],
    suggestedWindowSize?: number,
    showTestAlert?: boolean,
    isParsing?: boolean,
    onMethodChange?: (method: MethodName) => void
}

export interface FilterPanelState {
    allSolves: Solve[],
    filteredSolves: Solve[],
    compressedSolves: Solve[],
    lastAppliedSolves: Solve[],
    lastAppliedFilters: Filters | null,
    lastAppliedWindowSize: number,
    filters: Filters,

    // Objects required for filter objects to work
    chosenSteps: Option<StepName>[],
    chosenColors: Option[],
    chosenPLLs: Option[],
    chosenOLLs: Option[],
    chosenSessions: Option[],
    solveCleanliness: Option[],
    solveLuckiness: Option[],
    chosenSources: Option[],
    tabKey: number,
    autoWindowSize: boolean,
    autoBenchmarks: boolean,
    windowSize: number,
    pointsPerGraph: number,
    showFilters: boolean,
    showTestAlert: boolean,
    badTime: number,
    goodTime: number,
    method: Option<MethodName>,
    useLogScale: boolean,
    use4SegmentTiming: boolean
}

export interface FileInputProps { }

export interface FileInputState {
    solves: Solve[],
    showHelpModal: boolean,
    suggestedMethod?: Option<MethodName>,
    suggestedSessions?: Option[],
    suggestedWindowSize?: number,
    showTestAlert?: boolean,
    isParsing: boolean,
    currentMethod: MethodName
}

export interface ChartPanelProps {
    windowSize: number,
    pointsPerGraph: number,
    solves: Solve[],
    badTime: number,
    goodTime: number,
    methodName: MethodName,
    steps: StepName[],
    useLogScale: boolean,
    use4SegmentTiming: boolean
}

export interface ChartPanelState { chartData: ChartDataBundle | null; isComputing: boolean; }

/** A record chart plots one point per personal best, so its x axis is a date rather than a category. */
export type DatedPoint = { x: Date; y: number };

/**
 * Everything the chart worker computes for a single render, keyed by chart.
 * Optional entries are only produced when the relevant steps are selected.
 */
export interface ChartDataBundle {
    runningAverage: LabelledChart<'line'>;
    runningStdDev: LabelledChart<'line'>;
    runningTps: LabelledChart<'line'>;
    runningInspection: LabelledChart<'line'> | null;
    runningTurns: LabelledChart<'line'>;
    runningRecognitionExecution: LabelledChart<'line'>;
    runningEfficiency: LabelledChart<'line'>;
    histogram: LabelledChart<'bar', number>;
    stepAverages: LabelledChart<'line'>;
    runningColorPercentages: LabelledChart<'line'>;
    inspection: LabelledChart<'bar'> | null;
    dailyRecord: LabelledChart<'line'>;
    streakRows: StreakRow[];
    recordRows: RecordRow[];
    goodBad: LabelledChart<'line'>;
    recordHistory: ChartData<'line', DatedPoint[], string>;
    stepPercentages: LabelledChart<'doughnut'>;
    typicalCompare: LabelledChart<'bar'>;
    bestSolvesData: FastestSolve[];
    ollCategory?: LabelledChart<'line'>;
    pllCategory?: LabelledChart<'line'>;
    caseData?: LabelledChart<'bar'>;
    algoPracticeRows?: AlgoPracticeRow[];
}

export interface StreakRow { time: string; currentstreak: string; longeststreak: string; }

export interface RecordRow { recordType: string; time: string; }

export interface AlgoPracticeRow {
    case: string;
    total: number;
    failed: number;
    failureRate: string;
    avgMoves: string;
    expectedMoves: number;
    avgWasted: string;
    avgTime: string;
}

export interface HelpPanelProps { showHelpPanel: boolean, onCloseHandler: () => void }

export interface HelpPanelState { }

export interface FastestSolve {
    time: string,
    date: string,
    scramble: string,
    id: string,
    source: 'cubeast' | 'acubemy',
    fullstep: string,
    rawSourceId?: string
}

export interface StreakData { longestStreak: number, currentStreak: number }

export interface RedundantPair {
    startIdx: number,
    endIdx: number,
    moves: string
}

export interface MoveAnalysisResult {
    originalTurns: number,
    simplifiedTurns: number,
    wastedMoves: number,
    redundantPairs: RedundantPair[]
}

export interface CaseStats {
    caseName: string,
    totalCount: number,
    failureCount: number,
    failureRate: number,
    avgMoves: number,
    /** Expected move count before tolerance (for display). */
    expectedMovesBase: number,
    /** Expected move count with tolerance (used for failure detection). */
    expectedMoves: number,
    instances: { solveId: string; turns: number; failed: boolean }[]
}

export interface AufInefficiency {
    preAufMoves: number,
    postAufMoves: number,
    totalAufTime: number,
    isHighCost: boolean
}

export interface SolveEfficiency {
    moveEfficiency: number,
    hadOllFailure: boolean,
    hadPllFailure: boolean
}
