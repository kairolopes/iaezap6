#!/usr/bin/env node

/**
 * Final Database Verification Report
 * Generates comprehensive database setup verification report
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gqromcfhiosfppqlottz.supabase.co';
const serviceRoleKey = 'sb_secret_uh1cDxnWtzRT4fhYbiEWBg_fbnZkKwQ';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  db: { schema: 'public' }
});

async function generateReport() {
  const report = {
    timestamp: new Date().toISOString(),
    database_url: supabaseUrl,
    verification_steps: [],
    summary: {},
    recommendations: []
  };

  console.log('='.repeat(80));
  console.log('IAEZAP6 DATABASE SETUP COMPLETENESS VERIFICATION');
  console.log('='.repeat(80));
  console.log(`Date: ${report.timestamp}`);
  console.log(`Database: ${supabaseUrl}\n`);

  try {
    // STEP 1: Companies table verification
    console.log('STEP 1: Querying companies table...');
    const { data: companiesData, error: companiesError } = await supabase
      .from('companies')
      .select('*', { count: 'exact' });

    const companiesCount = companiesData?.length || 0;
    report.verification_steps.push({
      step: 1,
      name: 'SELECT COUNT(*) as total FROM companies',
      expected: '1+',
      actual: companiesCount,
      passed: companiesCount >= 1,
      error: companiesError?.message || null
    });
    console.log(`   Result: ${companiesCount} row(s) - ${companiesCount >= 1 ? 'PASS' : 'FAIL'}`);

    // STEP 2: Users table verification
    console.log('\nSTEP 2: Querying users table...');
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('*', { count: 'exact' });

    const usersCount = usersData?.length || 0;
    report.verification_steps.push({
      step: 2,
      name: 'SELECT COUNT(*) as total FROM users',
      expected: '1+',
      actual: usersCount,
      passed: usersCount >= 1,
      error: usersError?.message || null
    });
    console.log(`   Result: ${usersCount} row(s) - ${usersCount >= 1 ? 'PASS' : 'FAIL'}`);

    // STEP 3: Public tables verification
    console.log('\nSTEP 3: Checking public schema tables...');
    const expectedTables = ['companies', 'users', 'company_members', 'audit_logs', 'z_api_instances'];
    const foundTables = [];

    for (const tableName of expectedTables) {
      try {
        const { error } = await supabase
          .from(tableName)
          .select('id', { count: 'exact', head: true });

        if (!error) {
          foundTables.push(tableName);
          console.log(`   ✓ ${tableName}`);
        } else {
          console.log(`   ✗ ${tableName} - NOT FOUND`);
        }
      } catch (e) {
        console.log(`   ✗ ${tableName} - NOT FOUND`);
      }
    }

    report.verification_steps.push({
      step: 3,
      name: 'SELECT COUNT(*) as total FROM pg_tables WHERE schema_name=\'public\'',
      expected: '5+',
      actual: foundTables.length,
      passed: foundTables.length >= 5,
      tables_found: foundTables,
      tables_missing: expectedTables.filter(t => !foundTables.includes(t))
    });
    console.log(`   Result: ${foundTables.length} tables found - ${foundTables.length >= 5 ? 'PASS' : 'FAIL'}`);

    // STEP 4: RLS Policies verification (via note)
    console.log('\nSTEP 4: Row Level Security (RLS) Policies...');
    console.log('   Status: REQUIRES DIRECT SQL ACCESS');
    console.log('   Required query: SELECT COUNT(*) FROM pg_policies');
    console.log('   Expected: 13+ policies');
    console.log('   To verify, use Supabase SQL Editor or direct psql connection');

    report.verification_steps.push({
      step: 4,
      name: 'SELECT COUNT(*) FROM pg_policies',
      expected: '13+',
      status: 'REQUIRES_DIRECT_SQL_ACCESS',
      instructions: 'Connect to PostgreSQL database and run query, or use Supabase SQL Editor'
    });

    // STEP 5: Indexes verification (via note)
    console.log('\nSTEP 5: Database Indexes...');
    console.log('   Status: REQUIRES DIRECT SQL ACCESS');
    console.log('   Required query: SELECT indexname FROM pg_indexes WHERE schema_name=\'public\' AND indexname LIKE \'idx_%\'');
    console.log('   Expected: 25+ custom indexes');
    console.log('   To verify, use Supabase SQL Editor or direct psql connection');

    report.verification_steps.push({
      step: 5,
      name: 'SELECT COUNT(*) FROM pg_indexes WHERE indexname LIKE \'idx_%\'',
      expected: '25+',
      status: 'REQUIRES_DIRECT_SQL_ACCESS',
      instructions: 'Connect to PostgreSQL database and run query, or use Supabase SQL Editor'
    });

    // SUMMARY
    console.log('\n' + '='.repeat(80));
    console.log('VERIFICATION SUMMARY');
    console.log('='.repeat(80));

    const passed = report.verification_steps.filter(s => s.passed === true).length;
    const failed = report.verification_steps.filter(s => s.passed === false).length;
    const requiresDirectSQL = report.verification_steps.filter(s => s.status === 'REQUIRES_DIRECT_SQL_ACCESS').length;

    console.log(`\nResults:`);
    console.log(`  ✓ Passed checks: ${passed}`);
    console.log(`  ✗ Failed checks: ${failed}`);
    console.log(`  ⚠ Requires direct SQL: ${requiresDirectSQL}`);

    report.summary = {
      companies_count: companiesCount,
      users_count: usersCount,
      tables_found: foundTables.length,
      tables_list: foundTables,
      passed_checks: passed,
      failed_checks: failed,
      requires_direct_sql: requiresDirectSQL
    };

    console.log(`\nTable Status:`);
    console.log(`  - Companies: ${companiesCount} row(s)`);
    console.log(`  - Users: ${usersCount} row(s)`);
    console.log(`  - Public tables: ${foundTables.length} found`);
    console.log(`  - Tables: ${foundTables.join(', ')}`);

    const missingTables = expectedTables.filter(t => !foundTables.includes(t));
    if (missingTables.length > 0) {
      console.log(`  - MISSING: ${missingTables.join(', ')}`);
    }

    // DETAILED STATUS
    console.log(`\nDetailed Verification Status:`);
    report.verification_steps.forEach(step => {
      if (step.passed === true) {
        console.log(`  ✓ Step ${step.step}: ${step.name.split('FROM')[1]?.trim() || 'Unknown'}`);
        console.log(`    Actual: ${step.actual}, Expected: ${step.expected}`);
      } else if (step.passed === false) {
        console.log(`  ✗ Step ${step.step}: ${step.name.split('FROM')[1]?.trim() || 'Unknown'}`);
        console.log(`    Actual: ${step.actual}, Expected: ${step.expected}`);
      } else if (step.status === 'REQUIRES_DIRECT_SQL_ACCESS') {
        console.log(`  ⚠ Step ${step.step}: Requires direct SQL access`);
      }
    });

    // RECOMMENDATIONS
    console.log(`\n` + '='.repeat(80));
    console.log('RECOMMENDATIONS & NEXT STEPS');
    console.log('='.repeat(80));

    if (companiesCount === 0) {
      console.log(`\n1. SEED COMPANIES DATA`);
      console.log(`   - No companies found in database`);
      console.log(`   - Run: INSERT INTO companies (...) VALUES (...);`);
      report.recommendations.push('Seed test company data');
    }

    if (usersCount === 0) {
      console.log(`\n${companiesCount === 0 ? '2' : '1'}. SEED USERS DATA`);
      console.log(`   - No users found in database`);
      console.log(`   - First, ensure at least one company exists`);
      console.log(`   - Run: INSERT INTO users (...) VALUES (...);`);
      report.recommendations.push('Seed test user data');
    }

    if (missingTables.length > 0) {
      const step = (companiesCount === 0 ? 2 : 1) + (usersCount === 0 ? 1 : 0);
      console.log(`\n${step}. CREATE MISSING TABLES`);
      console.log(`   - Missing tables: ${missingTables.join(', ')}`);
      console.log(`   - Run migrations if not already executed`);
      console.log(`   - Check: migrations/001_complete_migration_bundle.sql`);
      report.recommendations.push(`Create missing tables: ${missingTables.join(', ')}`);
    }

    console.log(`\n${(companiesCount === 0 ? 2 : 1) + (usersCount === 0 ? 1 : 0) + (missingTables.length > 0 ? 1 : 0)}. VERIFY RLS POLICIES`);
    console.log(`   - Connect to Supabase SQL Editor or use direct psql`);
    console.log(`   - Query: SELECT COUNT(*) FROM pg_policies`);
    console.log(`   - Expected: 13 or more RLS policies`);
    console.log(`   - See: src/lib/auth/migrations.sql for RLS policy definitions`);
    report.recommendations.push('Verify RLS policies via direct SQL access');

    console.log(`\n${(companiesCount === 0 ? 2 : 1) + (usersCount === 0 ? 1 : 0) + (missingTables.length > 0 ? 1 : 0) + 1}. VERIFY INDEXES`);
    console.log(`   - Connect to Supabase SQL Editor or use direct psql`);
    console.log(`   - Query: SELECT indexname FROM pg_indexes WHERE indexname LIKE 'idx_%'`);
    console.log(`   - Expected: 25 or more custom indexes (idx_*)`);
    console.log(`   - See: migrations/001_complete_migration_bundle.sql for index definitions`);
    report.recommendations.push('Verify custom indexes via direct SQL access');

    // CONNECTION INSTRUCTIONS
    console.log(`\n` + '='.repeat(80));
    console.log('HOW TO CONNECT FOR DIRECT SQL VERIFICATION');
    console.log('='.repeat(80));
    console.log(`\nMethod 1: Supabase SQL Editor (Easiest)`);
    console.log(`  1. Go to: https://app.supabase.com/project/gqromcfhiosfppqlottz`);
    console.log(`  2. Click: SQL Editor (left sidebar)`);
    console.log(`  3. Run: SELECT COUNT(*) FROM pg_policies;`);
    console.log(`  4. Run: SELECT indexname FROM pg_indexes WHERE indexname LIKE 'idx_%';`);

    console.log(`\nMethod 2: Direct PostgreSQL Connection`);
    console.log(`  Host: db.gqromcfhiosfppqlottz.supabase.co`);
    console.log(`  Port: 5432`);
    console.log(`  Database: postgres`);
    console.log(`  User: postgres`);
    console.log(`  Password: [Your Supabase database password]`);
    console.log(`  Command: psql postgresql://postgres:PASSWORD@db.gqromcfhiosfppqlottz.supabase.co:5432/postgres`);

    console.log(`\n` + '='.repeat(80));
    console.log('FINAL STATUS');
    console.log('='.repeat(80));

    const allRequired = passed >= 3; // At least the first 3 steps should pass
    const majorIssues = failed > 0;

    if (allRequired && !majorIssues) {
      console.log('\n✓ CORE DATABASE SETUP IS COMPLETE');
      console.log('  - Tables exist and are accessible');
      if (companiesCount > 0 && usersCount > 0) {
        console.log('  - Sample data is present');
      } else {
        console.log('  - Waiting for data to be seeded');
      }
      console.log('  - Awaiting verification of RLS policies and indexes');
    } else if (missingTables.length > 0) {
      console.log('\n✗ DATABASE SETUP INCOMPLETE');
      console.log(`  - Missing table(s): ${missingTables.join(', ')}`);
      console.log('  - Run migrations to create missing tables');
    } else if (companiesCount === 0 || usersCount === 0) {
      console.log('\n⚠ DATABASE TABLES READY, NEEDS DATA');
      console.log('  - All required tables exist');
      console.log('  - Seed test data into companies and users tables');
    } else {
      console.log('\n✓ DATABASE SETUP APPEARS COMPLETE');
    }

    console.log('\n' + '='.repeat(80));

    // Save report to JSON file
    const fs = await import('fs');
    fs.writeFileSync('final-database-verification-report.json', JSON.stringify(report, null, 2));
    console.log('\nDetailed report saved to: final-database-verification-report.json');

    return report;

  } catch (error) {
    console.error('ERROR:', error.message);
    process.exit(1);
  }
}

// Execute
generateReport().then(() => process.exit(0));
