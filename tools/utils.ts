import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

export interface PackageInfo {
  name: string;
  path: string;
  version: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export interface WorkspaceInfo {
  packages: PackageInfo[];
  rootPath: string;
}

/**
 * Get all workspace packages dynamically using npm workspaces
 */
export function getWorkspacePackages(rootPath: string = path.join(__dirname, '..')): WorkspaceInfo {
  try {
    // Use npm to list all workspaces
    const output = execSync('npm ls --json --depth=0 --all', {
      cwd: rootPath,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'] // Ignore stderr to suppress warnings
    });
    
    const npmData = JSON.parse(output);
    const packages: PackageInfo[] = [];
    
    // Extract workspace packages from npm ls output
    if (npmData.dependencies) {
      for (const [name, info] of Object.entries(npmData.dependencies)) {
        if (info && typeof info === 'object' && 'resolved' in info) {
          const resolved = (info as any).resolved as string;
          if (resolved.startsWith('file:')) {
            // This is a workspace package
            const relativePath = resolved.replace('file:', '');
            const packagePath = path.join(rootPath, relativePath);
            const packageJsonPath = path.join(packagePath, 'package.json');
            
            if (fs.existsSync(packageJsonPath)) {
              const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
              packages.push({
                name: packageJson.name || name,
                path: packagePath,
                version: packageJson.version || '0.0.0',
                dependencies: packageJson.dependencies,
                devDependencies: packageJson.devDependencies
              });
            }
          }
        }
      }
    }
    
    // If npm ls didn't work well, fall back to reading workspace globs
    if (packages.length === 0) {
      const rootPackageJson = JSON.parse(fs.readFileSync(path.join(rootPath, 'package.json'), 'utf8'));
      const workspaceGlobs = Array.isArray(rootPackageJson.workspaces) 
        ? rootPackageJson.workspaces 
        : rootPackageJson.workspaces?.packages || [];
      
      for (const glob of workspaceGlobs) {
        const pattern = glob.replace('*', '');
        const baseDir = path.join(rootPath, pattern);
        
        if (fs.existsSync(baseDir)) {
          const entries = fs.readdirSync(baseDir, { withFileTypes: true });
          
          for (const entry of entries) {
            if (entry.isDirectory()) {
              const packagePath = path.join(baseDir, entry.name);
              const packageJsonPath = path.join(packagePath, 'package.json');
              
              if (fs.existsSync(packageJsonPath)) {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                packages.push({
                  name: packageJson.name,
                  path: packagePath,
                  version: packageJson.version || '0.0.0',
                  dependencies: packageJson.dependencies,
                  devDependencies: packageJson.devDependencies
                });
              }
            }
          }
        }
      }
    }
    
    // Sort packages by name for consistent output
    packages.sort((a, b) => a.name.localeCompare(b.name));
    
    return {
      packages,
      rootPath
    };
  } catch (error) {
    console.error('Error discovering workspace packages:', error);
    return {
      packages: [],
      rootPath
    };
  }
}

/**
 * Get package display name (without scope)
 */
export function getPackageDisplayName(packageName: string): string {
  return packageName.replace(/^@[^/]+\//, '');
}

/**
 * Execute command with proper error handling
 */
export function executeCommand(command: string, cwd?: string): { success: boolean; output?: string; error?: string } {
  try {
    const output = execSync(command, {
      cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return { success: true, output };
  } catch (error: any) {
    return { 
      success: false, 
      error: error.message || 'Unknown error',
      output: error.stdout?.toString() || ''
    };
  }
}