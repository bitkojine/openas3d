const baseConfig = require('./jest.config');

module.exports = {
    ...baseConfig,
    testMatch: [
        "<rootDir>/src/test/perf/**/*.perf.test.ts"
    ],
    testPathIgnorePatterns: [
        "/node_modules/"
    ],
    collectCoverage: false,
    verbose: true
};
