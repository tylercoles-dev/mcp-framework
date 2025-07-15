#!/usr/bin/env ts-node

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt: string): Promise<string> => 
  new Promise((resolve) => rl.question(prompt, resolve));

interface PackageInfo {
  name: string;
  version: string;
  path: string;
  dependencies: string[];
  private: boolean;
  dir: string;
}

interface PublishOptions {
  dryRun?: boolean;
  skipTests?: boolean;
  skipBuild?: boolean;
  skipExisting?: boolean;
}

class PackagePublisher {
  private packagesDir: string;
  private packages: PackageInfo[] = [];
  private publishOrder: PackageInfo[] = [];

  constructor() {
    this.packagesDir = path.join(process.cwd(), 'packages');
  }

  private log(message: string, level: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
    const colors = {
      info: '\x1b[36m',    // cyan
      success: '\x1b[32m', // green
      warning: '\x1b[33m', // yellow
      error: '\x1b[31m',   // red
      reset: '\x1b[0m'
    };
    
    console.log(`${colors[level]}[${level.toUpperCase()}]${colors.reset} ${message}`);
  }

  async loadPackages(): Promise<void> {
    const packageDirs = fs.readdirSync(this.packagesDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    for (const dir of packageDirs) {
      const packagePath = path.join(this.packagesDir, dir);
      const packageJsonPath = path.join(packagePath, 'package.json');
      
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        
        this.packages.push({
          name: packageJson.name,
          version: packageJson.version,
          path: packagePath,
          dependencies: Object.keys(packageJson.dependencies || {}),
          private: packageJson.private || false,
          dir: dir
        });
      }
    }

    this.log(`Found ${this.packages.length} packages`);
    this.packages.forEach(pkg => {
      this.log(`  - ${pkg.name}@${pkg.version} ${pkg.private ? '(private)' : ''}`);
    });
  }

  calculatePublishOrder(): void {
    const internalPackages = this.packages
      .filter(pkg => !pkg.private)
      .filter(pkg => pkg.name.startsWith('@tylercoles/'));

    // Create dependency graph
    const dependsOn = new Map<string, string[]>();
    const dependents = new Map<string, string[]>();

    internalPackages.forEach(pkg => {
      dependsOn.set(pkg.name, []);
      dependents.set(pkg.name, []);
    });

    internalPackages.forEach(pkg => {
      pkg.dependencies.forEach(dep => {
        if (dependsOn.has(dep)) {
          dependsOn.get(pkg.name)!.push(dep);
          dependents.get(dep)!.push(pkg.name);
        }
      });
    });

    // Topological sort
    const visited = new Set<string>();
    const temp = new Set<string>();
    const result: string[] = [];

    const visit = (pkgName: string): void => {
      if (temp.has(pkgName)) {
        throw new Error(`Circular dependency detected involving ${pkgName}`);
      }
      if (visited.has(pkgName)) return;

      temp.add(pkgName);
      dependsOn.get(pkgName)!.forEach(dep => visit(dep));
      temp.delete(pkgName);
      visited.add(pkgName);
      result.push(pkgName);
    };

    internalPackages.forEach(pkg => {
      if (!visited.has(pkg.name)) {
        visit(pkg.name);
      }
    });

    this.publishOrder = result.map(name => 
      this.packages.find(pkg => pkg.name === name)
    ).filter((pkg): pkg is PackageInfo => pkg !== undefined);

    this.log('Calculated publish order:');
    this.publishOrder.forEach((pkg, i) => {
      this.log(`  ${i + 1}. ${pkg.name}`);
    });
  }

  async checkNpmAuth(): Promise<boolean> {
    try {
      execSync('npm whoami', { stdio: 'pipe' });
      const user = execSync('npm whoami', { encoding: 'utf8' }).trim();
      this.log(`Authenticated as: ${user}`, 'success');
      return true;
    } catch (error) {
      this.log('Not authenticated with npm. Please run "npm login" first.', 'error');
      return false;
    }
  }

  async checkPackageExists(packageName: string, version: string): Promise<boolean> {
    try {
      const result = execSync(`npm view ${packageName}@${version} version`, { 
        encoding: 'utf8',
        stdio: 'pipe'
      });
      return result.trim() === version;
    } catch (error) {
      return false;
    }
  }

  async buildPackages(): Promise<void> {
    this.log('Building all packages...');
    try {
      execSync('npm run build', { stdio: 'inherit', cwd: process.cwd() });
      this.log('Build completed successfully', 'success');
    } catch (error) {
      this.log('Build failed', 'error');
      throw error;
    }
  }

