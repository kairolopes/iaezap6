#!/usr/bin/env node

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

console.log('🔍 Testing Supabase Connection\n');
console.log('URL:', env.NEXT_PUBLIC_SUPABASE_URL);
console.log('Key:', env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 20) + '...\n');

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function test() {
  try {
    // Test 1: Check companies table
    console.log('Test 1: Checking companies table...');
    const { data: companies, error: compErr } = await supabase
      .from('companies')
      .select('*')
      .limit(1);

    if (compErr) {
      console.log('❌ Companies table error:', compErr.message);
    } else {
      console.log('✅ Companies table exists, records:', companies?.length || 0);
    }

    // Test 2: Check users table
    console.log('\nTest 2: Checking users table...');
    const { data: users, error: userErr } = await supabase
      .from('users')
      .select('*')
      .limit(1);

    if (userErr) {
      console.log('❌ Users table error:', userErr.message);
    } else {
      console.log('✅ Users table exists, records:', users?.length || 0);
    }

    // Test 3: Check z_api_instances table
    console.log('\nTest 3: Checking z_api_instances table...');
    const { data: instances, error: instErr } = await supabase
      .from('z_api_instances')
      .select('*')
      .limit(1);

    if (instErr) {
      console.log('⚠️  Z-API instances error:', instErr.message);
    } else {
      console.log('✅ Z-API instances exists, records:', instances?.length || 0);
    }

    // Test 4: Check master company
    console.log('\nTest 4: Checking master company...');
    const { data: master, error: masterErr } = await supabase
      .from('companies')
      .select('*')
      .eq('slug', 'master')
      .single()
      .catch(() => ({ data: null, error: { message: 'Not found' } }));

    if (master) {
      console.log('✅ Master company found:', master.name);
    } else {
      console.log('⚠️  Master company not found');
    }

  } catch (e) {
    console.error('❌ Connection error:', e.message);
  }
}

test();
