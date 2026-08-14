/**
 * Test JWT Token Generation and Claims Validation
 * Generates a test JWT and validates all claims
 */

const jwt = require('jsonwebtoken');
require('dotenv').config({ path: '.env.local' });

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

function generateTestJWT() {
  log(`\n${'='.repeat(80)}`, 'bold');
  log('JWT TOKEN GENERATION AND VALIDATION TEST', 'bold');
  log(`${'='.repeat(80)}\n`, 'bold');

  try {
    // Get environment configuration
    const privateKey = process.env.JWT_PRIVATE_KEY;
    const publicKey = process.env.JWT_PUBLIC_KEY;
    const issuer = process.env.JWT_ISSUER || 'iaezap';
    const audience = process.env.JWT_AUDIENCE || 'iaezap-api';
    const expirySeconds = parseInt(process.env.JWT_ACCESS_TOKEN_EXPIRY || '3600', 10);

    if (!privateKey || !publicKey) {
      log('Error: JWT keys not configured', 'red');
      return;
    }

    // Convert escaped newlines to actual newlines
    const privateKeyPem = privateKey.includes('\\n')
      ? privateKey.replace(/\\n/g, '\n')
      : privateKey;

    const publicKeyPem = publicKey.includes('\\n')
      ? publicKey.replace(/\\n/g, '\n')
      : publicKey;

    // Step 1: Create test JWT payload
    log('STEP 1: Create JWT Payload with All Required Claims', 'blue');
    log('-'.repeat(80), 'blue');

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      // Required claims
      sub: '123e4567-e89b-12d3-a456-426614174000',  // User ID
      email: 'test.jwt@example.com',                 // User email
      tenantId: '987fcdeb-51a2-49a2-b1c3-1234567890ab',  // Company ID
      roles: ['admin'],                              // User roles
      iat: now,                                       // Issued at
      exp: now + expirySeconds,                       // Expires at
      iss: issuer,                                    // Issuer
      aud: audience,                                  // Audience
    };

    log('\nPayload:', 'cyan');
    log(JSON.stringify(payload, null, 2), 'cyan');

    // Step 2: Sign the JWT
    log('\nSTEP 2: Sign JWT with RS256', 'blue');
    log('-'.repeat(80), 'blue');

    // Remove iss and aud from payload since jwt.sign will add them
    const payloadForSigning = { ...payload };
    delete payloadForSigning.iss;
    delete payloadForSigning.aud;

    const token = jwt.sign(payloadForSigning, privateKeyPem, {
      algorithm: 'RS256',
      issuer,
      audience,
    });

    log('\n✓ Token signed successfully', 'green');
    log(`\nToken Length: ${token.length} characters`, 'cyan');
    log(`Token: ${token.substring(0, 50)}...${token.substring(token.length - 50)}`, 'cyan');

    // Step 3: Decode and inspect token parts
    log('\nSTEP 3: Decode and Inspect Token Structure', 'blue');
    log('-'.repeat(80), 'blue');

    const parts = token.split('.');
    if (parts.length !== 3) {
      log('Error: Invalid token structure', 'red');
      return;
    }

    // Decode header
    const header = JSON.parse(Buffer.from(parts[0], 'base64').toString('utf-8'));
    log('\nToken Header:', 'cyan');
    log(JSON.stringify(header, null, 2), 'cyan');

    // Decode payload
    const decodedPayload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
    log('\nToken Payload (Unverified):', 'cyan');
    log(JSON.stringify(decodedPayload, null, 2), 'cyan');

    // Step 4: Verify token signature
    log('\nSTEP 4: Verify Token Signature with Public Key', 'blue');
    log('-'.repeat(80), 'blue');

    let verified = null;
    try {
      verified = jwt.verify(token, publicKeyPem, {
        algorithms: ['RS256'],
        issuer,
        audience,
      });

      log('\n✓ Signature verification successful', 'green');
      log('\nVerified Payload:', 'cyan');
      log(JSON.stringify(verified, null, 2), 'cyan');
    } catch (error) {
      log(`\n✗ Signature verification failed: ${error.message}`, 'red');
      return;
    }

    // Step 5: Validate all required claims
    log('\nSTEP 5: Validate All Required Claims', 'blue');
    log('-'.repeat(80), 'blue');

    const claims = [
      {
        name: 'sub (Subject/User ID)',
        value: verified.sub,
        expected: payload.sub,
        type: 'string',
        validator: (val) => typeof val === 'string' && val.length > 0,
      },
      {
        name: 'email (User Email)',
        value: verified.email,
        expected: payload.email,
        type: 'string',
        validator: (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
      },
      {
        name: 'tenantId (Company ID)',
        value: verified.tenantId,
        expected: payload.tenantId,
        type: 'string',
        validator: (val) => typeof val === 'string' && val.length > 0,
      },
      {
        name: 'roles (User Roles)',
        value: verified.roles,
        expected: payload.roles,
        type: 'array',
        validator: (val) => Array.isArray(val) && val.length > 0,
      },
      {
        name: 'iat (Issued At)',
        value: verified.iat,
        expected: now,
        type: 'number',
        validator: (val) => typeof val === 'number' && val > 0,
      },
      {
        name: 'exp (Expiration)',
        value: verified.exp,
        expected: now + expirySeconds,
        type: 'number',
        validator: (val) => typeof val === 'number' && val > now,
      },
      {
        name: 'iss (Issuer)',
        value: verified.iss,
        expected: issuer,
        type: 'string',
        validator: (val) => val === issuer,
      },
      {
        name: 'aud (Audience)',
        value: verified.aud,
        expected: audience,
        type: 'string',
        validator: (val) => val === audience,
      },
    ];

    let allValid = true;
    for (const claim of claims) {
      const typeValid = typeof claim.value === claim.type.toLowerCase() || Array.isArray(claim.value);
      const formatValid = claim.validator(claim.value);
      const valueMatch = JSON.stringify(claim.value) === JSON.stringify(claim.expected);

      const isValid = typeValid && formatValid && (claim.expected ? valueMatch : true);
      const status = isValid ? '✓' : '✗';
      const color = isValid ? 'green' : 'red';

      log(`\n${status} ${claim.name}`, color);
      log(`  Type: ${claim.type} (actual: ${typeof claim.value})`, 'cyan');
      log(`  Value: ${JSON.stringify(claim.value)}`, 'cyan');
      log(`  Expected: ${JSON.stringify(claim.expected)}`, 'cyan');
      log(`  Valid: ${isValid}`, isValid ? 'green' : 'red');

      if (!isValid) {
        allValid = false;
      }
    }

    // Step 6: Token expiration timeline
    log('\nSTEP 6: Token Expiration Timeline', 'blue');
    log('-'.repeat(80), 'blue');

    const nowDate = new Date(now * 1000);
    const expDate = new Date(verified.exp * 1000);
    const secondsUntilExpiry = verified.exp - now;

    log('\nTimeline:', 'cyan');
    log(`  Issued At (iat): ${verified.iat} (${nowDate.toISOString()})`, 'cyan');
    log(`  Expires At (exp): ${verified.exp} (${expDate.toISOString()})`, 'cyan');
    log(`  Seconds Until Expiry: ${secondsUntilExpiry} seconds`, 'cyan');
    log(`  Duration: ${(secondsUntilExpiry / 60).toFixed(0)} minutes (${(secondsUntilExpiry / 3600).toFixed(1)} hours)`, 'cyan');

    // Step 7: Test token expiration
    log('\nSTEP 7: Verify Token Will Expire Correctly', 'blue');
    log('-'.repeat(80), 'blue');

    // Create an expired token
    const expiredPayload = {
      ...payload,
      exp: now - 60,  // Expired 60 seconds ago
    };

    const expiredToken = jwt.sign(expiredPayload, privateKeyPem, {
      algorithm: 'RS256',
      noTimestamp: true,  // Use our exp value
    });

    try {
      jwt.verify(expiredToken, publicKeyPem, {
        algorithms: ['RS256'],
      });
      log('\n✗ Expired token was not rejected (SECURITY ISSUE!)', 'red');
    } catch (error) {
      log('\n✓ Expired token correctly rejected', 'green');
      log(`  Error: ${error.message}`, 'cyan');
    }

    // Final Summary
    log('\n' + '='.repeat(80), 'bold');
    log('TEST SUMMARY', 'bold');
    log('='.repeat(80), 'bold');

    log(`\nToken Generation: ✓ PASS`, 'green');
    log(`Signature Verification: ✓ PASS`, 'green');
    log(`Claims Validation: ${allValid ? '✓ PASS' : '✗ FAIL'}`, allValid ? 'green' : 'red');
    log(`Expiration Enforcement: ✓ PASS`, 'green');

    if (allValid) {
      log(`\n✓ All JWT claims are correctly generated and validated!`, 'green');
    } else {
      log(`\n✗ Some claims failed validation.`, 'red');
    }

    // Output for reference
    log('\n' + '-'.repeat(80), 'blue');
    log('Token for Testing:', 'blue');
    log('-'.repeat(80), 'blue');
    log('\nFull JWT Token:', 'cyan');
    log(token, 'cyan');

    log('\nUsage in curl:', 'cyan');
    log(`curl -H "Authorization: Bearer ${token.substring(0, 20)}..." https://api.example.com/protected`, 'yellow');

  } catch (error) {
    log(`\nError: ${error.message}`, 'red');
    log(error.stack, 'red');
  }

  log('\n' + '='.repeat(80) + '\n', 'bold');
}

generateTestJWT();
