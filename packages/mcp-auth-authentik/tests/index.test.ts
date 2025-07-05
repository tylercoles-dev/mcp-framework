describe('module exports', () => {
  it('should export AuthentikAuth', () => {
    const { AuthentikAuth } = require('../src/index');
    expect(AuthentikAuth).toBeDefined();
  });
});
