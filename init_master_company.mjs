#!/usr/bin/env node

/**
 * Master Company Initialization Script
 * This script sets up the master company in Supabase
 *
 * It handles three scenarios:
 * 1. Companies table exists: Query for master company
 * 2. Companies table doesn't exist: Create it and insert master company
 * 3. Fallback: Use existing tenant_id from z_api_instances
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';

const supabase = createClient(
  'https://gqromcfhiosfppqlottz.supabase.co',
  'sb_secret_uh1cDxnWtzRT4fhYbiEWBg_fbnZkKwQ',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function initMasterCompany() {
  console.log('='.repeat(70));
  console.log('Master Company Initialization');
  console.log('='.repeat(70));

  try {
    // Step 1: Check if companies table exists
    console.log('\nStep 1: Checking if companies table exists...');
    const { data: testQuery, error: checkError } = await supabase
      .from('companies')
      .select('id')
      .limit(1);

    const tableExists = !checkError || checkError.code !== 'PGRST205';

    if (!tableExists) {
      console.log('❌ Companies table does not exist');
      console.log('\nStep 2: Creating companies table...');
      console.log('Note: PostgREST API cannot execute DDL statements.');
      console.log('');
      console.log('You have two options:');
      console.log('');
      console.log('OPTION A: Use Supabase Dashboard SQL Editor');
      console.log('  1. Go to https://supabase.com/dashboard');
      console.log('  2. Navigate to your project');
      console.log('  3. Go to SQL Editor');
      console.log('  4. Create a new query and paste the SQL from setup_master_company.sql');
      console.log('  5. Execute the query');
      console.log('');
      console.log('OPTION B: Use Supabase CLI');
      console.log('  1. Create a migration: supabase migration new create_companies_table');
      console.log('  2. Copy SQL from setup_master_company.sql to the migration file');
      console.log('  3. Push migrations: supabase db push --linked');
      console.log('');

      // Provide fallback using existing tenant_id
      console.log('FALLBACK: Using existing tenant ID...');
      const { data: instances } = await supabase
        .from('z_api_instances')
        .select('tenant_id')
        .limit(1)
        .single();

      if (instances?.tenant_id) {
        console.log('Found existing tenant ID (use as master company ID):');
        console.log(`  Tenant ID: ${instances.tenant_id}`);
        return instances.tenant_id;
      }
    } else {
      console.log('✓ Companies table exists');

      // Step 2: Query for existing master company
      console.log('\nStep 2: Checking for existing master company...');
      const { data: master, error: queryError } = await supabase
        .from('companies')
        .select('id, name, slug')
        .or("slug.eq.master,slug.eq.default-company")
        .maybeSingle();

      if (master) {
        console.log('✓ Found existing master company');
        console.log(`  ID: ${master.id}`);
        console.log(`  Name: ${master.name}`);
        console.log(`  Slug: ${master.slug}`);
        return master.id;
      }

      // Step 3: Create master company
      console.log('Master company not found. Creating...');
      const { data: newMaster, error: insertError } = await supabase
        .from('companies')
        .insert([{
          name: 'Master Company',
          slug: 'master',
          cnpj: '00.000.000/0000-00',
          plan: 'enterprise',
          status: 'active',
          owner_id: null,
          metadata: { type: 'master', system_managed: true }
        }])
        .select('id')
        .single();

      if (insertError) {
        throw insertError;
      }

      console.log('✓ Master company created successfully');
      console.log(`  ID: ${newMaster.id}`);
      return newMaster.id;
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the initialization
const companyId = await initMasterCompany();

console.log('\n' + '='.repeat(70));
console.log('RESULT');
console.log('='.repeat(70));
console.log(`Master Company/Tenant ID: ${companyId}`);
console.log('='.repeat(70));

// Output in JSON format for programmatic use
console.log('\nJSON Output:');
console.log(JSON.stringify({ company_id: companyId }));
