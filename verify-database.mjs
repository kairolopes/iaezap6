#!/usr/bin/env node

/**
 * Database Setup Verification Script
 * Checks Supabase database completeness using Supabase Admin Client
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('ERROR: Missing Supabase credentials');
  console.error('Required env variables: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

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
      .select('*', { count: 'exact', head: true });

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
      .select('*', { count: 'exact', head: true });

    if (usersError) {
      console.error('   ERROR:', usersError.message);
      results.usersCount = 0;
      results.usersError = usersError.message;
    } else {
      results.usersCount = usersData?.length || 0;
      console.log(`   Total users: ${results.usersCount} (expected: 1+)\n`);
    }

    // Query 3: Count public tables using raw SQL
    console.log('3. Checking public tables...');
    const { data: tablesResult, error: tablesError } = await supabase.rpc('verify_database', {
      query_type: 'table_count'
    }).catch(() => ({ data: null, error: { message: 'RPC not available' } }));

    if (tablesError || !tablesResult) {
      // Fallback: try to use SELECT * from information_schema
      const { data: tableList, error: listError } = await supabase
        .from('companies')
        .select('id', { count: 'exact', head: true });

      console.log('   Using fallback method to check tables...\n');
      results.tablesCount = 'Unknown (see table details below)';
    } else {
      results.tablesCount = tablesResult;
      console.log(`   Total public tables: ${results.tablesCount} (expected: 5+)\n`);
    }

    // Query by checking schema tables via multiple table queries
    console.log('4. Listing all available tables...');
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
    console.log(`   Total: ${tables.length} known tables\n`);
    results.tables = tables;

    // Query 5: Check RLS policies via system query
    console.log('5. Checking Row Level Security (RLS) policies...');
    console.log('   (Note: RLS policy count requires direct SQL access)\n');
    results.policiesNote = 'Use Supabase dashboard to verify RLS policies are enabled';

    // Query 6: Check indexes
    console.log('6. Checking database indexes...');
    console.log('   (Note: Index count requires direct SQL access)\n');
    results.indexesNote = 'Use Supabase dashboard or direct database connection to verify indexes';

    // Get sample data to verify structure
    console.log('7. Verifying data structure...');

    if (results.companiesCount > 0) {
      const { data: companySample } = await supabase
        .from('companies')
        .select('*')
        .limit(1)
        .single();

      if (companySample) {
        console.log('   Companies table columns:');
        Object.keys(companySample).forEach(key => {
          console.log(`     - ${key}`);
        });
      }
    }

    if (results.usersCount > 0) {
      const { data: userSample } = await supabase
        .from('users')
        .select('*')
        .limit(1)
        .single();

      if (userSample) {
        console.log('\n   Users table columns:');
        Object.keys(userSample).forEach(key => {
          console.log(`     - ${key}`);
        });
      }
    }

    console.log('\n');

    // Generate final report
    console.log('='.repeat(60));
    console.log('FINAL DATABASE STATE REPORT');
    console.log('='.repeat(60));
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log(`Database: ${supabaseUrl}`);
    console.log('');
    console.log('VERIFICATION RESULTS:');
    console.log(`✓ Companies table: ${results.companiesCount} row(s) - ${results.companiesCount >= 1 ? 'PASS' : 'CHECK'}`);
    console.log(`✓ Users table: ${results.usersCount} row(s) - ${results.usersCount >= 1 ? 'PASS' : 'CHECK'}`);
    console.log(`✓ Tables: ${results.tables.length} identified - ${results.tables.length >= 5 ? 'PASS' : 'CHECK'}`);
    console.log(`⚠ RLS Policies: ${results.policiesNote}`);
    console.log(`⚠ Custom Indexes: ${results.indexesNote}`);
    console.log('');
    console.log('IDENTIFIED TABLES:');
    results.tables.forEach(table => {
      console.log(`  - ${table}`);
    });
    console.log('');

    // Overall status
    const allPassed =
      results.companiesCount >= 1 &&
      results.usersCount >= 1 &&
      results.tables.length >= 5;

    console.log('OVERALL STATUS: ' + (allPassed ? '✓ CORE CHECKS PASSED' : '⚠ REVIEW NEEDED'));
    console.log('');
    console.log('NOTE: For complete verification of RLS policies and indexes,');
    console.log('please use direct PostgreSQL access or Supabase SQL Editor.');
    console.log('='.repeat(60));

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
