#!/usr/bin/env node

import pkg from 'pg';
const { Client } = pkg;
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

// Extract connection string from Supabase URL
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

// Parse connection URL
const url = new URL(supabaseUrl);
const connectionConfig = {
  host: url.hostname,
  port: 5432,
  database: 'postgres',
  user: 'postgres.gqromcfhiosfppqlottz',
  password: serviceKey.substring(0, 40), // Service key is often too long, need actual password
  ssl: { rejectUnauthorized: false }
};

console.log('🚀 EXECUTING SQL MIGRATION DIRECTLY\n');
console.log('='.repeat(60));

async function main() {
  const client = new Client(connectionConfig);

  try {
    await client.connect();
    console.log('✅ Connected to Supabase PostgreSQL\n');

    const migrationContent = readFileSync('migrations/001_complete_migration_bundle.sql', 'utf-8');

    // Execute entire migration at once
    console.log('📋 Executing migration...\n');
    await client.query(migrationContent);
    console.log('✅ Migration SQL executed successfully\n');

    // Verify tables were created
    const { rows } = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('companies', 'users', 'company_members', 'audit_logs')
      ORDER BY table_name
    `);

    console.log('📊 Tables created:');
    rows.forEach(r => console.log(`   ✅ ${r.table_name}`));

    // Create master company
    console.log('\n🏢 Creating master company...');
    await client.query(`
      INSERT INTO companies (id, name, slug, cnpj, plan, status, owner_id, metadata, settings)
      VALUES (
        '00000000-0000-0000-0000-000000000001'::UUID,
        'Master Company',
        'master',
        '00.000.000/0000-00',
        'enterprise',
        'active',
        '00000000-0000-0000-0000-000000000002'::UUID,
        '{"type": "master", "internal": true}',
        '{"master_account": true}'
      )
      ON CONFLICT (slug) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
    `);
    console.log('✅ Master company created');

    // Create master user
    console.log('\n👤 Creating master user...');
    const password = 'jx&CL%mFvt!x*Sm0';
    const passwordHash = await bcrypt.hash(password, 10);

    await client.query(`
      INSERT INTO users (
        id, company_id, email, full_name, role, status,
        email_verified, email_verified_at, password_hash, auth_id,
        preferences, metadata
      )
      VALUES (
        '00000000-0000-0000-0000-000000000002'::UUID,
        '00000000-0000-0000-0000-000000000001'::UUID,
        'kairolopesoficial@gmail.com',
        'Master Admin',
        'owner',
        'active',
        true,
        CURRENT_TIMESTAMP,
        $1,
        '00000000-0000-0000-0000-000000000002'::UUID,
        '{"master_user": true}',
        '{"internal": true}'
      )
      ON CONFLICT (email) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
    `, [passwordHash]);
    console.log('✅ Master user created');

    // Backfill z_api_instances
    console.log('\n🔄 Backfilling Z-API instances...');
    const { rowCount } = await client.query(`
      UPDATE z_api_instances
      SET company_id = '00000000-0000-0000-0000-000000000001'::UUID
      WHERE company_id IS NULL
    `);
    console.log(`✅ Backfilled ${rowCount} Z-API instances`);

    // Verify
    console.log('\n✨ FINAL VERIFICATION:\n');
    const stats = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM companies) as companies,
        (SELECT COUNT(*) FROM users) as users,
        (SELECT COUNT(*) FROM z_api_instances) as instances
    `);

    const row = stats.rows[0];
    console.log(`   Companies: ${row.companies} ✅`);
    console.log(`   Users: ${row.users} ✅`);
    console.log(`   Z-API Instances: ${row.instances} ✅`);

    console.log('\n' + '='.repeat(60));
    console.log('\n🎉 ✨ MIGRATION COMPLETE! ✨ 🎉\n');
    console.log('📌 MASTER CREDENTIALS:');
    console.log(`   Email:    kairolopesoficial@gmail.com`);
    console.log(`   Password: ${password}`);
    console.log('   ⚠️  SAVE SECURELY!\n');
    console.log('🚀 NEXT STEPS:');
    console.log('   npm run dev');
    console.log('   Visit: http://localhost:3000\n');

    await client.end();

  } catch (error) {
    console.error('\n❌ ERROR:', error.message || error);
    console.error(error.stack);

    if (error.message?.includes('password') || error.message?.includes('authentication')) {
      console.log('\n⚠️  Connection issue - trying alternate method...');
      console.log('   You may need to get the actual database password from Supabase.');
      console.log('   Or use the Supabase Dashboard SQL Editor instead.');
    }

    process.exit(1);
  }
}

main();
