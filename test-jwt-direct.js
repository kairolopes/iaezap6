/**
 * Direct JWT Claims Validation Test
 * Uses database directly to find test user and tests JWT claims
 */

const jwt = require('jsonwebtoken');
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

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

const API_BASE_URL = 'http://localhost:3000';

// JWT Claims to validate
const REQUIRED_CLAIMS = {
  sub: {
    description: 'User ID',
    expectedType: 'string',
    validator: (val) => typeof val === 'string' && val.length > 0,
  },
  email: {
    description: 'User email',
    expectedType: 'string',
    validator: (val) => typeof val === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
  },
  tenantId: {
    description: 'Company/Tenant ID',
    expectedType: 'string',
    validator: (val) => typeof val === 'string' && val.length > 0,
  },
  roles: {
    description: 'User roles',
    expectedType: 'array',
    validator: (val) => Array.isArray(val) && val.length > 0,
  },
  iat: {
    description: 'Issued at (Unix timestamp)',
    expectedType: 'number',
    validator: (val) => typeof val === 'number' && val > 0,
  },
  exp: {
    description: 'Expiration (Unix timestamp)',
    expectedType: 'number',
    validator: (val) => typeof val === 'number' && val > 0,
  },
  iss: {
    description: 'Issuer',
    expectedType: 'string',
    expectedValue: 'iaezap',
    validator: (val) => val === 'iaezap',
  },
  aud: {
    description: 'Audience',
    expectedType: 'string',
    expectedValue: 'iaezap-api',
    validator: (val) => val === 'iaezap-api',
  },
};

/**
 * Decode JWT without verification
 */
function decodeToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }

    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
    const header = JSON.parse(Buffer.from(parts[0], 'base64').toString('utf-8'));

    return { header, payload };
  } catch (error) {
    log(`Error decoding token: ${error.message}`, 'red');
    return null;
  }
}

/**
 * Verify JWT signature and claims
 */
