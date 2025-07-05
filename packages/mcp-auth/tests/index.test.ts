describe('module exports', () => {
  it('should export all auth providers', () => {
    const exports = require('../src/index');
    
    expect(exports.AuthProvider).toBeDefined();
    expect(exports.NoAuth).toBeDefined();
    expect(exports.DevAuth).toBeDefined();
    expect(exports.BearerTokenAuth).toBeDefined();
    expect(exports.SessionAuth).toBeDefined();
    expect(exports.OAuthProvider).toBeDefined();
  });
});
