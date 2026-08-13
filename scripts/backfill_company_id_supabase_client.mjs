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

async function backfillCompanyId() {
  try {
    console.log('========================================');
    console.log('BACKFILL COMPANY_ID MIGRATION');
    console.log('========================================\n');

    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    console.log('Connecting to Supabase...');
    console.log(`URL: ${SUPABASE_URL}\n`);

    // Get initial state
    console.log('Getting initial state...\n');

    // Check current state of z_api_instances
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
      .select('id')
      .eq('id', DEFAULT_COMPANY_ID)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      throw new Error(`Failed to check for existing company: ${checkError.message}`);
    }

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

      console.log(`✓ Default company created with ID: ${DEFAULT_COMPANY_ID}\n`);
    } else {
      console.log(`✓ Default company already exists with ID: ${DEFAULT_COMPANY_ID}\n`);
    }

    // Step 2: Update z_api_instances with NULL company_id
    console.log('Step 2: Updating z_api_instances...');

    if (withoutCompany > 0) {
      // Get the IDs of instances without company_id
      const { data: nullInstances, error: queryError } = await supabase
        .from('z_api_instances')
        .select('id')
        .is('company_id', null);

      if (queryError) {
        throw new Error(`Failed to query instances without company: ${queryError.message}`);
      }

      if (nullInstances && nullInstances.length > 0) {
        // Update in batches if needed
        const instanceIds = nullInstances.map(i => i.id);

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

        console.log(`✓ Updated ${withoutCompany} instances\n`);
      }
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
      }
    }

    console.log('\n========================================');
    console.log('✓ BACKFILL COMPLETE');
    console.log('========================================\n');

    // Verify expected state
    if (finalWithCompany === 2 && finalWithoutCompany === 0) {
      console.log('✓ Verification passed: All 2 instances have company_id assigned');
    } else {
      console.log(`⚠️  Note: Expected 2 instances, got ${finalWithCompany} with company_id`);
    }

  } catch (error) {
    console.error('\n========================================');
    console.error('Fatal Error:', error.message);
    console.error('========================================\n');
    process.exit(1);
  }
}

// Run
backfillCompanyId().catch(error => {
  console.error('Backfill failed:', error);
  process.exit(1);
});
