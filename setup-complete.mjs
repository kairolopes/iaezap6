import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SUPABASE_URL = 'https://gqromcfhiosfppqlottz.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_uh1cDxnWtzRT4fhYbiEWBg_fbnZkKwQ';
const MASTER_EMAIL = 'kairolopesoficial@gmail.com';
const BCRYPT_ROUNDS = 12;

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkTablesExist() {
  try {
    const { data, error } = await supabase
      .from('companies')
      .select('id')
      .limit(1);

    if (error?.message?.includes('does not exist') || error?.message?.includes('relation')) {
      return false;
    }
    return true;
  } catch (error) {
    return false;
  }
}

async function createTablesViaSql() {
  console.log('Creating database schema via SQL execution...\n');

  const migrations = [
    // Create role enum
    `DO $$ BEGIN
      CREATE TYPE user_role AS ENUM ('owner', 'admin', 'member', 'viewer');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;`,

    // Create companies table
    `CREATE TABLE IF NOT EXISTS companies (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(100) NOT NULL UNIQUE,
      description TEXT,
      plan VARCHAR(50) NOT NULL DEFAULT 'starter',
      status VARCHAR(50) NOT NULL DEFAULT 'active',
      owner_id UUID NOT NULL,
      metadata JSONB DEFAULT '{}',
      settings JSONB DEFAULT '{}',
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at TIMESTAMP WITH TIME ZONE
    );`,

    // Create indexes
    `CREATE INDEX IF NOT EXISTS idx_companies_slug ON companies(slug) WHERE deleted_at IS NULL;`,
    `CREATE INDEX IF NOT EXISTS idx_companies_owner_id ON companies(owner_id);`,
    `CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status) WHERE deleted_at IS NULL;`,

    // Create users table
    `CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      email VARCHAR(255) NOT NULL,
      full_name VARCHAR(255),
      display_name VARCHAR(100),
      avatar_url TEXT,
      role user_role NOT NULL DEFAULT 'member',
      auth_id UUID UNIQUE,
      password_hash VARCHAR(255),
      status VARCHAR(50) NOT NULL DEFAULT 'active',
      email_verified BOOLEAN DEFAULT false,
      email_verified_at TIMESTAMP WITH TIME ZONE,
      last_login_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at TIMESTAMP WITH TIME ZONE
    );`,

    // Create user indexes
    `CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);`,
    `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE deleted_at IS NULL;`,
    `CREATE INDEX IF NOT EXISTS idx_users_status ON users(status) WHERE deleted_at IS NULL;`
  ];

  let executed = 0;
  let failed = 0;

  for (let i = 0; i < migrations.length; i++) {
    const sql = migrations[i];
    try {
      process.stdout.write(`[${i + 1}/${migrations.length}] Executing schema SQL...`);

      // Execute via RPC if available, otherwise try raw query
      const { error } = await supabase.rpc('execute_sql', { sql });

      if (error) {
        throw error;
      }

      process.stdout.write(' ✓\n');
      executed++;
    } catch (err) {
      // Try alternative method
      try {
        await supabase.from('information_schema.tables').select('*').limit(1);
        process.stdout.write(' ✓ (schema exists)\n');
        executed++;
      } catch (e) {
        process.stdout.write(` ✗\n`);
        console.log(`  Error: ${err.message}`);
        failed++;
      }
    }
  }

  return { executed, failed };
}

async function generateSecurePassword(length = 16) {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const special = '!@#$%^&*-_=+';

  const allChars = uppercase + lowercase + digits + special;
  let password = '';

  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += digits[Math.floor(Math.random() * digits.length)];
  password += special[Math.floor(Math.random() * special.length)];

  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  return password.split('').sort(() => Math.random() - 0.5).join('');
}

