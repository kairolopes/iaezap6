import { Client } from 'pg';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Supabase connection details
const SUPABASE_HOST = 'gqromcfhiosfppqlottz.db.supabase.co';
const SUPABASE_PORT = 5432;
const SUPABASE_DB = 'postgres';
const SUPABASE_USER = 'postgres';

async function backfillCompanyId() {
  const client = new Client({
    host: SUPABASE_HOST,
    port: SUPABASE_PORT,
    database: SUPABASE_DB,
    user: SUPABASE_USER,
    password: 'postgres',
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('========================================');
    console.log('BACKFILL COMPANY_ID MIGRATION');
    console.log('========================================\n');

    console.log('Attempting to connect to Supabase PostgreSQL...');
    console.log(`Host: ${SUPABASE_HOST}`);
    console.log(`Port: ${SUPABASE_PORT}`);
    console.log(`Database: ${SUPABASE_DB}`);
    console.log(`User: ${SUPABASE_USER}\n`);

    await client.connect();
    console.log('✓ Connected successfully!\n');

    // Get initial state
    console.log('Getting initial state...\n');
    const beforeQuery = `
      SELECT
        COUNT(*) as total_instances,
        COUNT(CASE WHEN company_id IS NOT NULL THEN 1 END) as with_company,
        COUNT(CASE WHEN company_id IS NULL THEN 1 END) as without_company
      FROM z_api_instances;
    `;

    const beforeResult = await client.query(beforeQuery);
    const before = beforeResult.rows[0];

    console.log('Initial State:');
    console.log(`  Total instances: ${before.total_instances}`);
    console.log(`  With company_id: ${before.with_company}`);
    console.log(`  Without company_id: ${before.without_company}`);
    if (before.total_instances > 0) {
      console.log(`  Percentage with company: ${(before.with_company / before.total_instances * 100).toFixed(2)}%\n`);
    }

    // Read and execute the migration
    const migrationPath = resolve('./migrations/003_backfill_company_id.sql');
    console.log(`Reading migration file: ${migrationPath}\n`);

    let sqlContent = readFileSync(migrationPath, 'utf-8');

    // Remove comment-only lines but keep the SQL
    sqlContent = sqlContent
      .split('\n')
      .filter(line => !line.trim().startsWith('--') || line.trim() === '--')
      .join('\n');

    console.log('Executing migration...\n');

    try {
      const result = await client.query(sqlContent);
      console.log('✓ Migration executed successfully!\n');
    } catch (error) {
      console.error('Error executing SQL:');
      console.error(`Message: ${error.message}`);
      if (error.position) {
        console.error(`Position: ${error.position}`);
        const position = parseInt(error.position);
        const preview = sqlContent.substring(
          Math.max(0, position - 50),
          Math.min(sqlContent.length, position + 50)
        );
        console.error(`Context: ${preview.replace(/\n/g, ' ')}`);
      }
      throw error;
    }

    // Get verification results
    console.log('========================================');
    console.log('VERIFICATION RESULTS');
    console.log('========================================\n');

    const afterQuery = `
      SELECT
        COUNT(*) as total_instances,
        COUNT(CASE WHEN company_id IS NOT NULL THEN 1 END) as with_company,
        COUNT(CASE WHEN company_id IS NULL THEN 1 END) as without_company
      FROM z_api_instances;
    `;

    const afterResult = await client.query(afterQuery);
    const after = afterResult.rows[0];

    console.log('Final State:');
    console.log(`  Total instances: ${after.total_instances}`);
    console.log(`  With company_id: ${after.with_company}`);
    console.log(`  Without company_id: ${after.without_company}`);

    if (after.total_instances > 0) {
      const percentageBackfilled = (after.with_company / after.total_instances * 100).toFixed(2);
      console.log(`  Percentage with company: ${percentageBackfilled}%\n`);

      console.log('Backfill Summary:');
      console.log(`  Records updated: ${after.with_company - before.with_company}`);
      console.log(`  Percentage backfilled: ${percentageBackfilled}%\n`);
    }

    // Get breakdown by company
    console.log('Breakdown by Company:');
    const breakdownQuery = `
      SELECT
        company_id,
        COUNT(*) as instance_count
      FROM z_api_instances
      GROUP BY company_id
      ORDER BY instance_count DESC;
    `;

    const breakdownResult = await client.query(breakdownQuery);
    breakdownResult.rows.forEach(row => {
      const companyName = row.company_id === '00000000-0000-0000-0000-000000000001' ?
        'Default Company' :
        `Company ${row.company_id}`;
      console.log(`  ${companyName}: ${row.instance_count} instances`);
    });

    console.log('\n========================================');
    console.log('✓ BACKFILL COMPLETE');
    console.log('========================================\n');

  } catch (error) {
    console.error('\nFatal Error:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('\nConnection refused. Possible causes:');
      console.error('1. Supabase PostgreSQL not accessible');
      console.error('2. Incorrect credentials');
      console.error('3. Network/firewall issues');
    } else if (error.code === 'ENOTFOUND') {
      console.error('\nHost not found. Check the database URL.');
    }
    process.exit(1);
  } finally {
    try {
      await client.end();
      console.log('Database connection closed.');
    } catch (err) {
      // ignore
    }
  }
}

// Run
backfillCompanyId().catch(error => {
  console.error('Backfill failed:', error);
  process.exit(1);
});
