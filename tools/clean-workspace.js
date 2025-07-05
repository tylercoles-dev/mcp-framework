#!/usr/bin/env node

/**
 * Clean all packages and node_modules
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧹 Cleaning workspace...\n');

// Clean each workspace
console.log('📦 Running clean in all workspaces...');
try {
  execSync('npm run clean --workspaces --if-present', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });
} catch (error) {
  console.error('Warning: Some workspaces failed to clean');
}

// Remove root node_modules
console.log('\n🗑️  Removing root node_modules...');
const rootNodeModules = path.join(__dirname, '..', 'node_modules');
if (fs.existsSync(rootNodeModules)) {
  if (process.platform === 'win32') {
    execSync(`rmdir /s /q "${rootNodeModules}"`, { stdio: 'inherit' });
  } else {
    execSync(`rm -rf "${rootNodeModules}"`, { stdio: 'inherit' });
  }
}

// Remove package-lock.json
console.log('🗑️  Removing package-lock.json...');
const lockFile = path.join(__dirname, '..', 'package-lock.json');
if (fs.existsSync(lockFile)) {
  fs.unlinkSync(lockFile);
}

// Clean lerna artifacts if they exist
const lernaCleanup = [
  'lerna-debug.log',
  '.lerna-backup'
];

for (const file of lernaCleanup) {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    console.log(`🗑️  Removing ${file}...`);
    fs.unlinkSync(filePath);
  }
}

console.log('\n✨ Workspace cleaned successfully!');
console.log('\nNext steps:');
console.log('  1. Run "npm install" to reinstall dependencies');
console.log('  2. Run "npm run build" to rebuild all packages');
