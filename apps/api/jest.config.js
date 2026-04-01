/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/tests/**/*.test.ts'],
  globalSetup: '<rootDir>/tests/globalSetup.js',
  setupFiles: ['<rootDir>/tests/setupEnv.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  maxWorkers: 1,
  collectCoverageFrom: ['src/**/*.ts', '!src/index.ts', '!src/**/*.d.ts'],
  coverageDirectory: 'coverage',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.jest.json' }],
  },
};
