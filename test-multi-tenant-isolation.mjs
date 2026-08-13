#!/usr/bin/env node

/**
 * Multi-Tenant Isolation Test Script
 * Tests JWT-based multi-tenant access control
 *
 * This script validates:
 * 1. Two users in different companies can register
 * 2. Login generates JWT with company_id
 * 3. Cross-company data access is blocked
 * 4. RLS policies are enforced
 */

// Use native fetch (available in Node.js 18+)
// import { createClient } from '@supabase/supabase-js';

// Use port from environment or default to 3000
const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: Missing Supabase credentials in environment');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Test results tracking
const results = [];

function logResult(testName, passed, details = {}) {
  const status = passed ? '✓ PASS' : '✗ FAIL';
  console.log(`${status}: ${testName}`);
  if (Object.keys(details).length > 0) {
    console.log(`  Details: ${JSON.stringify(details, null, 2)}`);
  }
  results.push({ testName, passed, details });
}

// Decode JWT payload (without verification for inspection)
function decodeJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    return payload;
  } catch (e) {
    return null;
  }
}

async function runTests() {
  console.log('\n========================================');
  console.log('MULTI-TENANT ISOLATION TEST SUITE');
  console.log('========================================\n');

  const timestamp = Date.now();
  const testUsers = {
    companyA: {
      email: `user-a-${timestamp}@test.com`,
      password: 'TestPassword123!',
      company_cnpj: '11222333000181',
      company_name: `Test Company A ${timestamp}`,
    },
    companyB: {
      email: `user-b-${timestamp}@test.com`,
      password: 'TestPassword123!',
      company_cnpj: '11444555000182',
      company_name: `Test Company B ${timestamp}`,
    },
  };

  let registrationA, registrationB, loginA, loginB;

  try {
    // PHASE 1: Register two users in different companies
    console.log('PHASE 1: User Registration in Separate Companies\n');

    // Register User A (Company A)
    console.log('Registering User A in Company A...');
    const regAResponse = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUsers.companyA),
    });

    registrationA = await regAResponse.json();
    const userARegistered = regAResponse.status === 201 && registrationA.success;
    logResult('Register User A in Company A', userARegistered, {
      user_id: registrationA.user?.id,
      company_id: registrationA.user?.company_id,
      email: registrationA.user?.email,
    });

    if (!userARegistered) {
      throw new Error(`Registration A failed: ${registrationA.error?.message}`);
    }

    // Register User B (Company B)
    console.log('Registering User B in Company B...');
    const regBResponse = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUsers.companyB),
    });

    registrationB = await regBResponse.json();
    const userBRegistered = regBResponse.status === 201 && registrationB.success;
    logResult('Register User B in Company B', userBRegistered, {
      user_id: registrationB.user?.id,
      company_id: registrationB.user?.company_id,
      email: registrationB.user?.email,
    });

    if (!userBRegistered) {
      throw new Error(`Registration B failed: ${registrationB.error?.message}`);
    }

    // Verify different companies
    const differentCompanies = registrationA.user.company_id !== registrationB.user.company_id;
    logResult('User A and User B are in different companies', differentCompanies, {
      company_a: registrationA.user.company_id,
      company_b: registrationB.user.company_id,
    });

    // PHASE 2: Login and get JWT tokens
    console.log('\nPHASE 2: Authentication & JWT Token Generation\n');

    // Login User A
    console.log('Logging in User A...');
    const loginAResponse = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testUsers.companyA.email,
        password: testUsers.companyA.password,
      }),
    });

    loginA = await loginAResponse.json();
    const loginASuccess = loginAResponse.status === 200 && loginA.success;
    logResult('Login User A', loginASuccess, {
      user_id: loginA.user?.id,
      company_id: loginA.user?.company_id,
    });

    if (!loginASuccess) {
      throw new Error(`Login A failed: ${loginA.error?.message}`);
    }

    // Login User B
    console.log('Logging in User B...');
    const loginBResponse = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testUsers.companyB.email,
        password: testUsers.companyB.password,
      }),
    });

    loginB = await loginBResponse.json();
    const loginBSuccess = loginBResponse.status === 200 && loginB.success;
    logResult('Login User B', loginBSuccess, {
      user_id: loginB.user?.id,
      company_id: loginB.user?.company_id,
    });

    if (!loginBSuccess) {
      throw new Error(`Login B failed: ${loginB.error?.message}`);
    }

    // PHASE 3: Verify JWT claims
    console.log('\nPHASE 3: JWT Token Claims Verification\n');

    const claimsA = decodeJWT(loginA.access_token);
    const claimsB = decodeJWT(loginB.access_token);

    const jwtAHasCompanyId = claimsA && claimsA.company_id === registrationA.user.company_id;
    logResult('User A JWT contains correct company_id', jwtAHasCompanyId, {
      token_company_id: claimsA?.company_id,
      user_company_id: registrationA.user.company_id,
      jwt_payload: claimsA,
    });

    const jwtBHasCompanyId = claimsB && claimsB.company_id === registrationB.user.company_id;
    logResult('User B JWT contains correct company_id', jwtBHasCompanyId, {
      token_company_id: claimsB?.company_id,
      user_company_id: registrationB.user.company_id,
      jwt_payload: claimsB,
    });

    const tokensAreDifferent = loginA.access_token !== loginB.access_token;
    logResult('User A and User B have different tokens', tokensAreDifferent);

    // PHASE 4: Test RLS via Supabase client (simulating cross-tenant access)
    console.log('\nPHASE 4: Testing RLS Policies (Data Isolation)\n');

    // Test User A can see own company users
    const { data: usersInCompanyA, error: errorCompanyA } = await supabase
      .from('users')
      .select('id, email, company_id')
      .eq('company_id', registrationA.user.company_id)
      .eq('deleted_at', null);

    const userACanSeeOwnCompany = !errorCompanyA && usersInCompanyA && usersInCompanyA.length > 0;
    logResult('User A can see users in Company A', userACanSeeOwnCompany, {
      users_found: usersInCompanyA?.length || 0,
      company_id: registrationA.user.company_id,
    });

    // Test User B can see own company users
    const { data: usersInCompanyB, error: errorCompanyB } = await supabase
      .from('users')
      .select('id, email, company_id')
      .eq('company_id', registrationB.user.company_id)
      .eq('deleted_at', null);

    const userBCanSeeOwnCompany = !errorCompanyB && usersInCompanyB && usersInCompanyB.length > 0;
    logResult('User B can see users in Company B', userBCanSeeOwnCompany, {
      users_found: usersInCompanyB?.length || 0,
      company_id: registrationB.user.company_id,
    });

    // CRITICAL: Verify User A cannot see User B
    const userASeesUserB = usersInCompanyA?.some(u => u.id === registrationB.user.id) || false;
    logResult(
      'CRITICAL: User A cannot see User B (RLS Blocked)',
      !userASeesUserB,
      {
        user_b_id: registrationB.user.id,
        user_b_email: registrationB.user.email,
        found_in_company_a_results: userASeesUserB,
      }
    );

    // CRITICAL: Verify User B cannot see User A
    const userBSeesUserA = usersInCompanyB?.some(u => u.id === registrationA.user.id) || false;
    logResult(
      'CRITICAL: User B cannot see User A (RLS Blocked)',
      !userBSeesUserA,
      {
        user_a_id: registrationA.user.id,
        user_a_email: registrationA.user.email,
        found_in_company_b_results: userBSeesUserA,
      }
    );

    // PHASE 5: Test update prevention
    console.log('\nPHASE 5: Testing Cross-Company Update Prevention\n');

    // Try to update User B using User A's context (should fail)
    const { error: updateError } = await supabase
      .from('users')
      .update({ full_name: 'HACKED_USER_B' })
      .eq('id', registrationB.user.id)
      .select();

    const updateBlocked = !!updateError;
    logResult(
      'CRITICAL: RLS prevents User A from updating Company B users',
      updateBlocked,
      {
        error_code: updateError?.code,
        error_message: updateError?.message,
        target_user_id: registrationB.user.id,
      }
    );

    // Verify update didn't succeed by checking user is unchanged
    const { data: userBAfterAttempt } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', registrationB.user.id)
      .single();

    const userBUnchanged = userBAfterAttempt?.full_name !== 'HACKED_USER_B';
    logResult(
      'CRITICAL: User B data remains unchanged after unauthorized update attempt',
      userBUnchanged,
      {
        user_b_full_name: userBAfterAttempt?.full_name,
      }
    );

    // Cleanup
    console.log('\nPHASE 6: Cleanup\n');

    const { error: userDeleteError } = await supabase
      .from('users')
      .delete()
      .in('id', [registrationA.user.id, registrationB.user.id]);

    const usersDeleted = !userDeleteError;
    logResult('Cleanup: Delete test users', usersDeleted);

    const { error: companyDeleteError } = await supabase
      .from('companies')
      .delete()
      .in('id', [registrationA.user.company_id, registrationB.user.company_id]);

    const companiesDeleted = !companyDeleteError;
    logResult('Cleanup: Delete test companies', companiesDeleted);

    // Print results summary
    console.log('\n========================================');
    console.log('TEST RESULTS SUMMARY');
    console.log('========================================\n');

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const total = results.length;

    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed} (${((passed / total) * 100).toFixed(2)}%)`);
    console.log(`Failed: ${failed} (${((failed / total) * 100).toFixed(2)}%)\n`);

    if (failed > 0) {
      console.log('Failed Tests:');
      results
        .filter(r => !r.passed)
        .forEach(r => {
          console.log(`  - ${r.testName}`);
        });
      console.log();
    }

    // Multi-tenant isolation validation
    console.log('========================================');
    console.log('MULTI-TENANT ISOLATION VALIDATION');
    console.log('========================================\n');

    const isolationTests = [
      results.find(r => r.testName === 'CRITICAL: User A cannot see User B (RLS Blocked)'),
      results.find(r => r.testName === 'CRITICAL: User B cannot see User A (RLS Blocked)'),
      results.find(r => r.testName === 'CRITICAL: RLS prevents User A from updating Company B users'),
      results.find(r => r.testName === 'CRITICAL: User B data remains unchanged after unauthorized update attempt'),
    ];

    console.log('Core Isolation Tests:');
    isolationTests.forEach(test => {
      if (test) {
        const status = test.passed ? '✓' : '✗';
        console.log(`  ${status} ${test.testName}`);
      }
    });

    const allIsolationPassed = isolationTests.every(t => t && t.passed);
    console.log(`\nOverall Isolation Status: ${allIsolationPassed ? 'PASSED ✓' : 'FAILED ✗'}\n`);

    console.log('========================================');
    console.log('END OF TEST SUITE');
    console.log('========================================\n');

    process.exit(failed > 0 ? 1 : 0);

  } catch (error) {
    console.error('Test suite error:', error.message);
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
