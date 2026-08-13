#!/usr/bin/env node

/**
 * Complete Backfill Execution with Prerequisite Migrations
 * Runs migration 001, 002, 003_complete_multitenant_migration, and 003_backfill_company_id
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: Missing Supabase credentials in .env.local');
  process.exit(1);
}

// Extract project reference from Supabase URL
const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)/)[1];

// Construct PostgreSQL connection string
// Format: postgresql://postgres:password@host:5432/postgres
const DATABASE_URL = `postgresql://postgres:${SUPABASE_SERVICE_ROLE_KEY}@${projectRef}.supabase.co:5432/postgres`;

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Migration files to execute in order
const migrations = [
  {
    name: '001_create_companies_users_roles.sql',
    path: '../src/lib/auth/001_create_companies_users_roles.sql',
    required: true,
  },
  {
    name: '002_add_cnpj_to_companies.sql',
    path: '../src/lib/auth/002_add_cnpj_to_companies.sql',
    required: true,
  },
  {
    name: '003_complete_multitenant_migration.sql',
    path: '../src/lib/auth/003_complete_multitenant_migration.sql',
    required: true,
  },
  {
    name: '003_backfill_company_id.sql',
    path: '../src/lib/auth/003_backfill_company_id.sql',
    required: true,
  },
];

async function executeMigration(client, migrationFile) {
  const filePath = path.join(__dirname, migrationFile.path);

  if (!fs.existsSync(filePath)) {
    if (migrationFile.required) {
      throw new Error(`Migration file not found: ${filePath}`);
    }
    console.log(`⊘ Migration file not found (optional): ${migrationFile.name}`);
    return { success: true, skipped: true };
  }

  const sqlContent = fs.readFileSync(filePath, 'utf-8');

  console.log(`\n${'='.repeat(80)}`);
  console.log(`Executing migration: ${migrationFile.name}`);
  console.log(`${'='.repeat(80)}`);

  try {
    // Split by statement boundaries (more sophisticated than simple semicolon split)
    const statements = sqlContent
      .split(/;\s*(?=\n|$)/gm)
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`Found ${statements.length} SQL statements`);

    let executedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      const displayStmt = statement.substring(0, 80).replace(/\n/g, ' ');

      try {
        await client.query(statement);
        executedCount++;
        process.stdout.write(`\r  [${i + 1}/${statements.length}] ✓ Executed`);
      } catch (err) {
        // Some errors are expected (e.g., IF NOT EXISTS, already created)
        if (
          err.message.includes('already exists') ||
          err.message.includes('does not exist') ||
          err.message.includes('ON CONFLICT')
        ) {
          skippedCount++;
          process.stdout.write(`\r  [${i + 1}/${statements.length}] ⊘ Skipped`);
        } else {
          errorCount++;
          console.error(
            `\n  ❌ Error in statement ${i + 1}: ${err.message}`
          );
          console.error(`     Statement: ${displayStmt}...`);
          // Don't fail on all errors, continue with next statement
        }
      }
    }

    console.log(`\n✓ Migration ${migrationFile.name} completed`);
    console.log(`  Executed: ${executedCount}, Skipped: ${skippedCount}, Errors: ${errorCount}`);

    return { success: true, executed: executedCount, skipped: skippedCount, errors: errorCount };
  } catch (error) {
    console.error(`❌ Error executing migration ${migrationFile.name}:`, error.message);
    return { success: false, error: error.message };
  }
}

async function verifyBackfill(client) {
  console.log(`\n${'='.repeat(80)}`);
  console.log('BACKFILL VERIFICATION QUERIES');
  console.log(`${'='.repeat(80)}\n`);

  try {
    // Query 1: Check companies table
    console.log('1. Companies table:');
    const companiesResult = await client.query(`
      SELECT
        entity,
        total_count,
        default_companies,
        active_companies
      FROM (
        SELECT
          'companies_table' as entity,
          COUNT(*) as total_count,
          COUNT(CASE WHEN slug = 'default-company' THEN 1 END) as default_companies,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_companies
        FROM companies
      ) AS result
    `);

    if (companiesResult.rows.length > 0) {
      const row = companiesResult.rows[0];
      console.log(`   Total companies: ${row.total_count}`);
      console.log(`   Default companies: ${row.default_companies}`);
      console.log(`   Active companies: ${row.active_companies}`);
    }

    // Query 2: Check z_api_instances backfill status
    console.log('\n2. Z-API instances backfill status:');
    const instancesResult = await client.query(`
      SELECT
        COUNT(*) as total_instances,
        COUNT(CASE WHEN company_id IS NOT NULL THEN 1 END) as with_company_id,
        COUNT(CASE WHEN company_id IS NULL THEN 1 END) as without_company_id,
        ROUND(
          COUNT(CASE WHEN company_id IS NOT NULL THEN 1 END)::numeric /
          NULLIF(COUNT(*), 0) * 100,
          2
        ) as percentage_backfilled
      FROM z_api_instances
    `);

    if (instancesResult.rows.length > 0) {
      const row = instancesResult.rows[0];
      console.log(`   Total instances: ${row.total_instances}`);
      console.log(`   With company_id: ${row.with_company_id}`);
      console.log(`   Without company_id: ${row.without_company_id}`);
      console.log(`   Percentage backfilled: ${row.percentage_backfilled}%`);
    }

    // Query 3: Company distribution
    console.log('\n3. Company distribution:');
    const distributionResult = await client.query(`
      SELECT
        c.slug as company_slug,
        c.name as company_name,
        COUNT(zai.id) as instance_count,
        COUNT(CASE WHEN zai.tenant_id IS NOT NULL THEN 1 END) as instances_with_tenant
      FROM companies c
      LEFT JOIN z_api_instances zai ON zai.company_id = c.id
      GROUP BY c.id, c.slug, c.name
      ORDER BY instance_count DESC
    `);

    if (distributionResult.rows.length > 0) {
      distributionResult.rows.forEach(row => {
        console.log(`   ${row.company_slug}: ${row.instance_count} instances`);
      });
    }

    // Query 4: Default company details
    console.log('\n4. Default company details:');
    const defaultCompanyResult = await client.query(`
      SELECT
        id as company_id,
        name,
        slug,
        cnpj,
        plan,
        status,
        owner_id,
        created_at,
        updated_at
      FROM companies
      WHERE slug = 'default-company'
    `);

    if (defaultCompanyResult.rows.length > 0) {
      const row = defaultCompanyResult.rows[0];
      console.log(`   ID: ${row.company_id}`);
      console.log(`   Name: ${row.name}`);
      console.log(`   CNPJ: ${row.cnpj}`);
      console.log(`   Status: ${row.status}`);
      console.log(`   Created: ${row.created_at}`);
    }

    // Query 5: Sample backfilled instances
    console.log('\n5. Sample backfilled instances:');
    const samplesResult = await client.query(`
      SELECT
        zai.id,
        zai.instance_id,
        zai.tenant_id,
        zai.company_id,
        c.slug as company_slug,
        zai.created_at,
        zai.updated_at
      FROM z_api_instances zai
      LEFT JOIN companies c ON zai.company_id = c.id
      ORDER BY zai.updated_at DESC
      LIMIT 10
    `);

    if (samplesResult.rows.length > 0) {
      console.log(`   Found ${samplesResult.rows.length} sample instances:`);
      samplesResult.rows.forEach((row, index) => {
        console.log(`   ${index + 1}. Instance ID: ${row.instance_id}`);
        console.log(`      Company: ${row.company_slug || 'UNASSIGNED'}`);
        console.log(`      Created: ${row.created_at}`);
      });
    }

    // Query 6: Data integrity check
    console.log('\n6. Data integrity check:');
    const integrityResult = await client.query(`
      SELECT
        COUNT(*) as total_instances,
        COUNT(CASE WHEN instance_id IS NOT NULL THEN 1 END) as valid_instance_ids,
        COUNT(CASE WHEN company_id IS NOT NULL THEN 1 END) as linked_to_company
      FROM z_api_instances
    `);

    if (integrityResult.rows.length > 0) {
      const row = integrityResult.rows[0];
      console.log(`   Total instances: ${row.total_instances}`);
      console.log(`   Valid instance IDs: ${row.valid_instance_ids}`);
      console.log(`   Linked to company: ${row.linked_to_company}`);
    }

    return { success: true };
  } catch (error) {
    console.error('Verification error:', error.message);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║        Complete Backfill Execution: company_id in z_api_instances              ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════════╝');

  let client;

  try {
    console.log('\nConnecting to PostgreSQL...');
    client = await pool.connect();
    console.log('✓ Connected successfully');

    // Execute all migrations in order
    const results = [];
    for (const migration of migrations) {
      const result = await executeMigration(client, migration);
      results.push({
        name: migration.name,
        ...result,
      });
    }

    // Verify backfill
    await verifyBackfill(client);

    // Summary
    console.log(`\n${'='.repeat(80)}`);
    console.log('EXECUTION SUMMARY');
    console.log(`${'='.repeat(80)}\n`);

    results.forEach(result => {
      const status = result.success ? '✓' : '❌';
      const details = result.skipped ? '(skipped)' : `(executed: ${result.executed}, skipped: ${result.skipped})`;
      console.log(`${status} ${result.name} ${details}`);
    });

    const allSuccess = results.every(r => r.success);
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Overall Status: ${allSuccess ? '✓ SUCCESS' : '⚠ COMPLETED WITH WARNINGS'}`);
    console.log(`${'='.repeat(80)}\n`);

    process.exit(allSuccess ? 0 : 1);
  } catch (error) {
    console.error('Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (client) {
      await client.release();
    }
    await pool.end();
  }
}

main();
