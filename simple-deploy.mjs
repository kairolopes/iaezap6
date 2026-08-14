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

console.log('🚀 SIMPLE DEPLOY\n');

async function main() {
  try {
    // Step 1: Create master company
    console.log('Step 1: Creating master company...');
    const { data: company, error: compErr } = await supabase
      .from('companies')
      .insert({
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Master Company',
        slug: 'master',
        owner_id: '00000000-0000-0000-0000-000000000002'
      })
      .select();

    if (compErr) {
      console.log('Error:', compErr.message);
      if (compErr.message.includes('duplicate')) {
        console.log('✅ Master company already exists');
      }
    } else {
      console.log('✅ Master company created');
    }

    // Step 2: Create master user
    console.log('\nStep 2: Creating master user...');
    const password = 'jx&CL%mFvt!x*Sm0';
    const passwordHash = await bcrypt.hash(password, 10);

    const { data: user, error: userErr } = await supabase
      .from('users')
      .insert({
        id: '00000000-0000-0000-0000-000000000002',
        company_id: '00000000-0000-0000-0000-000000000001',
        email: 'kairolopesoficial@gmail.com',
        full_name: 'Master Admin',
        role: 'owner',
        status: 'active',
        password_hash: passwordHash
      })
      .select();

    if (userErr) {
      console.log('Error:', userErr.message);
      if (userErr.message.includes('duplicate')) {
        console.log('✅ Master user already exists');
      }
    } else {
      console.log('✅ Master user created');
    }

    // Step 3: Backfill z_api_instances
    console.log('\nStep 3: Backfilling Z-API instances...');
    const { error: updateErr } = await supabase
      .from('z_api_instances')
      .update({ company_id: '00000000-0000-0000-0000-000000000001' })
      .is('company_id', null);

    if (updateErr) {
      console.log('⚠️  Update error:', updateErr.message);
    } else {
      console.log('✅ Z-API instances backfilled');
    }

    // Step 4: Verify
    console.log('\nStep 4: Verification...');
    const { count: companies } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true });

    const { count: users } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    console.log(`Companies: ${companies}`);
    console.log(`Users: ${users}`);

    console.log('\n' + '='.repeat(60));
    console.log('\n🎉 DEPLOYMENT COMPLETE!\n');
    console.log('📌 Master Credentials:');
    console.log(`   Email: kairolopesoficial@gmail.com`);
    console.log(`   Password: ${password}`);
    console.log('\n🚀 Next: npm run dev\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error);
  }
}

main();
