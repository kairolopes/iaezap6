#!/usr/bin/env node

/**
 * Complete Database Verification Script
 * Performs all required verification steps
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gqromcfhiosfppqlottz.supabase.co';
const serviceRoleKey = 'sb_secret_uh1cDxnWtzRT4fhYbiEWBg_fbnZkKwQ';

// Initialize admin client with service role
const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  db: { schema: 'public' }
});

const results = {
  timestamp: new Date().toISOString(),
  database: supabaseUrl,
  checks: []
};

async function runAllVerifications() {
  try {
    console.log('Starting Database Setup Verification...\n');
    console.log(`Database: ${supabaseUrl}`);
    console.log(`Time: ${results.timestamp}\n`);
    console.log('='.repeat(70));

    // Step 1: Query companies count
    console.log('\n1. Querying companies table...');
    const { data: companiesData, error: companiesError } = await adminClient
      .from('companies')
      .select('*', { count: 'exact', head: true });

    let companiesCount = 0;
    if (companiesError) {
      console.log(`   ⚠ Error: ${companiesError.message}`);
      results.checks.push({
        name: 'Companies table',
        status: 'ERROR',
        message: companiesError.message
      });
    } else {
      companiesCount = companiesData?.length || 0;
      console.log(`   ✓ Companies count: ${companiesCount}`);
      results.checks.push({
        name: 'Companies table count',
        expected: '1+',
        actual: companiesCount,
        passed: companiesCount >= 1
      });
    }

    // Step 2: Query users count
    console.log('\n2. Querying users table...');
    const { data: usersData, error: usersError } = await adminClient
      .from('users')
      .select('*', { count: 'exact', head: true });

    let usersCount = 0;
    if (usersError) {
      console.log(`   ⚠ Error: ${usersError.message}`);
      results.checks.push({
        name: 'Users table',
        status: 'ERROR',
        message: usersError.message
      });
    } else {
      usersCount = usersData?.length || 0;
      console.log(`   ✓ Users count: ${usersCount}`);
      results.checks.push({
        name: 'Users table count',
        expected: '1+',
        actual: usersCount,
        passed: usersCount >= 1
      });
    }

    // Step 3: Identify all available tables
    console.log('\n3. Identifying tables in public schema...');
    const tableNames = [
      'companies',
      'users',
      'company_members',
      'audit_logs',
      'z_api_instances'
    ];

    const availableTables = [];
    for (const tableName of tableNames) {
      try {
        const { data, error } = await adminClient
          .from(tableName)
          .select('*', { count: 'exact', head: true });

        if (!error) {
          availableTables.push(tableName);
          console.log(`   ✓ ${tableName}`);
        }
      } catch (e) {
        console.log(`   ✗ ${tableName} (not found)`);
      }
    }

    console.log(`\n   Total: ${availableTables.length} tables found`);
    results.checks.push({
      name: 'Public tables count',
      expected: '5+',
      actual: availableTables.length,
      passed: availableTables.length >= 5,
      tables: availableTables
    });

    // Step 4: Get table structure details
    console.log('\n4. Verifying table structures...');

    for (const tableName of availableTables) {
      try {
        const { data: sample, error } = await adminClient
          .from(tableName)
          .select('*')
          .limit(1);

        if (!error && sample && sample.length > 0) {
          const columns = Object.keys(sample[0]);
          console.log(`   ✓ ${tableName}: ${columns.length} columns`);
        } else {
          console.log(`   ✓ ${tableName}: (empty or unable to retrieve sample)`);
        }
      } catch (e) {
        console.log(`   ⚠ ${tableName}: ${e.message}`);
      }
    }

    // Step 5: Check data presence
    console.log('\n5. Checking data presence...');

    if (companiesCount > 0) {
      const { data: companySample } = await adminClient
        .from('companies')
        .select('*')
        .limit(1)
        .single();

      if (companySample) {
        console.log(`   ✓ Sample company found:`);
        console.log(`     - ID: ${companySample.id}`);
        console.log(`     - Name: ${companySample.name || 'N/A'}`);
        console.log(`     - Status: ${companySample.status || 'N/A'}`);
      }
    } else {
      console.log(`   ⚠ No companies in database`);
    }

    if (usersCount > 0) {
      const { data: userSample } = await adminClient
        .from('users')
        .select('*')
        .limit(1)
        .single();

      if (userSample) {
        console.log(`   ✓ Sample user found:`);
        console.log(`     - ID: ${userSample.id}`);
        console.log(`     - Email: ${userSample.email || 'N/A'}`);
        console.log(`     - Status: ${userSample.status || 'N/A'}`);
      }
    } else {
      console.log(`   ⚠ No users in database`);
    }

    // Step 6: RLS and Indexes note
    console.log('\n6. Row Level Security (RLS) & Indexes...');
    console.log('   Note: Requires direct PostgreSQL access to verify');
    console.log('   - Query: SELECT COUNT(*) FROM pg_policies');
    console.log('   - Expected RLS policies: 13+');
    console.log('   - Query: SELECT * FROM pg_indexes WHERE indexname LIKE \'idx_%\'');
    console.log('   - Expected custom indexes: 25+');

    results.checks.push({
      name: 'RLS Policies count',
      status: 'REQUIRES_DIRECT_SQL',
      expected: '13+',
      message: 'Query pg_policies table via direct PostgreSQL connection'
    });

    results.checks.push({
      name: 'Custom indexes count',
      status: 'REQUIRES_DIRECT_SQL',
      expected: '25+',
      message: 'Query pg_indexes table via direct PostgreSQL connection'
    });

    // Generate comprehensive report
    console.log('\n' + '='.repeat(70));
    console.log('FINAL DATABASE STATE REPORT');
    console.log('='.repeat(70));
    console.log(`\nTimestamp: ${results.timestamp}`);
    console.log(`Database URL: ${supabaseUrl}\n`);

    console.log('VERIFICATION SUMMARY:\n');

    // Count passes and failures
    const passedChecks = results.checks.filter(c => c.passed === true).length;
    const failedChecks = results.checks.filter(c => c.passed === false).length;
    const requiresDirectSQL = results.checks.filter(c => c.status === 'REQUIRES_DIRECT_SQL').length;
    const errors = results.checks.filter(c => c.status === 'ERROR').length;

    results.checks.forEach(check => {
      if (check.passed === true) {
        console.log(`  ✓ ${check.name}: ${check.actual} (expected: ${check.expected})`);
      } else if (check.passed === false) {
        console.log(`  ✗ ${check.name}: ${check.actual} (expected: ${check.expected})`);
      } else if (check.status === 'REQUIRES_DIRECT_SQL') {
        console.log(`  ⚠ ${check.name}: ${check.message}`);
      } else if (check.status === 'ERROR') {
        console.log(`  ✗ ${check.name}: ${check.message}`);
      }
    });

    console.log(`\nCOUNTS:`);
    console.log(`  - Companies: ${companiesCount}`);
    console.log(`  - Users: ${usersCount}`);
    console.log(`  - Available tables: ${availableTables.length}`);
    console.log(`  - Tables: ${availableTables.join(', ')}`);

    console.log(`\nCHECK RESULTS:`);
    console.log(`  - Passed: ${passedChecks}`);
    console.log(`  - Failed: ${failedChecks}`);
    console.log(`  - Requires direct SQL: ${requiresDirectSQL}`);
    console.log(`  - Errors: ${errors}`);

    // Overall status
    const overallPassed = failedChecks === 0 && errors === 0 && companiesCount > 0 && usersCount > 0;
    console.log(`\nOVERALL STATUS:`);

    if (overallPassed) {
      console.log('  ✓ DATABASE SETUP APPEARS COMPLETE');
      console.log('  - Core tables present and accessible');
      console.log('  - Sample data exists in database');
      console.log('  - Note: RLS policies and indexes require direct PostgreSQL verification');
    } else if (failedChecks > 0 || errors > 0) {
      console.log('  ✗ DATABASE SETUP INCOMPLETE OR ERRORS FOUND');
      if (companiesCount === 0) console.log('    - No companies in database');
      if (usersCount === 0) console.log('    - No users in database');
      if (availableTables.length < 5) {
        const missing = tableNames.filter(t => !availableTables.includes(t));
        console.log(`    - Missing tables: ${missing.join(', ')}`);
      }
    } else {
      console.log('  ⚠ PARTIAL SETUP - DATA NEEDED');
      console.log('  - Tables exist but need data seeding');
    }

    console.log('\n' + '='.repeat(70));
    console.log('NEXT STEPS:');
    console.log('  1. For complete verification, connect to PostgreSQL directly');
    console.log('  2. Run: SELECT COUNT(*) FROM pg_policies');
    console.log('  3. Run: SELECT indexname FROM pg_indexes WHERE indexname LIKE \'idx_%\'');
    console.log('  4. Verify RLS policies >= 13 and custom indexes >= 25');
    console.log('='.repeat(70));

    return results;

  } catch (error) {
    console.error('\n✗ Verification failed:', error.message);
    process.exit(1);
  }
}

// Execute verification
runAllVerifications()
  .then(async results => {
    // Save results to file
    const fs = await import('fs');
    fs.writeFileSync('database-verification-results.json', JSON.stringify(results, null, 2));
    console.log('\nResults saved to: database-verification-results.json');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
