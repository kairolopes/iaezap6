import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gqromcfhiosfppqlottz.supabase.co',
  'sb_secret_uh1cDxnWtzRT4fhYbiEWBg_fbnZkKwQ',
  {
    auth: { autoRefreshToken: false, persistSession: false }
  }
);

console.log('Checking for tenant/company information in z_api_instances...\n');

try {
  const { data, error } = await supabase
    .from('z_api_instances')
    .select('tenant_id, id, instance_id')
    .limit(10);

  if (error) {
    console.log('Error:', error);
  } else {
    console.log('Found', data?.length || 0, 'Z-API instances');

    if (data && data.length > 0) {
      // Get unique tenant IDs
      const tenantIds = [...new Set(data.map(d => d.tenant_id))];
      console.log('\nUnique tenant IDs:', tenantIds);

      // Check if there's a pattern or a default tenant
      console.log('\nTenant distribution:');
      for (const tenantId of tenantIds) {
        const count = data.filter(d => d.tenant_id === tenantId).length;
        console.log(`  ${tenantId}: ${count} instances`);
      }

      // The first or most common tenant might be the "master" tenant
      const mostCommonTenant = tenantIds.sort((a, b) =>
        data.filter(d => d.tenant_id === b).length -
        data.filter(d => d.tenant_id === a).length
      )[0];

      console.log('\nMost common tenant ID (likely master):', mostCommonTenant);
    }
  }
} catch (err) {
  console.error('Error:', err.message);
}

console.log('\n' + '='.repeat(60));
console.log('Note: Companies table needs to be created for proper');
console.log('multi-tenant support. Run setup_master_company.sql');
console.log('through Supabase dashboard SQL Editor.');
console.log('='.repeat(60));
