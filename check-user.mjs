#!/usr/bin/env node

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
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', 'kairolopesoficial@gmail.com')
    .single();

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log('User found:');
  console.log('ID:', data.id);
  console.log('Email:', data.email);
  console.log('Role:', data.role);
  console.log('Password hash:', data.password_hash);

  // Test password
  const password = 'jx&CL%mFvt!x*Sm0';
  console.log('\nTesting password...');
  const match = await bcrypt.compare(password, data.password_hash);
  console.log('Match:', match);

  // Create new hash to compare
  const newHash = await bcrypt.hash(password, 10);
  console.log('\nNew hash:', newHash);

  // Update with new hash
  const { error: updateErr } = await supabase
    .from('users')
    .update({ password_hash: newHash })
    .eq('id', data.id);

  if (updateErr) {
    console.error('Update error:', updateErr.message);
  } else {
    console.log('\n✅ Password hash updated');
  }
}

main();
