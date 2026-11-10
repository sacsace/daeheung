// Jest setup file for MVS Backend
import { config } from 'dotenv';

// Load environment variables
config();

// Set test environment
process.env.NODE_ENV = 'test';

// Mock console methods to reduce noise during tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Global test timeout
jest.setTimeout(10000);

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Global teardown
afterAll(async () => {
  // Close any open handles
  await new Promise(resolve => setTimeout(resolve, 100));
});

// Jest setup 파일이므로 테스트가 없어도 경고를 방지
describe('Jest Setup', () => {
  test('Setup file loaded successfully', () => {
    expect(true).toBe(true);
  });
});