import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

// Load .env.local
const envPath = path.join(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envLines = envContent.split('\n');
const envVars = {};
envLines.forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...valueParts] = trimmed.split('=');
    const value = valueParts.join('=').replace(/^"(.*)"$/, '$1').replace(/\\n/g, '\n');
    envVars[key] = value;
  }
});

console.log('=== JWT TOKEN GENERATION VALIDATION ===\n');

try {
  const privateKey = envVars.JWT_PRIVATE_KEY;
  const publicKey = envVars.JWT_PUBLIC_KEY;
  const issuer = envVars.JWT_ISSUER || 'iaezap';
  const audience = envVars.JWT_AUDIENCE || 'iaezap-api';
  const accessTokenExpiry = parseInt(envVars.JWT_ACCESS_TOKEN_EXPIRY || '3600', 10);
  const refreshTokenExpiry = parseInt(envVars.JWT_REFRESH_TOKEN_EXPIRY || '604800', 10);

  console.log('Configuration:');
  console.log(`  Issuer: ${issuer}`);
  console.log(`  Audience: ${audience}`);
  console.log(`  Access Token Expiry: ${accessTokenExpiry} seconds`);
  console.log(`  Refresh Token Expiry: ${refreshTokenExpiry} seconds`);

  if (!privateKey || !publicKey) {
    console.error('\n❌ FAILED: JWT keys not configured');
    process.exit(1);
  }

  console.log('  Private Key: ✓ Configured');
  console.log('  Public Key: ✓ Configured\n');

  // Simulate a token pair generation
  const testPayload = {
    user_id: 'test-user-123',
    company_id: 'test-company-456',
    email: 'test_user_1@example.com',
    role: 'admin',
  };

  console.log('Test Payload:');
  console.log(`  user_id: ${testPayload.user_id}`);
  console.log(`  company_id: ${testPayload.company_id}`);
  console.log(`  email: ${testPayload.email}`);
  console.log(`  role: ${testPayload.role}\n`);

  // Generate access token
  const now = Math.floor(Date.now() / 1000);
  const accessTokenPayload = {
    sub: testPayload.user_id,
    email: testPayload.email,
    roles: [testPayload.role],
    tenantId: testPayload.company_id,
    iat: now,
    exp: now + accessTokenExpiry,
    aud: audience,
    iss: issuer,
  };

  const accessToken = jwt.sign(accessTokenPayload, privateKey, {
    algorithm: 'RS256',
    expiresIn: accessTokenExpiry,
  });

  console.log('=== ACCESS TOKEN GENERATED ===\n');
  console.log('Token (truncated):', accessToken.substring(0, 50) + '...\n');

  // Verify access token signature
  try {
    const decoded = jwt.verify(accessToken, publicKey, {
      algorithms: ['RS256'],
      issuer: issuer,
      audience: audience,
    });

    console.log('✓ TEST 1: Token signature valid (RS256) - PASSED');
    console.log('✓ TEST 2: Token issuer correct - PASSED');
    console.log('✓ TEST 3: Token audience correct - PASSED');
  } catch (verifyError) {
    console.error('❌ Token verification failed:', verifyError.message);
    process.exit(1);
  }

  // Decode token to examine payload
  const parts = accessToken.split('.');
  if (parts.length === 3) {
    try {
      const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());

      console.log('\nToken Structure Analysis:');
      console.log('  Header:');
      console.log(`    Algorithm: ${header.alg}`);
      console.log(`    Type: ${header.typ}`);

      console.log('\n  Payload Claims:');
      console.log(`    sub (user_id): ${payload.sub}`);
      console.log(`    email: ${payload.email}`);
      console.log(`    roles: ${JSON.stringify(payload.roles)}`);
      console.log(`    tenantId (company_id): ${payload.tenantId}`);
      console.log(`    iat: ${payload.iat} (${new Date(payload.iat * 1000).toISOString()})`);
      console.log(`    exp: ${payload.exp} (${new Date(payload.exp * 1000).toISOString()})`);
      console.log(`    iss: ${payload.iss}`);
      console.log(`    aud: ${payload.aud}`);

      // Verify all required claims are present
      console.log('\n=== CLAIM VERIFICATION ===');
      const requiredClaims = ['sub', 'email', 'tenantId', 'roles', 'iss', 'aud'];
      let allClaimsPresent = true;

      requiredClaims.forEach(claim => {
        const isPresent = claim in payload;
        console.log(`  ${claim}: ${isPresent ? '✓' : '❌'}`);
        if (!isPresent) allClaimsPresent = false;
      });

      if (allClaimsPresent) {
        console.log('\n✓ TEST 4: JWT contains all required claims - PASSED');
      } else {
        console.log('\n❌ TEST 4: JWT missing required claims - FAILED');
        process.exit(1);
      }
    } catch (error) {
      console.error('Error decoding token:', error.message);
      process.exit(1);
    }
  }

  // Generate refresh token
  const refreshTokenPayload = {
    sub: testPayload.user_id,
    email: testPayload.email,
    type: 'refresh',
    tenantId: testPayload.company_id,
    iat: now,
    exp: now + refreshTokenExpiry,
    iss: issuer,
    aud: audience,
  };

  const refreshToken = jwt.sign(refreshTokenPayload, privateKey, {
    algorithm: 'RS256',
    expiresIn: refreshTokenExpiry,
  });

  console.log('\n=== REFRESH TOKEN GENERATED ===');
  console.log('Token (truncated):', refreshToken.substring(0, 50) + '...');

  // Verify refresh token signature
  try {
    jwt.verify(refreshToken, publicKey, {
      algorithms: ['RS256'],
      issuer: issuer,
      audience: audience,
    });
    console.log('✓ Refresh token signature valid - PASSED');
  } catch (verifyError) {
    console.error('❌ Refresh token verification failed:', verifyError.message);
    process.exit(1);
  }

  console.log('\n=== FINAL SUMMARY ===');
  console.log('✓ JWT Token Generation - ALL TESTS PASSED');
  console.log('✓ RS256 Signature Algorithm - VERIFIED');
  console.log('✓ Required Claims Structure - VERIFIED');
  console.log('✓ Token Verification with Public Key - VERIFIED');
  console.log('✓ Issuer and Audience Validation - VERIFIED');

  console.log('\n=== TOKEN PAIR EXAMPLE ===');
  console.log('Access Token (JWT):');
  console.log(`  Algorithm: RS256`);
  console.log(`  Expiration: ${accessTokenExpiry} seconds (${Math.floor(accessTokenExpiry / 3600)} hour(s))`);
  console.log(`  Contains Claims: user_id, email, company_id, role, iat, exp, iss, aud`);

  console.log('\nRefresh Token (JWT):');
  console.log(`  Algorithm: RS256`);
  console.log(`  Expiration: ${refreshTokenExpiry} seconds (${Math.floor(refreshTokenExpiry / 86400)} days)`);
  console.log(`  Contains Claims: user_id, email, type='refresh', iat, exp, iss, aud`);

  console.log('\n✓ VALIDATION COMPLETE - JWT TOKEN GENERATION READY FOR PRODUCTION');

} catch (error) {
  console.error('❌ Validation Failed:', error.message);
  process.exit(1);
}
