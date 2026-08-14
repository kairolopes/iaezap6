import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gqromcfhiosfppqlottz.supabase.co';
const supabaseServiceRoleKey = 'sb_secret_uh1cDxnWtzRT4fhYbiEWBg_fbnZkKwQ';

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function createMasterCompany() {
  try {
    console.log('Creating master company in Supabase...\n');

    // Execute the INSERT statement using rpc or direct table insert
    // Since we're using service role key, we can directly insert
    const { data, error } = await supabase
      .from('companies')
      .insert([
        {
          id: '00000000-0000-0000-0000-000000000001',
          name: 'Master Company',
          slug: 'master',
          cnpj: '00.000.000/0000-00',
          plan: 'enterprise',
          status: 'active',
          owner_id: '00000000-0000-0000-0000-000000000002',
          created_at: new Date().toISOString()
        }
      ])
      .select();

    if (error) {
      // If conflict (already exists), fetch it
      if (error.code === '23505') {
        console.log('Master company already exists (conflict on slug). Fetching...\n');
        const { data: existing, error: fetchError } = await supabase
          .from('companies')
          .select('id, name, slug, plan')
          .eq('slug', 'master')
          .single();

        if (fetchError) {
          console.error('Error fetching existing company:', fetchError);
          process.exit(1);
        }

        console.log('✓ Master company found:');
        console.log('  ID:', existing.id);
        console.log('  Name:', existing.name);
        console.log('  Slug:', existing.slug);
        console.log('  Plan:', existing.plan);
        return existing;
      } else {
        console.error('Error inserting company:', error);
        process.exit(1);
      }
    } else if (data && data.length > 0) {
      console.log('✓ Master company created successfully:');
      console.log('  ID:', data[0].id);
      console.log('  Name:', data[0].name);
      console.log('  Slug:', data[0].slug);
      console.log('  Plan:', data[0].plan);
      return data[0];
    }

    // Verify with SELECT
    console.log('\nVerifying master company...');
    const { data: verify, error: verifyError } = await supabase
      .from('companies')
      .select('id, name, slug, plan')
      .eq('slug', 'master');

    if (verifyError) {
      console.error('Error verifying company:', verifyError);
      process.exit(1);
    }

    if (verify && verify.length > 0) {
      console.log('\n✓ Verification successful! Company exists in database:');
      console.log('  ID:', verify[0].id);
      console.log('  Name:', verify[0].name);
      console.log('  Slug:', verify[0].slug);
      console.log('  Plan:', verify[0].plan);
    } else {
      console.log('Warning: Company not found during verification');
    }

  } catch (error) {
    console.error('Error occurred:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

await createMasterCompany();
console.log('\n✓ Master company creation process completed!');
