#!/usr/bin/env node

/**
 * Build script for the monorepo
 * Ensures packages are built in the correct order based on dependencies
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const packages = [
  // Build order matters - dependencies first
  'mcp-server',
  'mcp-auth', 
  'mcp-transport-stdio',
  'mcp-transport-http',
  'mcp-auth-authentik'
];

console.log('🏗️  Building @tylercoles/mcp-framework packages...\n');

// Clean all packages first
console.log('🧹 Cleaning previous builds...');
try {
  execSync('npm run clean', { stdio: 'inherit' });
} catch (e) {
  console.log('Clean step skipped (may not exist yet)');
}

// Build each package in order
for (const pkg of packages) {
  const pkgPath = path.join('packages', pkg);
  const pkgJsonPath = path.join(pkgPath, 'package.json');
  
  if (!fs.existsSync(pkgJsonPath)) {
    console.log(`⚠️  Skipping ${pkg} - package.json not found`);
    continue;
  }
  
  console.log(`\n📦 Building @tylercoles/${pkg}...`);
  
  try {
    execSync('npm run build', {
      cwd: pkgPath,
      stdio: 'inherit'
    });
    console.log(`✅ @tylercoles/${pkg} built successfully`);
  } catch (error) {
    console.error(`❌ Failed to build @tylercoles/${pkg}`);
    console.error(error.message);
    process.exit(1);
  }
}

// Build examples
console.log('\n📚 Building examples...');
const examplesDir = 'examples';
if (fs.existsSync(examplesDir)) {
  const examples = fs.readdirSync(examplesDir).filter(dir => {
    const pkgJsonPath = path.join(examplesDir, dir, 'package.json');
    return fs.existsSync(pkgJsonPath);
  });
  
  for (const example of examples) {
    console.log(`\n🔨 Building ${example} example...`);
    try {
      execSync('npm run build', {
        cwd: path.join(examplesDir, example),
        stdio: 'inherit'
      });
      console.log(`✅ ${example} example built successfully`);
    } catch (error) {
      console.error(`❌ Failed to build ${example} example`);
      console.error(error.message);
      // Don't exit on example failures
    }
  }
}

console.log('\n✨ Build complete!');
