#!/usr/bin/env node

/**
 * Publish packages using npm workspaces
 * Handles versioning and publishing in dependency order
 */

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

// Publishing order based on dependencies
const publishOrder = [
  '@tylercoles/mcp-server',
  '@tylercoles/mcp-auth',
  '@tylercoles/mcp-transport-stdio',
  '@tylercoles/mcp-transport-http',
  '@tylercoles/mcp-auth-authentik'
];

async function getPackageInfo(packageName) {
  const pkgPath = path.join(__dirname, '..', 'packages', packageName.replace('@tylercoles/', ''), 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  return { path: pkgPath, current: pkg.version, name: pkg.name };
}

async function main() {
  console.log('📦 MCP Framework Package Publisher\n');

  // Check if we're logged in to npm
  try {
    execSync('npm whoami', { stdio: 'ignore' });
  } catch {
    console.error('❌ Not logged in to npm. Please run: npm login');
    process.exit(1);
  }

  // Show current versions
  console.log('Current package versions:');
  for (const pkgName of publishOrder) {
    const { current } = await getPackageInfo(pkgName);
    console.log(`  ${pkgName}: ${current}`);
  }

  console.log('\nVersion bump options:');
  console.log('  1. patch (bug fixes)');
  console.log('  2. minor (new features)');
  console.log('  3. major (breaking changes)');
  console.log('  4. prerelease (alpha/beta)');
  console.log('  5. custom version');
  console.log('  6. skip (no version change)\n');

  const choice = await question('Select version bump type (1-6): ');
  
  let versionType;
  switch (choice.trim()) {
    case '1': versionType = 'patch'; break;
    case '2': versionType = 'minor'; break;
    case '3': versionType = 'major'; break;
    case '4': versionType = 'prerelease'; break;
    case '5': 
      versionType = await question('Enter custom version: ');
      break;
    case '6': 
      versionType = null;
      break;
    default:
      console.error('Invalid choice');
      process.exit(1);
  }

  // Build all packages first
  console.log('\n🔨 Building all packages...');
  try {
    execSync('npm run build', { stdio: 'inherit' });
  } catch (error) {
    console.error('❌ Build failed. Fix errors before publishing.');
    process.exit(1);
  }

  // Run tests
  console.log('\n🧪 Running tests...');
  try {
    execSync('npm test', { stdio: 'inherit' });
  } catch (error) {
    console.error('❌ Tests failed. Fix failing tests before publishing.');
    process.exit(1);
  }

  // Version bump if requested
  if (versionType) {
    console.log(`\n📝 Updating versions to ${versionType}...`);
    
    for (const pkgName of publishOrder) {
      try {
        if (versionType.match(/^\d+\.\d+\.\d+/)) {
          // Custom version
          execSync(`npm version ${versionType} --workspace=${pkgName}`, { stdio: 'inherit' });
        } else {
          // Standard version type
          execSync(`npm version ${versionType} --workspace=${pkgName}`, { stdio: 'inherit' });
        }
      } catch (error) {
        console.error(`❌ Failed to version ${pkgName}`);
        process.exit(1);
      }
    }
  }

  // Confirm before publishing
  console.log('\n📋 Ready to publish the following packages:');
  for (const pkgName of publishOrder) {
    const { current } = await getPackageInfo(pkgName);
    console.log(`  ${pkgName}@${current}`);
  }

  const confirm = await question('\nProceed with publishing? (yes/no): ');
  if (confirm.toLowerCase() !== 'yes') {
    console.log('Publishing cancelled.');
    process.exit(0);
  }

  // Publish packages
  console.log('\n🚀 Publishing packages...');
  const published = [];
  const failed = [];

  for (const pkgName of publishOrder) {
    console.log(`\nPublishing ${pkgName}...`);
    try {
      execSync(`npm publish --workspace=${pkgName} --access=public`, { stdio: 'inherit' });
      published.push(pkgName);
      console.log(`✅ ${pkgName} published successfully!`);
    } catch (error) {
      failed.push(pkgName);
      console.error(`❌ Failed to publish ${pkgName}`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Publishing Summary:');
  console.log(`   ✅ Published: ${published.length}`);
  console.log(`   ❌ Failed: ${failed.length}`);
  
  if (failed.length > 0) {
    console.log(`\nFailed packages: ${failed.join(', ')}`);
    console.log('\nYou may need to manually publish these packages.');
  } else {
    console.log('\n🎉 All packages published successfully!');
    console.log('\nNext steps:');
    console.log('  1. Push the version tags: git push --tags');
    console.log('  2. Create a GitHub release');
    console.log('  3. Update documentation');
  }

  rl.close();
}

main().catch((error) => {
  console.error('Error:', error);
  rl.close();
  process.exit(1);
});
