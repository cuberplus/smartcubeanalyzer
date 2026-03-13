import { Option } from "react-multi-select-component"

export enum MethodName {
    CFOP = 'CFOP',
    CFOP_2OLL = 'CFOP (2 look OLL)',
    CFOP_4LL = 'CFOP (4 look LL)',
    Roux = 'Roux',
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
    F2L = 'F2L'
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
    inspectionTime: number,
    recognitionTime: number,
    executionTime: number,
    turns: number,
    steps: Step[],
    isCorrupt: boolean,
    method: MethodName,
    session: string,
    isMistake: boolean,
    isFullStep: boolean
}

export interface AppState {
    solves: Solve[]
}

export interface FilterPanelProps {
    solves: Solve[]
}

export interface FilterPanelState {
    allSolves: Solve[],
    filteredSolves: Solve[],
    filters: Filters,

    // Objects required for filter objects to work
    chosenSteps: Option[],
    chosenColors: Option[],
    chosenPLLs: Option[],
    chosenOLLs: Option[],
    chosenSessions: Option[],
    solveCleanliness: Option[],
    solveLuckiness: Option[],
    chosenSources: Option[],
    tabKey: number,
    windowSize: number,
    pointsPerGraph: number,
    showFilters: boolean,
    showTestAlert: boolean,
    badTime: number,
    goodTime: number,
    method: Option,
    useLogScale: boolean
}

export interface FileInputProps {

}

export interface FileInputState {
    solves: Solve[],
    showHelpModal: boolean
}

export interface ChartPanelProps {
    windowSize: number,
    pointsPerGraph: number,
    solves: Solve[],
    badTime: number,
    goodTime: number,
    methodName: MethodName,
    steps: StepName[],
    useLogScale: boolean
}

export interface ChartPanelState {

}

export interface StepDrilldownProps {
    windowSize: number,
    pointsPerGraph: number,
    steps: Step[],
    stepName: string,
    methodName: MethodName
}

export interface StepDrilldownState {

}

export interface HelpPanelProps {
    showHelpPanel: boolean,
    onCloseHandler: any
}

export interface HelpPanelState {

}

export interface Deviations {
    dev_total: number,
    dev: number[],
    avg_total: number,
    avg: number[]
}

export interface Records {
    best: number,
    bestAo5: number,
    bestAo12: number,
    bestAo100: number
}

export interface FastestSolve {
    time: string,
    date: string,
    scramble: string,
    id: string,
    source: 'cubeast' | 'acubemy',
    fullstep: string,
    rawSourceId?: string
}

export interface StreakData {
    longestStreak: number,
    currentStreak: number,
}