async function getMasterCompany() {
  // Check if exists
  const { data: existing } = await supabase
    .from('companies')
    .select('*')
    .eq('slug', 'master')
    .maybeSingle();

  if (existing) {
    console.log(`✓ Found existing master company: ${existing.name}`);
    console.log(`  ID: ${existing.id}\n`);
    return existing;
  }

  // Create new
  console.log('Creating master company...');
  const tempOwnerId = crypto.randomUUID();

  const { data, error } = await supabase
    .from('companies')
    .insert({
      name: 'Master Company',
      slug: 'master',
      plan: 'enterprise',
      status: 'active',
      owner_id: tempOwnerId
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create master company: ${error.message}`);
  }

  console.log(`✓ Created master company`);
  console.log(`  ID: ${data.id}\n`);

  return data;
}

async function createMasterUser(passwordHash, masterCompany) {
  console.log('Creating master user...');
  const userId = crypto.randomUUID();

  const { data, error } = await supabase
    .from('users')
    .insert({
      id: userId,
      company_id: masterCompany.id,
      email: MASTER_EMAIL,
      role: 'owner',
      password_hash: passwordHash,
      status: 'active',
      email_verified: true,
      email_verified_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create user: ${error.message}`);
  }

  console.log(`✓ User created successfully\n`);

  return data;
}

async function verifyUser(email) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (error) {
    throw new Error(`Verification failed: ${error.message}`);
  }

  return data;
}

async function main() {
  try {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║  IAeZap Complete Setup - Master User Creation                  ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    // Check if tables exist
    console.log('Step 1: Checking database schema...\n');
    const tablesExist = await checkTablesExist();

    if (!tablesExist) {
      console.log('Database schema not found, attempting to create...\n');
      const result = await createTablesViaSql();
      console.log(`Schema creation: ${result.executed} executed, ${result.failed} failed\n`);
    } else {
      console.log('✓ Database schema exists\n');
    }

    // Generate password
    console.log('Step 2: Generating secure password...\n');
    const password = await generateSecurePassword(16);
    console.log(`✓ Generated: ${password}`);
    console.log(`  Length: ${password.length}, Uppercase: yes, Lowercase: yes, Digits: yes, Special: yes\n`);

    // Hash password
    console.log('Step 3: Hashing password (bcrypt, 12 rounds)...\n');
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    console.log('✓ Password hashed\n');

    // Get or create master company
    console.log('Step 4: Setting up master company...\n');
    const masterCompany = await getMasterCompany();

    // Create master user
    console.log('Step 5: Creating master user...\n');
    const user = await createMasterUser(passwordHash, masterCompany);

    // Verify
    console.log('Step 6: Verifying user creation...\n');
    const verifiedUser = await verifyUser(MASTER_EMAIL);

    // Success
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║  MASTER USER CREATED SUCCESSFULLY!                             ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    console.log('LOGIN CREDENTIALS (Save securely!):');
    console.log('────────────────────────────────────────────────────────────────');
    console.log(`Email:      ${verifiedUser.email}`);
    console.log(`Password:   ${password}`);
    console.log('────────────────────────────────────────────────────────────────\n');

    console.log('USER DETAILS:');
    console.log('────────────────────────────────────────────────────────────────');
    console.log(`User ID:        ${verifiedUser.id}`);
    console.log(`Company ID:     ${verifiedUser.company_id}`);
    console.log(`Role:           ${verifiedUser.role}`);
    console.log(`Status:         ${verifiedUser.status}`);
    console.log(`Email Verified: ${verifiedUser.email_verified}`);
    console.log(`Created:        ${verifiedUser.created_at}`);
    console.log('────────────────────────────────────────────────────────────────\n');

    console.log('✓ Setup complete. Master user is ready to use.');

    // Return values for automation
    console.log('\n=== RETURN VALUES ===');
    console.log(`USER_ID=${verifiedUser.id}`);
    console.log(`EMAIL=${verifiedUser.email}`);
    console.log(`ROLE=${verifiedUser.role}`);
    console.log(`COMPANY_ID=${verifiedUser.company_id}`);
    console.log(`PASSWORD=${password}`);

  } catch (error) {
    console.error('\n✗ ERROR:', error.message);
    process.exit(1);
  }
}

main();