  async runTests(): Promise<void> {
    this.log('Running tests...');
    try {
      execSync('npm test', { stdio: 'inherit', cwd: process.cwd() });
      this.log('Tests passed', 'success');
    } catch (error) {
      this.log('Tests failed', 'error');
      throw error;
    }
  }

  async publishPackage(pkg: PackageInfo, options: PublishOptions = {}): Promise<boolean> {
    const { dryRun = false, skipExisting = true } = options;
    
    if (skipExisting) {
      const exists = await this.checkPackageExists(pkg.name, pkg.version);
      if (exists) {
        this.log(`${pkg.name}@${pkg.version} already exists, skipping`, 'warning');
        return true;
      }
    }

    const publishCmd = ['npm', 'publish'];
    if (dryRun) {
      publishCmd.push('--dry-run');
    }
    
    this.log(`${dryRun ? 'Dry run: ' : ''}Publishing ${pkg.name}@${pkg.version}...`);
    
    try {
      execSync(publishCmd.join(' '), { 
        stdio: 'inherit', 
        cwd: pkg.path 
      });
      this.log(`Successfully published ${pkg.name}@${pkg.version}`, 'success');
      return true;
    } catch (error) {
      this.log(`Failed to publish ${pkg.name}: ${(error as Error).message}`, 'error');
      return false;
    }
  }

  async promptOptions(): Promise<PublishOptions> {
    const options: PublishOptions = {};
    
    const dryRun = await question('Run in dry-run mode? (y/N): ');
    options.dryRun = dryRun.toLowerCase().startsWith('y');
    
    const skipTests = await question('Skip tests? (y/N): ');
    options.skipTests = skipTests.toLowerCase().startsWith('y');
    
    const skipBuild = await question('Skip build? (y/N): ');
    options.skipBuild = skipBuild.toLowerCase().startsWith('y');
    
    const skipExisting = await question('Skip packages that already exist on npm? (Y/n): ');
    options.skipExisting = !skipExisting.toLowerCase().startsWith('n');

    return options;
  }

  async run(): Promise<void> {
    try {
      this.log('🚀 MCP Framework Package Publisher');
      this.log('====================================');

      // Load packages
      await this.loadPackages();
      
      if (this.packages.length === 0) {
        this.log('No packages found to publish', 'warning');
        return;
      }

      // Calculate publish order
      this.calculatePublishOrder();
      
      if (this.publishOrder.length === 0) {
        this.log('No publishable packages found', 'warning');
        return;
      }

      // Check npm authentication
      if (!(await this.checkNpmAuth())) {
        return;
      }

      // Get user options
      const options = await this.promptOptions();
      
      this.log(`\nOptions: ${JSON.stringify(options, null, 2)}`);
      
      const confirm = await question('\nProceed with publishing? (y/N): ');
      if (!confirm.toLowerCase().startsWith('y')) {
        this.log('Publishing cancelled', 'warning');
        return;
      }

      // Run tests
      if (!options.skipTests) {
        await this.runTests();
      }

      // Build packages
      if (!options.skipBuild) {
        await this.buildPackages();
      }

      // Publish packages in order
      this.log('\n📦 Publishing packages...');
      let successCount = 0;
      let failureCount = 0;

      for (const pkg of this.publishOrder) {
        const success = await this.publishPackage(pkg, options);
        if (success) {
          successCount++;
        } else {
          failureCount++;
          
          const continueOnError = await question(`\nContinue with remaining packages? (y/N): `);
          if (!continueOnError.toLowerCase().startsWith('y')) {
            break;
          }
        }
      }

      // Summary
      this.log('\n📊 Publishing Summary');
      this.log('====================');
      this.log(`✅ Successful: ${successCount}`);
      this.log(`❌ Failed: ${failureCount}`);
      this.log(`📦 Total: ${this.publishOrder.length}`);

      if (failureCount === 0) {
        this.log('\n🎉 All packages published successfully!', 'success');
      } else {
        this.log('\n⚠️  Some packages failed to publish. Check the logs above.', 'warning');
      }

    } catch (error) {
      this.log(`Fatal error: ${(error as Error).message}`, 'error');
      process.exit(1);
    } finally {
      rl.close();
    }
  }
}

// Run the publisher
if (require.main === module) {
  const publisher = new PackagePublisher();
  publisher.run().catch(console.error);
}

export default PackagePublisher;
