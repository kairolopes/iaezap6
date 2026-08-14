#!/usr/bin/env node

const SUPABASE_URL = 'https://gqromcfhiosfppqlottz.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_uh1cDxnWtzRT4fhYbiEWBg_fbnZkKwQ';

async function executeSQL(sql) {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({ sql }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('API Error:', error);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Fetch error:', error);
    return null;
  }
}

async function createMasterCompanyViaAPI() {
  console.log('\n' + '='.repeat(80));
  console.log('MASTER COMPANY CREATION VIA SUPABASE REST API');
  console.log('='.repeat(80) + '\n');

  try {
    // Step 1: Check if companies table exists by trying to query it
    console.log('Step 1: Checking database connectivity...\n');

    const checkTableSQL = `
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'companies'
      ) as table_exists;
    `;

    const tableCheckResult = await executeSQL(checkTableSQL);
    console.log('Table check result:', tableCheckResult);

    if (!tableCheckResult) {
      console.log('Note: Could not verify table via RPC. Attempting direct insert...\n');
    }

    // Step 2: Execute the INSERT statement
    console.log('Step 2: Creating master company...\n');

    const insertSQL = `
      INSERT INTO companies (id, name, slug, cnpj, plan, status, owner_id, created_at)
      VALUES ('00000000-0000-0000-0000-000000000001', 'Master Company', 'master', '00.000.000/0000-00', 'enterprise', 'active', '00000000-0000-0000-0000-000000000002', NOW())
      ON CONFLICT (slug) DO NOTHING;
    `;

    const insertResult = await executeSQL(insertSQL);
    console.log('Insert result:', insertResult);

    // Step 3: Verify with SELECT
    console.log('\nStep 3: Verifying master company...\n');

    const selectSQL = `
      SELECT id, name, slug, plan FROM companies WHERE slug='master';
    `;

    const selectResult = await executeSQL(selectSQL);
    console.log('Select result:', selectResult);

    if (selectResult && selectResult.length > 0) {
      console.log('\n✓ Company verification successful!');
      console.log('\nResult:');
      console.table(selectResult);
    } else {
      console.log('\n✗ Company not found in verification query');
    }

    console.log('\n' + '='.repeat(80));
    console.log('✓ PROCESS COMPLETED');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('\n' + '='.repeat(80));
    console.error('✗ ERROR');
    console.error('='.repeat(80));
    console.error(error);
    process.exit(1);
  }
}

await createMasterCompanyViaAPI();
