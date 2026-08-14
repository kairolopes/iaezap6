#!/usr/bin/env node

import pkg from 'pg';
const { Client } = pkg;

// Supabase connection details - using direct connection
const client = new Client({
  host: 'gqromcfhiosfppqlottz.db.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'iaezapdb2024@secure',
  ssl: {
    rejectUnauthorized: false,
  },
});

async function executeSQL(sql, description) {
  console.log(`\n[Executing] ${description}`);
  try {
    const result = await client.query(sql);
    console.log(`[Success] ${description}`);
    if (result.rows && result.rows.length > 0) {
      console.log(`[Result] Rows: ${result.rowCount}`);
    }
    return result;
  } catch (error) {
    console.error(`[Error] ${description}`);
    console.error(`  Message: ${error.message}`);
    throw error;
  }
}

async function executeBackfill() {
  try {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  IAeZap Z-API Instances Company ID Backfill');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('\n[Connection] Connecting to Supabase PostgreSQL...');
    await client.connect();
    console.log('[Connected] Successfully connected to database\n');

    // Check if companies table exists
    console.log('[Step 0] Verifying database schema...');
    const checkTablesSQL = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('companies', 'z_api_instances')
      ORDER BY table_name;
    `;
    const tableCheck = await client.query(checkTablesSQL);
    const existingTables = tableCheck.rows.map(r => r.table_name);
    console.log(`[Tables Found] ${existingTables.length > 0 ? existingTables.join(', ') : 'None'}`);

    // If companies table doesn't exist, create it
    if (!existingTables.includes('companies')) {
      console.log('\n[Step 0a] Creating companies table...');
      const createCompaniesSQL = `
        CREATE TABLE IF NOT EXISTS companies (
          id UUID PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          slug VARCHAR(100) NOT NULL UNIQUE,
          description TEXT,
          plan VARCHAR(50) NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'professional', 'enterprise')),
          status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'suspended', 'cancelled')),
          owner_id UUID NOT NULL,
          cnpj VARCHAR(18),
          metadata JSONB DEFAULT '{}',
          settings JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          deleted_at TIMESTAMP WITH TIME ZONE
        );

        CREATE INDEX IF NOT EXISTS idx_companies_slug ON companies(slug) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS idx_companies_owner_id ON companies(owner_id);
        CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS idx_companies_plan ON companies(plan);
        CREATE INDEX IF NOT EXISTS idx_companies_created_at ON companies(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_companies_cnpj ON companies(cnpj) WHERE cnpj IS NOT NULL;
      `;
      await executeSQL(createCompaniesSQL, 'Create companies table');
    }

    // Check if company_id column exists in z_api_instances
    console.log('\n[Step 0b] Checking for company_id column...');
    const checkColumnSQL = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'z_api_instances'
      AND column_name = 'company_id';
    `;
    const columnCheck = await client.query(checkColumnSQL);

    if (columnCheck.rows.length === 0) {
      console.log('[Column Missing] Adding company_id column to z_api_instances...');
      const addColumnSQL = `
        ALTER TABLE z_api_instances
        ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

        CREATE INDEX IF NOT EXISTS idx_z_api_instances_company_id
        ON z_api_instances(company_id);

        CREATE INDEX IF NOT EXISTS idx_z_api_instances_instance_id_company
        ON z_api_instances(instance_id, company_id);
      `;
      await executeSQL(addColumnSQL, 'Add company_id column');
    } else {
      console.log('[Column Exists] company_id column already exists');
    }

    // Now execute the backfill steps

    console.log('\n[Step 1] Creating/verifying default company...');
    const createCompanySQL = `
      INSERT INTO companies (
        id,
        name,
        slug,
        plan,
        status,
        owner_id,
        cnpj,
        created_at,
        updated_at
      )
      VALUES (
        '00000000-0000-0000-0000-000000000001'::uuid,
        'Default Company',
        'default-company',
        'starter',
        'active',
        '00000000-0000-0000-0000-000000000000'::uuid,
        '00.000.000/0000-00',
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO NOTHING;
    `;
    const companyResult = await executeSQL(createCompanySQL, 'Create/verify default company');
    console.log(`[Company] Inserted: ${companyResult.rowCount} row(s)`);

    // Get count before update
    console.log('\n[Step 2a] Counting records before backfill...');
    const beforeCountSQL = `
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN company_id IS NOT NULL THEN 1 END) as with_company_id,
        COUNT(CASE WHEN company_id IS NULL THEN 1 END) as without_company_id
      FROM z_api_instances;
    `;
    const beforeCount = await client.query(beforeCountSQL);
    const beforeStats = beforeCount.rows[0];
    console.log(`[Before] Total: ${beforeStats.total}`);
    console.log(`         With company_id: ${beforeStats.with_company_id}`);
    console.log(`         Without company_id: ${beforeStats.without_company_id}`);

    console.log('\n[Step 2b] Backfilling company_id for z_api_instances...');
    const backfillSQL = `
      UPDATE z_api_instances
      SET company_id = '00000000-0000-0000-0000-000000000001'::uuid,
          updated_at = NOW()
      WHERE company_id IS NULL;
    `;
    const backfillResult = await executeSQL(backfillSQL, 'Backfill z_api_instances');
    console.log(`[Backfill] Updated: ${backfillResult.rowCount} row(s)`);

    // Verify the backfill
    console.log('\n[Step 3] Verifying backfill...');
    const verifySQL = `
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN company_id IS NOT NULL THEN 1 END) as with_company_id,
        COUNT(CASE WHEN company_id IS NULL THEN 1 END) as without_company_id,
        ROUND(100.0 * COUNT(CASE WHEN company_id IS NOT NULL THEN 1 END) /
          CASE WHEN COUNT(*) = 0 THEN 1 ELSE COUNT(*) END, 2) as percentage_with_company
      FROM z_api_instances;
    `;
    const verifyResult = await client.query(verifySQL);
    const verifyStats = verifyResult.rows[0];

    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║  VERIFICATION RESULTS                                          ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log(`  Total z_api_instances:        ${verifyStats.total}`);
    console.log(`  With company_id:              ${verifyStats.with_company_id}`);
    console.log(`  Without company_id:           ${verifyStats.without_company_id}`);
    console.log(`  Backfill percentage:          ${verifyStats.percentage_with_company}%`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Show breakdown by company
    console.log('[Breakdown by company]');
    const breakdownSQL = `
      SELECT
        COALESCE(company_id::text, 'NULL') as company_id,
        COUNT(*) as instance_count
      FROM z_api_instances
      GROUP BY company_id
      ORDER BY instance_count DESC;
    `;
    const breakdownResult = await client.query(breakdownSQL);
    breakdownResult.rows.forEach(row => {
      console.log(`  ${row.company_id}: ${row.instance_count} instance(s)`);
    });

    // Summary
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║  MIGRATION SUMMARY                                             ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    const isSuccess = parseInt(verifyStats.without_company_id) === 0;
    console.log(`  Status:                       ${isSuccess ? '✓ SUCCESS' : '⚠ PARTIAL'}`);
    console.log(`  Records backfilled:           ${backfillResult.rowCount}`);
    console.log(`  Backfill percentage:          ${verifyStats.percentage_with_company}%`);
    console.log(`  Remaining unmapped:           ${verifyStats.without_company_id}`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    await client.end();

    console.log(`[Exit] Process completed with status: ${isSuccess ? 'SUCCESS' : 'FAILURE'}`);
    process.exit(isSuccess ? 0 : 1);

  } catch (error) {
    console.error('\n╔════════════════════════════════════════════════════════════════╗');
    console.error('║  FATAL ERROR                                                   ║');
    console.error('╚════════════════════════════════════════════════════════════════╝');
    console.error(`  ${error.message}`);
    console.error('═══════════════════════════════════════════════════════════════\n');
    try {
      await client.end();
    } catch (e) {
      // Ignore close errors
    }
    process.exit(1);
  }
}

executeBackfill();
