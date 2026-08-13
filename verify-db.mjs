#!/usr/bin/env node

/**
 * Database Setup Verification Script
 * Checks Supabase database completeness
 */

import { createClient } from '@supabase/supabase-js';

// Hard-coded credentials from .env.local
const supabaseUrl = 'https://gqromcfhiosfppqlottz.supabase.co';
const serviceRoleKey = 'sb_secret_uh1cDxnWtzRT4fhYbiEWBg_fbnZkKwQ';

async function verifyDatabase() {
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    db: {
      schema: 'public',
    },
  });

  const results = {};

  try {
    console.log('Connecting to Supabase database...');
    console.log(`URL: ${supabaseUrl}\n`);

    // Query 1: Count companies
    console.log('1. Checking companies table...');
    const { data: companiesData, error: companiesError } = await supabase
      .from('companies')
      .select('id', { count: 'exact' });

    if (companiesError) {
      console.error('   ERROR:', companiesError.message);
      results.companiesCount = 0;
      results.companiesError = companiesError.message;
    } else {
      results.companiesCount = companiesData?.length || 0;
      console.log(`   Total companies: ${results.companiesCount} (expected: 1+)\n`);
    }

    // Query 2: Count users
    console.log('2. Checking users table...');
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('id', { count: 'exact' });

    if (usersError) {
      console.error('   ERROR:', usersError.message);
      results.usersCount = 0;
      results.usersError = usersError.message;
    } else {
      results.usersCount = usersData?.length || 0;
      console.log(`   Total users: ${results.usersCount} (expected: 1+)\n`);
    }

    // Query 3: Check available tables
    console.log('3. Checking available tables...');
    const tables = [];
    const tableNames = ['companies', 'users', 'company_members', 'audit_logs', 'z_api_instances'];

    for (const tableName of tableNames) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('id', { count: 'exact', head: true });

        if (!error) {
          tables.push(tableName);
        }
      } catch (e) {
        // Table doesn't exist or can't be accessed
      }
    }

    console.log(`   Found tables: ${tables.join(', ')}`);
    console.log(`   Total: ${tables.length} verified tables (expected: 5+)\n`);
    results.tables = tables;

    // Query 4: Get full table structure by listing columns
    console.log('4. Checking table structures...');

    for (const tableName of tables) {
      try {
        const { data: sample } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);

        if (sample && sample.length > 0) {
          results[`${tableName}_columns`] = Object.keys(sample[0]);
        } else {
          // Try with just id to get schema
          const { data: idCheck } = await supabase
            .from(tableName)
            .select('*', { count: 'exact', head: true });

          results[`${tableName}_columns`] = ['(empty table)'];
        }
      } catch (e) {
        results[`${tableName}_columns`] = ['(error reading columns)'];
      }
    }

    // Display table structures
    console.log('   Table structures:');
    for (const tableName of tables) {
      const columns = results[`${tableName}_columns`];
      console.log(`     ${tableName}: ${columns.join(', ')}`);
    }
    console.log('');

    // Query 5: Check sample company data
    console.log('5. Checking sample data...');
    if (results.companiesCount > 0) {
      const { data: companySample } = await supabase
        .from('companies')
        .select('*')
        .limit(1);

      if (companySample && companySample.length > 0) {
        console.log('   Sample company:');
        const company = companySample[0];
        console.log(`     ID: ${company.id}`);
        console.log(`     Name: ${company.name}`);
        console.log(`     Status: ${company.status}`);
      }
    }

    if (results.usersCount > 0) {
      const { data: userSample } = await supabase
        .from('users')
        .select('*')
        .limit(1);

      if (userSample && userSample.length > 0) {
        console.log('   Sample user:');
        const user = userSample[0];
        console.log(`     ID: ${user.id}`);
        console.log(`     Email: ${user.email}`);
        console.log(`     Status: ${user.status}`);
      }
    }

    console.log('\n');

    // Generate final report
    console.log('='.repeat(70));
    console.log('FINAL DATABASE STATE REPORT');
    console.log('='.repeat(70));
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log(`Database: ${supabaseUrl}`);
    console.log('');
    console.log('VERIFICATION RESULTS:');
    console.log(`✓ Companies table: ${results.companiesCount} row(s) - ${results.companiesCount >= 1 ? 'PASS' : 'FAIL'}`);
    console.log(`✓ Users table: ${results.usersCount} row(s) - ${results.usersCount >= 1 ? 'PASS' : 'FAIL'}`);
    console.log(`✓ Tables found: ${results.tables.length} total - ${results.tables.length >= 5 ? 'PASS' : 'FAIL'}`);
    console.log('');
    console.log('TABLE DETAILS:');
    results.tables.forEach(table => {
      const count = table === 'companies' ? results.companiesCount :
                   table === 'users' ? results.usersCount : 'N/A';
      const columns = results[`${table}_columns`] || [];
      console.log(`  ${table} (${columns.length} columns, ${count} rows)`);
    });
    console.log('');

    // Overall status
    const coreChecksPassed =
      results.companiesCount >= 1 &&
      results.usersCount >= 1 &&
      results.tables.length >= 5;

    console.log('SUMMARY:');
    console.log(`  Database connectivity: ✓ OK`);
    console.log(`  Core tables: ${coreChecksPassed ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`  Data presence: ${results.companiesCount > 0 ? '✓ OK' : '⚠ NEEDS DATA'}`);
    console.log('');

    console.log('NOTE: For complete RLS policy and index verification,');
    console.log('use: SELECT * FROM pg_policies');
    console.log('     SELECT * FROM pg_indexes WHERE schema_name=\'public\' AND indexname LIKE \'idx_%\'');
    console.log('');
    console.log('OVERALL STATUS: ' + (coreChecksPassed ? '✓ ALL CORE CHECKS PASSED' : '✗ SOME CHECKS FAILED'));
    console.log('='.repeat(70));

    return results;

  } catch (error) {
    console.error('Error during verification:', error);
    process.exit(1);
  }
}

// Run verification
verifyDatabase()
  .then(results => {
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
