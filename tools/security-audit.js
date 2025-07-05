#!/usr/bin/env node

/**
 * Security audit script to check for sensitive information
 */

const fs = require('fs');
const path = require('path');

console.log('🔒 Security Audit for MCP Framework\n');

const sensitivePatterns = [
  // Credentials
  { pattern: /password\s*[:=]\s*["'](?!your-|example|test|placeholder)/gi, name: 'Hardcoded passwords' },
  { pattern: /secret\s*[:=]\s*["'](?!your-|example|test|placeholder)/gi, name: 'Hardcoded secrets' },
  { pattern: /api[_-]?key\s*[:=]\s*["'](?!your-|example|test|placeholder)/gi, name: 'API keys' },
  { pattern: /token\s*[:=]\s*["'](?!your-|example|test|placeholder)/gi, name: 'Hardcoded tokens' },
  
  // URLs with credentials
  { pattern: /https?:\/\/[^:]+:[^@]+@/gi, name: 'URLs with credentials' },
  
  // Private keys
  { pattern: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/gi, name: 'Private keys' },
  { pattern: /-----BEGIN (RSA |EC |DSA )?ENCRYPTED PRIVATE KEY-----/gi, name: 'Encrypted private keys' },
  
  // AWS
  { pattern: /AKIA[0-9A-Z]{16}/gi, name: 'AWS Access Key IDs' },
  { pattern: /aws[_-]?secret[_-]?access[_-]?key/gi, name: 'AWS Secret references' },
  
  // Other services
  { pattern: /sk_live_[0-9a-zA-Z]{24,}/gi, name: 'Stripe live keys' },
  { pattern: /github[_-]?token/gi, name: 'GitHub token references' },
  
  // Base64 encoded secrets (common pattern)
  { pattern: /[A-Za-z0-9+/]{40,}={0,2}/g, name: 'Potential base64 secrets', lowPriority: true },
];

const excludedDirs = ['node_modules', '.git', 'dist', 'build', 'coverage', '.next'];
const includedExtensions = ['.js', '.ts', '.json', '.env', '.yml', '.yaml', '.md'];

let issuesFound = [];
let filesScanned = 0;

function scanFile(filePath) {
  const ext = path.extname(filePath);
  if (!includedExtensions.includes(ext)) return;
  
  filesScanned++;
  const content = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(process.cwd(), filePath);
  
  sensitivePatterns.forEach(({ pattern, name, lowPriority }) => {
    const matches = content.match(pattern);
    if (matches) {
      matches.forEach(match => {
        // Skip if it's in a test file and looks like test data
        if (filePath.includes('test') && match.includes('test')) return;
        
        // Skip if it's in package-lock.json
        if (filePath.endsWith('package-lock.json')) return;
        
        issuesFound.push({
          file: relativePath,
          issue: name,
          match: match.substring(0, 50) + (match.length > 50 ? '...' : ''),
          lowPriority
        });
      });
    }
  });
  
  // Check for personal information
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = content.match(emailPattern);
  if (emails) {
    emails.forEach(email => {
      // Skip common example emails
      if (!email.includes('example.com') && 
          !email.includes('localhost') && 
          !email.includes('test.com')) {
        issuesFound.push({
          file: relativePath,
          issue: 'Email address',
          match: email,
          lowPriority: true
        });
      }
    });
  }
}

function scanDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      if (!excludedDirs.includes(file)) {
        scanDirectory(filePath);
      }
    } else {
      scanFile(filePath);
    }
  });
}

// Start scanning
console.log('Scanning for sensitive information...\n');
scanDirectory('.');

// Report results
console.log(`Files scanned: ${filesScanned}\n`);

// Group issues by priority
const highPriorityIssues = issuesFound.filter(i => !i.lowPriority);
const lowPriorityIssues = issuesFound.filter(i => i.lowPriority);

if (highPriorityIssues.length > 0) {
  console.log('❌ HIGH PRIORITY ISSUES FOUND:\n');
  highPriorityIssues.forEach(({ file, issue, match }) => {
    console.log(`  File: ${file}`);
    console.log(`  Issue: ${issue}`);
    console.log(`  Match: ${match}`);
    console.log('');
  });
}

if (lowPriorityIssues.length > 0) {
  console.log('⚠️  LOW PRIORITY ISSUES (review manually):\n');
  lowPriorityIssues.forEach(({ file, issue, match }) => {
    console.log(`  File: ${file}`);
    console.log(`  Issue: ${issue}`);
    console.log(`  Match: ${match}`);
    console.log('');
  });
}

if (issuesFound.length === 0) {
  console.log('✅ No sensitive information found!');
} else {
  console.log(`\nTotal issues found: ${issuesFound.length}`);
  console.log('Please review and remove any sensitive information before committing.');
}

// Additional checks
console.log('\n📋 Additional Security Recommendations:\n');

// Check for .env files
if (!fs.existsSync('.gitignore')) {
  console.log('❌ No .gitignore file found - create one to exclude sensitive files');
} else {
  const gitignore = fs.readFileSync('.gitignore', 'utf8');
  if (!gitignore.includes('.env')) {
    console.log('⚠️  .gitignore should include .env files');
  } else {
    console.log('✅ .gitignore properly excludes .env files');
  }
}

// Check for example env file
if (fs.existsSync('.env')) {
  console.log('❌ .env file found in root - should not be committed');
}

// Check package.json for repository info
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
if (!packageJson.repository) {
  console.log('ℹ️  Consider adding repository field to package.json');
}

if (!packageJson.license) {
  console.log('ℹ️  Consider adding license field to package.json');
}

console.log('\n✅ Security audit complete!');
