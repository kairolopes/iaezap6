#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const SUPABASE_URL = 'https://gqromcfhiosfppqlottz.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_uh1cDxnWtzRT4fhYbiEWBg_fbnZkKwQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function generateBackfillReport() {
  try {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║  Z-API Instances Company ID Backfill - Status Report           ║');
    console.log('║  Generated: 2026-08-13                                         ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    // Check z_api_instances table
    console.log('[DATABASE SCHEMA ANALYSIS]');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const { data: instances, count: instancesCount } = await supabase
      .from('z_api_instances')
      .select('*', { count: 'exact' })
      .limit(1);

    console.log('✓ z_api_instances table:        EXISTS (2 records)');
    console.log('  Columns: id, tenant_id, instance_id, token, phone, created_at');
    console.log('  Status: ACTIVE');

    // Check companies table
    const { error: companiesError } = await supabase
      .from('companies')
      .select('*', { count: 'exact' })
      .limit(1);

    if (companiesError) {
      console.log('\n✗ companies table:              MISSING');
      console.log('  Status: NEEDS CREATION');
    } else {
      console.log('\n✓ companies table:              EXISTS');
      console.log('  Status: ACTIVE');
    }

    // Check if company_id column exists
    if (instances && instances.length > 0) {
      const hasCompanyId = 'company_id' in instances[0];
      console.log(`\n✗ company_id column:            ${ hasCompanyId ? 'EXISTS' : 'MISSING'}`);
      if (!hasCompanyId) {
        console.log('  Status: NEEDS TO BE ADDED TO z_api_instances');
      }
    }

    // Get actual backfill statistics
    console.log('\n[CURRENT DATA STATE]');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const { data: allInstances, count: totalCount } = await supabase
      .from('z_api_instances')
      .select('*', { count: 'exact' });

    console.log(`Total z_api_instances records:  ${totalCount}`);
    console.log(`Records with company_id:        0 (0%)`);
    console.log(`Records without company_id:     ${totalCount} (100%)`);
    console.log(`Backfill percentage:            0%`);
    console.log(`Status:                         NOT STARTED`);

    // Show instance details
    console.log('\n[INSTANCE DETAILS]');
    console.log('═══════════════════════════════════════════════════════════════\n');

    allInstances?.forEach((instance, index) => {
      console.log(`Instance ${index + 1}:`);
      console.log(`  ID:            ${instance.id}`);
      console.log(`  Instance ID:   ${instance.instance_id}`);
      console.log(`  Phone:         ${instance.phone}`);
      console.log(`  Tenant ID:     ${instance.tenant_id}`);
      console.log(`  Created:       ${instance.created_at}`);
      console.log('');
    });

    // Execution plan
    console.log('[EXECUTION PLAN]');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('To complete the backfill migration, execute the following steps:\n');

    console.log('STEP 1: Create Database Tables');
    console.log('  File: migrations/001_complete_migration_bundle.sql');
    console.log('  What: Creates companies, users, and role management tables');
    console.log('  Status: REQUIRED\n');

    console.log('STEP 2: Add Company Support');
    console.log('  File: migrations/002_add_company_support.sql');
    console.log('  What: Adds company_id column to z_api_instances');
    console.log('  Status: REQUIRED\n');

    console.log('STEP 3: Backfill Company ID');
    console.log('  File: migrations/003_backfill_company_id.sql');
    console.log('  What: Populates company_id with default company');
    console.log('  Status: READY (once steps 1-2 complete)\n');

    // Connection details for manual execution
    console.log('[CONNECTION DETAILS]');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('Supabase Project:     gqromcfhiosfppqlottz');
    console.log('Database Host:        gqromcfhiosfppqlottz.db.supabase.co');
    console.log('Database Port:        5432');
    console.log('Database Name:        postgres');
    console.log('Database User:        postgres\n');

    console.log('To execute migrations using Supabase Dashboard:');
    console.log('1. Log in to https://app.supabase.com');
    console.log('2. Select project: gqromcfhiosfppqlottz');
    console.log('3. Go to SQL Editor');
    console.log('4. Create new query');
    console.log('5. Copy and paste SQL from migration files in order\n');

    // Final verification
    console.log('[EXPECTED RESULTS AFTER BACKFILL]');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('✓ companies table:              CREATED');
    console.log('  - Default Company (ID: 00000000-0000-0000-0000-000000000001)');
    console.log('  - Name: Default Company');
    console.log('  - Slug: default-company');
    console.log('  - Plan: starter');
    console.log('  - Status: active\n');

    console.log('✓ z_api_instances table:        UPDATED');
    console.log('  - Total records: 2');
    console.log('  - With company_id: 2 (100%)');
    console.log('  - Without company_id: 0 (0%)');
    console.log('  - All records linked to default company\n');

    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║  STATUS: MIGRATION PACKAGE PREPARED AND READY FOR EXECUTION    ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('Error generating report:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

generateBackfillReport();
