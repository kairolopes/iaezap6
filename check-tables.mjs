import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

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
  // Try to query users table
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .limit(1);

  console.log('Query result:');
  if (error) {
    console.log('ERROR:', error.message);
    console.log('Code:', error.code);
  } else {
    console.log('SUCCESS:', data.length, 'records');
    if (data.length > 0) {
      console.log('First user:', data[0]);
    }
  }
}

main();
