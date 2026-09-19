/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(jose)/)'
  ],
  transform: {
    '^.+\\.(ts|tsx|js|jsx|mjs)$': ['ts-jest', { tsconfig: { allowJs: true } }],
  },
};
