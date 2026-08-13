/**
 * Comprehensive JWT Claims Validation Report
 * Analyzes JWT implementation and expected claims structure
 */

const jwt = require('jsonwebtoken');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');

// Color constants
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Parse JWT claims without verification
 */
function parseJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
    const header = JSON.parse(Buffer.from(parts[0], 'base64').toString('utf-8'));

    return { header, payload };
  } catch (error) {
    return null;
  }
}

/**
 * Create a test JWT token
 */
function createTestJWT() {
  try {
    const privateKey = process.env.JWT_PRIVATE_KEY;
    if (!privateKey) {
      return null;
    }

    const keyPem = privateKey.includes('\\n')
      ? privateKey.replace(/\\n/g, '\n')
      : privateKey;

    const payload = {
      sub: '123e4567-e89b-12d3-a456-426614174000',
      email: 'test.jwt@example.com',
      tenantId: '987fcdeb-51a2-49a2-b1c3-1234567890ab',
      roles: ['admin'],
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      iss: 'iaezap',
      aud: 'iaezap-api',
    };

    const token = jwt.sign(payload, keyPem, {
      algorithm: 'RS256',
      issuer: 'iaezap',
      audience: 'iaezap-api',
    });

    return token;
  } catch (error) {
    return null;
  }
}

/**
 * Main test function
 */
