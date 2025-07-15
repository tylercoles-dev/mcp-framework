import { describe, it, expect } from 'vitest';

describe('module exports', () => {
  it('should export AuthentikAuth', async () => {
    const { AuthentikAuth } = await import('../src/index');
    expect(AuthentikAuth).toBeDefined();
  });
});
