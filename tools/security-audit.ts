#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { getWorkspacePackages } from './utils.js';

interface SecurityPattern {
  pattern: RegExp;
  name: string;
  lowPriority?: boolean;
}

interface SecurityIssue {
  file: string;
  issue: string;
  match: string;
  line?: number;
  lowPriority?: boolean;
}

const sensitivePatterns: SecurityPattern[] = [
  // Credentials
  { pattern: /password\s*[:=]\s*["'](?!your-|example|test|placeholder|password|<|{)/gi, name: 'Hardcoded passwords' },
  { pattern: /secret\s*[:=]\s*["'](?!your-|example|test|placeholder|secret|<|{)/gi, name: 'Hardcoded secrets' },
  { pattern: /api[_-]?key\s*[:=]\s*["'](?!your-|example|test|placeholder|api|<|{)/gi, name: 'API keys' },
  { pattern: /token\s*[:=]\s*["'](?!your-|example|test|placeholder|token|<|{)/gi, name: 'Hardcoded tokens' },
  
  // URLs with credentials
  { pattern: /https?:\/\/[^:]+:[^@]+@/gi, name: 'URLs with credentials' },
  
  // Private keys
  { pattern: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/gi, name: 'Private keys' },
  { pattern: /-----BEGIN (RSA |EC |DSA )?ENCRYPTED PRIVATE KEY-----/gi, name: 'Encrypted private keys' },
  
  // AWS
  { pattern: /AKIA[0-9A-Z]{16}/gi, name: 'AWS Access Key IDs' },
  { pattern: /aws[_-]?secret[_-]?access[_-]?key\s*[:=]\s*["'][^"']+["']/gi, name: 'AWS Secret Access Keys' },
  
  // Other services
  { pattern: /sk_live_[0-9a-zA-Z]{24,}/gi, name: 'Stripe live keys' },
  { pattern: /github[_-]?token\s*[:=]\s*["'][^"']+["']/gi, name: 'GitHub tokens' },
  { pattern: /ghp_[0-9a-zA-Z]{36}/gi, name: 'GitHub personal access tokens' },
  
  // OAuth secrets
  { pattern: /client[_-]?secret\s*[:=]\s*["'](?!your-|example|test|placeholder|secret|<|{)[^"']+["']/gi, name: 'OAuth client secrets' },
  
  // JWT secrets
  { pattern: /jwt[_-]?secret\s*[:=]\s*["'](?!your-|example|test|placeholder|secret|<|{)[^"']+["']/gi, name: 'JWT secrets' },
];

const excludedDirs = ['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.turbo', 'examples'];
const includedExtensions = ['.js', '.ts', '.tsx', '.json', '.env', '.yml', '.yaml', '.md', '.mjs', '.cjs'];

let issuesFound: SecurityIssue[] = [];
let filesScanned = 0;

/**
 * Get line number for a match in content
 */
function getLineNumber(content: string, matchIndex: number): number {
  const lines = content.substring(0, matchIndex).split('\n');
  return lines.length;
}

/**
 * Scan a single file for security issues
 */
function scanFile(filePath: string): void {
  const ext = path.extname(filePath);
  if (!includedExtensions.includes(ext)) return;
  
  filesScanned++;
  const content = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(process.cwd(), filePath);
  
  // Skip test files for certain patterns
  const isTestFile = filePath.includes('test') || filePath.includes('spec') || filePath.includes('__tests__');
  
  sensitivePatterns.forEach(({ pattern, name, lowPriority }) => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      // Skip if it's in a test file and looks like test data
      if (isTestFile && (match[0].includes('test') || match[0].includes('example'))) continue;
      
      // Skip if it's in package-lock.json or similar
      if (filePath.endsWith('package-lock.json') || 
          filePath.endsWith('yarn.lock') || 
          filePath.endsWith('pnpm-lock.yaml')) continue;
      
      // Skip if it's clearly a placeholder
      if (match[0].includes('YOUR_') || 
          match[0].includes('PLACEHOLDER') || 
          match[0].includes('EXAMPLE')) continue;
      
      const lineNumber = getLineNumber(content, match.index);
      
      issuesFound.push({
        file: relativePath,
        issue: name,
        match: match[0].substring(0, 60) + (match[0].length > 60 ? '...' : ''),
        line: lineNumber,
        lowPriority
      });
    }
    // Reset regex lastIndex
    pattern.lastIndex = 0;
  });
  
  // Check for personal information (emails)
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  let emailMatch;
  while ((emailMatch = emailPattern.exec(content)) !== null) {
    const email = emailMatch[0];
    // Skip common example/test emails
    if (!email.includes('example.com') && 
        !email.includes('localhost') && 
        !email.includes('test.com') &&
        !email.includes('noreply') &&
        !email.includes('@anthropic.com')) {
      const lineNumber = getLineNumber(content, emailMatch.index);
      issuesFound.push({
        file: relativePath,
        issue: 'Email address',
        match: email,
        line: lineNumber,
        lowPriority: true
      });
    }
  }
}

/**
 * Recursively scan directory
 */
function scanDirectory(dir: string): void {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    
    try {
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        if (!excludedDirs.includes(file) && !file.startsWith('.')) {
          scanDirectory(filePath);
        }
      } else {
        scanFile(filePath);
      }
    } catch (error) {
      // Skip files we can't read
    }
  });
}

/**
 * Run security audit
 */
async function runSecurityAudit() {
  console.log('🔒 Security Audit for MCP Framework\n');
  
  const rootPath = path.join(__dirname, '..');
  const { packages } = getWorkspacePackages(rootPath);
  
  console.log(`Found ${packages.length} workspace packages\n`);
  console.log('Scanning for sensitive information...\n');
  
  // Scan root directory
  process.chdir(rootPath);
  scanDirectory('.');
  
  // Report results
  console.log(`Files scanned: ${filesScanned}\n`);
  
  // Group issues by priority
  const highPriorityIssues = issuesFound.filter(i => !i.lowPriority);
  const lowPriorityIssues = issuesFound.filter(i => i.lowPriority);
  
  if (highPriorityIssues.length > 0) {
    console.log('❌ HIGH PRIORITY ISSUES FOUND:\n');
    highPriorityIssues.forEach(({ file, issue, match, line }) => {
      console.log(`  File: ${file}${line ? `:${line}` : ''}`);
      console.log(`  Issue: ${issue}`);
      console.log(`  Match: ${match}`);
      console.log('');
    });
  }
  
  if (lowPriorityIssues.length > 0 && lowPriorityIssues.length < 20) {
    console.log('⚠️  LOW PRIORITY ISSUES (review manually):\n');
    lowPriorityIssues.forEach(({ file, issue, match, line }) => {
      console.log(`  File: ${file}${line ? `:${line}` : ''}`);
      console.log(`  Issue: ${issue}`);
      console.log(`  Match: ${match}`);
      console.log('');
    });
  } else if (lowPriorityIssues.length >= 20) {
    console.log(`⚠️  ${lowPriorityIssues.length} LOW PRIORITY ISSUES found (too many to display)\n`);
  }
  
  if (issuesFound.length === 0) {
    console.log('✅ No sensitive information found!');
  } else {
    console.log(`Total issues found: ${issuesFound.length} (${highPriorityIssues.length} high, ${lowPriorityIssues.length} low)`);
    if (highPriorityIssues.length > 0) {
      console.log('\n⚠️  Please review and remove any sensitive information before committing.');
    }
  }
  
  // Additional security checks
  console.log('\n📋 Additional Security Recommendations:\n');
  
  // Check for .gitignore
  if (!fs.existsSync('.gitignore')) {
    console.log('❌ No .gitignore file found - create one to exclude sensitive files');
  } else {
    const gitignore = fs.readFileSync('.gitignore', 'utf8');
    const requiredPatterns = ['.env', 'node_modules', '*.log', '.DS_Store'];
    const missingPatterns = requiredPatterns.filter(pattern => !gitignore.includes(pattern));
    
    if (missingPatterns.length === 0) {
      console.log('✅ .gitignore properly configured');
    } else {
      console.log(`⚠️  .gitignore should include: ${missingPatterns.join(', ')}`);
    }
  }
  
  // Check for .env files
  const envFiles = ['.env', '.env.local', '.env.development', '.env.production'];
  const foundEnvFiles = envFiles.filter(file => fs.existsSync(file));
  
  if (foundEnvFiles.length > 0) {
    console.log(`❌ Environment files found in root: ${foundEnvFiles.join(', ')} - should not be committed`);
  } else {
    console.log('✅ No environment files in root');
  }
  
  // Check for example env file
  if (!fs.existsSync('.env.example') && !fs.existsSync('.env.sample')) {
    console.log('ℹ️  Consider adding .env.example to document required environment variables');
  }
  
  // Check package.json
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const recommendations: string[] = [];
  
  if (!packageJson.repository) {
    recommendations.push('repository field');
  }
  if (!packageJson.license) {
    recommendations.push('license field');
  }
  if (!packageJson.author) {
    recommendations.push('author field');
  }
  
  if (recommendations.length > 0) {
    console.log(`ℹ️  Consider adding to package.json: ${recommendations.join(', ')}`);
  } else {
    console.log('✅ package.json metadata complete');
  }
  
  console.log('\n✅ Security audit complete!');
  
  // Exit with error if high priority issues found
  if (highPriorityIssues.length > 0) {
    process.exit(1);
  }
}

// Run the audit
runSecurityAudit().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});