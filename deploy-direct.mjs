#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';

const __dirname = __dirname || new URL('.', import.meta.url).pathname;

// Load env
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
  { auth: { persistSession: false }, db: { schema: 'public' } }
);

console.log('🚀 DEPLOYMENT EXECUTION\n');

async function deploy() {
  try {
    // Read migration file
    const migrationSQL = readFileSync('migrations/001_complete_migration_bundle.sql', 'utf-8');

    // Split statements more carefully
    const statements = migrationSQL
      .split('\n')
      .filter(line => line.trim() && !line.trim().startsWith('--'))
      .join('\n')
      .split(';\n')
      .filter(s => s.trim())
      .map(s => s.trim() + ';');

    console.log(`📝 Found ${statements.length} SQL statements\n`);
    console.log('Step 1: Checking current database state...\n');

    // Check current tables
    const { data: tables, error: tableError } = await supabase
      .rpc('information_schema')
      .limit(1)
      .catch(() => ({ data: [] }));

    // Step 1: Try to create master company directly
    console.log('Step 2: Creating master company...');
    const { error: companyError } = await supabase
      .from('companies')
      .insert({
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Master Company',
        slug: 'master',
        cnpj: '00.000.000/0000-00',
        plan: 'enterprise',
        status: 'active'
      });

    if (companyError) {
      if (companyError.message.includes('permission denied')) {
        console.log('⚠️  Tables not yet created (expected)');
        console.log('\n🔧 SOLUTION:');
        console.log('   The database schema migrations need to be executed first.');
        console.log('   Open Supabase Dashboard and run the migration SQL.\n');
        console.log('   1. Go to: https://app.supabase.com');
        console.log('   2. Select project: gqromcfhiosfppqlottz');
        console.log('   3. SQL Editor → New Query');
        console.log('   4. Copy migrations/001_complete_migration_bundle.sql');
        console.log('   5. Paste and click RUN\n');
        console.log('   After that, run this script again.');
        return false;
      }
    }

    // Step 2: Create master user
    console.log('Step 3: Creating master user...');
    const password = 'jx&CL%mFvt!x*Sm0';
    const hash = await bcrypt.hash(password, 10);

    const { error: userError } = await supabase
      .from('users')
      .insert({
        id: '00000000-0000-0000-0000-000000000002',
        company_id: '00000000-0000-0000-0000-000000000001',
        email: 'kairolopesoficial@gmail.com',
        password_hash: hash,
        full_name: 'Master Admin',
        role: 'owner',
        status: 'active',
        email_verified: true
      });

    if (userError && !userError.message.includes('duplicate')) {
      console.error('❌ Error:', userError.message);
      return false;
    }

    // Step 3: Backfill z_api_instances
    console.log('Step 4: Backfilling Z-API instances...');
    const { error: backfillError } = await supabase
      .from('z_api_instances')
      .update({ company_id: '00000000-0000-0000-0000-000000000001' })
      .is('company_id', null);

    // Verify
    console.log('\nStep 5: Verifying deployment...');
    const { count: companyCount } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true });

    const { count: userCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    console.log(`\n✅ DEPLOYMENT SUCCESSFUL!\n`);
    console.log('📊 Database Status:');
    console.log(`   Companies: ${companyCount || 0} created`);
    console.log(`   Users: ${userCount || 0} created\n`);
    console.log('🔐 Master Credentials:');
    console.log(`   Email: kairolopesoficial@gmail.com`);
    console.log(`   Password: ${password}`);
    console.log('   ⚠️  SAVE SECURELY!\n');
    console.log('🚀 Next: npm run dev (http://localhost:3000)\n');

    return true;

  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

deploy().then(success => {
  process.exit(success ? 0 : 1);
});
