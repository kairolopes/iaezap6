import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import bcrypt from 'bcrypt';

const SUPABASE_URL = 'https://gqromcfhiosfppqlottz.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_uh1cDxnWtzRT4fhYbiEWBg_fbnZkKwQ';
const MASTER_EMAIL = 'kairolopesoficial@gmail.com';
const BCRYPT_ROUNDS = 12;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Core schema creation functions using direct database calls
const schemaSQL = {
  createEnum: `DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('owner', 'admin', 'member', 'viewer');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$;`,

  createCompanies: `CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    plan VARCHAR(50) NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'professional', 'enterprise')),
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'suspended', 'cancelled')),
    owner_id UUID NOT NULL,
    metadata JSONB DEFAULT '{}',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
  );`,

  createCompanyIndexes: [
    'CREATE INDEX IF NOT EXISTS idx_companies_slug ON companies(slug) WHERE deleted_at IS NULL;',
    'CREATE INDEX IF NOT EXISTS idx_companies_owner_id ON companies(owner_id);',
    'CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status) WHERE deleted_at IS NULL;',
    'CREATE INDEX IF NOT EXISTS idx_companies_plan ON companies(plan);',
    'CREATE INDEX IF NOT EXISTS idx_companies_created_at ON companies(created_at DESC);'
  ],

  createUsers: `CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    display_name VARCHAR(100),
    avatar_url TEXT,
    role user_role NOT NULL DEFAULT 'member',
    auth_id UUID UNIQUE,
    password_hash VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    email_verified BOOLEAN DEFAULT false,
    email_verified_at TIMESTAMP WITH TIME ZONE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
  );`,

  createUserIndexes: [
    'CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);',
    'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE deleted_at IS NULL;',
    'CREATE INDEX IF NOT EXISTS idx_users_status ON users(status) WHERE deleted_at IS NULL;'
  ],

  enableRLS: [
    'ALTER TABLE companies ENABLE ROW LEVEL SECURITY;',
    'ALTER TABLE users ENABLE ROW LEVEL SECURITY;'
  ]
};

async function testConnection() {
  try {
    console.log('Testing Supabase connection...');
    const { data, error } = await supabase
      .from('companies')
      .select('id')
      .limit(1);

    if (error?.message?.includes('does not exist')) {
      return 'SCHEMA_MISSING';
    } else if (error) {
      console.log(`Connection error: ${error.message}`);
      return 'ERROR';
    }
    return 'SCHEMA_EXISTS';
  } catch (err) {
    console.log(`Test error: ${err.message}`);
    return 'ERROR';
  }
}

async function generatePassword(length = 16) {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const special = '!@#$%^&*-_=+';
  const all = uppercase + lowercase + digits + special;

  let pwd = '';
  pwd += uppercase[Math.floor(Math.random() * uppercase.length)];
  pwd += lowercase[Math.floor(Math.random() * lowercase.length)];
  pwd += digits[Math.floor(Math.random() * digits.length)];
  pwd += special[Math.floor(Math.random() * special.length)];

  for (let i = pwd.length; i < length; i++) {
    pwd += all[Math.floor(Math.random() * all.length)];
  }

  return pwd.split('').sort(() => Math.random() - 0.5).join('');
}

async function createMasterCompany() {
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

  if (error) throw error;
  return data;
}

async function createMasterUser(companyId, passwordHash) {
  const userId = crypto.randomUUID();

  const { data, error } = await supabase
    .from('users')
    .insert({
      id: userId,
      company_id: companyId,
      email: MASTER_EMAIL,
      role: 'owner',
      password_hash: passwordHash,
      status: 'active',
      email_verified: true,
      email_verified_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function verifyUser() {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', MASTER_EMAIL)
    .single();

  if (error) throw error;
  return data;
}

async function main() {
  try {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║  Master User Creation - IAeZap Setup                            ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    // Test connection
    console.log('Step 1: Checking database connection...\n');
    const status = await testConnection();

    if (status === 'ERROR') {
      throw new Error('Could not connect to Supabase database');
    }

    if (status === 'SCHEMA_MISSING') {
      console.log('⚠️  Database schema not initialized.');
      console.log('\nTo initialize the schema, follow these steps:');
      console.log('1. Open: https://app.supabase.com/projects');
      console.log('2. Select project: gqromcfhiosfppqlottz');
      console.log('3. Go to: SQL Editor');
      console.log('4. Click: New Query');
      console.log('5. Copy and run the SQL from: migrations/001_complete_migration_bundle.sql');
      console.log('6. After completion, run this script again\n');
      process.exit(1);
    }

    console.log('✓ Database schema exists\n');

    // Generate password
    console.log('Step 2: Generating secure password...\n');
    const password = await generatePassword(16);
    console.log(`✓ Generated: ${password}\n`);

    // Hash password
    console.log('Step 3: Hashing password (bcrypt, 12 rounds)...\n');
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    console.log('✓ Password hashed\n');

    // Get or create company
    console.log('Step 4: Setting up master company...\n');
    let company;
    const { data: existing } = await supabase
      .from('companies')
      .select('*')
      .eq('slug', 'master')
      .maybeSingle();

    if (existing) {
      console.log(`✓ Found existing master company: ${existing.name}`);
      console.log(`  ID: ${existing.id}\n`);
      company = existing;
    } else {
      company = await createMasterCompany();
      console.log(`✓ Created master company`);
      console.log(`  ID: ${company.id}\n`);
    }

    // Create master user
    console.log('Step 5: Creating master user...\n');
    const user = await createMasterUser(company.id, passwordHash);
    console.log(`✓ User created\n`);

    // Verify
    console.log('Step 6: Verifying user creation...\n');
    const verified = await verifyUser();

    // Success
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║  MASTER USER CREATED SUCCESSFULLY!                             ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    console.log('CREDENTIALS (Save securely!):');
    console.log('────────────────────────────────────────────────────────────────');
    console.log(`Email:      ${verified.email}`);
    console.log(`Password:   ${password}`);
    console.log('────────────────────────────────────────────────────────────────\n');

    console.log('VERIFICATION:');
    console.log(`SELECT * FROM users WHERE email='${MASTER_EMAIL}';`);
    console.log('\nResult:');
    console.log(`  user_id:      ${verified.id}`);
    console.log(`  email:        ${verified.email}`);
    console.log(`  role:         ${verified.role}`);
    console.log(`  company_id:   ${verified.company_id}`);
    console.log(`  status:       ${verified.status}`);
    console.log(`  email_verified: ${verified.email_verified}\n`);

    // Return values for scripting
    console.log('AUTOMATION OUTPUT:');
    console.log(`USER_ID=${verified.id}`);
    console.log(`EMAIL=${verified.email}`);
    console.log(`ROLE=${verified.role}`);
    console.log(`COMPANY_ID=${verified.company_id}`);

  } catch (error) {
    console.error('\n✗ ERROR:', error.message);
    console.log('\nNote: If the error mentions missing tables, run the SQL migration first');
    console.log('in the Supabase SQL Editor: migrations/001_complete_migration_bundle.sql\n');
    process.exit(1);
  }
}

main();
