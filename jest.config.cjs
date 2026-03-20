module.exports = {
    preset: 'ts-jest/presets/default',
    testEnvironment: 'node',
    testMatch: ['**/src/tests/**/*.test.tsx'],
    moduleNameMapper: {
        '^.+/Workers/createChartWorker$': '<rootDir>/src/Workers/__mocks__/createChartWorker.ts',
        '\\.css$': '<rootDir>/src/__mocks__/fileMock.js',
    },
};
