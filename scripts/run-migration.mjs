import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SUPABASE_URL = 'https://gqromcfhiosfppqlottz.supabase.co';
const SERVICE_ROLE_KEY = 'sb_secret_uh1cDxnWtzRT4fhYbiEWBg_fbnZkKwQ';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function runMigration() {
  try {
    console.log('Reading migration file...');
    const migrationPath = resolve('./migrations/001_complete_migration_bundle.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('Migration SQL loaded. Splitting into statements...\n');

    // Split by GO or ; but keep comments intact
    const statements = migrationSQL
      .split(/;\s*\n/)
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`Found ${statements.length} SQL statements\n`);

    let successCount = 0;
    let errorCount = 0;

    // Execute statements one by one
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      if (statement.length === 0) continue;

      try {
        console.log(`[${i + 1}/${statements.length}] Executing statement...`);

        // Use the execute method for DDL statements
        const { error } = await supabase.rpc('exec', { sql: statement });

        if (error) {
          // Try alternative approach - ignore certain errors that are not critical
          if (error.message.includes('already exists') ||
              error.message.includes('duplicate') ||
              error.code === 'PGRST204' ||
              error.code === '42P07') {
            console.log(`  ⚠️  Warning: ${error.message}`);
            successCount++;
          } else {
            console.log(`  ✗ Error: ${error.message}`);
            errorCount++;
          }
        } else {
          console.log(`  ✓ OK`);
          successCount++;
        }
      } catch (err) {
        console.log(`  ✗ Error: ${err.message}`);
        errorCount++;
      }
    }

    console.log(`\n✓ Migration completed: ${successCount} succeeded, ${errorCount} failed`);

    if (errorCount === 0) {
      console.log('\n✓ Database schema initialized successfully!');
      console.log('\nNow you can run: node scripts/create-master-user.js');
    }

  } catch (error) {
    console.error('Error:', error.message);
    console.log('\nNote: Supabase JS client may not support raw SQL execution via RPC.');
    console.log('Please run the migration manually in the Supabase SQL Editor:');
    console.log('1. Go to: https://app.supabase.com/projects');
    console.log('2. Select project: gqromcfhiosfppqlottz');
    console.log('3. Go to: SQL Editor');
    console.log('4. New Query');
    console.log('5. Copy and paste: migrations/001_complete_migration_bundle.sql');
    console.log('6. Run the query');
    process.exit(1);
  }
}

runMigration();
