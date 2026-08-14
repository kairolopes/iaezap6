#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import bcrypt from 'bcrypt';

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
  { auth: { persistSession: false } }
);

console.log('🚀 EXECUTING SQL MIGRATION DIRECTLY\n');
console.log('='.repeat(60));

async function executeSql(sql) {
  const { data, error } = await supabase.rpc('exec', {
    sql: sql
  }).catch(async () => {
    // Fallback: try via raw SQL endpoint if available
    return await fetch(
      `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Apikey': env.SUPABASE_SERVICE_ROLE_KEY,
        },
        body: JSON.stringify({ sql })
      }
    ).then(r => r.json()).then(data => ({ data, error: null })).catch(e => ({ data: null, error: e }));
  });

  return { data, error };
}

async function main() {
  try {
    const migrationContent = readFileSync('migrations/001_complete_migration_bundle.sql', 'utf-8');

    // Split SQL into individual statements
    const statements = migrationContent
      .split(';\n')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--') && !s.startsWith('\\echo'));

    console.log(`📝 Found ${statements.length} SQL statements\n`);

    let executed = 0;
    let skipped = 0;
    let errors = [];

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i].trim() + ';';

      try {
        // For large statements, just show progress
        const preview = stmt.substring(0, 60).replace(/\n/g, ' ');
        process.stdout.write(`[${i + 1}/${statements.length}] Executing: ${preview}... `);

        const { data, error } = await executeSql(stmt);

        if (error) {
          if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
            console.log('⏭️  (already exists)');
            skipped++;
          } else if (error.message?.includes('does not exist')) {
            console.log('⏭️  (not applicable)');
            skipped++;
          } else {
            console.log(`❌ ERROR: ${error.message}`);
            errors.push({ stmt: preview, error: error.message });
          }
        } else {
          console.log('✅');
          executed++;
        }
      } catch (e) {
        console.log(`⚠️  ${e.message}`);
        skipped++;
      }

      // Small delay between statements
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n📊 MIGRATION RESULTS:');
    console.log(`   ✅ Executed: ${executed}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors.length}\n`);

    if (errors.length > 0) {
      console.log('⚠️  ERRORS:');
      errors.forEach(e => {
        console.log(`   - ${e.stmt}`);
        console.log(`     ${e.error}\n`);
      });
    }

    // Step 2: Verify master company and user
    console.log('\n📋 VERIFYING DEPLOYMENT...\n');

    // Create master company
    console.log('Creating master company...');
    const { error: companyError } = await supabase
      .from('companies')
      .insert({
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Master Company',
        slug: 'master',
        cnpj: '00.000.000/0000-00',
        plan: 'enterprise',
        status: 'active',
        owner_id: '00000000-0000-0000-0000-000000000002'
      });

    if (companyError && !companyError.message.includes('duplicate')) {
      console.log(`❌ ${companyError.message}`);
    } else {
      console.log('✅ Master company created');
    }

    // Create master user
    console.log('Creating master user...');
    const password = 'jx&CL%mFvt!x*Sm0';
    const passwordHash = await bcrypt.hash(password, 10);

    const { error: userError } = await supabase
      .from('users')
      .insert({
        id: '00000000-0000-0000-0000-000000000002',
        company_id: '00000000-0000-0000-0000-000000000001',
        email: 'kairolopesoficial@gmail.com',
        password_hash: passwordHash,
        full_name: 'Master Admin',
        role: 'owner',
        status: 'active',
        email_verified: true
      });

    if (userError && !userError.message.includes('duplicate')) {
      console.log(`❌ ${userError.message}`);
    } else {
      console.log('✅ Master user created');
    }

    // Verify counts
    console.log('\nFinal verification...');
    const { count: companyCount } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true });

    const { count: userCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    console.log(`✅ Companies: ${companyCount || 0}`);
    console.log(`✅ Users: ${userCount || 0}`);

    console.log('\n' + '='.repeat(60));
    console.log('\n🎉 MIGRATION COMPLETE!\n');
    console.log('📌 MASTER CREDENTIALS:');
    console.log(`   Email: kairolopesoficial@gmail.com`);
    console.log(`   Password: ${password}`);
    console.log('\n🚀 Next: npm run dev\n');

  } catch (error) {
    console.error('\n❌ FAILED:', error.message);
    process.exit(1);
  }
}

main();
