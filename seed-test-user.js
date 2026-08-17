const bcrypt = require('bcrypt');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedTestUser() {
  try {
    console.log('Creating test company...');

    // Create company
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .insert([
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Master Admin Company',
          slug: 'master-admin',
          cnpj: '00.000.000/0000-00',
          plan: 'enterprise',
          status: 'active',
          owner_id: 'def4f37b-a401-451f-9fe2-238747a4e670',
          metadata: { type: 'master' },
        }
      ])
      .select();

    if (companyError && !companyError.message.includes('duplicate')) {
      console.error('Company error:', companyError);
      throw companyError;
    }

    console.log('Company created or exists:', company?.[0]?.id);

    const password = 'jx&CL%mFvt!x*Sm0';
    const hashedPassword = await bcrypt.hash(password, 10);

    console.log('Creating test user...');

    // Create user
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert([
        {
          id: 'def4f37b-a401-451f-9fe2-238747a4e670',
          company_id: '550e8400-e29b-41d4-a716-446655440000',
          email: 'kairolopesoficial@gmail.com',
          full_name: 'Master Admin',
          password_hash: hashedPassword,
          role: 'owner',
          status: 'active',
        }
      ])
      .select();

    if (userError && !userError.message.includes('duplicate')) {
      console.error('User error:', userError);
      throw userError;
    }

    console.log('✅ Test user created successfully!');
    console.log('Email: kairolopesoficial@gmail.com');
    console.log('Password: jx&CL%mFvt!x*Sm0');
  } catch (error) {
    console.error('Error seeding test user:', error);
    process.exit(1);
  }
}

seedTestUser();
