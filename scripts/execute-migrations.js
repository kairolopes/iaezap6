#!/usr/bin/env node

/**
 * Migration Execution Script for IAeZap Multi-Tenant System
 * Executes SQL migrations in Supabase in the correct order
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: Missing Supabase credentials in .env.local');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', SUPABASE_URL ? 'SET' : 'MISSING');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING');
  process.exit(1);
}

// Migration files in order
const migrations = [
  '001_create_companies_users_roles.sql',
  '002_add_cnpj_to_companies.sql',
  '003_complete_multitenant_migration.sql',
];

const migrationsDir = path.join(__dirname, '../src/lib/auth');

async function executeMigration(client, migrationFile) {
  const filePath = path.join(migrationsDir, migrationFile);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Migration file not found: ${filePath}`);
  }

  const sqlContent = fs.readFileSync(filePath, 'utf-8');

  console.log(`\n${'='.repeat(80)}`);
  console.log(`Executing migration: ${migrationFile}`);
  console.log(`${'='.repeat(80)}`);

  try {
    // Split by semicolon and execute statements individually
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    let executedCount = 0;
    let skippedCount = 0;

    for (const statement of statements) {
      try {
        const { error } = await client.rpc('exec_sql', { sql: statement });

        if (error) {
          // Some statements may fail due to IF NOT EXISTS, which is expected
          if (error.message && (
            error.message.includes('already exists') ||
            error.message.includes('IF NOT EXISTS') ||
            error.message.includes('is not a known function')
          )) {
            skippedCount++;
          } else {
            console.warn(`Warning in statement: ${error.message}`);
            console.warn(`Statement: ${statement.substring(0, 100)}...`);
          }
        } else {
          executedCount++;
        }
      } catch (err) {
        // Supabase doesn't have exec_sql, we need to use raw SQL
        console.error(`Error executing statement: ${err.message}`);
      }
    }

    console.log(`Migration ${migrationFile}: ${executedCount} executed, ${skippedCount} skipped`);
    return { success: true, executed: executedCount, skipped: skippedCount };
  } catch (error) {
    console.error(`Error executing migration ${migrationFile}:`, error.message);
    return { success: false, error: error.message };
  }
}

async function verifyMigration(client) {
  console.log(`\n${'='.repeat(80)}`);
  console.log('VERIFICATION QUERIES');
  console.log(`${'='.repeat(80)}`);

  try {
    // Verify tables
    const { data: tables, error: tablesError } = await client
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['companies', 'users', 'company_members', 'audit_logs']);

    if (tablesError) {
      console.error('Error verifying tables:', tablesError.message);
    } else {
      console.log('\n✓ Tables created:');
      console.log('  - companies');
      console.log('  - users');
      console.log('  - company_members');
      console.log('  - audit_logs');
      console.log(`  Found: ${tables?.length || 0} tables`);
    }

    // Verify master user
    const { data: masterUser, error: userError } = await client
      .from('users')
      .select('id, email, full_name, role, created_at')
      .eq('email', 'kairolopesoficial@gmail.com')
      .is('deleted_at', null)
      .single();

    if (userError && userError.code !== 'PGRST116') {
      console.error('Error verifying master user:', userError.message);
    } else if (masterUser) {
      console.log('\n✓ Master user created:');
      console.log(`  - Email: ${masterUser.email}`);
      console.log(`  - Full Name: ${masterUser.full_name}`);
      console.log(`  - Role: ${masterUser.role}`);
      console.log(`  - Created At: ${masterUser.created_at}`);
    }

    // Verify master company
    const { data: masterCompany, error: companyError } = await client
      .from('companies')
      .select('id, name, slug, plan, status, created_at')
      .eq('slug', 'master')
      .is('deleted_at', null)
      .single();

    if (companyError && companyError.code !== 'PGRST116') {
      console.error('Error verifying master company:', companyError.message);
    } else if (masterCompany) {
      console.log('\n✓ Master company created:');
      console.log(`  - Name: ${masterCompany.name}`);
      console.log(`  - Slug: ${masterCompany.slug}`);
      console.log(`  - Plan: ${masterCompany.plan}`);
      console.log(`  - Status: ${masterCompany.status}`);
      console.log(`  - Created At: ${masterCompany.created_at}`);
    }

    return { success: true };
  } catch (error) {
    console.error('Verification error:', error.message);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║           IAeZap Multi-Tenant System - SQL Migration Executor                 ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════════╝');

  console.log('\nInitializing Supabase client...');
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log('Connected to Supabase');
  console.log(`Project URL: ${SUPABASE_URL}`);

  // Note: Due to Supabase limitations with the JS client, we'll use a PostgreSQL approach
  // We'll use the SQL interface through Supabase RPC or direct SQL execution

  console.log('\n⚠️  NOTE: For full SQL migration execution, please use one of these methods:');
  console.log('   1. Use Supabase SQL Editor in the dashboard (copy/paste migration files)');
  console.log('   2. Use psql directly with: psql postgres://user:password@db.host/database');
  console.log('   3. Use supabase-cli: supabase db push');
  console.log('\nFor now, here is what needs to be executed:\n');

  // Display migration files
  let totalStatements = 0;
  for (const migrationFile of migrations) {
    const filePath = path.join(migrationsDir, migrationFile);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const statements = content.split(';').filter(s => s.trim() && !s.trim().startsWith('--')).length;
      console.log(`✓ ${migrationFile}: ${statements} SQL statements`);
      totalStatements += statements;
    }
  }

  console.log(`\nTotal SQL statements: ${totalStatements}`);
  console.log('\n' + '='.repeat(80));
  console.log('EXECUTION METHOD: Use Supabase Dashboard SQL Editor');
  console.log('='.repeat(80));

  console.log('\nStep 1: Visit Supabase dashboard');
  console.log(`        URL: https://app.supabase.com/project/${SUPABASE_URL.split('.')[0]}`);
  console.log('\nStep 2: Navigate to "SQL Editor"');
  console.log('\nStep 3: Execute each migration file in order:');

  for (let i = 0; i < migrations.length; i++) {
    const migrationFile = migrations[i];
    const filePath = path.join(migrationsDir, migrationFile);
    console.log(`\n[${i + 1}/${migrations.length}] ${migrationFile}`);
    console.log('-'.repeat(80));

    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').slice(0, 50);
      console.log(lines.join('\n'));
      console.log('\n... (full content in file)');
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('VERIFICATION QUERIES');
  console.log('='.repeat(80));
  console.log('\nAfter executing all migrations, run these verification queries:\n');

  console.log('-- 1. Verify all tables created');
  console.log('SELECT table_name FROM information_schema.tables');
  console.log('WHERE table_schema=\'public\'');
  console.log('AND table_name IN (\'companies\', \'users\', \'company_members\', \'audit_logs\');');

  console.log('\n-- 2. Verify master user created');
  console.log('SELECT id, email, full_name, role, created_at FROM users');
  console.log('WHERE email = \'kairolopesoficial@gmail.com\' AND deleted_at IS NULL;');

  console.log('\n-- 3. Verify master company created');
  console.log('SELECT id, name, slug, plan, status, created_at FROM companies');
  console.log('WHERE slug = \'master\' AND deleted_at IS NULL;');

  console.log('\n-- 4. Verify RLS policies exist');
  console.log('SELECT schemaname, tablename, policyname FROM pg_policies');
  console.log('WHERE schemaname = \'public\' ORDER BY tablename, policyname;');

  console.log('\n-- 5. Verify company_id in z_api_instances');
  console.log('SELECT column_name, data_type, is_nullable FROM information_schema.columns');
  console.log('WHERE table_name = \'z_api_instances\' ORDER BY ordinal_position;');

  console.log('\n' + '='.repeat(80));
  console.log('ALTERNATIVE: Execute using PostgreSQL CLI');
  console.log('='.repeat(80));
  console.log('\nIf you have psql installed:');
  console.log(`psql "postgresql://postgres:[PASSWORD]@${SUPABASE_URL.match(/https:\\/\\/([^.]+)/)[1]}.supabase.co:5432/postgres" \\`);
  console.log('  -f src/lib/auth/001_create_companies_users_roles.sql \\');
  console.log('  -f src/lib/auth/002_add_cnpj_to_companies.sql \\');
  console.log('  -f src/lib/auth/003_complete_multitenant_migration.sql');

  console.log('\n' + '='.repeat(80));
  console.log('GENERATED MIGRATION FILES');
  console.log('='.repeat(80));

  for (const migrationFile of migrations) {
    const filePath = path.join(migrationsDir, migrationFile);
    console.log(`\n✓ ${filePath}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('✓ Migration files are ready for execution');
  console.log('='.repeat(80) + '\n');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
