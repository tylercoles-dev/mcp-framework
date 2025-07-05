#!/usr/bin/env node

/**
 * Coverage reporter that aggregates coverage from all packages
 */

const fs = require('fs');
const path = require('path');

const packages = [
  'mcp-server',
  'mcp-auth', 
  'mcp-transport-stdio',
  'mcp-transport-http',
  'mcp-auth-authentik'
];

console.log('📊 Coverage Report Summary\n');
console.log('Package'.padEnd(25) + 'Statements'.padEnd(12) + 'Branches'.padEnd(12) + 'Functions'.padEnd(12) + 'Lines');
console.log('─'.repeat(70));

const totals = {
  statements: { covered: 0, total: 0 },
  branches: { covered: 0, total: 0 },
  functions: { covered: 0, total: 0 },
  lines: { covered: 0, total: 0 }
};

for (const pkg of packages) {
  const coveragePath = path.join(__dirname, '..', 'packages', pkg, 'coverage', 'coverage-summary.json');
  
  if (!fs.existsSync(coveragePath)) {
    console.log(`${pkg.padEnd(25)}No coverage data`);
    continue;
  }

  try {
    const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
    const summary = coverage.total;
    
    // Update totals
    totals.statements.covered += summary.statements.covered;
    totals.statements.total += summary.statements.total;
    totals.branches.covered += summary.branches.covered;
    totals.branches.total += summary.branches.total;
    totals.functions.covered += summary.functions.covered;
    totals.functions.total += summary.functions.total;
    totals.lines.covered += summary.lines.covered;
    totals.lines.total += summary.lines.total;
    
    // Format percentages
    const stmtPct = `${summary.statements.pct}%`.padEnd(12);
    const branchPct = `${summary.branches.pct}%`.padEnd(12);
    const funcPct = `${summary.functions.pct}%`.padEnd(12);
    const linePct = `${summary.lines.pct}%`;
    
    console.log(`${pkg.padEnd(25)}${stmtPct}${branchPct}${funcPct}${linePct}`);
  } catch (error) {
    console.log(`${pkg.padEnd(25)}Error reading coverage`);
  }
}

// Calculate total percentages
console.log('─'.repeat(70));
const totalStmtPct = totals.statements.total > 0 ? 
  ((totals.statements.covered / totals.statements.total) * 100).toFixed(2) : '0';
const totalBranchPct = totals.branches.total > 0 ?
  ((totals.branches.covered / totals.branches.total) * 100).toFixed(2) : '0';
const totalFuncPct = totals.functions.total > 0 ?
  ((totals.functions.covered / totals.functions.total) * 100).toFixed(2) : '0';
const totalLinePct = totals.lines.total > 0 ?
  ((totals.lines.covered / totals.lines.total) * 100).toFixed(2) : '0';

console.log(`${'TOTAL'.padEnd(25)}${(totalStmtPct + '%').padEnd(12)}${(totalBranchPct + '%').padEnd(12)}${(totalFuncPct + '%').padEnd(12)}${totalLinePct}%`);

// Check if coverage meets thresholds
const threshold = 80; // Default threshold
const failed = [];

if (parseFloat(totalStmtPct) < threshold) failed.push('statements');
if (parseFloat(totalBranchPct) < threshold) failed.push('branches');
if (parseFloat(totalFuncPct) < threshold) failed.push('functions');
if (parseFloat(totalLinePct) < threshold) failed.push('lines');

if (failed.length > 0) {
  console.log(`\n⚠️  Coverage below ${threshold}% threshold for: ${failed.join(', ')}`);
  process.exit(1);
} else {
  console.log(`\n✅ All coverage metrics above ${threshold}% threshold!`);
}
