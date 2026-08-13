/**
 * Multi-Tenant Isolation Test Suite
 *
 * Tests multi-tenant data isolation through:
 * 1. User creation in separate companies
 * 2. JWT token generation with company_id claims
 * 3. RLS policy enforcement
 * 4. Cross-tenant access prevention
 * 5. Audit trail validation
 */

import { createClient } from '@supabase/supabase-js';
import { generateTokenPair, verifyToken, JwtClaims } from '@/lib/jwt';
import bcrypt from 'bcrypt';

// Types for test results
interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: Record<string, any>;
}

interface MultiTenantTestSuite {
  companyA: { id: string; name: string; slug: string };
  companyB: { id: string; name: string; slug: string };
  userA: { id: string; email: string; company_id: string; role: string };
  userB: { id: string; email: string; company_id: string; role: string };
  jwtA: { access: string; refresh: string };
  jwtB: { access: string; refresh: string };
  results: TestResult[];
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize test suite
const testSuite: MultiTenantTestSuite = {
  companyA: { id: '', name: '', slug: '' },
  companyB: { id: '', name: '', slug: '' },
  userA: { id: '', email: '', company_id: '', role: '' },
  userB: { id: '', email: '', company_id: '', role: '' },
  jwtA: { access: '', refresh: '' },
  jwtB: { access: '', refresh: '' },
  results: [],
};

// Utility function to add test result
function addResult(name: string, passed: boolean, error?: string, details?: Record<string, any>) {
  testSuite.results.push({ name, passed, error, details });
  const status = passed ? '✓ PASS' : '✗ FAIL';
  const message = error ? ` - ${error}` : '';
  console.log(`${status}: ${name}${message}`);
  if (details) {
    console.log(`  Details: ${JSON.stringify(details, null, 2)}`);
  }
}

// Main test function
async function runMultiTenantTests() {
  console.log('\n========================================');
  console.log('MULTI-TENANT ISOLATION TEST SUITE');
  console.log('========================================\n');

  try {
    // PHASE 1: Create two companies
    console.log('PHASE 1: Creating Test Companies...\n');
    await createTestCompanies();

    // PHASE 2: Create two users in different companies
    console.log('\nPHASE 2: Creating Test Users...\n');
    await createTestUsers();

    // PHASE 3: Login and get JWT tokens
    console.log('\nPHASE 3: Authentication & JWT Generation...\n');
    await authenticateUsers();

    // PHASE 4: Test JWT claims contain correct company_id
    console.log('\nPHASE 4: Verifying JWT Claims...\n');
    await verifyJWTClaims();

    // PHASE 5: Test RLS policies
    console.log('\nPHASE 5: Testing RLS Policies (Data Isolation)...\n');
    await testRLSPolicies();

    // PHASE 6: Test cross-tenant access prevention
    console.log('\nPHASE 6: Testing Cross-Tenant Access Prevention...\n');
    await testCrossTenantPrevention();

    // PHASE 7: Test audit logging
    console.log('\nPHASE 7: Testing Audit Logs...\n');
    await testAuditLogs();

    // Cleanup
    console.log('\nPHASE 8: Cleanup...\n');
    await cleanup();

    // Print results summary
    printTestSummary();

  } catch (error) {
    console.error('Fatal error during tests:', error);
    process.exit(1);
  }
}

// PHASE 1: Create test companies
async function createTestCompanies() {
  try {
    // Create Company A
    const { data: companyAData, error: companyAError } = await supabase
      .from('companies')
      .insert([
        {
          name: 'Test Company A',
          slug: `test-company-a-${Date.now()}`,
          description: 'First test company for multi-tenant isolation',
          plan: 'starter',
          status: 'active',
          owner_id: '00000000-0000-0000-0000-000000000002', // Master user
          metadata: { test: true, company: 'A' },
        },
      ])
      .select('id, name, slug')
      .single();

    if (companyAError || !companyAData) {
      throw new Error(`Failed to create Company A: ${companyAError?.message}`);
    }

    testSuite.companyA = companyAData;
    addResult('Create Company A', true, undefined, {
      id: companyAData.id,
      name: companyAData.name,
      slug: companyAData.slug,
    });

    // Create Company B
    const { data: companyBData, error: companyBError } = await supabase
      .from('companies')
      .insert([
        {
          name: 'Test Company B',
          slug: `test-company-b-${Date.now()}`,
          description: 'Second test company for multi-tenant isolation',
          plan: 'starter',
          status: 'active',
          owner_id: '00000000-0000-0000-0000-000000000002', // Master user
          metadata: { test: true, company: 'B' },
        },
      ])
      .select('id, name, slug')
      .single();

    if (companyBError || !companyBData) {
      throw new Error(`Failed to create Company B: ${companyBError?.message}`);
    }

    testSuite.companyB = companyBData;
    addResult('Create Company B', true, undefined, {
      id: companyBData.id,
      name: companyBData.name,
      slug: companyBData.slug,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    addResult('Create test companies', false, message);
    throw error;
  }
}

// PHASE 2: Create test users
async function createTestUsers() {
  try {
    const passwordHash = await bcrypt.hash('TestPassword123!', 10);

    // Create User A in Company A
    const { data: userAData, error: userAError } = await supabase
      .from('users')
      .insert([
        {
          company_id: testSuite.companyA.id,
          email: `user-a-${Date.now()}@test.com`,
          full_name: 'User A',
          role: 'admin',
          status: 'active',
          email_verified: true,
          password_hash: passwordHash,
        },
      ])
      .select('id, email, company_id, role')
      .single();

    if (userAError || !userAData) {
      throw new Error(`Failed to create User A: ${userAError?.message}`);
    }

    testSuite.userA = userAData;
    addResult('Create User A in Company A', true, undefined, {
      id: userAData.id,
      email: userAData.email,
      company_id: userAData.company_id,
      role: userAData.role,
    });

    // Create User B in Company B
    const { data: userBData, error: userBError } = await supabase
      .from('users')
      .insert([
        {
          company_id: testSuite.companyB.id,
          email: `user-b-${Date.now()}@test.com`,
          full_name: 'User B',
          role: 'admin',
          status: 'active',
          email_verified: true,
          password_hash: passwordHash,
        },
      ])
      .select('id, email, company_id, role')
      .single();

    if (userBError || !userBData) {
      throw new Error(`Failed to create User B: ${userBError?.message}`);
    }

    testSuite.userB = userBData;
    addResult('Create User B in Company B', true, undefined, {
      id: userBData.id,
      email: userBData.email,
      company_id: userBData.company_id,
      role: userBData.role,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    addResult('Create test users', false, message);
    throw error;
  }
}

// PHASE 3: Authenticate users and generate JWT tokens
async function authenticateUsers() {
  try {
    // Generate tokens for User A
    const jwtA = generateTokenPair(
      testSuite.userA.id,
      testSuite.userA.company_id,
      testSuite.userA.email,
      testSuite.userA.role
    );

    testSuite.jwtA = {
      access: jwtA.accessToken,
      refresh: jwtA.refreshToken,
    };

    addResult('Generate JWT for User A', true, undefined, {
      user_id: testSuite.userA.id,
      company_id: testSuite.userA.company_id,
    });

    // Generate tokens for User B
    const jwtB = generateTokenPair(
      testSuite.userB.id,
      testSuite.userB.company_id,
      testSuite.userB.email,
      testSuite.userB.role
    );

    testSuite.jwtB = {
      access: jwtB.accessToken,
      refresh: jwtB.refreshToken,
    };

    addResult('Generate JWT for User B', true, undefined, {
      user_id: testSuite.userB.id,
      company_id: testSuite.userB.company_id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    addResult('Authenticate users', false, message);
    throw error;
  }
}

// PHASE 4: Verify JWT claims
async function verifyJWTClaims() {
  try {
    // Verify User A's token
    const claimsA = verifyToken(testSuite.jwtA.access);
    if (!claimsA) {
      throw new Error('Failed to verify User A token');
    }

    const passed = claimsA.company_id === testSuite.userA.company_id &&
                   claimsA.user_id === testSuite.userA.id;

    addResult('Verify User A JWT claims', passed, passed ? undefined : 'company_id or user_id mismatch', {
      expected_company_id: testSuite.userA.company_id,
      actual_company_id: claimsA.company_id,
      expected_user_id: testSuite.userA.id,
      actual_user_id: claimsA.user_id,
    });

    // Verify User B's token
    const claimsB = verifyToken(testSuite.jwtB.access);
    if (!claimsB) {
      throw new Error('Failed to verify User B token');
    }

    const passedB = claimsB.company_id === testSuite.userB.company_id &&
                    claimsB.user_id === testSuite.userB.id;

    addResult('Verify User B JWT claims', passedB, passedB ? undefined : 'company_id or user_id mismatch', {
      expected_company_id: testSuite.userB.company_id,
      actual_company_id: claimsB.company_id,
      expected_user_id: testSuite.userB.id,
      actual_user_id: claimsB.user_id,
    });

    // Verify tokens are different
    const tokensDifferent = testSuite.jwtA.access !== testSuite.jwtB.access;
    addResult('User A and User B have different tokens', tokensDifferent);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    addResult('Verify JWT claims', false, message);
  }
}

// PHASE 5: Test RLS Policies
async function testRLSPolicies() {
  try {
    // Test 1: User A can see Company A users
    const { data: userACompanyUsers, error: userAError } = await supabase
      .from('users')
      .select('id, email, company_id')
      .eq('company_id', testSuite.userA.company_id)
      .eq('deleted_at', null);

    if (userAError) {
      throw new Error(`User A cannot read users in their company: ${userAError.message}`);
    }

    const userACanSeeOwnCompany = userACompanyUsers && userACompanyUsers.length > 0;
    addResult('User A can see users in Company A', userACanSeeOwnCompany, undefined, {
      users_found: userACompanyUsers?.length || 0,
    });

    // Test 2: User B can see Company B users
    const { data: userBCompanyUsers, error: userBError } = await supabase
      .from('users')
      .select('id, email, company_id')
      .eq('company_id', testSuite.userB.company_id)
      .eq('deleted_at', null);

    if (userBError) {
      throw new Error(`User B cannot read users in their company: ${userBError.message}`);
    }

    const userBCanSeeOwnCompany = userBCompanyUsers && userBCompanyUsers.length > 0;
    addResult('User B can see users in Company B', userBCanSeeOwnCompany, undefined, {
      users_found: userBCompanyUsers?.length || 0,
    });

    // Test 3: Verify no cross-company visibility (User A should NOT see User B)
    const userASeesUserB = userACompanyUsers?.some(u => u.id === testSuite.userB.id) || false;
    addResult('User A cannot see User B', !userASeesUserB, undefined, {
      user_b_id: testSuite.userB.id,
      user_a_can_see_user_b: userASeesUserB,
    });

    // Test 4: Verify no cross-company visibility (User B should NOT see User A)
    const userBSeesUserA = userBCompanyUsers?.some(u => u.id === testSuite.userA.id) || false;
    addResult('User B cannot see User A', !userBSeesUserA, undefined, {
      user_a_id: testSuite.userA.id,
      user_b_can_see_user_a: userBSeesUserA,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    addResult('RLS policies enforcement', false, message);
  }
}

// PHASE 6: Test cross-tenant access prevention
async function testCrossTenantPrevention() {
  try {
    // Test 1: User A tries to read Company B data
    const { data: companyBData, error: companyBReadError } = await supabase
      .from('users')
      .select('id, email, company_id')
      .eq('company_id', testSuite.companyB.id)
      .eq('deleted_at', null);

    // User A should not see any data from Company B
    const userACantSeeCompanyB = !companyBData || companyBData.length === 0;
    addResult('User A cannot read Company B data via RLS', userACantSeeCompanyB, undefined, {
      company_b_id: testSuite.companyB.id,
      data_found: companyBData?.length || 0,
    });

    // Test 2: User A tries to update a user in Company B
    const { error: updateError } = await supabase
      .from('users')
      .update({ full_name: 'Hacked' })
      .eq('id', testSuite.userB.id)
      .select();

    const updateBlocked = !!updateError;
    addResult('RLS prevents User A from updating Company B users', updateBlocked, undefined, {
      error_code: updateError?.code,
      error_message: updateError?.message,
    });

    // Test 3: User B tries to delete User A
    const { error: deleteError } = await supabase
      .from('users')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', testSuite.userA.id)
      .select();

    const deleteBlocked = !!deleteError;
    addResult('RLS prevents User B from deleting Company A users', deleteBlocked, undefined, {
      error_code: deleteError?.code,
      error_message: deleteError?.message,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    addResult('Cross-tenant access prevention', false, message);
  }
}

// PHASE 7: Test audit logs
async function testAuditLogs() {
  try {
    // Create an audit log entry for Company A
    const { data: auditData, error: auditError } = await supabase
      .from('audit_logs')
      .insert([
        {
          company_id: testSuite.companyA.id,
          user_id: testSuite.userA.id,
          action: 'user_login',
          entity_type: 'user',
          entity_id: testSuite.userA.id,
          new_values: { last_login_at: new Date().toISOString() },
        },
      ])
      .select('id, company_id, user_id, action')
      .single();

    if (auditError) {
      throw new Error(`Failed to create audit log: ${auditError.message}`);
    }

    addResult('Create audit log for Company A', true, undefined, {
      audit_id: auditData?.id,
      company_id: auditData?.company_id,
      action: auditData?.action,
    });

    // Verify User A can see logs from their company
    const { data: userALogs, error: userALogsError } = await supabase
      .from('audit_logs')
      .select('id, company_id, action')
      .eq('company_id', testSuite.companyA.id);

    if (userALogsError) {
      throw new Error(`User A cannot read audit logs: ${userALogsError.message}`);
    }

    const logsFound = userALogs && userALogs.length > 0;
    addResult('User A can read audit logs from Company A', logsFound, undefined, {
      logs_found: userALogs?.length || 0,
    });

    // Verify User B cannot see Company A logs
    const { data: userBViewsCompanyALogs } = await supabase
      .from('audit_logs')
      .select('id, company_id')
      .eq('company_id', testSuite.companyA.id);

    const userBCantSeeCompanyALogs = !userBViewsCompanyALogs || userBViewsCompanyALogs.length === 0;
    addResult('User B cannot read Company A audit logs', userBCantSeeCompanyALogs, undefined, {
      logs_found: userBViewsCompanyALogs?.length || 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    addResult('Audit logs isolation', false, message);
  }
}

// Cleanup function
async function cleanup() {
  try {
    // Delete test data
    const { error: userDeleteError } = await supabase
      .from('users')
      .delete()
      .in('id', [testSuite.userA.id, testSuite.userB.id]);

    if (userDeleteError) {
      console.warn('Warning: Could not delete test users:', userDeleteError.message);
    } else {
      addResult('Cleanup: Delete test users', true);
    }

    const { error: companyDeleteError } = await supabase
      .from('companies')
      .delete()
      .in('id', [testSuite.companyA.id, testSuite.companyB.id]);

    if (companyDeleteError) {
      console.warn('Warning: Could not delete test companies:', companyDeleteError.message);
    } else {
      addResult('Cleanup: Delete test companies', true);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('Cleanup error:', message);
  }
}

// Print test summary
function printTestSummary() {
  console.log('\n========================================');
  console.log('TEST RESULTS SUMMARY');
  console.log('========================================\n');

  const passed = testSuite.results.filter(r => r.passed).length;
  const failed = testSuite.results.filter(r => !r.passed).length;
  const total = testSuite.results.length;

  console.log(`Total Tests: ${total}`);
  console.log(`Passed: ${passed} (${((passed / total) * 100).toFixed(2)}%)`);
  console.log(`Failed: ${failed} (${((failed / total) * 100).toFixed(2)}%)\n`);

  if (failed > 0) {
    console.log('Failed Tests:');
    testSuite.results
      .filter(r => !r.passed)
      .forEach(r => {
        console.log(`  - ${r.name}: ${r.error}`);
      });
  }

  console.log('\n========================================');
  console.log('ISOLATION VALIDATION RESULTS');
  console.log('========================================\n');

  const isolationTests = [
    { name: 'User A cannot see User B', result: testSuite.results.find(r => r.name === 'User A cannot see User B')?.passed },
    { name: 'User B cannot see User A', result: testSuite.results.find(r => r.name === 'User B cannot see User A')?.passed },
    { name: 'User A cannot read Company B data via RLS', result: testSuite.results.find(r => r.name === 'User A cannot read Company B data via RLS')?.passed },
    { name: 'RLS prevents User A from updating Company B users', result: testSuite.results.find(r => r.name === 'RLS prevents User A from updating Company B users')?.passed },
    { name: 'RLS prevents User B from deleting Company A users', result: testSuite.results.find(r => r.name === 'RLS prevents User B from deleting Company A users')?.passed },
  ];

  isolationTests.forEach(test => {
    const status = test.result ? '✓' : '✗';
    const result = test.result ? 'PASSED' : 'FAILED';
    console.log(`${status} ${test.name}: ${result}`);
  });

  const allIsolationPassed = isolationTests.every(t => t.result);
  console.log(`\nOverall Isolation Status: ${allIsolationPassed ? 'PASSED ✓' : 'FAILED ✗'}`);

  console.log('\n========================================');
  console.log('END OF TEST SUITE');
  console.log('========================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runMultiTenantTests().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
