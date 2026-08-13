import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

async function checkSchemaAndBackfill() {
  try {
    console.log('========================================');
    console.log('SCHEMA CHECK AND BACKFILL MIGRATION');
    console.log('========================================\n');

    // Create Supabase client with rpc capability
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    console.log('Connecting to Supabase...');
    console.log(`URL: ${SUPABASE_URL}\n`);

    // First, let's check the schema by trying to query information_schema
    console.log('Checking database schema...\n');

    // We'll check schema by attempting table queries

    // Check if companies table exists and has data
    console.log('Checking companies table...');
    const { data: companies, error: companiesError, count: companiesCount } = await supabase
      .from('companies')
      .select('id, name, slug', { count: 'exact' });

    if (companiesError) {
      if (companiesError.message.includes('does not exist')) {
        console.log('✗ Companies table does not exist');
        console.log('  Status: Migration 002 not applied\n');
      } else {
        throw companiesError;
      }
    } else {
      console.log(`✓ Companies table exists with ${companiesCount} records\n`);
      if (companies && companies.length > 0) {
        console.log('Existing companies:');
        companies.forEach(c => {
          console.log(`  - ${c.name} (${c.slug})`);
        });
        console.log();
      }
    }

    // Check z_api_instances table
    console.log('Checking z_api_instances table...');
    let hasCompanyIdColumn = true;
    const { data: instances, error: instancesError, count: instancesCount } = await supabase
      .from('z_api_instances')
      .select('*', { count: 'exact', head: true });

    if (instancesError) {
      if (instancesError.message.includes('does not exist')) {
        console.log('✗ z_api_instances table does not exist\n');
      } else if (instancesError.message.includes('company_id')) {
        console.log('✓ z_api_instances table exists but missing company_id column');
        console.log('  Status: Need to apply Migration 002\n');
        hasCompanyIdColumn = false;
      } else {
        throw instancesError;
      }
    } else {
      console.log(`✓ z_api_instances table exists with ${instancesCount} records\n`);
    }

    if (!hasCompanyIdColumn) {
      console.log('========================================');
      console.log('APPLYING MIGRATION 002 (Add Company Support)');
      console.log('========================================\n');

      const migration002Path = resolve('./migrations/002_add_company_support.sql');
      const migration002Content = readFileSync(migration002Path, 'utf-8');

      console.log('Note: Direct SQL execution via Supabase RPC not available.');
      console.log('Please apply Migration 002 manually using Supabase SQL Editor:');
      console.log(`  File: ${migration002Path}\n`);
      console.log('Then run this script again to apply Migration 003.\n');

      return;
    }

    // If we get here, company_id column exists, proceed with backfill
    console.log('========================================');
    console.log('APPLYING MIGRATION 003 (Backfill Company ID)');
    console.log('========================================\n');

    // Get initial state
    console.log('Getting initial state...\n');

    const { data: initialData, error: initialError, count: initialCount } = await supabase
      .from('z_api_instances')
      .select('id, company_id', { count: 'exact' });

    if (initialError) {
      throw new Error(`Failed to query z_api_instances: ${initialError.message}`);
    }

    const totalInstances = initialCount || 0;
    const withCompany = initialData ? initialData.filter(i => i.company_id !== null).length : 0;
    const withoutCompany = totalInstances - withCompany;

    console.log('Initial State:');
    console.log(`  Total instances: ${totalInstances}`);
    console.log(`  With company_id: ${withCompany}`);
    console.log(`  Without company_id: ${withoutCompany}`);
    if (totalInstances > 0) {
      console.log(`  Percentage with company: ${(withCompany / totalInstances * 100).toFixed(2)}%\n`);
    }

    const DEFAULT_COMPANY_ID = '00000000-0000-0000-0000-000000000001';

    // Step 1: Create default company
    console.log('Step 1: Creating default company...');

    const { data: existingCompany, error: checkError } = await supabase
      .from('companies')
      .select('id, name')
      .eq('id', DEFAULT_COMPANY_ID)
      .single()
      .catch(() => ({ data: null }));

    if (!existingCompany) {
      const { error: insertError } = await supabase
        .from('companies')
        .insert({
          id: DEFAULT_COMPANY_ID,
          name: 'Default Company',
          slug: 'default-company',
          plan: 'starter',
          status: 'active',
          owner_id: '00000000-0000-0000-0000-000000000000',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (insertError) {
        throw new Error(`Failed to create default company: ${insertError.message}`);
      }

      console.log(`✓ Default company created`);
      console.log(`  ID: ${DEFAULT_COMPANY_ID}`);
      console.log(`  Name: Default Company`);
      console.log(`  Slug: default-company\n`);
    } else {
      console.log(`✓ Default company already exists`);
      console.log(`  ID: ${existingCompany.id}`);
      console.log(`  Name: ${existingCompany.name}\n`);
    }

    // Step 2: Update z_api_instances with NULL company_id
    console.log('Step 2: Updating z_api_instances...');

    if (withoutCompany > 0) {
      const { error: updateError } = await supabase
        .from('z_api_instances')
        .update({
          company_id: DEFAULT_COMPANY_ID,
          updated_at: new Date().toISOString()
        })
        .is('company_id', null);

      if (updateError) {
        throw new Error(`Failed to update instances: ${updateError.message}`);
      }

      console.log(`✓ Updated ${withoutCompany} instances with default company_id\n`);
    } else {
      console.log('✓ No instances to update (all already have company_id)\n');
    }

    // Step 3: Verification
    console.log('========================================');
    console.log('VERIFICATION RESULTS');
    console.log('========================================\n');

    const { data: finalData, error: finalError, count: finalCount } = await supabase
      .from('z_api_instances')
      .select('id, company_id', { count: 'exact' });

    if (finalError) {
      throw new Error(`Failed to verify: ${finalError.message}`);
    }

    const finalTotal = finalCount || 0;
    const finalWithCompany = finalData ? finalData.filter(i => i.company_id !== null).length : 0;
    const finalWithoutCompany = finalTotal - finalWithCompany;

    console.log('Final State:');
    console.log(`  Total instances: ${finalTotal}`);
    console.log(`  With company_id: ${finalWithCompany}`);
    console.log(`  Without company_id: ${finalWithoutCompany}`);

    if (finalTotal > 0) {
      const percentageBackfilled = (finalWithCompany / finalTotal * 100).toFixed(2);
      console.log(`  Percentage with company: ${percentageBackfilled}%\n`);

      console.log('Backfill Summary:');
      console.log(`  Records before: ${withCompany} with company_id`);
      console.log(`  Records after: ${finalWithCompany} with company_id`);
      console.log(`  Records updated: ${finalWithCompany - withCompany}`);
      console.log(`  Percentage backfilled: ${percentageBackfilled}%\n`);

      // Show breakdown by company
      const { data: breakdown, error: breakdownError } = await supabase
        .from('z_api_instances')
        .select('company_id');

      if (!breakdownError && breakdown) {
        const groupedByCompany = {};
        breakdown.forEach(item => {
          const companyId = item.company_id || 'NULL';
          groupedByCompany[companyId] = (groupedByCompany[companyId] || 0) + 1;
        });

        console.log('Breakdown by Company:');
        Object.entries(groupedByCompany)
          .sort((a, b) => b[1] - a[1])
          .forEach(([companyId, count]) => {
            const companyName = companyId === DEFAULT_COMPANY_ID ?
              'Default Company' :
              companyId === 'NULL' ?
              'No Company (NULL)' :
              `Company ${companyId}`;
            console.log(`  ${companyName}: ${count} instances`);
          });
        console.log();
      }
    }

    console.log('========================================');
    console.log('✓ BACKFILL COMPLETE');
    console.log('========================================\n');

    // Verify expected state
    if (finalWithCompany === finalTotal && finalWithoutCompany === 0) {
      console.log('✓ Verification PASSED: All instances have company_id assigned');
    } else if (finalWithoutCompany > 0) {
      console.log(`⚠️  Warning: ${finalWithoutCompany} instances still have NULL company_id`);
    }

  } catch (error) {
    console.error('\n========================================');
    console.error('Fatal Error:', error.message);
    console.error('========================================\n');
    process.exit(1);
  }
}

// Run
checkSchemaAndBackfill().catch(error => {
  console.error('Operation failed:', error);
  process.exit(1);
});
