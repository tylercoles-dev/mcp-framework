import { describe, it, expect } from 'vitest';
import * as exports from '../src/index';

describe('module exports', () => {
  it('should export all auth providers', () => {
    expect(exports.AuthProvider).toBeDefined();
    expect(exports.NoAuth).toBeDefined();
    expect(exports.DevAuth).toBeDefined();
    expect(exports.BearerTokenAuth).toBeDefined();
    expect(exports.SessionAuth).toBeDefined();
    expect(exports.OAuthProvider).toBeDefined();
  });
});
