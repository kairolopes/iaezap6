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

async function checkSchema() {
  try {
    console.log('Checking database schema...\n');

    // Check z_api_instances table
    console.log('[1] z_api_instances table:');
    const { data: instances, error: instancesError, count: instancesCount } = await supabase
      .from('z_api_instances')
      .select('*', { count: 'exact' })
      .limit(10);

    if (instancesError) {
      console.log(`  Error: ${instancesError.message}`);
    } else {
      console.log(`  ✓ Exists`);
      console.log(`  Total records: ${instancesCount}`);
      if (instances && instances.length > 0) {
        console.log(`  First record keys: ${Object.keys(instances[0]).join(', ')}`);
        console.log(`  Sample record:`, JSON.stringify(instances[0], null, 2));
      }
    }

    // Check companies table
    console.log('\n[2] companies table:');
    const { data: companies, error: companiesError, count: companiesCount } = await supabase
      .from('companies')
      .select('*', { count: 'exact' })
      .limit(10);

    if (companiesError) {
      console.log(`  Error: ${companiesError.code} - ${companiesError.message}`);
    } else {
      console.log(`  ✓ Exists`);
      console.log(`  Total records: ${companiesCount}`);
      if (companies && companies.length > 0) {
        console.log(`  Sample record:`, JSON.stringify(companies[0], null, 2));
      }
    }

    // Check for users table
    console.log('\n[3] users table:');
    const { data: users, error: usersError, count: usersCount } = await supabase
      .from('users')
      .select('*', { count: 'exact' })
      .limit(10);

    if (usersError) {
      console.log(`  Error: ${usersError.code} - ${usersError.message}`);
    } else {
      console.log(`  ✓ Exists`);
      console.log(`  Total records: ${usersCount}`);
    }

  } catch (error) {
    console.error('Fatal error:', error.message);
  }

  process.exit(0);
}

checkSchema();
