#!/usr/bin/env node

import { Client } from 'pg';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Configuration
const SUPABASE_HOST = 'gqromcfhiosfppqlottz.db.supabase.co';
const SUPABASE_PORT = 5432;
const SUPABASE_USER = 'postgres';
const SUPABASE_PASSWORD = 'postgres'; // Default Supabase password
const SUPABASE_DATABASE = 'postgres';

async function executeMigrations() {
  console.log('\n' + '='.repeat(80));
  console.log('DATABASE MIGRATION EXECUTOR (Direct PG Connection)');
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
      rejectUnauthorized: false, // Required for Supabase
    },
  });

  try {
    console.log('\nConnecting to database...');
    await client.connect();
    console.log('✓ Connected successfully!\n');

    // Read and execute migration 002
    console.log('-'.repeat(80));
    console.log('MIGRATION 002: Add Company Support');
    console.log('-'.repeat(80));

    const migration002Path = resolve('./migrations/002_add_company_support.sql');
    let sql002 = readFileSync(migration002Path, 'utf-8');

    // Remove \echo lines
    sql002 = sql002
      .split('\n')
      .filter(line => !line.trim().startsWith('\\echo'))
      .join('\n');

    console.log(`File size: ${sql002.length} bytes`);

    try {
      await client.query(sql002);
      console.log('✓ Migration 002 executed successfully\n');
    } catch (error) {
      console.error('❌ Migration 002 failed:');
      console.error(`   Error: ${error.message}`);
      console.error(`   Position: ${error.position || 'N/A'}`);
      // Continue anyway
    }

    // Read and execute migration 003
    console.log('-'.repeat(80));
    console.log('MIGRATION 003: Backfill company_id');
    console.log('-'.repeat(80));

    const migration003Path = resolve('./migrations/003_backfill_company_id.sql');
    let sql003 = readFileSync(migration003Path, 'utf-8');

    // Remove \echo lines
    sql003 = sql003
      .split('\n')
      .filter(line => !line.trim().startsWith('\\echo'))
      .join('\n');

    console.log(`File size: ${sql003.length} bytes`);

    try {
      await client.query(sql003);
      console.log('✓ Migration 003 executed successfully\n');
    } catch (error) {
      console.error('❌ Migration 003 failed:');
      console.error(`   Error: ${error.message}`);
      console.error(`   Position: ${error.position || 'N/A'}`);
    }

    // Verification queries
    console.log('-'.repeat(80));
    console.log('VERIFICATION');
    console.log('-'.repeat(80) + '\n');

    // Check companies table
    try {
      const companiesResult = await client.query(
        'SELECT COUNT(*) as count FROM companies'
      );
      console.log(`✓ Companies table: ${companiesResult.rows[0].count} rows`);
    } catch (e) {
      console.log('⚠ Companies table query failed:', e.message);
    }

    // Check z_api_instances
    try {
      const instancesResult = await client.query(
        'SELECT COUNT(*) as total, COUNT(CASE WHEN company_id IS NOT NULL THEN 1 END) as with_company FROM z_api_instances'
      );
      const row = instancesResult.rows[0];
      console.log(`✓ Z-API Instances: ${row.total} total, ${row.with_company} with company_id`);
      const percentage = row.total > 0 ? ((row.with_company / row.total) * 100).toFixed(2) : 0;
      console.log(`  Backfill percentage: ${percentage}%`);
    } catch (e) {
      console.log('⚠ Z-API Instances query failed:', e.message);
    }

    // Check default company
    try {
      const defaultCompanyResult = await client.query(
        "SELECT id, name, slug, cnpj FROM companies WHERE slug = 'default-company' LIMIT 1"
      );
      if (defaultCompanyResult.rows.length > 0) {
        const company = defaultCompanyResult.rows[0];
        console.log(`✓ Default company found:`);
        console.log(`  ID: ${company.id}`);
        console.log(`  Name: ${company.name}`);
        console.log(`  Slug: ${company.slug}`);
        console.log(`  CNPJ: ${company.cnpj}`);
      } else {
        console.log('⚠ Default company not found');
      }
    } catch (e) {
      console.log('⚠ Default company query failed:', e.message);
    }

    console.log('\n' + '='.repeat(80));
    console.log('MIGRATION COMPLETE');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
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
