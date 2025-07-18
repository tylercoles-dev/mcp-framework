#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { getWorkspacePackages, getPackageDisplayName } from './utils.js';

interface CoverageMetric {
  total: number;
  covered: number;
  skipped: number;
  pct: number;
}

interface CoverageSummary {
  lines: CoverageMetric;
  statements: CoverageMetric;
  functions: CoverageMetric;
  branches: CoverageMetric;
  branchesTrue?: CoverageMetric;
}

interface CoverageReport {
  total: CoverageSummary;
  [key: string]: CoverageSummary;
}

interface CoverageTotals {
  statements: { covered: number; total: number };
  branches: { covered: number; total: number };
  functions: { covered: number; total: number };
  lines: { covered: number; total: number };
}

async function generateCoverageReport() {
  console.log('📊 Coverage Report Summary\n');
  
  const rootPath = path.join(process.cwd());
  const { packages } = getWorkspacePackages(rootPath);
  
  if (packages.length === 0) {
    console.error('❌ No workspace packages found!');
    process.exit(1);
  }
  
  console.log('Package'.padEnd(30) + 'Statements'.padEnd(12) + 'Branches'.padEnd(12) + 'Functions'.padEnd(12) + 'Lines');
  console.log('─'.repeat(74));
  
  const totals: CoverageTotals = {
    statements: { covered: 0, total: 0 },
    branches: { covered: 0, total: 0 },
    functions: { covered: 0, total: 0 },
    lines: { covered: 0, total: 0 }
  };
  
  for (const pkg of packages) {
    const coveragePath = path.join(pkg.path, 'coverage', 'coverage-summary.json');
    const displayName = getPackageDisplayName(pkg.name);
  
    if (!fs.existsSync(coveragePath)) {
      console.log(`${displayName.padEnd(30)}No coverage data`);
      continue;
    }
    
    try {
      const coverageData = fs.readFileSync(coveragePath, 'utf8');
      const coverage: CoverageReport = JSON.parse(coverageData);
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
      const stmtPct = `${summary.statements.pct.toFixed(2)}%`.padEnd(12);
      const branchPct = `${summary.branches.pct.toFixed(2)}%`.padEnd(12);
      const funcPct = `${summary.functions.pct.toFixed(2)}%`.padEnd(12);
      const linePct = `${summary.lines.pct.toFixed(2)}%`;
      
      console.log(`${displayName.padEnd(30)}${stmtPct}${branchPct}${funcPct}${linePct}`);
    } catch (error) {
      console.log(`${displayName.padEnd(30)}Error reading coverage`);
      if (error instanceof Error) {
        console.error(`  └─ ${error.message}`);
      }
    }
  }

  // Calculate total percentages
  console.log('─'.repeat(74));
  const totalStmtPct = totals.statements.total > 0 ? 
    ((totals.statements.covered / totals.statements.total) * 100).toFixed(2) : '0.00';
  const totalBranchPct = totals.branches.total > 0 ?
    ((totals.branches.covered / totals.branches.total) * 100).toFixed(2) : '0.00';
  const totalFuncPct = totals.functions.total > 0 ?
    ((totals.functions.covered / totals.functions.total) * 100).toFixed(2) : '0.00';
  const totalLinePct = totals.lines.total > 0 ?
    ((totals.lines.covered / totals.lines.total) * 100).toFixed(2) : '0.00';
  
  console.log(`${'TOTAL'.padEnd(30)}${(totalStmtPct + '%').padEnd(12)}${(totalBranchPct + '%').padEnd(12)}${(totalFuncPct + '%').padEnd(12)}${totalLinePct}%`);
  
  // Check if coverage meets thresholds
  const threshold = 80; // Default threshold
  const failed: string[] = [];
  
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
}

// Run the report
generateCoverageReport().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});