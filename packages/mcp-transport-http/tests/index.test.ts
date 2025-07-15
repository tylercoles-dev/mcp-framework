import { describe, it, expect } from 'vitest';
import { HttpTransport } from '../src/index';

describe('module exports', () => {
  it('should export HttpTransport', () => {
    expect(HttpTransport).toBeDefined();
  });
});
