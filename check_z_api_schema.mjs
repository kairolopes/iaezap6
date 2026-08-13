import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gqromcfhiosfppqlottz.supabase.co',
  'sb_secret_uh1cDxnWtzRT4fhYbiEWBg_fbnZkKwQ',
  {
    auth: { autoRefreshToken: false, persistSession: false }
  }
);

console.log('Checking z_api_instances schema...\n');

try {
  const { data, error } = await supabase
    .from('z_api_instances')
    .select('*')
    .limit(1);

  if (error) {
    console.log('Error querying z_api_instances:', error);
  } else {
    console.log('z_api_instances columns:');
    if (data && data.length > 0) {
      console.log(Object.keys(data[0]));
      console.log('\nSample record:');
      console.log(JSON.stringify(data[0], null, 2));
    } else {
      console.log('No records found');
    }
  }
} catch (err) {
  console.error('Error:', err.message);
}
