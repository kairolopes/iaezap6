import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import bcrypt from 'bcrypt';

const envContent = readFileSync('.env.local', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && !key.startsWith('#')) {
    env[key.trim()] = valueParts.join('=').trim().replace(/^["'](.*)["']$/, '$1');
  }
});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function main() {
  const email = 'kairolopesoficial@gmail.com';
  const password = 'jx&CL%mFvt!x*Sm0';

  // Get user
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .eq('deleted_at', null)
    .single();

  console.log('User lookup:', user ? '✅ Found' : '❌ Not found');
  if (userError) console.log('Error:', userError.message);

  if (!user) return;

  // Verify password
  const match = await bcrypt.compare(password, user.password_hash);
  console.log('Password match:', match ? '✅ Valid' : '❌ Invalid');

  // Get company
  const { data: company, error: compError } = await supabase
    .from('companies')
    .select('*')
    .eq('id', user.company_id)
    .single();

  console.log('Company lookup:', company ? '✅ Found' : '❌ Not found');
  if (compError) console.log('Error:', compError.message);

  if (match && company) {
    console.log('\n✅ LOGIN WOULD SUCCEED');
    console.log('User:', user.email, user.role);
    console.log('Company:', company.name, company.slug);
  }
}

main();
