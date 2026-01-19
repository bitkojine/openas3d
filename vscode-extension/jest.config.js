const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Transform TypeScript files using ts-jest
  transform: {
    ...tsJestTransformCfg,
  },

  // Mock vscode for tests
  moduleNameMapper: {
    '^vscode$': '<rootDir>/src/__mocks__/vscode.ts',
  },

  // Automatically clear mocks between tests
  clearMocks: true,

  // Collect test coverage
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],

  // Include only src files in coverage
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/__tests__/**",
    "!src/out/**"
  ],

  // Optional: verbose test output
  verbose: true,
};
