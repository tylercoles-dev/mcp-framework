describe('module exports', () => {
  it('should export StdioTransport', () => {
    const { StdioTransport } = require('../src/index');
    expect(StdioTransport).toBeDefined();
  });
});