function verifyToken(token, publicKey) {
  try {
    const publicKeyPem = publicKey.includes('\\n')
      ? publicKey.replace(/\\n/g, '\n')
      : publicKey;

    const decoded = jwt.verify(token, publicKeyPem, {
      algorithms: ['RS256'],
      issuer: 'iaezap',
      audience: 'iaezap-api',
    });

    return { valid: true, payload: decoded };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

/**
 * Validate individual claim
 */
function validateClaim(claimName, claimValue, expectedClaimConfig) {
  const result = {
    name: claimName,
    description: expectedClaimConfig.description,
    present: claimValue !== undefined,
    value: claimValue,
    expectedType: expectedClaimConfig.expectedType,
    valid: false,
    error: null,
  };

  if (!result.present) {
    result.error = `Claim missing from token`;
    return result;
  }

  if (!expectedClaimConfig.validator(claimValue)) {
    result.error = `Invalid value: ${JSON.stringify(claimValue)} (expected ${expectedClaimConfig.expectedType})`;
    return result;
  }

  if (expectedClaimConfig.expectedValue !== undefined) {
    if (claimValue !== expectedClaimConfig.expectedValue) {
      result.error = `Value mismatch: got "${claimValue}", expected "${expectedClaimConfig.expectedValue}"`;
      return result;
    }
  }

  // Special validation for expiration time
  if (claimName === 'exp') {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const expiresInSeconds = claimValue - nowSeconds;

    if (expiresInSeconds <= 0) {
      result.error = `Token is expired`;
      return result;
    }

    // Check if expiry is approximately 3600 seconds (1 hour)
    const expectedExpiry = 3600;
    const tolerance = 60; // 60 seconds tolerance

    result.expiresInSeconds = expiresInSeconds;
    result.expectedExpirySeconds = expectedExpiry;
    result.expiryMatch = Math.abs(expiresInSeconds - expectedExpiry) <= tolerance;
  }

  // Special validation for iat
  if (claimName === 'iat') {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const timeDiff = nowSeconds - claimValue;

    if (timeDiff > 60) {
      result.error = `Token issued more than 60 seconds ago`;
      return result;
    }

    result.issuedSecondsAgo = timeDiff;
  }

  result.valid = true;
  return result;
}

/**
 * Main test function
 */
async function testJWTClaims() {
  log(`\n${'='.repeat(80)}`, 'bold');
  log('JWT CLAIMS VALIDATION TEST (Direct DB)', 'bold');
  log(`${'='.repeat(80)}\n`, 'bold');

  try {
    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      log('Missing Supabase configuration', 'red');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Step 1: Get existing user from database
    log('Step 1: Fetching test user from database...', 'blue');
    log('-'.repeat(80), 'blue');

    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, password_hash, role, company_id')
      .limit(1);

    if (usersError || !users || users.length === 0) {
      log('No users found in database. Please create a user first.', 'yellow');
      log('Create a user by registering at the API or manually inserting into the database.', 'yellow');
      return;
    }

    const user = users[0];
    log(`Found test user: ${user.email}`, 'green');
    log(`User ID: ${user.id}`, 'cyan');
    log(`Company ID: ${user.company_id}`, 'cyan');
    log(`Role: ${user.role}`, 'cyan');

    // Step 2: Create a test password and update user if needed
    log('\nStep 2: Setting test password...', 'blue');
    log('-'.repeat(80), 'blue');

    const testPassword = 'TestPassword123!@#';
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(testPassword, 10);

    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: hashedPassword })
      .eq('id', user.id);

    if (updateError) {
      log(`Error updating password: ${updateError.message}`, 'yellow');
    } else {
      log(`Password updated for user ${user.email}`, 'green');
    }

    // Step 3: Login with the test user
    log('\nStep 3: Attempting login...', 'blue');
    log('-'.repeat(80), 'blue');

    const loginResponse = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: user.email,
        password: testPassword,
      }),
    });

    const loginData = await loginResponse.json();

    if (!loginResponse.ok) {
      log(`Login failed with status ${loginResponse.status}:`, 'red');
      log(JSON.stringify(loginData, null, 2), 'red');
      return;
    }

    log('Login successful!', 'green');
    log(`User ID: ${loginData.user.id}`, 'green');
    log(`Company ID: ${loginData.company_id}`, 'green');

    // Step 4: Extract and decode access token
    log('\nStep 4: Decoding JWT access token...', 'blue');
    log('-'.repeat(80), 'blue');

    const accessToken = loginData.access_token;
    const decoded = decodeToken(accessToken);

    if (!decoded) {
      log('Failed to decode token', 'red');
      return;
    }

    log('Token header:', 'cyan');
    log(JSON.stringify(decoded.header, null, 2), 'cyan');

    log('\nToken payload (unverified):', 'cyan');
    log(JSON.stringify(decoded.payload, null, 2), 'cyan');

    // Step 5: Verify token signature
    log('\nStep 5: Verifying JWT signature...', 'blue');
    log('-'.repeat(80), 'blue');

    const publicKey = process.env.JWT_PUBLIC_KEY;
    if (!publicKey) {
      log('JWT_PUBLIC_KEY not configured in environment', 'red');
      return;
    }

    const verification = verifyToken(accessToken, publicKey);

    if (!verification.valid) {
      log(`Signature verification failed: ${verification.error}`, 'red');
      return;
    }

    log('Signature verification successful!', 'green');

    // Step 6: Validate individual claims
    log('\nStep 6: Validating JWT claims...', 'blue');
    log('-'.repeat(80), 'blue');

    const payload = verification.payload;
    const claimResults = [];

    for (const [claimName, claimConfig] of Object.entries(REQUIRED_CLAIMS)) {
      const result = validateClaim(claimName, payload[claimName], claimConfig);
      claimResults.push(result);
    }

    // Step 7: Display detailed claim validation results
    log('\nStep 7: Detailed Claim Analysis', 'blue');
    log('-'.repeat(80), 'blue');

    let allValid = true;
    for (const result of claimResults) {
      const status = result.valid ? '✓' : '✗';
      const color = result.valid ? 'green' : 'red';

      log(`\n${status} ${result.name} (${result.description})`, color);
      log(`  Type: ${result.expectedType}`, 'cyan');

      if (!result.present) {
        log(`  Status: MISSING`, 'red');
        allValid = false;
      } else {
        log(`  Value: ${JSON.stringify(result.value)}`, 'cyan');

        if (result.expectedValue !== undefined) {
          log(`  Expected: "${result.expectedValue}"`, 'cyan');
        }

        if (result.issuedSecondsAgo !== undefined) {
          log(`  Issued ${result.issuedSecondsAgo} seconds ago`, 'cyan');
        }

        if (result.expiresInSeconds !== undefined) {
          log(`  Expires in: ${result.expiresInSeconds} seconds (expected ~${result.expectedExpirySeconds})`, 'cyan');
          if (result.expiryMatch) {
            log(`  Expiry time: CORRECT`, 'green');
          } else {
            log(`  Expiry time: WARNING (diff: ${Math.abs(result.expiresInSeconds - result.expectedExpirySeconds)} seconds)`, 'yellow');
          }
        }

        if (result.error) {
          log(`  Error: ${result.error}`, 'red');
          allValid = false;
        } else {
          log(`  Status: VALID`, 'green');
        }
      }
    }

    // Step 8: Test refresh token
    log('\nStep 8: Testing Refresh Token...', 'blue');
    log('-'.repeat(80), 'blue');

    const refreshToken = loginData.refresh_token;
    const refreshDecoded = decodeToken(refreshToken);

    if (refreshDecoded) {
      log('Refresh token payload:', 'cyan');
      log(JSON.stringify(refreshDecoded.payload, null, 2), 'cyan');

      const refreshVerification = verifyToken(refreshToken, publicKey);
      if (refreshVerification.valid) {
        log('Refresh token verified successfully!', 'green');
      } else {
        log(`Refresh token verification failed: ${refreshVerification.error}`, 'red');
      }
    }

    // Final Report
    log('\n' + '='.repeat(80), 'bold');
    log('TEST SUMMARY', 'bold');
    log('='.repeat(80), 'bold');

    const validClaims = claimResults.filter(r => r.valid).length;
    const totalClaims = claimResults.length;

    log(`\nClaims validated: ${validClaims}/${totalClaims}`, allValid ? 'green' : 'red');

    if (allValid) {
      log('\n✓ All JWT claims are valid and correctly formatted!', 'green');
    } else {
      log('\n✗ Some JWT claims have validation errors. See details above.', 'red');

      const invalidClaims = claimResults.filter(r => !r.valid);
      log('\nInvalid claims:', 'red');
      for (const claim of invalidClaims) {
        log(`  - ${claim.name}: ${claim.error}`, 'red');
      }
    }

    // Additional validation checks
    log('\n' + '-'.repeat(80), 'blue');
    log('ADDITIONAL VALIDATION CHECKS', 'blue');
    log('-'.repeat(80), 'blue');

    // Check mapping from database to JWT
    log('\nDatabase to JWT Mapping:', 'cyan');
    log(`  User ID: ${loginData.user.id} -> sub: ${payload.sub}`, 'cyan');
    log(`  Email: ${loginData.user.email} -> email: ${payload.email}`, 'cyan');
    log(`  Company ID: ${loginData.company_id} -> tenantId: ${payload.tenantId}`, 'cyan');
    log(`  Role: ${loginData.user.role} -> roles: ${JSON.stringify(payload.roles)}`, 'cyan');

    // Verify these match
    const userIdMatch = loginData.user.id === payload.sub;
    const emailMatch = loginData.user.email === payload.email;
    const companyMatch = loginData.company_id === payload.tenantId;

    log(`\nMapping validation:`, userIdMatch && emailMatch && companyMatch ? 'green' : 'red');
    log(`  User ID match: ${userIdMatch ? '✓' : '✗'}`, userIdMatch ? 'green' : 'red');
    log(`  Email match: ${emailMatch ? '✓' : '✗'}`, emailMatch ? 'green' : 'red');
    log(`  Company ID match: ${companyMatch ? '✓' : '✗'}`, companyMatch ? 'green' : 'red');

    // Report all claims present in token
    log('\n' + '-'.repeat(80), 'blue');
    log('ALL CLAIMS PRESENT IN TOKEN', 'blue');
    log('-'.repeat(80), 'blue');

    log(JSON.stringify(payload, null, 2), 'cyan');

  } catch (error) {
    log(`\n✗ Test failed with error: ${error.message}`, 'red');
    log(error.stack, 'red');
  }

  log('\n' + '='.repeat(80) + '\n', 'bold');
}

// Run the test
testJWTClaims().catch((error) => {
  log(`Fatal error: ${error.message}`, 'red');
  process.exit(1);
});
