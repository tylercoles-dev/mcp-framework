#!/usr/bin/env node

/**
 * Build all packages in dependency order using npm workspaces
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔨 Building all packages...\n');

// Build order based on dependencies
const buildOrder = [
  '@tylercoles/mcp-server',
  '@tylercoles/mcp-auth',
  '@tylercoles/mcp-transport-stdio',
  '@tylercoles/mcp-transport-http',
  '@tylercoles/mcp-auth-authentik'
];

let built = 0;
let failed = [];

for (const packageName of buildOrder) {
  console.log(`📦 Building ${packageName}...`);
  
  try {
    // Use npm workspace command to build specific package
    execSync(`npm run build --workspace=${packageName}`, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    
    built++;
    console.log(`✅ ${packageName} built successfully!\n`);
  } catch (error) {
    failed.push(packageName);
    console.error(`❌ Failed to build ${packageName}\n`);
  }
}

console.log('─'.repeat(50));
console.log(`📊 Build Summary:`);
console.log(`   Total packages: ${buildOrder.length}`);
console.log(`   ✅ Built: ${built}`);
console.log(`   ❌ Failed: ${failed.length}`);

if (failed.length > 0) {
  console.log(`\n   Failed packages: ${failed.join(', ')}`);
  process.exit(1);
} else {
  console.log('\n🎉 All packages built successfully!');
}
