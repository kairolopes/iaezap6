import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SUPABASE_URL = 'https://gqromcfhiosfppqlottz.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_uh1cDxnWtzRT4fhYbiEWBg_fbnZkKwQ';

async function runMigrations() {
  try {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║  IAeZap Database Migration Runner                              ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Read migration file
    const migrationPath = resolve('./migrations/001_complete_migration_bundle.sql');
    console.log(`Reading migration file: ${migrationPath}\n`);
    const sqlContent = readFileSync(migrationPath, 'utf-8');

    // Split by statement blocks (;)
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt && !stmt.startsWith('--'));

    console.log(`Found ${statements.length} migration statements\n`);
    console.log('Attempting to execute migrations via Supabase SQL Admin...\n');

    // Try to execute via rpc if available
    try {
      // First, try to get the database schema status
      const { data, error } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .limit(1);

      if (error && error.message.includes('relation')) {
        console.log('Database schema not initialized. Using direct SQL execution...\n');

        // For Supabase, we need to use sql-related functions
        // Let's use the raw_sql approach
        for (let i = 0; i < Math.min(statements.length, 5); i++) {
          const stmt = statements[i];
          if (!stmt) continue;

          console.log(`[${i + 1}] Executing: ${stmt.substring(0, 60)}...`);

          // Execute each statement
          try {
            // Use a simple query that should work
            if (stmt.includes('CREATE TYPE') || stmt.includes('CREATE TABLE') || stmt.includes('CREATE INDEX')) {
              // Skip these for now - we'll use manual execution
              console.log('  → Schema DDL requires direct SQL execution');
            }
          } catch (err) {
            console.log(`  ✗ Error: ${err.message}`);
          }
        }
      }
    } catch (err) {
      console.log(`Schema check attempt: ${err.message}\n`);
    }

    console.log('\n⚠️  NOTICE: Direct SQL migration requires Supabase Admin Panel\n');
    console.log('To complete the migration:');
    console.log('1. Open Supabase Admin Panel: https://app.supabase.com');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Copy the full content of: migrations/001_complete_migration_bundle.sql');
    console.log('4. Paste into a new SQL query and execute');
    console.log('5. Then run: node scripts/setup_master_user_final.mjs\n');

    // Show preview
    console.log('Preview of migration SQL:');
    console.log('────────────────────────────────────────────────────────────────');
    const preview = sqlContent.split('\n').slice(0, 40).join('\n');
    console.log(preview);
    console.log('────────────────────────────────────────────────────────────────\n');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

runMigrations();
