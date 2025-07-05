describe('module exports', () => {
  it('should export HttpTransport', () => {
    const { HttpTransport } = require('../src/index');
    expect(HttpTransport).toBeDefined();
  });
});
