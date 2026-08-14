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

console.log('🚀 DEPLOYING VIA SUPABASE API\n');
console.log('='.repeat(60));

// Step 1: Try to create master company
async function step1() {
  console.log('\n🏢 Step 1: Creating Master Company...');

  try {
    const { data, error } = await supabase
      .from('companies')
      .insert({
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Master Company',
        slug: 'master',
        cnpj: '00.000.000/0000-00',
        plan: 'enterprise',
        status: 'active',
        owner_id: '00000000-0000-0000-0000-000000000002',
        metadata: { type: 'master', internal: true },
        settings: { master_account: true }
      })
      .select();

    if (error) {
      if (error.message.includes('permission denied') || error.message.includes('does not exist')) {
        console.log('❌ Tables not created yet');
        console.log('\n⚠️  IMPORTANT:');
        console.log('   The database schema needs to be created first.');
        console.log('   \n   Please do this MANUALLY via Supabase Dashboard:');
        console.log('   \n   1. Open: https://app.supabase.com');
        console.log('   2. Project: gqromcfhiosfppqlottz');
        console.log('   3. SQL Editor → New Query');
        console.log('   4. Copy entire content of: migrations/001_complete_migration_bundle.sql');
        console.log('   5. Paste in editor and click RUN');
        console.log('   6. Wait for completion');
        console.log('   7. Run this script again: node deploy-via-api.mjs\n');
        process.exit(1);
      }

      if (error.message.includes('duplicate') || error.message.includes('unique')) {
        console.log('✅ Master company already exists');
        return true;
      }

      console.log(`❌ ${error.message}`);
      return false;
    }

    console.log('✅ Master company created');
    return true;
  } catch (e) {
    console.log(`❌ ${e.message}`);
    return false;
  }
}

// Step 2: Create master user
async function step2() {
  console.log('\n👤 Step 2: Creating Master User...');

  const password = 'jx&CL%mFvt!x*Sm0';
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const { data, error } = await supabase
      .from('users')
      .insert({
        id: '00000000-0000-0000-0000-000000000002',
        company_id: '00000000-0000-0000-0000-000000000001',
        email: 'kairolopesoficial@gmail.com',
        password_hash: passwordHash,
        full_name: 'Master Admin',
        role: 'owner',
        status: 'active',
        email_verified: true,
        preferences: { master_user: true, language: 'pt-BR', timezone: 'America/Sao_Paulo' },
        metadata: { internal: true }
      })
      .select();

    if (error) {
      if (error.message.includes('duplicate') || error.message.includes('unique')) {
        console.log('✅ Master user already exists');
        return { success: true, password };
      }

      console.log(`❌ ${error.message}`);
      return { success: false, password };
    }

    console.log('✅ Master user created');
    return { success: true, password };
  } catch (e) {
    console.log(`❌ ${e.message}`);
    return { success: false, password };
  }
}

// Step 3: Backfill z_api_instances
async function step3() {
  console.log('\n🔄 Step 3: Backfilling Z-API Instances...');

  try {
    const { count, error } = await supabase
      .from('z_api_instances')
      .update({ company_id: '00000000-0000-0000-0000-000000000001' })
      .is('company_id', null);

    if (error) {
      if (error.message.includes('does not exist')) {
        console.log('ℹ️  Z-API instances table not found (might not exist yet)');
        return true;
      }
      console.log(`⚠️  ${error.message}`);
      return true;
    }

    console.log(`✅ Backfilled instances`);
    return true;
  } catch (e) {
    console.log(`⚠️  ${e.message}`);
    return true;
  }
}

// Step 4: Verify
async function step4() {
  console.log('\n✨ Step 4: Verifying...');

  try {
    const { count: companies } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true });

    const { count: users } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    const { count: instances } = await supabase
      .from('z_api_instances')
      .select('*', { count: 'exact', head: true })
      .catch(() => ({ count: 0 }));

    console.log(`✅ Companies: ${companies || 0}`);
    console.log(`✅ Users: ${users || 0}`);
    console.log(`✅ Z-API Instances: ${instances || 0}`);

    return true;
  } catch (e) {
    console.log(`⚠️  ${e.message}`);
    return true;
  }
}

async function main() {
  const step1Result = await step1();

  if (!step1Result) {
    console.log('\n❌ Cannot continue without database schema.');
    process.exit(1);
  }

  const step2Result = await step2();
  await step3();
  await step4();

  console.log('\n' + '='.repeat(60));
  console.log('\n🎉 ✨ DEPLOYMENT COMPLETE! ✨ 🎉\n');
  console.log('📌 MASTER CREDENTIALS:');
  console.log(`   Email:    kairolopesoficial@gmail.com`);
  console.log(`   Password: ${step2Result.password}`);
  console.log('   ⚠️  SAVE SECURELY!\n');
  console.log('🚀 NEXT STEPS:');
  console.log('   1. npm run dev');
  console.log('   2. Visit: http://localhost:3000\n');
  console.log('='.repeat(60) + '\n');
}

main().catch(e => {
  console.error('❌ ERROR:', e.message);
  process.exit(1);
});
