import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gqromcfhiosfppqlottz.supabase.co',
  'sb_secret_uh1cDxnWtzRT4fhYbiEWBg_fbnZkKwQ',
  {
    auth: { autoRefreshToken: false, persistSession: false }
  }
);

console.log('Checking available tables in Supabase...\n');

// Try querying common tables
const tablesToCheck = [
  'companies',
  'users',
  'z_api_instances',
  'conversations',
  'messages',
  'organizations',
  'teams'
];

for (const table of tablesToCheck) {
  try {
    const { data, error } = await supabase
      .from(table)
      .select('count', { count: 'exact' })
      .limit(1);

    if (error && error.code === 'PGRST205') {
      console.log(`❌ ${table}: Table does not exist`);
    } else if (error) {
      console.log(`⚠️  ${table}: Error - ${error.message}`);
    } else {
      console.log(`✓ ${table}: EXISTS`);
    }
  } catch (err) {
    console.log(`⚠️  ${table}: Exception - ${err.message}`);
  }
}

console.log('\n' + '='.repeat(50));
console.log('To create the companies table, you need to:');
console.log('1. Use Supabase SQL Editor (web dashboard)');
console.log('2. Or use supabase CLI: supabase db push');
console.log('3. Or set up database migrations in your project');
console.log('='.repeat(50));
