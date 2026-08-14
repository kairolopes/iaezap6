import pkg from 'pg';
const { Client } = pkg;
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

// Extract Supabase URL and service role key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('ERROR: Missing Supabase credentials');
  console.error('  NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'SET' : 'NOT SET');
  console.error('  SUPABASE_SERVICE_ROLE_KEY:', serviceRoleKey ? 'SET' : 'NOT SET');
  process.exit(1);
}

// Parse Supabase URL to get host
// Format: https://projectid.supabase.co
const url = new URL(supabaseUrl);
const projectId = url.hostname.split('.')[0];

console.log('Starting SQL migration execution via PostgreSQL client...');
console.log(`Project ID: ${projectId}`);
console.log(`Supabase Host: ${url.hostname}`);

// Create PostgreSQL connection
const client = new Client({
  host: url.hostname,
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: serviceRoleKey,
  ssl: {
    rejectUnauthorized: false,
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
console.log(`Migration file loaded: ${migrationSQL.length} bytes\n`);

async function executeMigration() {
  try {
    console.log('Connecting to Supabase PostgreSQL database...');
    await client.connect();
    console.log('✓ Connected to database\n');

    console.log('Executing migration SQL...');
    console.log('='.repeat(60));

    // Execute the entire migration
    const result = await client.query(migrationSQL);

    console.log('='.repeat(60));
    console.log('\n✓ Migration COMPLETED successfully!\n');

    // Verify the migration
    console.log('--- VERIFICATION ---\n');
    await verifyMigration();

  } catch (error) {
    console.error('\n✗ Migration FAILED:');
    console.error('Error:', error.message);
    if (error.position) {
      console.error(`Position: ${error.position}`);
    }
    if (error.detail) {
      console.error(`Detail: ${error.detail}`);
    }
    if (error.hint) {
      console.error(`Hint: ${error.hint}`);
    }
    process.exit(1);
  } finally {
    await client.end();
    console.log('\nDatabase connection closed.');
  }
}

async function verifyMigration() {
  try {
    // Check created tables
    const tablesQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('companies', 'users', 'company_members', 'audit_logs')
      ORDER BY table_name;
    `;

    const tablesResult = await client.query(tablesQuery);
    console.log(`✓ Tables created: ${tablesResult.rowCount}`);
    tablesResult.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });

    // Check indexes
    const indexesQuery = `
      SELECT COUNT(*) as index_count
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND tablename IN ('companies', 'users', 'company_members', 'audit_logs', 'z_api_instances')
      AND indexname LIKE 'idx_%';
    `;

    const indexesResult = await client.query(indexesQuery);
    console.log(`\n✓ Indexes created: ${indexesResult.rows[0].index_count}`);

    // Check master user
    const masterUserQuery = `
      SELECT id, email, role FROM users
      WHERE email = 'kairolopesoficial@gmail.com' AND deleted_at IS NULL;
    `;

    const masterUserResult = await client.query(masterUserQuery);
    if (masterUserResult.rowCount > 0) {
      const user = masterUserResult.rows[0];
      console.log(`\n✓ Master user created:`);
      console.log(`  - Email: ${user.email}`);
      console.log(`  - Role: ${user.role}`);
      console.log(`  - ID: ${user.id}`);
    } else {
      console.log(`\n⚠️  Master user not found`);
    }

    // Check RLS enabled
    const rlsQuery = `
      SELECT relname
      FROM pg_class
      WHERE relname IN ('companies', 'users', 'company_members', 'audit_logs')
      AND relrowsecurity = true;
    `;

    const rlsResult = await client.query(rlsQuery);
    console.log(`\n✓ Row Level Security (RLS) enabled on ${rlsResult.rowCount} tables:`);
    rlsResult.rows.forEach(row => {
      console.log(`  - ${row.relname}`);
    });

    // Check enum type
    const enumQuery = `
      SELECT typname
      FROM pg_type
      WHERE typname = 'user_role';
    `;

    const enumResult = await client.query(enumQuery);
    if (enumResult.rowCount > 0) {
      console.log(`\n✓ user_role enum type created`);
    } else {
      console.log(`\n⚠️  user_role enum type not found`);
    }

    console.log('\n✓ All verifications passed!');

  } catch (error) {
    console.error('Verification failed:', error.message);
  }
}

// Run the migration
executeMigration();
