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

async function createMasterCompany() {
  console.log('\n' + '='.repeat(80));
  console.log('IAeZap Master Company Creation - Supabase Client');
  console.log('='.repeat(80) + '\n');

  try {
    console.log('Step 1: Checking if companies table exists...\n');

    // Try to query the companies table to see if it exists
    const { data: testData, error: testError } = await supabase
      .from('companies')
      .select('count')
      .limit(1);

    if (testError && testError.code === 'PGRST116') {
      console.log('✗ Companies table not found.');
      console.log('   Please run migrations first: npm run migration:execute\n');
      process.exit(1);
    } else if (testError) {
      console.log('Warning: Could not fully verify table, attempting to proceed...');
      console.log(`Error: ${testError.message}\n`);
    } else {
      console.log('✓ Companies table exists!\n');
    }

    // Step 2: Check if master company already exists
    console.log('Step 2: Checking for existing master company...\n');

    const { data: existing, error: existingError } = await supabase
      .from('companies')
      .select('id, name, slug, plan')
      .eq('slug', 'master')
      .single();

    if (existing) {
      console.log('✓ Master company already exists:');
      console.log(`  ID:   ${existing.id}`);
      console.log(`  Name: ${existing.name}`);
      console.log(`  Slug: ${existing.slug}`);
      console.log(`  Plan: ${existing.plan}`);
    } else if (existingError && existingError.code !== 'PGRST116') {
      // No row found is expected
      console.log('No existing master company found. Creating new one...\n');
    }

    // Step 3: Create or verify master company
    console.log('Step 3: Creating/upserting master company...\n');

    const { data: result, error: insertError } = await supabase
      .from('companies')
      .upsert(
        {
          id: '00000000-0000-0000-0000-000000000001',
          name: 'Master Company',
          slug: 'master',
          cnpj: '00.000.000/0000-00',
          plan: 'enterprise',
          status: 'active',
          owner_id: '00000000-0000-0000-0000-000000000002',
        },
        { onConflict: 'slug', ignoreDuplicates: false }
      )
      .select('id, name, slug, plan');

    if (insertError) {
      console.error('✗ Error creating master company:');
      console.error(`  Code: ${insertError.code}`);
      console.error(`  Message: ${insertError.message}`);
      if (insertError.details) {
        console.error(`  Details: ${insertError.details}`);
      }
      // Continue to verification anyway
    } else if (result && result.length > 0) {
      console.log('✓ Master company created/updated:');
      console.log(`  ID:   ${result[0].id}`);
      console.log(`  Name: ${result[0].name}`);
      console.log(`  Slug: ${result[0].slug}`);
      console.log(`  Plan: ${result[0].plan}`);
    }

    // Step 4: Verify with SELECT
    console.log('\nStep 4: Final verification...\n');

    const { data: verify, error: verifyError } = await supabase
      .from('companies')
      .select('id, name, slug, plan')
      .eq('slug', 'master')
      .single();

    if (verifyError) {
      console.error('✗ Verification failed:');
      console.error(`  ${verifyError.message}`);
      process.exit(1);
    }

    if (verify) {
      console.log('✓ VERIFICATION SUCCESSFUL!\n');
      console.log('Query: SELECT id, name, slug, plan FROM companies WHERE slug=\'master\';');
      console.log('\nResult:');
      console.log(`  ID:   ${verify.id}`);
      console.log(`  Name: ${verify.name}`);
      console.log(`  Slug: ${verify.slug}`);
      console.log(`  Plan: ${verify.plan}`);
    } else {
      console.log('✗ Master company not found after creation!');
      process.exit(1);
    }

    console.log('\n' + '='.repeat(80));
    console.log('✓ MASTER COMPANY SETUP COMPLETE');
    console.log('='.repeat(80));
    console.log('Report: Company created successfully.');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('\n' + '='.repeat(80));
    console.error('✗ UNEXPECTED ERROR');
    console.error('='.repeat(80));
    console.error(error);
    console.error('='.repeat(80) + '\n');
    process.exit(1);
  }
}

await createMasterCompany();
