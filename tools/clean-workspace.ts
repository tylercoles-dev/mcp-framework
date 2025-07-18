#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { getWorkspacePackages, executeCommand } from './utils.js';

interface CleanTarget {
  path: string;
  type: 'file' | 'directory';
  description: string;
}

/**
 * Remove a directory cross-platform
 */
function removeDirectory(dirPath: string): boolean {
  try {
    if (fs.existsSync(dirPath)) {
      if (process.platform === 'win32') {
        execSync(`rmdir /s /q "${dirPath}"`, { stdio: 'inherit' });
      } else {
        execSync(`rm -rf "${dirPath}"`, { stdio: 'inherit' });
      }
      return true;
    }
  } catch (error) {
    console.error(`Failed to remove ${dirPath}:`, error);
    return false;
  }
  return false;
}

/**
 * Clean all workspace packages and root artifacts
 */
async function cleanWorkspace() {
  console.log('🧹 Cleaning workspace...\n');
  
  const rootPath = path.join(__dirname, '..');
  const { packages } = getWorkspacePackages(rootPath);
  
  let cleanedCount = 0;
  let failedCount = 0;
  
  // Clean each workspace package
  console.log('📦 Cleaning workspace packages...');
  
  for (const pkg of packages) {
    const displayName = pkg.name.replace(/^@[^/]+\//, '');
    process.stdout.write(`   Cleaning ${displayName}... `);
    
    // Check if package has a clean script
    const packageJsonPath = path.join(pkg.path, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    if (packageJson.scripts?.clean) {
      const result = executeCommand('npm run clean', pkg.path);
      if (result.success) {
        console.log('✅');
        cleanedCount++;
      } else {
        console.log('❌');
        failedCount++;
      }
    } else {
      // No clean script, manually clean common artifacts
      const artifactsRemoved: string[] = [];
      
      // Common build artifacts
      const artifacts = ['dist', 'build', 'coverage', '.turbo', 'tsconfig.tsbuildinfo'];
      
      for (const artifact of artifacts) {
        const artifactPath = path.join(pkg.path, artifact);
        if (fs.existsSync(artifactPath)) {
          const stats = fs.statSync(artifactPath);
          if (stats.isDirectory()) {
            if (removeDirectory(artifactPath)) {
              artifactsRemoved.push(artifact);
            }
          } else {
            fs.unlinkSync(artifactPath);
            artifactsRemoved.push(artifact);
          }
        }
      }
      
      if (artifactsRemoved.length > 0) {
        console.log(`✅ (removed: ${artifactsRemoved.join(', ')})`);
        cleanedCount++;
      } else {
        console.log('✅ (already clean)');
        cleanedCount++;
      }
    }
  }
  
  console.log(`\n   Cleaned ${cleanedCount} packages${failedCount > 0 ? `, ${failedCount} failed` : ''}\n`);
  
  // Define root-level cleanup targets
  const rootTargets: CleanTarget[] = [
    { path: 'node_modules', type: 'directory', description: 'root node_modules' },
    { path: 'package-lock.json', type: 'file', description: 'package-lock.json' },
    { path: 'lerna-debug.log', type: 'file', description: 'lerna-debug.log' },
    { path: '.lerna-backup', type: 'directory', description: '.lerna-backup' },
    { path: 'coverage', type: 'directory', description: 'root coverage' },
    { path: '.turbo', type: 'directory', description: '.turbo cache' },
    { path: 'tsconfig.tsbuildinfo', type: 'file', description: 'TypeScript build info' }
  ];
  
  // Clean root artifacts
  console.log('🗑️  Cleaning root artifacts...');
  let rootCleaned = 0;
  
  for (const target of rootTargets) {
    const targetPath = path.join(rootPath, target.path);
    
    if (fs.existsSync(targetPath)) {
      process.stdout.write(`   Removing ${target.description}... `);
      
      try {
        if (target.type === 'directory') {
          if (removeDirectory(targetPath)) {
            console.log('✅');
            rootCleaned++;
          } else {
            console.log('❌');
          }
        } else {
          fs.unlinkSync(targetPath);
          console.log('✅');
          rootCleaned++;
        }
      } catch (error) {
        console.log('❌');
        console.error(`     Error: ${error}`);
      }
    }
  }
  
  if (rootCleaned === 0) {
    console.log('   No root artifacts to clean');
  }
  
  // Summary
  console.log('\n✨ Workspace cleaned successfully!');
  console.log('\nNext steps:');
  console.log('  1. Run "npm install" to reinstall dependencies');
  console.log('  2. Run "npm run build" to rebuild all packages');
}

// Run the cleanup
cleanWorkspace().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});