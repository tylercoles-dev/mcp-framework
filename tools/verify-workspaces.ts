#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { getWorkspacePackages, getPackageDisplayName } from './utils.js';

interface VerificationIssue {
  type: 'error' | 'warning';
  message: string;
  details?: string[];
}

interface DependencyLink {
  from: string;
  to: string;
  version: string;
}

/**
 * Check npm version for workspace support
 */
function checkNpmVersion(): { version: string; supported: boolean } {
  const npmVersion = execSync('npm --version').toString().trim();
  const majorVersion = parseInt(npmVersion.split('.')[0]);
  
  return {
    version: npmVersion,
    supported: majorVersion >= 7
  };
}

/**
 * Verify workspace configuration
 */
async function verifyWorkspaces() {
  console.log('🔍 Verifying npm workspace configuration...\n');
  
  const issues: VerificationIssue[] = [];
  const rootPath = path.join(__dirname, '..');
  
  // Check npm version
  console.log('📌 Checking npm version...');
  const npmCheck = checkNpmVersion();
  
  if (!npmCheck.supported) {
    console.error(`❌ npm version ${npmCheck.version} does not support workspaces.`);
    console.error('   Please upgrade to npm 7 or higher.');
    process.exit(1);
  } else {
    console.log(`✅ npm version ${npmCheck.version} supports workspaces\n`);
  }
  
  // Check root package.json
  console.log('📋 Checking root package.json...');
  const rootPkgPath = path.join(rootPath, 'package.json');
  const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
  
  if (!rootPkg.workspaces) {
    console.error('❌ No workspaces field in root package.json');
    process.exit(1);
  }
  
  const workspaceGlobs = Array.isArray(rootPkg.workspaces) 
    ? rootPkg.workspaces 
    : rootPkg.workspaces.packages || [];
  
  console.log('✅ Workspaces configured:');
  workspaceGlobs.forEach(ws => console.log(`   - ${ws}`));
  
  // Get all workspace packages
  console.log('\n📦 Detected workspace packages:');
  const { packages } = getWorkspacePackages(rootPath);
  
  if (packages.length === 0) {
    console.log('   ❌ No workspace packages found. Run "npm install" first.');
    issues.push({
      type: 'error',
      message: 'No workspace packages detected'
    });
  } else {
    packages.forEach(pkg => {
      console.log(`   ✅ ${getPackageDisplayName(pkg.name)} (v${pkg.version})`);
    });
  }
  
  // Check for workspace protocol usage
  console.log('\n🔗 Checking internal dependency links...');
  const dependencyLinks: DependencyLink[] = [];
  
  packages.forEach(pkg => {
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    
    Object.entries(allDeps).forEach(([depName, version]) => {
      // Check if this dependency is another workspace package
      const isWorkspacePackage = packages.some(p => p.name === depName);
      
      if (isWorkspacePackage) {
        dependencyLinks.push({
          from: pkg.name,
          to: depName,
          version: version as string
        });
        
        // Verify it's using workspace protocol or exact version
        if (version !== '0.1.0' && !version.startsWith('workspace:') && !version.startsWith('file:')) {
          issues.push({
            type: 'warning',
            message: `${pkg.name} depends on workspace package ${depName} with version ${version}`,
            details: [`Consider using "0.1.0" or "workspace:*" for internal dependencies`]
          });
        }
      }
    });
  });
  
  if (dependencyLinks.length === 0) {
    console.log('   ⚠️  No internal workspace dependencies found');
  } else {
    console.log(`   Found ${dependencyLinks.length} internal dependencies:`);
    dependencyLinks.forEach(link => {
      const fromDisplay = getPackageDisplayName(link.from);
      const toDisplay = getPackageDisplayName(link.to);
      console.log(`   ✅ ${fromDisplay} → ${toDisplay} (${link.version})`);
    });
  }
  
  // Check package.json consistency
  console.log('\n🔧 Checking package.json consistency...');
  const inconsistencies: string[] = [];
  
  packages.forEach(pkg => {
    const pkgJsonPath = path.join(pkg.path, 'package.json');
    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    
    // Check for required fields
    if (!pkgJson.name) inconsistencies.push(`${pkg.path}: missing "name" field`);
    if (!pkgJson.version) inconsistencies.push(`${pkg.path}: missing "version" field`);
    if (!pkgJson.scripts?.build && !pkgJson.private) {
      inconsistencies.push(`${getPackageDisplayName(pkg.name)}: no "build" script`);
    }
  });
  
  if (inconsistencies.length > 0) {
    inconsistencies.forEach(issue => console.log(`   ⚠️  ${issue}`));
  } else {
    console.log('   ✅ All packages have consistent structure');
  }
  
  // Check for common issues
  console.log('\n⚠️  Checking for common issues...');
  
  // Check for lerna remnants
  const lernaFiles = ['lerna.json', 'lerna-debug.log'];
  lernaFiles.forEach(file => {
    if (fs.existsSync(path.join(rootPath, file))) {
      issues.push({
        type: 'warning',
        message: `${file} still exists - should be removed`
      });
    }
  });
  
  // Check for lerna in dependencies
  if (rootPkg.devDependencies?.lerna || rootPkg.dependencies?.lerna) {
    issues.push({
      type: 'error',
      message: 'Lerna is still in dependencies - should be removed'
    });
  }
  
  // Check for old lerna scripts
  const lernaScripts = Object.entries(rootPkg.scripts || {})
    .filter(([_, cmd]) => typeof cmd === 'string' && cmd.includes('lerna'));
  
  if (lernaScripts.length > 0) {
    issues.push({
      type: 'error',
      message: 'Found lerna commands in scripts',
      details: lernaScripts.map(([name, cmd]) => `${name}: ${cmd}`)
    });
  }
  
  // Display issues
  if (issues.length > 0) {
    issues.forEach(issue => {
      const icon = issue.type === 'error' ? '❌' : '⚠️';
      console.log(`   ${icon} ${issue.message}`);
      if (issue.details) {
        issue.details.forEach(detail => console.log(`      - ${detail}`));
      }
    });
  } else {
    console.log('   ✅ No issues found');
  }
  
  // Check TypeScript configuration
  console.log('\n📘 Checking TypeScript configuration...');
  const tsconfigPath = path.join(rootPath, 'tsconfig.json');
  
  if (fs.existsSync(tsconfigPath)) {
    const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
    
    if (tsconfig.references) {
      console.log(`   ✅ TypeScript project references configured (${tsconfig.references.length} projects)`);
    } else {
      console.log('   ⚠️  No TypeScript project references found');
    }
  } else {
    console.log('   ❌ No root tsconfig.json found');
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  
  const errorCount = issues.filter(i => i.type === 'error').length;
  const warningCount = issues.filter(i => i.type === 'warning').length;
  
  if (errorCount === 0 && warningCount === 0) {
    console.log('✅ Workspace configuration looks perfect!');
  } else if (errorCount === 0) {
    console.log(`✅ Workspace configuration is valid with ${warningCount} warning(s)`);
  } else {
    console.log(`❌ Found ${errorCount} error(s) and ${warningCount} warning(s)`);
  }
  
  console.log('\n📚 Useful commands:');
  console.log('  npm install                    - Install all dependencies');
  console.log('  npm run build                  - Build all packages');
  console.log('  npm run test                   - Test all packages');
  console.log('  npm run lint                   - Lint all packages');
  console.log('  npm run clean                  - Clean all packages');
  console.log('  npm run build -w @pkg/name     - Build specific package');
  console.log('  npm ls --depth=0               - List all packages');
  console.log('  npm run coverage:report        - Generate coverage report');
  
  if (errorCount > 0) {
    console.log('\n❌ Please fix the errors above and run this script again.');
    process.exit(1);
  }
}

// Run verification
verifyWorkspaces().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});