#!/usr/bin/env node

import { execSync } from 'child_process';
import path from 'path';
import { getWorkspacePackages, getPackageDisplayName, executeCommand } from './utils.js';

interface BuildResult {
  packageName: string;
  success: boolean;
  error?: string;
}

/**
 * Sort packages by dependencies to ensure proper build order
 */
function sortPackagesByDependencies(packages: ReturnType<typeof getWorkspacePackages>['packages']): string[] {
  const graph = new Map<string, Set<string>>();
  const inDegree = new Map<string, number>();
  
  // Initialize graph
  for (const pkg of packages) {
    graph.set(pkg.name, new Set());
    inDegree.set(pkg.name, 0);
  }
  
  // Build dependency graph
  for (const pkg of packages) {
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const [depName] of Object.entries(deps)) {
      if (graph.has(depName)) {
        graph.get(depName)!.add(pkg.name);
        inDegree.set(pkg.name, (inDegree.get(pkg.name) || 0) + 1);
      }
    }
  }
  
  // Topological sort using Kahn's algorithm
  const queue: string[] = [];
  const result: string[] = [];
  
  // Find packages with no dependencies
  for (const [name, degree] of inDegree) {
    if (degree === 0) {
      queue.push(name);
    }
  }
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);
    
    const dependents = graph.get(current) || new Set();
    for (const dependent of dependents) {
      const newDegree = (inDegree.get(dependent) || 0) - 1;
      inDegree.set(dependent, newDegree);
      
      if (newDegree === 0) {
        queue.push(dependent);
      }
    }
  }
  
  // If we couldn't sort all packages, just return them in original order
  if (result.length !== packages.length) {
    return packages.map(p => p.name);
  }
  
  return result;
}

async function buildWorkspaces() {
  console.log('🔨 Building all packages...\n');
  
  const { packages } = getWorkspacePackages();
  
  if (packages.length === 0) {
    console.error('❌ No workspace packages found!');
    process.exit(1);
  }
  
  // Sort packages by dependencies
  const buildOrder = sortPackagesByDependencies(packages);
  
  console.log(`📦 Found ${packages.length} packages to build:`);
  buildOrder.forEach((name, index) => {
    console.log(`   ${index + 1}. ${getPackageDisplayName(name)}`);
  });
  console.log('');
  
  const results: BuildResult[] = [];
  
  for (const packageName of buildOrder) {
    const displayName = getPackageDisplayName(packageName);
    console.log(`📦 Building ${displayName}...`);
    
    const result = executeCommand(`npm run build --workspace=${packageName}`, path.join(__dirname, '..'));
    
    if (result.success) {
      console.log(`✅ ${displayName} built successfully!\n`);
      results.push({ packageName, success: true });
    } else {
      console.error(`❌ Failed to build ${displayName}`);
      console.error(`   Error: ${result.error}\n`);
      results.push({ packageName, success: false, error: result.error });
    }
  }
  
  // Print summary
  console.log('─'.repeat(50));
  console.log(`📊 Build Summary:`);
  console.log(`   Total packages: ${buildOrder.length}`);
  
  const succeeded = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success);
  
  console.log(`   ✅ Built: ${succeeded}`);
  console.log(`   ❌ Failed: ${failed.length}`);
  
  if (failed.length > 0) {
    console.log(`\n   Failed packages:`);
    failed.forEach(f => {
      console.log(`     - ${getPackageDisplayName(f.packageName)}: ${f.error || 'Unknown error'}`);
    });
    process.exit(1);
  } else {
    console.log('\n🎉 All packages built successfully!');
  }
}

// Run the build
buildWorkspaces().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});