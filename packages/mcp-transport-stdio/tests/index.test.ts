import { describe, it, expect } from 'vitest';
import { StdioTransport } from '../src/index';

describe('module exports', () => {
  it('should export StdioTransport', () => {
    expect(StdioTransport).toBeDefined();
  });
});
