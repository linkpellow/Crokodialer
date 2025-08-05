import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.ts'],
  verbose: true,
  setupFiles: [
    'dotenv/config'
  ]
};

export default config; 