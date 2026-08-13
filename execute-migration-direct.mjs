import pkg from 'pg';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import dotenv from 'dotenv';

const { Pool } = pkg;

// Load environment variables
dotenv.config({ path: '.env.local' });

// Get Supabase connection details from URL
const SUPABASE_URL = 'https://gqromcfhiosfppqlottz.supabase.co';
const DB_HOST = 'aws-0-us-east-1.pooler.supabase.com';
const DB_PORT = 6543;
const DB_USER = 'postgres';
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD || '';
const DB_NAME = 'postgres';

async function executeMigrations() {
  const pool = new Pool({
    host: DB_HOST,
    port: DB_PORT,
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASSWORD,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║  IAeZap Database Migration - Direct Execution                  ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    // Read migration file
    const migrationPath = resolve('./migrations/001_complete_migration_bundle.sql');
    console.log(`Reading migration file: ${migrationPath}`);
    const sqlContent = readFileSync(migrationPath, 'utf-8');

    // Connect to database
    console.log(`Connecting to PostgreSQL: ${DB_HOST}:${DB_PORT}/${DB_NAME}`);
    const client = await pool.connect();
    console.log('✓ Connected to database\n');

    // Split statements properly
    const statements = [];
    let current = '';
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < sqlContent.length; i++) {
      const char = sqlContent[i];

      if (!inString && (char === '"' || char === "'")) {
        inString = true;
        stringChar = char;
      } else if (inString && char === stringChar && sqlContent[i - 1] !== '\\') {
        inString = false;
      }

      current += char;

      if (char === ';' && !inString) {
        statements.push(current.trim());
        current = '';
      }
    }

    if (current.trim()) {
      statements.push(current.trim());
    }

    console.log(`Found ${statements.length} SQL statements\n`);

    // Execute statements
    let executed = 0;
    let skipped = 0;
    let failed = 0;
    const errors = [];

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      if (!stmt || stmt.trim().startsWith('--')) {
        skipped++;
        continue;
      }

      try {
        process.stdout.write(`[${i + 1}/${statements.length}] Executing: ${stmt.substring(0, 70)}...`);

        await client.query(stmt);

        process.stdout.write(' ✓\n');
        executed++;
      } catch (err) {
        process.stdout.write(` ✗\n`);
        errors.push(`[${i + 1}] ${err.message}`);
        failed++;
        console.log(`        Error: ${err.message}`);
      }
    }

    // Disconnect
    await client.release();
    await pool.end();

    // Summary
    console.log(`\n${'='.repeat(70)}`);
    console.log('MIGRATION SUMMARY');
    console.log(`${'='.repeat(70)}`);
    console.log(`Total statements: ${statements.length}`);
    console.log(`Executed: ${executed}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Failed: ${failed}`);

    if (errors.length > 0) {
      console.log(`\nErrors:`);
      errors.slice(0, 5).forEach(err => console.log(`  ${err}`));
      if (errors.length > 5) {
        console.log(`  ... and ${errors.length - 5} more`);
      }
    }

    if (failed === 0) {
      console.log('\n✓ Migration completed successfully!');
      console.log('\nNext step: Create master user');
      console.log('Run: node scripts/setup_master_user_final.mjs\n');
    }

  } catch (error) {
    console.error('\n✗ Migration failed:', error.message);
    process.exit(1);
  }
}

// Check if database password is available
if (!process.env.SUPABASE_DB_PASSWORD) {
  console.log('⚠️  Database password not found in environment variables');
  console.log('Set SUPABASE_DB_PASSWORD in .env.local to execute migrations\n');
  console.log('Instructions:');
  console.log('1. Get database password from Supabase Dashboard');
  console.log('2. Add to .env.local: SUPABASE_DB_PASSWORD=<password>');
  console.log('3. Run this script again\n');
  process.exit(1);
} else {
  executeMigrations().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
