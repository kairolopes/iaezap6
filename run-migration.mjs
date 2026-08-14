#!/usr/bin/env node

import { Client } from 'pg';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SUPABASE_HOST = 'gqromcfhiosfppqlottz.db.supabase.co';
const SUPABASE_PORT = 5432;
const SUPABASE_USER = 'postgres';
const SUPABASE_PASSWORD = 'postgres';
const SUPABASE_DATABASE = 'postgres';

async function executeMigrations() {
  console.log('\n' + '='.repeat(80));
  console.log('DATABASE MIGRATION EXECUTOR - Master User Setup');
  console.log('='.repeat(80));
  console.log(`\nTarget: ${SUPABASE_HOST}:${SUPABASE_PORT}/${SUPABASE_DATABASE}`);
  console.log(`User: ${SUPABASE_USER}`);

  const client = new Client({
    host: SUPABASE_HOST,
    port: SUPABASE_PORT,
    user: SUPABASE_USER,
    password: SUPABASE_PASSWORD,
    database: SUPABASE_DATABASE,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    console.log('\nConnecting to database...');
    await client.connect();
    console.log('✓ Connected successfully!\n');

    // Read migration SQL
    console.log('-'.repeat(80));
    console.log('MIGRATION 001: Complete Migration Bundle');
    console.log('-'.repeat(80));

    const migrationPath = resolve('./migrations/001_complete_migration_bundle.sql');
    let sql = readFileSync(migrationPath, 'utf-8');

    console.log(`File size: ${sql.length} bytes`);

    try {
      await client.query(sql);
      console.log('✓ Migration executed successfully!\n');
    } catch (error) {
      console.error('❌ Migration failed:');
      console.error(`   Error: ${error.message}`);
      if (error.position) {
        console.error(`   Position: ${error.position}`);
      }
      throw error;
    }

    // Verify tables were created
    console.log('-'.repeat(80));
    console.log('VERIFICATION');
    console.log('-'.repeat(80) + '\n');

    const checkQueries = [
      'SELECT table_name FROM information_schema.tables WHERE table_schema = \'public\' ORDER BY table_name;',
      'SELECT COUNT(*) as count FROM companies;',
      'SELECT COUNT(*) as count FROM users;',
      'SELECT COUNT(*) as count FROM company_members;',
      'SELECT COUNT(*) as count FROM audit_logs;',
    ];

    for (const query of checkQueries) {
      try {
        const result = await client.query(query);
        if (Array.isArray(result.rows) && result.rows.length > 0) {
          if (query.includes('table_name')) {
            console.log('✓ Tables created:');
            result.rows.forEach(row => console.log(`  - ${row.table_name}`));
          } else {
            const countObj = result.rows[0];
            const countValue = countObj.count || 0;
            const tableName = query.match(/FROM\s+(\w+)/)?.[1] || 'unknown';
            console.log(`✓ ${tableName}: ${countValue} rows`);
          }
        }
      } catch (e) {
        console.log(`⚠ Query failed: ${e.message}`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('MIGRATION COMPLETE');
    console.log('='.repeat(80));
    console.log('\nNext step: Create master user with npm run init-master-user\n');

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('Database connection closed.\n');
  }
}

executeMigrations().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
