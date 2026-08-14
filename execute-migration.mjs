import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.local
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('ERROR: Missing Supabase credentials');
  console.error('  NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'SET' : 'NOT SET');
  console.error('  SUPABASE_SERVICE_ROLE_KEY:', serviceRoleKey ? 'SET' : 'NOT SET');
  process.exit(1);
}

console.log('Starting SQL migration execution...');
console.log(`Supabase URL: ${supabaseUrl}`);
console.log('Service Role Key: SET ✓');

// Create Supabase client with service role key (bypasses RLS)
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// Read the migration file
const migrationPath = path.join(__dirname, 'migrations', '001_complete_migration_bundle.sql');
console.log(`\nReading migration file: ${migrationPath}`);

if (!fs.existsSync(migrationPath)) {
  console.error(`ERROR: Migration file not found at ${migrationPath}`);
  process.exit(1);
}

const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
console.log(`Migration file loaded: ${migrationSQL.length} bytes`);

// Execute the migration
async function executeMigration() {
  try {
    console.log('\nExecuting migration...');

    // Try to execute the entire migration as a single query
    try {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql_query: migrationSQL
      });

      if (error) {
        throw new Error(`RPC exec_sql failed: ${error.message}`);
      }

      console.log('\n✓ Migration COMPLETED successfully!');
      console.log('Result:', JSON.stringify(data, null, 2));

      // Verify the migration
      console.log('\n--- VERIFICATION ---');
      await verifyMigration();
      return;
    } catch (rpcError) {
      // If exec_sql doesn't exist, try using direct query execution
      console.log(`Note: RPC function attempt failed: ${rpcError.message}`);
      console.log('Attempting direct SQL execution via pg client...');

      // Use a different approach - execute via a custom function or direct client
      await executeMigrationViaDirectClient();
    }

  } catch (error) {
    console.error('\nMigration execution failed:');
    console.error('Error:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

async function executeMigrationViaDirectClient() {
  try {
    // Create a PostgreSQL client for direct execution
    // First, let's try using sql function if it exists
    console.log('\nTrying direct SQL execution via stored procedures...');

    // Split the migration into chunks to avoid timeouts
    const chunks = migrationSQL.split('\n\n').filter(chunk => chunk.trim().length > 0);
    console.log(`Executing ${chunks.length} SQL chunks...`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i].trim();
      if (!chunk.startsWith('--') && chunk.length > 0) {
        try {
          // Try to execute each chunk individually
          console.log(`  [${i + 1}/${chunks.length}] Executing: ${chunk.substring(0, 50)}...`);

          // Note: Direct SQL execution via Supabase client is limited
          // The best approach is to use the SQL Editor in the dashboard
          console.log('    ⚠️  Note: Supabase JS client has limited SQL execution. Use SQL Editor in dashboard.');
          errorCount++;
        } catch (e) {
          console.log(`  [${i + 1}/${chunks.length}] ✗ Error: ${e.message}`);
          errorCount++;
        }
      }
    }

    console.log(`\n⚠️  Direct SQL execution not fully supported via Supabase JS client.`);
    console.log(`Please use the SQL Editor in the Supabase Dashboard instead.`);
    console.log(`\nMigration script saved to: migrations/001_complete_migration_bundle.sql`);
  } catch (error) {
    console.error('Direct client execution failed:', error.message);
    throw error;
  }
}

async function verifyMigration() {
  try {
    // Check if companies table exists
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('id, name, slug')
      .limit(5);

    if (companiesError) {
      console.log('⚠️  Could not query companies table:', companiesError.message);
    } else {
      console.log(`✓ Companies table exists (${companies?.length || 0} rows found)`);
    }

    // Check if users table exists
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, role')
      .limit(5);

    if (usersError) {
      console.log('⚠️  Could not query users table:', usersError.message);
    } else {
      console.log(`✓ Users table exists (${users?.length || 0} rows found)`);
    }

    // Check if master user was created
    const { data: masterUser, error: masterError } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('email', 'kairolopesoficial@gmail.com')
      .single();

    if (masterError && masterError.code !== 'PGRST116') {
      console.log('⚠️  Could not query master user:', masterError.message);
    } else if (masterUser) {
      console.log(`✓ Master user created: ${masterUser.email} (role: ${masterUser.role})`);
    } else {
      console.log('⚠️  Master user not found');
    }

    // Check if company_members table exists
    const { data: members, error: membersError } = await supabase
      .from('company_members')
      .select('id')
      .limit(1);

    if (membersError && membersError.code !== 'PGRST116') {
      console.log('⚠️  Could not query company_members table:', membersError.message);
    } else {
      console.log(`✓ Company_members table exists`);
    }

    // Check if audit_logs table exists
    const { data: logs, error: logsError } = await supabase
      .from('audit_logs')
      .select('id')
      .limit(1);

    if (logsError && logsError.code !== 'PGRST116') {
      console.log('⚠️  Could not query audit_logs table:', logsError.message);
    } else {
      console.log(`✓ Audit_logs table exists`);
    }

  } catch (error) {
    console.error('Verification failed:', error.message);
  }
}

// Run the migration
executeMigration();
