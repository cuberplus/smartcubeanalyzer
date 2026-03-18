# SmartcubeAnalyzer

SmartcubeAnalyzer is a tool designed to analyze and visualize data related to cube solving. It provides various statistical functions and visualizations to help users understand their performance and improve their solving skills.

## Features

- **Average Time**: Displays the running average time of solves.
- **Average Recognition and Execution**: Shows the running average split by recognition and execution times.
- **Count of Solves by How Long They Took**: Visualizes the number of solves within specific time ranges.
- **Average Turns Per Second (TPS)**: Displays the average TPS and TPS during execution.
- **Average Turns**: Shows the average number of turns per solve.
- **Solve Efficiency**: Shows move efficiency ratio (after cancelling redundant same-face moves; 100% = no wasted moves), OLL/PLL failure rates, and a combined solve efficiency.
- **Top 100 Fastest Solves**: Lists the top 100 fastest solves given the current filters.
- **Average Standard Deviation**: Displays the running standard deviation of solve times.
- **Percentage of Solves by Cross Color**: Shows the percentage of solves starting with each cross color.
- **Average solve time by inspection time**: Visualizes the average solve time grouped by inspection time (e.g. the left bar is the 1/7 of solves with the lowest inspection time, the right bar the 1/7 with the most).
- **Average Time by Step**: Displays the average time taken for each step of the solve.
- **Average Inspection Time**: Shows the running average inspection time.
- **Longest Daily Streaks**: Shows how many days in a row you've achieved solves at each time threshold.
- **Daily Fastest Solve**: Shows the fastest solve for each day based on the selected filters.
- **Current Records**: Shows your current records for Single, Ao5, Ao12, Ao100, and Ao1000.
- **OLL Edge Orientation** (when OLL selected): Displays the percentage of OLL cases by edge orientation.
- **PLL Corner Permutation** (when PLL selected): Shows the percentage of PLL cases by corner permutation.
- **Time Per Step Compared to Typical Solver** (when CFOP with all steps): Compares your step times to those of a typical solver at your average; typical data is from Felix Zemdegs's CubeSkills blog.
- **Percentage of the Solve Each Step Took** (when 2+ steps selected): Doughnut chart of what percentage of your solve each step takes.
- **Average Recognition Time and Execution Time per Case** (when OLL or PLL only): Bar chart of recognition and execution time per last-layer algorithm, sorted by duration.
- **Algorithm Practice** (when OLL or PLL only): Per-case failure rate and move efficiency; "Failed" means core move count exceeded mode/average for that case; "Avg Wasted" shows redundant same-face moves that could be cancelled.
- **Percentage of Good and Bad Solves** (when all steps selected): Displays the percentage of solves considered good or bad based on user-defined criteria in the filter panel.
- **History of Records** (when all steps selected): Shows the history of personal bests (PBs) for single, Ao5, Ao12, Ao100, and Ao1000; only includes solves that meet the current filters.

Some charts appear only for certain method or step selections; the list above notes the main conditions in parentheses.

## Supported data sources

SmartcubeAnalyzer can import and analyze solves exported from:

- **Cubeast** ([cubeast.com](https://www.cubeast.com/))
- **Acubemy** ([acubemy.com](https://acubemy.com/))

Both timer apps record:

- Detailed step splits  
- Recognition and execution times  
- Per-move timestamps  

In addition:

- **Acubemy** stores gyro-based cube rotations  
- **Cubeast** records inspection time  

All sources are normalized so that metrics such as total time, recognition/execution splits, turns, and TPS are comparable across platforms.

## How timings are interpreted

- **Cubeast AUFs**: Cubeast records AUF moves (U / U' / U2 / U3) at the start of a step as part of recognition. SmartcubeAnalyzer detects these leading AUFs in each step (except for Cross) and **moves their duration from recognition into execution**. This makes execution stats better reflect the actual turning you do, while still keeping total step time unchanged.
- **Acubemy rotations**: Acubemy records cube rotations in execution using gyro data, which can include spurious rotations that do not correspond to real turns and would otherwise inflate execution times. SmartcubeAnalyzer **strips rotation moves from the solution** so that turn counts, TPS, and step moves use only actual turns. When recomputing step recognition/execution, the timeline is already rotation-free; the time between the previous step’s last move and the current step’s first move (which in the raw data may include rotations) is assigned as **recognition time for the current step**, matching the same behavior used for Cubeast after AUF correction.

## Installation

To install the dependencies, run:

```bash
npm install
```

## Running the app

To start the development server, run:

```bash
npm start
```

This builds the app and starts a local development server (typically on `http://localhost:3000`), where you can explore the dashboards and visualizations.

## Importing solve data

Once the app is running:

1. Export your solves from Cubeast or Acubemy.  
2. Import the exported files into SmartcubeAnalyzer. You can upload one or more CSV files (from Cubeast and/or Acubemy) to Smartcube Analyzer and display your combined stats!
3. Explore the dashboards to drill into timings, TPS, and step-level performance.

## Running Tests

To run the tests, use:

```bash
npm test
```

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

This project is licensed under the MIT License.

## Check it out!

To try it out for yourself, visit [cuberplus.com](https://cuberplus.com).
