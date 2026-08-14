const { createClient } = require('@supabase/supabase-js');
const https = require('https');

// Configuration
const SUPABASE_URL = 'https://gqromcfhiosfppqlottz.supabase.co';
const SERVICE_ROLE_KEY = 'sb_secret_uh1cDxnWtzRT4fhYbiEWBg_fbnZkKwQ';
const MASTER_COMPANY_ID = '00000000-0000-0000-0000-000000000001';
const MASTER_USER_ID = '00000000-0000-0000-0000-000000000002';
const MASTER_EMAIL = 'kairolopesoficial@gmail.com';
const PASSWORD_HASH = '$2b$10$vFX3Giqy3DymRSXd1.8M6uKFHD37G9WlzsJEdXE.Fv8fmQdrdJWLW';

// Create Supabase client with service role key
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Execute raw SQL via Supabase REST API
async function executeSql(sql) {
  return new Promise((resolve, reject) => {
    const url = new URL(SUPABASE_URL);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: '/rest/v1/rpc/sql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'X-Client-Info': 'supabase-js/2.0.0',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify({ query: sql }));
    req.end();
  });
}

// First ensure master company exists
async function ensureMasterCompany() {
  console.log('Ensuring master company exists...');
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', MASTER_COMPANY_ID)
    .maybeSingle();

  if (data) {
    console.log(`✓ Master company already exists\n`);
    return data;
  }

  console.log('Creating master company...');
  const { data: newCompany, error: createError } = await supabase
    .from('companies')
    .insert({
      id: MASTER_COMPANY_ID,
      name: 'Master Company',
      slug: 'master',
      plan: 'enterprise',
      status: 'active',
      owner_id: MASTER_USER_ID,
    })
    .select()
    .single();

  if (createError) {
    console.log(`Note: Company might already exist. Continuing...`);
  }

  return newCompany;
}

async function createMasterUser() {
  try {
    console.log('Creating master user in Supabase database...\n');

    // Ensure master company exists first
    await ensureMasterCompany();

    // Try inserting the master user using Supabase client
    console.log('Executing INSERT query...');
    const { data: insertData, error: insertError } = await supabase
      .from('users')
      .insert({
        id: MASTER_USER_ID,
        company_id: MASTER_COMPANY_ID,
        email: MASTER_EMAIL,
        password_hash: PASSWORD_HASH,
        full_name: 'Master Admin',
        role: 'owner',
        status: 'active',
        email_verified: true,
        created_at: new Date().toISOString(),
      })
      .select('id, email, role, created_at');

    if (insertError) {
      // Check if user already exists
      if (insertError.code === '23505' || insertError.message.includes('duplicate')) {
        console.log('✓ Master user already exists');
      } else {
        console.error('Insert error:', insertError);
        throw insertError;
      }
    } else {
      console.log('✓ Insert successful!');
    }

    // Verify the user was created
    console.log('\nVerifying user creation...');
    const { data: verifyData, error: verifyError } = await supabase
      .from('users')
      .select('id, email, role, company_id, status, email_verified')
      .eq('email', MASTER_EMAIL);

    if (verifyError) {
      console.error('Verification error:', verifyError);
      throw verifyError;
    }

    if (verifyData && verifyData.length > 0) {
      console.log('✓ Verification successful!');
      console.log('\nUser Details:');
      const user = verifyData[0];
      console.log(`  user_id: ${user.id}`);
      console.log(`  email: ${user.email}`);
      console.log(`  role: ${user.role}`);
      console.log(`  company_id: ${user.company_id}`);
      console.log(`  status: ${user.status}`);
      console.log(`  email_verified: ${user.email_verified}`);

      return {
        success: true,
        user,
      };
    }

    throw new Error('User not found after creation');
  } catch (error) {
    console.error('Error:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Run the script
createMasterUser().then((result) => {
  console.log('\nOperation completed.');
  process.exit(result.success ? 0 : 1);
});
