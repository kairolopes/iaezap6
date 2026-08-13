#!/usr/bin/env node

/**
 * Database Setup Verification Script - Direct PostgreSQL Connection
 * Uses pg package to connect directly to Supabase PostgreSQL
 */

const { Client } = require('pg');

// Supabase PostgreSQL connection string
// Format: postgresql://[user]:[password]@[host]:[port]/[database]
// For Supabase, the password is the database password you set during project creation
// Default user is typically 'postgres'
// Trying with an environment variable or common Supabase default

const connectionString = process.env.DATABASE_URL ||
  'postgresql://postgres:' + (process.env.DB_PASSWORD || 'YOUR_DB_PASSWORD_HERE') +
  '@db.gqromcfhiosfppqlottz.supabase.co:5432/postgres';

async function verifyDatabase() {
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }, // Required for Supabase
  });

  const results = {};

  try {
    console.log('Attempting to connect to Supabase PostgreSQL database...');
    await client.connect();
    console.log('✓ Connected successfully!\n');

    // Query 1: Count companies
    console.log('1. Querying companies table...');
    const companiesResult = await client.query('SELECT COUNT(*) as total FROM companies');
    results.companiesCount = parseInt(companiesResult.rows[0].total);
    console.log(`   Total companies: ${results.companiesCount} (expected: 1+)`);

    // Query 2: Count users
    console.log('2. Querying users table...');
    const usersResult = await client.query('SELECT COUNT(*) as total FROM users');
    results.usersCount = parseInt(usersResult.rows[0].total);
    console.log(`   Total users: ${results.usersCount} (expected: 1+)`);

    // Query 3: Count public tables
    console.log('3. Querying public tables...');
    const tablesResult = await client.query(
      "SELECT COUNT(*) as total FROM pg_tables WHERE schema_name='public'"
    );
    results.tablesCount = parseInt(tablesResult.rows[0].total);
    console.log(`   Total public tables: ${results.tablesCount} (expected: 5+)`);

    // List all table names
    const tableListResult = await client.query(
      "SELECT tablename FROM pg_tables WHERE schema_name='public' ORDER BY tablename"
    );
    const tableNames = tableListResult.rows.map(r => r.tablename);
    console.log(`   Tables: ${tableNames.join(', ')}\n`);
    results.tables = tableNames;

    // Query 4: Count RLS policies
    console.log('4. Querying Row Level Security (RLS) policies...');
    const policiesResult = await client.query('SELECT COUNT(*) as total FROM pg_policies');
    results.policiesCount = parseInt(policiesResult.rows[0].total);
    console.log(`   Total RLS policies: ${results.policiesCount} (expected: 13+)\n`);

    // Query 5: Count custom indexes
    console.log('5. Querying indexes...');
    const indexesResult = await client.query(
      "SELECT COUNT(*) as total FROM pg_indexes WHERE schema_name='public' AND indexname LIKE 'idx_%'"
    );
    results.indexesCount = parseInt(indexesResult.rows[0].total);
    console.log(`   Total custom indexes: ${results.indexesCount} (expected: 25+)`);

    // List index names
    const indexListResult = await client.query(
      "SELECT indexname FROM pg_indexes WHERE schema_name='public' AND indexname LIKE 'idx_%' ORDER BY indexname"
    );
    const indexNames = indexListResult.rows.map(r => r.indexname);
    console.log(`   Indexes found: ${indexNames.length}`);
    results.indexes = indexNames;
    console.log('');

    // Query 6: List all indexes (including system ones)
    console.log('6. All indexes (system + custom)...');
    const allIndexesResult = await client.query(
      "SELECT indexname FROM pg_indexes WHERE schema_name='public' ORDER BY indexname"
    );
    console.log(`   Total indexes (all types): ${allIndexesResult.rows.length}\n`);
    results.allIndexesCount = allIndexesResult.rows.length;

    // Additional verification
    console.log('7. Verifying table columns and constraints...');

    // Companies table info
    const companiesInfoResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name='companies'
      ORDER BY ordinal_position
    `);
    results.companiesColumns = companiesInfoResult.rows;
    console.log(`   Companies: ${companiesInfoResult.rows.length} columns`);

    // Users table info
    const usersInfoResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name='users'
      ORDER BY ordinal_position
    `);
    results.usersColumns = usersInfoResult.rows;
    console.log(`   Users: ${usersInfoResult.rows.length} columns`);

    // Check for z_api_instances
    const zapiResult = await client.query(`
      SELECT COUNT(*) as total FROM z_api_instances
    `);
    results.zapiCount = parseInt(zapiResult.rows[0].total);
    console.log(`   Z-API instances: ${results.zapiCount} rows\n`);

    // Generate final report
    console.log('='.repeat(70));
    console.log('FINAL DATABASE STATE REPORT');
    console.log('='.repeat(70));
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log(`Database: PostgreSQL @ db.gqromcfhiosfppqlottz.supabase.co`);
    console.log(`Supabase URL: https://gqromcfhiosfppqlottz.supabase.co\n`);

    console.log('REQUIREMENT VERIFICATION:');
    const checks = [
      {
        name: '1. Companies table count',
        actual: results.companiesCount,
        expected: '1+',
        status: results.companiesCount >= 1
      },
      {
        name: '2. Users table count',
        actual: results.usersCount,
        expected: '1+',
        status: results.usersCount >= 1
      },
      {
        name: '3. Public tables count',
        actual: results.tablesCount,
        expected: '5+',
        status: results.tablesCount >= 5
      },
      {
        name: '4. RLS policies count',
        actual: results.policiesCount,
        expected: '13+',
        status: results.policiesCount >= 13
      },
      {
        name: '5. Custom indexes (idx_*)',
        actual: results.indexesCount,
        expected: '25+',
        status: results.indexesCount >= 25
      }
    ];

    checks.forEach(check => {
      const symbol = check.status ? '✓' : '✗';
      console.log(`${symbol} ${check.name}: ${check.actual} (expected ${check.expected})`);
    });

    console.log('\nDETAILED COUNTS:');
    console.log(`- Total companies: ${results.companiesCount}`);
    console.log(`- Total users: ${results.usersCount}`);
    console.log(`- Total public tables: ${results.tablesCount}`);
    console.log(`- RLS policies: ${results.policiesCount}`);
    console.log(`- Custom indexes (idx_%): ${results.indexesCount}`);
    console.log(`- All indexes (all types): ${results.allIndexesCount}`);
    console.log(`- Z-API instances: ${results.zapiCount}`);

    console.log('\nTABLE STRUCTURE:');
    console.log(`Tables (${results.tables.length}):`);
    results.tables.forEach(table => {
      console.log(`  - ${table}`);
    });

    console.log('\nCUSTOM INDEXES:');
    results.indexes.forEach(index => {
      console.log(`  - ${index}`);
    });

    console.log('\nCOMPANIES TABLE SCHEMA:');
    results.companiesColumns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    console.log('\nUSERS TABLE SCHEMA:');
    results.usersColumns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    // Overall summary
    const allPassed = checks.every(c => c.status);
    console.log('\n' + '='.repeat(70));
    console.log(`OVERALL STATUS: ${allPassed ? '✓ ALL REQUIREMENTS MET' : '✗ SOME REQUIREMENTS NOT MET'}`);
    console.log('='.repeat(70));

    return results;

  } catch (error) {
    console.error('\n✗ Connection Error:', error.message);
    console.error('\nConnection Details Used:');
    console.error(`  Host: db.gqromcfhiosfppqlottz.supabase.co`);
    console.error(`  Port: 5432`);
    console.error(`  Database: postgres`);
    console.error(`  User: postgres`);
    console.error(`  SSL: Required`);
    console.error('\nTroubleshooting:');
    console.error('1. Set DB_PASSWORD environment variable to your Supabase database password');
    console.error('2. Or set DATABASE_URL with full connection string');
    console.error('3. Database password is the one you set when creating the Supabase project');
    console.error('4. Check Supabase project settings > Database > Connection string');
    process.exit(1);

  } finally {
    try {
      await client.end();
    } catch (e) {
      // Connection already closed
    }
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
