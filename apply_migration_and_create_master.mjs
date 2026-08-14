#!/usr/bin/env node

import pkg from 'pg';
const { Client } = pkg;
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SUPABASE_HOST = 'gqromcfhiosfppqlottz.db.supabase.co';
const SUPABASE_PORT = 5432;
const SUPABASE_USER = 'postgres';
const SUPABASE_PASSWORD = 'sb_secret_uh1cDxnWtzRT4fhYbiEWBg_fbnZkKwQ'; // Service role key
const SUPABASE_DATABASE = 'postgres';

async function applyMigrationsAndCreateMaster() {
  console.log('\n' + '='.repeat(80));
  console.log('MASTER COMPANY SETUP - Migration & Creation');
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
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
  });

  try {
    console.log('\nConnecting to database...');
    await client.connect();
    console.log('✓ Connected successfully!\n');

    // Check if companies table already exists
    console.log('-'.repeat(80));
    console.log('CHECKING EXISTING SCHEMA');
    console.log('-'.repeat(80));

    const checkTableResult = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'companies'
      );
    `);

    const companiesTableExists = checkTableResult.rows[0].exists;
    console.log(`Companies table exists: ${companiesTableExists}\n`);

    if (!companiesTableExists) {
      // Apply migration 001
      console.log('-'.repeat(80));
      console.log('APPLYING MIGRATION 001: Complete Migration Bundle');
      console.log('-'.repeat(80));

      const migrationPath = resolve('./migrations/001_complete_migration_bundle.sql');
      let sql = readFileSync(migrationPath, 'utf-8');

      console.log(`Migration file size: ${sql.length} bytes`);

      try {
        await client.query(sql);
        console.log('✓ Migration 001 executed successfully!\n');
      } catch (error) {
        console.error('✗ Migration 001 failed:');
        console.error(`  Error: ${error.message}`);
        if (error.position) {
          console.error(`  Position: ${error.position}`);
        }
        throw error;
      }

      // Verify tables were created
      console.log('-'.repeat(80));
      console.log('VERIFICATION AFTER MIGRATION');
      console.log('-'.repeat(80) + '\n');

      const tables = await client.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name IN ('companies', 'users', 'company_members', 'audit_logs')
        ORDER BY table_name;
      `);

      console.log('✓ Tables created:');
      tables.rows.forEach(row => console.log(`  - ${row.table_name}`));
      console.log();
    }

    // Now create the master company
    console.log('-'.repeat(80));
    console.log('CREATING MASTER COMPANY');
    console.log('-'.repeat(80) + '\n');

    // Check if master company already exists
    const checkMasterResult = await client.query(`
      SELECT id, name, slug, plan FROM companies WHERE slug = 'master';
    `);

    if (checkMasterResult.rows.length > 0) {
      const company = checkMasterResult.rows[0];
      console.log('✓ Master company already exists:');
      console.log(`  ID:   ${company.id}`);
      console.log(`  Name: ${company.name}`);
      console.log(`  Slug: ${company.slug}`);
      console.log(`  Plan: ${company.plan}`);
    } else {
      // Insert master company
      const insertResult = await client.query(`
        INSERT INTO companies (id, name, slug, cnpj, plan, status, owner_id, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (slug) DO NOTHING
        RETURNING id, name, slug, plan;
      `, [
        '00000000-0000-0000-0000-000000000001',
        'Master Company',
        'master',
        '00.000.000/0000-00',
        'enterprise',
        'active',
        '00000000-0000-0000-0000-000000000002'
      ]);

      if (insertResult.rows.length > 0) {
        const company = insertResult.rows[0];
        console.log('✓ Master company created successfully!');
        console.log(`  ID:   ${company.id}`);
        console.log(`  Name: ${company.name}`);
        console.log(`  Slug: ${company.slug}`);
        console.log(`  Plan: ${company.plan}`);
      } else {
        console.log('Note: Master company may already exist. Verifying...');

        const verifyResult = await client.query(`
          SELECT id, name, slug, plan FROM companies WHERE slug = 'master';
        `);

        if (verifyResult.rows.length > 0) {
          const company = verifyResult.rows[0];
          console.log('✓ Master company confirmed:');
          console.log(`  ID:   ${company.id}`);
          console.log(`  Name: ${company.name}`);
          console.log(`  Slug: ${company.slug}`);
          console.log(`  Plan: ${company.plan}`);
        }
      }
    }

    // Final verification
    console.log('\n' + '-'.repeat(80));
    console.log('FINAL VERIFICATION');
    console.log('-'.repeat(80) + '\n');

    const finalVerifyResult = await client.query(`
      SELECT id, name, slug, plan FROM companies WHERE slug='master';
    `);

    if (finalVerifyResult.rows.length > 0) {
      console.log('✓ Verification successful!');
      console.log('\nQuery Result: SELECT id, name, slug, plan FROM companies WHERE slug=\'master\';');
      console.log('\nResult:');
      console.table(finalVerifyResult.rows);
    } else {
      console.log('✗ Master company not found in database!');
      process.exit(1);
    }

    console.log('\n' + '='.repeat(80));
    console.log('✓ MASTER COMPANY SETUP COMPLETE');
    console.log('='.repeat(80));
    console.log('Report: Company created successfully.');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('\n' + '='.repeat(80));
    console.error('✗ FATAL ERROR');
    console.error('='.repeat(80));
    console.error(`Error: ${error.message}`);
    if (error.code) {
      console.error(`Code: ${error.code}`);
    }
    console.error('='.repeat(80) + '\n');
    process.exit(1);
  } finally {
    try {
      await client.end();
      console.log('Database connection closed.\n');
    } catch (e) {
      // ignore
    }
  }
}

await applyMigrationsAndCreateMaster();