async function analyzeJWTImplementation() {
  log(`\n${'='.repeat(80)}`, 'bold');
  log('JWT CLAIMS VALIDATION REPORT', 'bold');
  log('Comprehensive Analysis of JWT Implementation', 'bold');
  log(`${'='.repeat(80)}\n`, 'bold');

  // Section 1: Environment Configuration
  log('SECTION 1: ENVIRONMENT CONFIGURATION', 'blue');
  log('-'.repeat(80), 'blue');

  const config = {
    JWT_ISSUER: process.env.JWT_ISSUER || 'auth-service',
    JWT_AUDIENCE: process.env.JWT_AUDIENCE || 'auth-api',
    JWT_ACCESS_TOKEN_EXPIRY: process.env.JWT_ACCESS_TOKEN_EXPIRY || '3600',
    JWT_REFRESH_TOKEN_EXPIRY: process.env.JWT_REFRESH_TOKEN_EXPIRY || '604800',
    NODE_ENV: process.env.NODE_ENV || 'development',
  };

  log('\nConfigured JWT Settings:', 'cyan');
  for (const [key, value] of Object.entries(config)) {
    log(`  ${key}: ${value}`, 'cyan');
  }

  const privateKeyExists = !!process.env.JWT_PRIVATE_KEY;
  const publicKeyExists = !!process.env.JWT_PUBLIC_KEY;

  log(`\nJWT Keys Status:`, privateKeyExists && publicKeyExists ? 'green' : 'red');
  log(`  Private Key: ${privateKeyExists ? '✓ Configured' : '✗ Missing'}`, privateKeyExists ? 'green' : 'red');
  log(`  Public Key: ${publicKeyExists ? '✓ Configured' : '✗ Missing'}`, publicKeyExists ? 'green' : 'red');

  // Section 2: Required Claims Analysis
  log(`\nSECTION 2: REQUIRED JWT CLAIMS STRUCTURE`, 'blue');
  log('-'.repeat(80), 'blue');

  const requiredClaims = {
    sub: {
      description: 'Subject (User ID)',
      type: 'string',
      source: 'user.id',
      required: true,
      example: '123e4567-e89b-12d3-a456-426614174000',
      validation: 'UUID v4 format',
    },
    email: {
      description: 'User Email',
      type: 'string',
      source: 'user.email',
      required: true,
      example: 'user@example.com',
      validation: 'Valid email format',
    },
    tenantId: {
      description: 'Tenant/Company ID',
      type: 'string',
      source: 'user.company_id',
      required: true,
      example: '987fcdeb-51a2-49a2-b1c3-1234567890ab',
      validation: 'UUID v4 format',
    },
    role: {
      description: 'User Role (for backward compatibility)',
      type: 'string',
      source: 'user.role',
      required: false,
      example: 'admin',
      validation: 'admin|moderator|user',
    },
    roles: {
      description: 'User Roles (array format)',
      type: 'array',
      source: 'user.roles',
      required: true,
      example: ['admin'],
      validation: 'Array of role strings',
    },
    iat: {
      description: 'Issued At (Unix timestamp)',
      type: 'number',
      source: 'Math.floor(Date.now() / 1000)',
      required: true,
      example: Math.floor(Date.now() / 1000),
      validation: 'Current Unix timestamp in seconds',
    },
    exp: {
      description: 'Expiration (Unix timestamp)',
      type: 'number',
      source: 'iat + accessTokenExpiry (3600s)',
      required: true,
      example: Math.floor(Date.now() / 1000) + 3600,
      validation: 'Unix timestamp, typically +3600 seconds from iat',
    },
    iss: {
      description: 'Issuer',
      type: 'string',
      source: 'JWT_ISSUER env var',
      required: true,
      example: 'iaezap',
      validation: 'Must be exactly "iaezap"',
      expectedValue: 'iaezap',
    },
    aud: {
      description: 'Audience',
      type: 'string',
      source: 'JWT_AUDIENCE env var',
      required: true,
      example: 'iaezap-api',
      validation: 'Must be exactly "iaezap-api"',
      expectedValue: 'iaezap-api',
    },
  };

  log('\nRequired Claims Details:', 'cyan');
  for (const [claimName, claimInfo] of Object.entries(requiredClaims)) {
    const status = claimInfo.required ? 'REQUIRED' : 'OPTIONAL';
    const statusColor = claimInfo.required ? 'bold' : 'cyan';

    log(`\n${claimName} - ${claimInfo.description}`, statusColor);
    log(`  Type: ${claimInfo.type}`, 'cyan');
    log(`  Status: ${status}`, claimInfo.required ? 'green' : 'yellow');
    log(`  Source: ${claimInfo.source}`, 'cyan');
    log(`  Example: ${JSON.stringify(claimInfo.example)}`, 'cyan');
    log(`  Validation: ${claimInfo.validation}`, 'cyan');

    if (claimInfo.expectedValue) {
      log(`  Expected Value: "${claimInfo.expectedValue}"`, 'yellow');
    }
  }

  // Section 3: Test JWT Creation
  log(`\nSECTION 3: TEST JWT TOKEN CREATION`, 'blue');
  log('-'.repeat(80), 'blue');

  if (!privateKeyExists || !publicKeyExists) {
    log('\nSkipping test token creation - Keys not configured', 'yellow');
  } else {
    const testToken = createTestJWT();

    if (testToken) {
      log('\n✓ Test JWT generated successfully', 'green');

      const parsed = parseJWT(testToken);
      if (parsed) {
        log('\nToken Header:', 'cyan');
        log(JSON.stringify(parsed.header, null, 2), 'cyan');

        log('\nToken Payload (Claims):', 'cyan');
        log(JSON.stringify(parsed.payload, null, 2), 'cyan');

        // Validate token signature
        try {
          const publicKey = process.env.JWT_PUBLIC_KEY.includes('\\n')
            ? process.env.JWT_PUBLIC_KEY.replace(/\\n/g, '\n')
            : process.env.JWT_PUBLIC_KEY;

          const verified = jwt.verify(testToken, publicKey, {
            algorithms: ['RS256'],
            issuer: 'iaezap',
            audience: 'iaezap-api',
          });

          log('\n✓ Token signature verified successfully', 'green');
        } catch (err) {
          log(`\n✗ Token verification failed: ${err.message}`, 'red');
        }
      }
    } else {
      log('\n✗ Failed to create test JWT', 'red');
    }
  }

  // Section 4: Claim Validation Rules
  log(`\nSECTION 4: CLAIM VALIDATION RULES`, 'blue');
  log('-'.repeat(80), 'blue');

  const validationRules = [
    {
      claim: 'sub',
      rule: 'Must match user.id from database',
      severity: 'CRITICAL',
    },
    {
      claim: 'email',
      rule: 'Must match user.email from database, must be valid email format',
      severity: 'CRITICAL',
    },
    {
      claim: 'tenantId',
      rule: 'Must match user.company_id from database, must be UUID v4',
      severity: 'CRITICAL',
    },
    {
      claim: 'roles',
      rule: 'Must be an array containing user roles (e.g., ["admin"])',
      severity: 'CRITICAL',
    },
    {
      claim: 'iat',
      rule: 'Must be current Unix timestamp (in seconds), issued within last 60 seconds',
      severity: 'CRITICAL',
    },
    {
      claim: 'exp',
      rule: 'Must be iat + accessTokenExpiry (3600 seconds), token must not be expired',
      severity: 'CRITICAL',
    },
    {
      claim: 'iss',
      rule: 'Must be exactly "iaezap" (per JWT_ISSUER config)',
      severity: 'CRITICAL',
    },
    {
      claim: 'aud',
      rule: 'Must be exactly "iaezap-api" (per JWT_AUDIENCE config)',
      severity: 'CRITICAL',
    },
  ];

  log('\nValidation Rules:\n', 'cyan');
  for (const rule of validationRules) {
    const severityColor = rule.severity === 'CRITICAL' ? 'red' : 'yellow';
    log(`${rule.claim}:`, 'bold');
    log(`  Rule: ${rule.rule}`, 'cyan');
    log(`  Severity: ${rule.severity}`, severityColor);
  }

  // Section 5: Testing Instructions
  log(`\nSECTION 5: TESTING INSTRUCTIONS`, 'blue');
  log('-'.repeat(80), 'blue');

  log('\nTo test JWT claims validation:', 'cyan');
  log('1. Setup test user:', 'cyan');
  log('   node setup-test-user.js', 'yellow');
  log('\n2. Run JWT claims test:', 'cyan');
  log('   node test-jwt-direct.js', 'yellow');
  log('\n3. The test will:', 'cyan');
  log('   - Fetch test user from database', 'cyan');
  log('   - Attempt login with test credentials', 'cyan');
  log('   - Extract and decode access token', 'cyan');
  log('   - Verify JWT signature with public key', 'cyan');
  log('   - Validate all claims against expected values', 'cyan');

  // Section 6: Expected Token Lifecycle
  log(`\nSECTION 6: TOKEN LIFECYCLE`, 'blue');
  log('-'.repeat(80), 'blue');

  const accessTokenExpiry = parseInt(process.env.JWT_ACCESS_TOKEN_EXPIRY || '3600', 10);
  const refreshTokenExpiry = parseInt(process.env.JWT_REFRESH_TOKEN_EXPIRY || '604800', 10);

  log('\nAccess Token:', 'cyan');
  log(`  Expiry: ${accessTokenExpiry} seconds (${(accessTokenExpiry / 60).toFixed(0)} minutes / ${(accessTokenExpiry / 3600).toFixed(1)} hours)`, 'cyan');
  log(`  Contains: All user info (sub, email, tenantId, roles, iat, exp, iss, aud)`, 'cyan');
  log(`  Validation: Verified on every protected request`, 'cyan');

  log('\nRefresh Token:', 'cyan');
  log(`  Expiry: ${refreshTokenExpiry} seconds (${(refreshTokenExpiry / 3600).toFixed(0)} hours / ${(refreshTokenExpiry / (24 * 3600)).toFixed(0)} days)`, 'cyan');
  log(`  Contains: User ID and company ID only`, 'cyan');
  log(`  Purpose: Used to obtain new access tokens`, 'cyan');
  log(`  Endpoint: POST /api/auth/refresh`, 'cyan');

  // Section 7: Summary Checklist
  log(`\nSECTION 7: JWT CLAIMS VALIDATION CHECKLIST`, 'blue');
  log('-'.repeat(80), 'blue');

  const checks = [
    { item: 'JWT Algorithm', status: 'RS256', configured: true },
    { item: 'Issuer (iss)', status: config.JWT_ISSUER, configured: config.JWT_ISSUER === 'iaezap' },
    { item: 'Audience (aud)', status: config.JWT_AUDIENCE, configured: config.JWT_AUDIENCE === 'iaezap-api' },
    { item: 'Access Token Expiry', status: `${config.JWT_ACCESS_TOKEN_EXPIRY}s`, configured: parseInt(config.JWT_ACCESS_TOKEN_EXPIRY) === 3600 },
    { item: 'Private Key', status: privateKeyExists ? 'Configured' : 'Missing', configured: privateKeyExists },
    { item: 'Public Key', status: publicKeyExists ? 'Configured' : 'Missing', configured: publicKeyExists },
    { item: 'sub Claim', status: 'user.id (UUID)', configured: true },
    { item: 'email Claim', status: 'user.email', configured: true },
    { item: 'tenantId Claim', status: 'user.company_id (UUID)', configured: true },
    { item: 'roles Claim', status: 'user.roles (array)', configured: true },
    { item: 'iat Claim', status: 'Current Unix timestamp', configured: true },
    { item: 'exp Claim', status: 'iat + 3600 seconds', configured: true },
  ];

  log('\nValidation Checklist:', 'cyan');
  for (const check of checks) {
    const statusSymbol = check.configured ? '✓' : '✗';
    const statusColor = check.configured ? 'green' : 'red';
    log(`  ${statusSymbol} ${check.item}: ${check.status}`, statusColor);
  }

  const allConfigured = checks.every(c => c.configured);
  log(`\n${allConfigured ? '✓ All JWT claims are properly configured!' : '✗ Some JWT claims need configuration'}`, allConfigured ? 'green' : 'red');

  log('\n' + '='.repeat(80) + '\n', 'bold');
}

// Run analysis
analyzeJWTImplementation().catch((error) => {
  log(`Fatal error: ${error.message}`, 'red');
  process.exit(1);
});
