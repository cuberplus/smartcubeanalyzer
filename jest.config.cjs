module.exports = {
    preset: 'ts-jest/presets/default',
    testEnvironment: 'node',
    testMatch: ['**/src/tests/**/*.test.ts?(x)'],
    moduleNameMapper: {
        '^.+/Workers/createChartWorker$': '<rootDir>/src/Workers/__mocks__/createChartWorker.ts',
        '\\.(css|png|jpe?g|gif|svg)$': '<rootDir>/src/__mocks__/fileMock.js',
    },
};
