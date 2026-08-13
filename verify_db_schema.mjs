#!/usr/bin/env node

/**
 * Comprehensive Database Schema Verification
 * Verifies all required database components
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Load environment
const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  if (line && !line.startsWith('#')) {
    const [key, ...valueParts] = line.split('=');
    if (key) {
      env[key.trim()] = valueParts.join('=').trim().replace(/^"(.*)"$/, '$1');
    }
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const report = {
  timestamp: new Date().toISOString(),
  database_url: supabaseUrl,
  verification_results: {},
  summary: {
    total_checks: 0,
    passed: 0,
    failed: 0,
    partial: 0
  }
};

async function addCheck(name, expectedCount, checkFn) {
  report.summary.total_checks++;
  try {
    const result = await checkFn();
    const passed = result.actual >= expectedCount;
    const status = passed ? 'PASS' : result.actual === null ? 'UNKNOWN' : 'FAIL';

    if (status === 'PASS') report.summary.passed++;
    else if (status === 'FAIL') report.summary.failed++;
    else report.summary.partial++;

    report.verification_results[name] = {
      expected: expectedCount,
      actual: result.actual,
      status,
      details: result.details || null
    };

    return { name, status, ...result };
  } catch (error) {
    report.summary.partial++;
    report.verification_results[name] = {
      expected: expectedCount,
      actual: 0,
      status: 'ERROR',
      error: error.message
    };
    return { name, status: 'ERROR', error: error.message };
  }
}

async function runVerification() {
  console.log('='.repeat(80));
  console.log('DATABASE SCHEMA VERIFICATION REPORT');
  console.log('='.repeat(80));
  console.log(`Timestamp: ${report.timestamp}`);
  console.log(`Database: ${supabaseUrl}\n`);

  // 1. Count tables in public schema with row counts
  console.log('1. TABLES IN PUBLIC SCHEMA WITH ROW COUNTS:');

  const knownTables = [
    'companies', 'users', 'token_rotations', 'password_reset_tokens',
    'webhooks', 'messages', 'contacts', 'teams', 'audit_logs'
  ];

  let tableCount = 0;
  let totalRows = 0;
  const tableDetails = [];

  for (const tableName of knownTables) {
    try {
      const { data, error, count } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (!error && data !== null) {
        tableCount++;
        const rowCount = count || 0;
        totalRows += rowCount;
        tableDetails.push({
          name: tableName,
          rows: rowCount,
          accessible: true
        });
        console.log(`   ✓ ${tableName}: ${rowCount} rows`);
      } else if (error?.code === 'PGRST116') {
        tableDetails.push({
          name: tableName,
          accessible: false,
          error: error.message
        });
        console.log(`   ✗ ${tableName}: NOT FOUND`);
      }
    } catch (e) {
      tableDetails.push({
        name: tableName,
        accessible: false,
        error: e.message
      });
      console.log(`   ✗ ${tableName}: ERROR`);
    }
  }

  report.verification_results['tables_in_public_schema'] = {
    expected: 5,
    actual: tableCount,
    status: tableCount >= 5 ? 'PASS' : 'FAIL',
    details: {
      table_count: tableCount,
      total_rows: totalRows,
      tables: tableDetails
    }
  };

  console.log(`   Result: ${tableCount} tables accessible, ${totalRows} total rows\n`);

  // 2. Check master company exists
  console.log('2. MASTER COMPANY VERIFICATION:');
  const masterCompanyId = '00000000-0000-0000-0000-000000000001';
  let masterCompanyFound = false;
  let masterCompanyData = null;

  try {
    const { data: company, error } = await supabase
      .from('companies')
      .select('id, name, slug, plan, status, owner_id')
      .eq('id', masterCompanyId)
      .single();

    if (error && error.code === 'PGRST116') {
      console.log(`   ✗ Companies table not accessible`);
      report.verification_results['master_company'] = {
        expected: 1,
        actual: 0,
        status: 'ERROR',
        error: 'Companies table not accessible'
      };
    } else if (error) {
      console.log(`   ✗ NOT FOUND`);
      report.verification_results['master_company'] = {
        expected: 1,
        actual: 0,
        status: 'FAIL'
      };
    } else if (company) {
      masterCompanyFound = true;
      masterCompanyData = company;
      console.log(`   ✓ FOUND`);
      console.log(`     - ID: ${company.id}`);
      console.log(`     - Name: ${company.name}`);
      console.log(`     - Slug: ${company.slug}`);
      console.log(`     - Plan: ${company.plan}`);
      console.log(`     - Status: ${company.status}`);
      report.verification_results['master_company'] = {
        expected: 1,
        actual: 1,
        status: 'PASS',
        details: company
      };
    } else {
      console.log(`   ✗ NOT FOUND`);
      report.verification_results['master_company'] = {
        expected: 1,
        actual: 0,
        status: 'FAIL'
      };
    }
  } catch (e) {
    console.log(`   ✗ ERROR: ${e.message}`);
    report.verification_results['master_company'] = {
      expected: 1,
      actual: 0,
      status: 'ERROR',
      error: e.message
    };
  }
  console.log();

  // 3. Check master user exists
  console.log('3. MASTER USER VERIFICATION:');
  const masterEmail = 'kairolopesoficial@gmail.com';
  let masterUserFound = false;
  let masterUserData = null;

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, full_name, company_id, role, status')
      .eq('email', masterEmail)
      .single();

    if (error && error.code === 'PGRST116') {
      console.log(`   ✗ Users table not accessible`);
      report.verification_results['master_user'] = {
        expected: 1,
        actual: 0,
        status: 'ERROR',
        error: 'Users table not accessible'
      };
    } else if (error) {
      console.log(`   ✗ NOT FOUND`);
      report.verification_results['master_user'] = {
        expected: 1,
        actual: 0,
        status: 'FAIL'
      };
    } else if (user) {
      masterUserFound = true;
      masterUserData = user;
      const isAssociatedWithMaster = user.company_id === '00000000-0000-0000-0000-000000000001';
      console.log(`   ✓ FOUND`);
      console.log(`     - ID: ${user.id}`);
      console.log(`     - Email: ${user.email}`);
      console.log(`     - Full Name: ${user.full_name || 'N/A'}`);
      console.log(`     - Company ID: ${user.company_id}`);
      console.log(`     - Associated with Master Company: ${isAssociatedWithMaster ? 'YES' : 'NO'}`);
      console.log(`     - Role: ${user.role}`);
      console.log(`     - Status: ${user.status}`);
      report.verification_results['master_user'] = {
        expected: 1,
        actual: 1,
        status: isAssociatedWithMaster ? 'PASS' : 'PARTIAL',
        details: user
      };
    } else {
      console.log(`   ✗ NOT FOUND`);
      report.verification_results['master_user'] = {
        expected: 1,
        actual: 0,
        status: 'FAIL'
      };
    }
  } catch (e) {
    console.log(`   ✗ ERROR: ${e.message}`);
    report.verification_results['master_user'] = {
      expected: 1,
      actual: 0,
      status: 'ERROR',
      error: e.message
    };
  }
  console.log();

  // 4. Count indexes (requires direct SQL access)
  console.log('4. DATABASE INDEXES (expected 25+):');
  console.log('   Status: Requires direct SQL access via Supabase SQL Editor or psql');
  console.log('   Query: SELECT COUNT(*) FROM pg_indexes WHERE schemaname = \'public\'');
  report.verification_results['database_indexes'] = {
    expected: 25,
    actual: null,
    status: 'REQUIRES_SQL_EDITOR',
    instructions: 'Use Supabase SQL Editor or psql to execute the query'
  };
  console.log();

  // 5. Count RLS policies (requires direct SQL access)
  console.log('5. RLS POLICIES (expected 13+):');
  console.log('   Status: Requires direct SQL access via Supabase SQL Editor or psql');
  console.log('   Query: SELECT COUNT(*) FROM pg_policies');
  report.verification_results['rls_policies'] = {
    expected: 13,
    actual: null,
    status: 'REQUIRES_SQL_EDITOR',
    instructions: 'Use Supabase SQL Editor or psql to execute the query'
  };
  console.log();

  // Summary section
  console.log('='.repeat(80));
  console.log('VERIFICATION SUMMARY');
  console.log('='.repeat(80));

  const passedChecks = Object.values(report.verification_results).filter(r => r.status === 'PASS').length;
  const failedChecks = Object.values(report.verification_results).filter(r => r.status === 'FAIL').length;
  const partialChecks = Object.values(report.verification_results).filter(r => r.status === 'PARTIAL').length;
  const requiresSQL = Object.values(report.verification_results).filter(r => r.status === 'REQUIRES_SQL_EDITOR').length;
  const errorChecks = Object.values(report.verification_results).filter(r => r.status === 'ERROR').length;

  console.log(`\nResults:`);
  console.log(`  Passed: ${passedChecks}`);
  console.log(`  Failed: ${failedChecks}`);
  console.log(`  Partial: ${partialChecks}`);
  console.log(`  Errors: ${errorChecks}`);
  console.log(`  Requires Direct SQL: ${requiresSQL}`);

  console.log(`\nData Summary:`);
  console.log(`  Tables Accessible: ${tableCount}`);
  console.log(`  Total Rows: ${totalRows}`);
  console.log(`  Master Company: ${masterCompanyFound ? 'FOUND' : 'NOT FOUND'}`);
  console.log(`  Master User: ${masterUserFound ? 'FOUND' : 'NOT FOUND'}`);

  console.log('\nDetailed Status:');
  for (const [check, result] of Object.entries(report.verification_results)) {
    const statusIcon = result.status === 'PASS' ? '✓' : result.status === 'FAIL' ? '✗' : '⚠';
    console.log(`  ${statusIcon} ${check}: ${result.status}`);
    if (result.actual !== null) {
      console.log(`     Expected: ${result.expected}, Actual: ${result.actual}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('RECOMMENDATIONS');
  console.log('='.repeat(80));

  if (!masterCompanyFound) {
    console.log('\n1. CREATE MASTER COMPANY');
    console.log('   Execute in Supabase SQL Editor:');
    console.log(`   INSERT INTO companies (id, name, slug, plan, status, owner_id)`);
    console.log(`   VALUES ('00000000-0000-0000-0000-000000000001', 'Master Company', 'master', 'enterprise', 'active', '00000000-0000-0000-0000-000000000002');`);
  }

  if (!masterUserFound) {
    console.log(`\n${!masterCompanyFound ? '2' : '1'}. CREATE MASTER USER`);
    console.log('   Execute in Supabase SQL Editor:');
    console.log(`   INSERT INTO users (id, company_id, email, password_hash, full_name, role, status)`);
    console.log(`   VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'kairolopesoficial@gmail.com', '[password_hash]', 'Master Admin', 'owner', 'active');`);
    console.log('   Note: Replace [password_hash] with a proper bcrypt hash');
  }

  console.log('\n3. VERIFY INDEXES AND RLS POLICIES');
  console.log('   Open Supabase SQL Editor and execute:');
  console.log('   - SELECT COUNT(*) FROM pg_indexes WHERE schemaname = \'public\';');
  console.log('   - SELECT COUNT(*) FROM pg_policies;');

  console.log('\n' + '='.repeat(80));
  console.log('END OF REPORT');
  console.log('='.repeat(80));
}

runVerification().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
