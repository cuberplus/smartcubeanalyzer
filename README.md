# CubeastAnalyzer

CubeastAnalyzer is a tool designed to analyze and visualize data related to cube solving. It provides various statistical functions and visualizations to help users understand their performance and improve their solving skills.

## Features

- **Average Time**: Displays the running average time of solves.
- **Average Recognition and Execution**: Shows the running average split by recognition and execution times.
- **Count of Solves by Time**: Visualizes the number of solves within specific time ranges.
- **Average Turns Per Second (TPS)**: Displays the average TPS and TPS during execution.
- **Average Turns**: Shows the average number of turns per solve.
- **Top Fastest Solves**: Lists the top fastest solves.
- **Average Standard Deviation**: Displays the running standard deviation of solve times.
- **Percentage of Solves by Cross Color**: Shows the percentage of solves starting with each cross color.
- **Solve Time by Inspection Time**: Visualizes the average solve time grouped by inspection time.
- **Average Time by Step**: Displays the average time taken for each step of the solve.
- **Average Inspection Time**: Shows the running average inspection time.
- **OLL Edge Orientation**: Displays the percentage of OLL cases by edge orientation.
- **PLL Corner Permutation**: Shows the percentage of PLL cases by corner permutation.
- **Time Per Step Compared to Typical Solver**: Compares the user's step times to those of a typical solver.
- **Percentage of Good and Bad Solves**: Displays the percentage of solves considered good or bad based on user-defined criteria.
- **History of Records**: Shows the history of personal bests (PBs) for single, Ao5, and Ao12.

## Supported data sources

CubeastAnalyzer can import and analyze solves exported from:

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

- **Cubeast AUFs**: Cubeast records AUF moves (U / U' / U2 / U3) at the start of a step as part of recognition. CubeastAnalyzer detects these leading AUFs in each step (except for Cross) and **moves their duration from recognition into execution**. This makes execution stats better reflect the actual turning you do, while still keeping total step time unchanged.
- **Acubemy rotations**: Acubemy records cube rotations in execution using gyro data, which can include spurious rotations that do not correspond to real turns and would otherwise inflate execution times. CubeastAnalyzer **ignores cube rotations when counting turns and TPS**, and when recomputing step timings it treats rotations that occur between steps as **recognition time for the next step**, matching the same behavior used for Cubeast after AUF correction.

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
2. Import the exported files into CubeastAnalyzer. You can upload one or more CSV files (from Cubeast and/or Acubemy) to Cubeast Analyzer and display your combined stats!
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
