#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gqromcfhiosfppqlottz.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_uh1cDxnWtzRT4fhYbiEWBg_fbnZkKwQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function executeBackfill() {
  try {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  IAeZap Z-API Instances Company ID Backfill (Supabase Client)');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Step 1: Check if companies table exists
    console.log('[Step 0] Verifying database schema...');
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*', { count: 'exact', head: true })
        .limit(1);

      if (error && error.code === 'PGRST116') {
        console.log('[Schema] Companies table does not exist - will be created');
      } else if (error) {
        console.log(`[Schema] Error checking companies table: ${error.message}`);
      } else {
        console.log('[Schema] Companies table exists');
      }
    } catch (err) {
      console.log(`[Schema] Error: ${err.message}`);
    }

    // Check z_api_instances table
    console.log('[Schema] Checking z_api_instances table...');
    const { data: instances, error: instancesError, count: instancesCount } = await supabase
      .from('z_api_instances')
      .select('*', { count: 'exact', head: true })
      .limit(1);

    console.log(`[Schema] z_api_instances table exists (${instancesCount} total records)`);

    // Step 1: Create/verify default company
    console.log('\n[Step 1] Creating/verifying default company...');
    const { data: companyData, error: companyError } = await supabase
      .from('companies')
      .upsert(
        {
          id: '00000000-0000-0000-0000-000000000001',
          name: 'Default Company',
          slug: 'default-company',
          plan: 'starter',
          status: 'active',
          owner_id: '00000000-0000-0000-0000-000000000000',
        },
        { onConflict: 'id' }
      )
      .select();

    if (companyError) {
      console.error('[Error] Failed to create company:', companyError.message);
      // If table doesn't exist, we might need to try a different approach
      if (companyError.code === 'PGRST116') {
        console.log('[Info] Companies table needs to be created first');
      }
      throw companyError;
    }

    console.log('[Success] Default company created or verified');

    // Step 2: Get before count
    console.log('\n[Step 2a] Counting records before backfill...');
    const { data: beforeData, error: beforeError, count: beforeCount } = await supabase
      .from('z_api_instances')
      .select('*', { count: 'exact', head: false });

    if (beforeError) {
      console.error('[Error] Failed to fetch before state:', beforeError.message);
      throw beforeError;
    }

    const withCompanyBefore = beforeData?.filter(r => r.company_id !== null)?.length || 0;
    const withoutCompanyBefore = (beforeCount || 0) - withCompanyBefore;

    console.log(`[Before] Total: ${beforeCount || 0}`);
    console.log(`         With company_id: ${withCompanyBefore}`);
    console.log(`         Without company_id: ${withoutCompanyBefore}`);

    // Step 2b: Backfill company_id
    console.log('\n[Step 2b] Backfilling company_id for z_api_instances...');

    // We need to fetch all records where company_id is NULL and update them
    const { data: recordsToUpdate, error: fetchError } = await supabase
      .from('z_api_instances')
      .select('id')
      .is('company_id', null);

    if (fetchError) {
      console.error('[Error] Failed to fetch records to update:', fetchError.message);
      throw fetchError;
    }

    const recordCount = recordsToUpdate?.length || 0;
    console.log(`[Found] ${recordCount} records to backfill`);

    if (recordCount > 0) {
      const { error: updateError, data: updateData } = await supabase
        .from('z_api_instances')
        .update({
          company_id: '00000000-0000-0000-0000-000000000001',
          updated_at: new Date().toISOString(),
        })
        .is('company_id', null);

      if (updateError) {
        console.error('[Error] Failed to backfill:', updateError.message);
        throw updateError;
      }

      console.log(`[Success] Updated ${recordCount} record(s)`);
    } else {
      console.log('[Info] No records need backfilling');
    }

    // Step 3: Verify the backfill
    console.log('\n[Step 3] Verifying backfill...');
    const { data: verifyData, error: verifyError, count: verifyCount } = await supabase
      .from('z_api_instances')
      .select('*', { count: 'exact', head: false });

    if (verifyError) {
      console.error('[Error] Failed to verify:', verifyError.message);
      throw verifyError;
    }

    const withCompanyAfter = verifyData?.filter(r => r.company_id !== null)?.length || 0;
    const withoutCompanyAfter = (verifyCount || 0) - withCompanyAfter;
    const backfillPercentage = verifyCount && verifyCount > 0
      ? ((withCompanyAfter / verifyCount) * 100).toFixed(2)
      : '0.00';

    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║  VERIFICATION RESULTS                                          ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log(`  Total z_api_instances:        ${verifyCount || 0}`);
    console.log(`  With company_id:              ${withCompanyAfter}`);
    console.log(`  Without company_id:           ${withoutCompanyAfter}`);
    console.log(`  Backfill percentage:          ${backfillPercentage}%`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Show breakdown by company
    console.log('[Breakdown by company]');
    const companyBreakdown = {};
    verifyData?.forEach(record => {
      const companyId = record.company_id || 'NULL';
      companyBreakdown[companyId] = (companyBreakdown[companyId] || 0) + 1;
    });

    Object.entries(companyBreakdown).forEach(([companyId, count]) => {
      console.log(`  ${companyId}: ${count} instance(s)`);
    });

    // Summary
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║  MIGRATION SUMMARY                                             ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    const isSuccess = withoutCompanyAfter === 0;
    console.log(`  Status:                       ${isSuccess ? '✓ SUCCESS' : '⚠ PARTIAL'}`);
    console.log(`  Records backfilled:           ${recordCount}`);
    console.log(`  Backfill percentage:          ${backfillPercentage}%`);
    console.log(`  Remaining unmapped:           ${withoutCompanyAfter}`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log(`[Exit] Process completed with status: ${isSuccess ? 'SUCCESS' : 'FAILURE'}`);
    process.exit(isSuccess ? 0 : 1);

  } catch (error) {
    console.error('\n╔════════════════════════════════════════════════════════════════╗');
    console.error('║  FATAL ERROR                                                   ║');
    console.error('╚════════════════════════════════════════════════════════════════╝');
    console.error(`  ${error.message}`);
    if (error.details) {
      console.error(`  Details: ${error.details}`);
    }
    console.error('═══════════════════════════════════════════════════════════════\n');
    process.exit(1);
  }
}

executeBackfill();
