#!/usr/bin/env node

/**
 * Verify npm workspace configuration
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying npm workspace configuration...\n');

// Check npm version
console.log('📌 Checking npm version...');
const npmVersion = execSync('npm --version').toString().trim();
const majorVersion = parseInt(npmVersion.split('.')[0]);

if (majorVersion < 7) {
  console.error(`❌ npm version ${npmVersion} does not support workspaces.`);
  console.error('   Please upgrade to npm 7 or higher.');
  process.exit(1);
} else {
  console.log(`✅ npm version ${npmVersion} supports workspaces\n`);
}

// Check root package.json
console.log('📋 Checking root package.json...');
const rootPkgPath = path.join(__dirname, '..', 'package.json');
const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));

if (!rootPkg.workspaces) {
  console.error('❌ No workspaces field in root package.json');
  process.exit(1);
}

console.log('✅ Workspaces configured:');
rootPkg.workspaces.forEach(ws => console.log(`   - ${ws}`));

// List all workspaces
console.log('\n📦 Detected workspace packages:');
try {
  const workspaces = execSync('npm ls --json --depth=0', { 
    encoding: 'utf8',
    cwd: path.join(__dirname, '..')
  });
  
  const wsData = JSON.parse(workspaces);
  const deps = { ...wsData.dependencies, ...wsData.devDependencies };
  
  const workspacePackages = Object.entries(deps)
    .filter(([name, info]) => info.resolved && info.resolved.startsWith('file:'))
    .map(([name]) => name);
  
  if (workspacePackages.length === 0) {
    console.log('   No workspace packages found. Run "npm install" first.');
  } else {
    workspacePackages.forEach(pkg => console.log(`   ✅ ${pkg}`));
  }
} catch (error) {
  console.log('   ⚠️  Cannot list workspaces. Run "npm install" first.');
}

// Check for workspace protocol in dependencies
console.log('\n🔗 Checking workspace protocol usage...');
const packagesDir = path.join(__dirname, '..', 'packages');
let protocolUsage = 0;

fs.readdirSync(packagesDir).forEach(dir => {
  const pkgPath = path.join(packagesDir, dir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    
    Object.entries(allDeps).forEach(([dep, version]) => {
      if (version === '0.1.0' || version === 'workspace:^') {
        protocolUsage++;
        console.log(`   ✅ ${pkg.name} → ${dep} (${version})`);
      }
    });
  }
});

if (protocolUsage === 0) {
  console.log('   ⚠️  No workspace protocol usage found');
}

// Check for common issues
console.log('\n⚠️  Checking for common issues...');
let issues = 0;

// Check for lerna.json
if (fs.existsSync(path.join(__dirname, '..', 'lerna.json'))) {
  console.log('   ❌ lerna.json still exists - should be removed');
  issues++;
}

// Check for lerna in dependencies
if (rootPkg.devDependencies && rootPkg.devDependencies.lerna) {
  console.log('   ❌ Lerna is still in devDependencies - should be removed');
  issues++;
}

// Check for old lerna scripts
const lernaScripts = Object.entries(rootPkg.scripts || {})
  .filter(([name, cmd]) => cmd.includes('lerna'));

if (lernaScripts.length > 0) {
  console.log('   ❌ Found lerna commands in scripts:');
  lernaScripts.forEach(([name, cmd]) => console.log(`      - ${name}: ${cmd}`));
  issues++;
}

if (issues === 0) {
  console.log('   ✅ No issues found');
}

// Summary
console.log('\n' + '='.repeat(50));
if (issues === 0) {
  console.log('✅ Workspace configuration looks good!');
  console.log('\nUseful commands:');
  console.log('  npm install                    - Install all dependencies');
  console.log('  npm run build                  - Build all packages');
  console.log('  npm run test                   - Test all packages');
  console.log('  npm run lint                   - Lint all packages');
  console.log('  npm run clean                  - Clean all packages');
  console.log('  npm run build -w @pkg/name     - Build specific package');
  console.log('  npm ls                         - List all packages');
} else {
  console.log(`❌ Found ${issues} issue(s) with workspace configuration`);
  console.log('\nPlease fix the issues above and run this script again.');
  process.exit(1);
}
