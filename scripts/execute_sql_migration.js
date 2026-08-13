#!/usr/bin/env node

/**
 * SQL Migration Executor
 * Executes SQL files against Supabase using psql
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Configuration
const SUPABASE_HOST = 'gqromcfhiosfppqlottz.db.supabase.co';
const SUPABASE_PORT = 5432;
const SUPABASE_USER = 'postgres';
const SUPABASE_PASSWORD = process.env.SUPABASE_PASSWORD || 'postgres';
const SUPABASE_DATABASE = 'postgres';

async function executeSqlFile(filePath) {
  return new Promise((resolve, reject) => {
    // Read the migration file
    let sql = fs.readFileSync(filePath, 'utf-8');

    // Remove \echo lines as they're not valid psql commands in this context
    sql = sql
      .split('\n')
      .filter(line => !line.trim().startsWith('\\echo'))
      .join('\n');

    console.log(`\nReading migration file: ${filePath}`);
    console.log(`File size: ${sql.length} bytes`);

    // Create psql process
    const psql = spawn('psql', [
      `-h`, SUPABASE_HOST,
      `-p`, SUPABASE_PORT.toString(),
      `-U`, SUPABASE_USER,
      `-d`, SUPABASE_DATABASE,
      `-f`, filePath,
      `--set=sslmode=require`,
    ], {
      env: {
        ...process.env,
        PGPASSWORD: SUPABASE_PASSWORD,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let output = '';
    let errorOutput = '';

    psql.stdout.on('data', (data) => {
      output += data.toString();
      process.stdout.write(data.toString());
    });

    psql.stderr.on('data', (data) => {
      errorOutput += data.toString();
      process.stderr.write(data.toString());
    });

    psql.on('close', (code) => {
      if (code === 0) {
        console.log('\n✓ Migration executed successfully');
        resolve({ success: true, output, error: '' });
      } else {
        console.error(`\n❌ Migration failed with exit code ${code}`);
        reject(new Error(`Migration failed: ${errorOutput}`));
      }
    });

    psql.on('error', (error) => {
      console.error('❌ Failed to execute psql:', error.message);
      reject(error);
    });
  });
}

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('SQL MIGRATION EXECUTOR');
  console.log('='.repeat(80));
  console.log(`\nTarget: ${SUPABASE_HOST}:${SUPABASE_PORT}/${SUPABASE_DATABASE}`);
  console.log(`User: ${SUPABASE_USER}`);

  try {
    // Check if psql is available
    const { spawnSync } = require('child_process');
    const result = spawnSync('psql', ['--version']);
    if (result.error) {
      console.error('\n❌ psql not found. Please install PostgreSQL client tools.');
      console.error('   On Windows: https://www.postgresql.org/download/windows/');
      console.error('   On macOS: brew install postgresql');
      console.error('   On Linux: sudo apt-get install postgresql-client');
      process.exit(1);
    }

    console.log('\n✓ psql is available');

    // Execute migrations
    const migrations = [
      '../migrations/002_add_company_support.sql',
      '../migrations/003_backfill_company_id.sql',
    ];

    for (const migration of migrations) {
      const migrationPath = path.join(__dirname, migration);
      if (fs.existsSync(migrationPath)) {
        console.log(`\n${'-'.repeat(80)}`);
        console.log(`Executing: ${migration}`);
        console.log('-'.repeat(80));

        try {
          await executeSqlFile(migrationPath);
        } catch (error) {
          console.error(`\nError executing ${migration}:`, error.message);
          // Continue to next migration if this fails
        }

        // Small delay between migrations
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        console.log(`⚠ Migration file not found: ${migrationPath}`);
      }
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log('MIGRATION EXECUTION COMPLETE');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

main();
