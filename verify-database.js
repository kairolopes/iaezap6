#!/usr/bin/env node

/**
 * Database Setup Verification Script
 * Checks Supabase database completeness
 */

require('dotenv').config();
const { Client } = require('pg');

// Supabase PostgreSQL connection details
const connectionConfig = {
  host: 'db.gqromcfhiosfppqlottz.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'iaezap@2024Secure!Password123', // Default Supabase password (may vary)
};

async function verifyDatabase() {
  const client = new Client(connectionConfig);
  const results = {};

  try {
    console.log('Connecting to Supabase database...');
    await client.connect();
    console.log('Connected successfully!\n');

    // Query 1: Count companies
    console.log('1. Checking companies table...');
    const companiesResult = await client.query('SELECT COUNT(*) as total FROM companies');
    results.companiesCount = companiesResult.rows[0].total;
    console.log(`   Total companies: ${results.companiesCount} (expected: 1+)\n`);

    // Query 2: Count users
    console.log('2. Checking users table...');
    const usersResult = await client.query('SELECT COUNT(*) as total FROM users');
    results.usersCount = usersResult.rows[0].total;
    console.log(`   Total users: ${results.usersCount} (expected: 1+)\n`);

    // Query 3: Count public tables
    console.log('3. Checking public tables...');
    const tablesResult = await client.query(
      "SELECT COUNT(*) as total FROM pg_tables WHERE schema_name='public'"
    );
    results.tablesCount = tablesResult.rows[0].total;
    console.log(`   Total public tables: ${results.tablesCount} (expected: 5+)`);

    // List all tables
    const tableListResult = await client.query(
      "SELECT tablename FROM pg_tables WHERE schema_name='public' ORDER BY tablename"
    );
    const tableNames = tableListResult.rows.map(r => r.tablename);
    console.log(`   Tables: ${tableNames.join(', ')}\n`);
    results.tables = tableNames;

    // Query 4: Check RLS policies
    console.log('4. Checking Row Level Security (RLS) policies...');
    const policiesResult = await client.query('SELECT COUNT(*) as total FROM pg_policies');
    results.policiesCount = policiesResult.rows[0].total;
    console.log(`   Total RLS policies: ${results.policiesCount} (expected: 13+)\n`);

    // Query 5: List indexes
    console.log('5. Checking indexes...');
    const indexesResult = await client.query(
      "SELECT indexname FROM pg_indexes WHERE schema_name='public' AND indexname LIKE 'idx_%' ORDER BY indexname"
    );
    results.indexesCount = indexesResult.rows.length;
    const indexNames = indexesResult.rows.map(r => r.indexname);
    console.log(`   Total custom indexes: ${results.indexesCount} (expected: 25+)`);
    console.log(`   Indexes: ${indexNames.join(', ')}\n`);
    results.indexes = indexNames;

    // Query 6: Additional verification
    console.log('6. Additional database verification...');

    // Check for required columns in companies
    const companiesColumnsResult = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name='companies'
      ORDER BY ordinal_position
    `);
    results.companiesColumns = companiesColumnsResult.rows.map(r => r.column_name);
    console.log(`   Companies columns: ${results.companiesColumns.join(', ')}`);

    // Check for required columns in users
    const usersColumnsResult = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name='users'
      ORDER BY ordinal_position
    `);
    results.usersColumns = usersColumnsResult.rows.map(r => r.column_name);
    console.log(`   Users columns: ${results.usersColumns.join(', ')}\n`);

    // Generate final report
    console.log('='.repeat(60));
    console.log('FINAL DATABASE STATE REPORT');
    console.log('='.repeat(60));
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log(`Database: postgres@db.gqromcfhiosfppqlottz.supabase.co`);
    console.log('');
    console.log('VERIFICATION RESULTS:');
    console.log(`✓ Companies table: ${results.companiesCount} row(s) - ${results.companiesCount >= 1 ? 'PASS' : 'FAIL'}`);
    console.log(`✓ Users table: ${results.usersCount} row(s) - ${results.usersCount >= 1 ? 'PASS' : 'FAIL'}`);
    console.log(`✓ Public tables: ${results.tablesCount} table(s) - ${results.tablesCount >= 5 ? 'PASS' : 'FAIL'}`);
    console.log(`✓ RLS policies: ${results.policiesCount} policy(ies) - ${results.policiesCount >= 13 ? 'PASS' : 'FAIL'}`);
    console.log(`✓ Custom indexes: ${results.indexesCount} index(es) - ${results.indexesCount >= 25 ? 'PASS' : 'FAIL'}`);
    console.log('');
    console.log('TABLES:');
    results.tables.forEach(table => {
      console.log(`  - ${table}`);
    });
    console.log('');
    console.log('CUSTOM INDEXES:');
    results.indexes.forEach(index => {
      console.log(`  - ${index}`);
    });
    console.log('');

    // Overall status
    const allPassed =
      results.companiesCount >= 1 &&
      results.usersCount >= 1 &&
      results.tablesCount >= 5 &&
      results.policiesCount >= 13 &&
      results.indexesCount >= 25;

    console.log('OVERALL STATUS: ' + (allPassed ? '✓ ALL CHECKS PASSED' : '✗ SOME CHECKS FAILED'));
    console.log('='.repeat(60));

    return results;

  } catch (error) {
    console.error('Error during verification:', error.message);
    console.error('Connection details used:', {
      host: connectionConfig.host,
      port: connectionConfig.port,
      database: connectionConfig.database,
      user: connectionConfig.user,
    });
    process.exit(1);
  } finally {
    await client.end();
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
