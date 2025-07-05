#!/usr/bin/env node

/**
 * Test runner for all packages
 * Runs tests with coverage reporting
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const packages = [
  'mcp-server',
  'mcp-auth',
  'mcp-transport-stdio',
  'mcp-transport-http',
  'mcp-auth-authentik'
];

console.log('🧪 Running tests for all packages...\n');

let totalTests = 0;
let passedPackages = 0;
let failedPackages = [];

for (const pkg of packages) {
  const packagePath = path.join(__dirname, 'packages', pkg);
  
  if (!fs.existsSync(packagePath)) {
    console.log(`⚠️  Package ${pkg} not found, skipping...`);
    continue;
  }

  console.log(`\n📦 Testing @tylercoles/${pkg}...`);
  console.log('─'.repeat(50));

  try {
    // Run tests with coverage
    execSync('npm test -- --coverage --silent', {
      cwd: packagePath,
      stdio: 'inherit'
    });
    
    passedPackages++;
    console.log(`✅ ${pkg} tests passed!`);
  } catch (error) {
    failedPackages.push(pkg);
    console.error(`❌ ${pkg} tests failed!`);
  }
}

console.log('\n' + '═'.repeat(50));
console.log('📊 Test Summary:');
console.log(`   Packages tested: ${packages.length}`);
console.log(`   ✅ Passed: ${passedPackages}`);
console.log(`   ❌ Failed: ${failedPackages.length}`);

if (failedPackages.length > 0) {
  console.log(`\n   Failed packages: ${failedPackages.join(', ')}`);
  process.exit(1);
} else {
  console.log('\n🎉 All tests passed!');
}
