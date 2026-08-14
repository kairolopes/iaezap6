import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SUPABASE_URL = 'https://gqromcfhiosfppqlottz.supabase.co';
const SERVICE_ROLE_KEY = 'sb_secret_uh1cDxnWtzRT4fhYbiEWBg_fbnZkKwQ';
const MASTER_COMPANY_ID = '00000000-0000-0000-0000-000000000001';
const MASTER_USER_ID = '00000000-0000-0000-0000-000000000002';
const MASTER_EMAIL = 'kairolopesoficial@gmail.com';
const PASSWORD_HASH = '$2b$10$vFX3Giqy3DymRSXd1.8M6uKFHD37G9WlzsJEdXE.Fv8fmQdrdJWLW';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function ensureTables() {
  console.log('Step 1: Ensuring database schema exists...\n');

  try {
    // Try to query companies table
    const { error: compError } = await supabase
      .from('companies')
      .select('id')
      .limit(1);

    if (compError?.message?.includes('does not exist')) {
      console.log('⚠️  Tables do not exist. Creating minimal schema...\n');

      // Since we can't execute raw DDL easily with the JS client, we'll need to handle this differently
      console.log('ERROR: Database schema not initialized.\n');
      console.log('To initialize the database schema, please follow these steps:\n');
      console.log('1. Open Supabase Dashboard: https://app.supabase.com/projects');
      console.log('2. Select project: gqromcfhiosfppqlottz');
      console.log('3. Go to: SQL Editor');
      console.log('4. Click: New Query');
      console.log('5. Copy and paste the following SQL:\n');

      const schemaSQL = `
-- Create enum type
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('owner', 'admin', 'member', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create companies table
CREATE TABLE IF NOT EXISTS companies (
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
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
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
  last_activity_at TIMESTAMP WITH TIME ZONE,
  preferences JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT users_email_company_unique UNIQUE (company_id, email)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_company_email ON users(company_id, email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_companies_slug ON companies(slug) WHERE deleted_at IS NULL;
`;

      console.log(schemaSQL);
      console.log('\n6. Click: Run');
      console.log('7. After the query completes, run this script again.\n');

      process.exit(1);
    }

    console.log('✓ Database schema appears to be initialized\n');
    return true;
  } catch (error) {
    console.error('Error checking schema:', error.message);
    process.exit(1);
  }
}

async function ensureMasterCompany() {
  console.log('Step 2: Ensuring master company exists...\n');

  try {
    const { data: existing, error: selectError } = await supabase
      .from('companies')
      .select('*')
      .eq('id', MASTER_COMPANY_ID)
      .maybeSingle();

    if (existing) {
      console.log(`✓ Master company already exists`);
      console.log(`  ID: ${existing.id}`);
      console.log(`  Name: ${existing.name}\n`);
      return existing;
    }

    console.log('Creating master company...');
    const { data: newCompany, error: createError } = await supabase
      .from('companies')
      .insert({
        id: MASTER_COMPANY_ID,
        name: 'Master Company',
        slug: 'master',
        plan: 'enterprise',
        status: 'active',
        owner_id: MASTER_USER_ID,
      })
      .select()
      .single();

    if (createError) {
      throw createError;
    }

    console.log(`✓ Master company created`);
    console.log(`  ID: ${newCompany.id}`);
    console.log(`  Name: ${newCompany.name}\n`);

    return newCompany;
  } catch (error) {
    console.error('Error ensuring master company:', error.message);
    throw error;
  }
}

async function createMasterUser() {
  console.log('Step 3: Creating master user...\n');

  try {
    // Check if user already exists
    const { data: existing } = await supabase
      .from('users')
      .select('*')
      .eq('email', MASTER_EMAIL)
      .maybeSingle();

    if (existing) {
      console.log(`✓ Master user already exists`);
      console.log(`  Email: ${existing.email}`);
      console.log(`  ID: ${existing.id}`);
      console.log(`  Role: ${existing.role}\n`);
      return existing;
    }

    console.log('Inserting master user...');
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        id: MASTER_USER_ID,
        company_id: MASTER_COMPANY_ID,
        email: MASTER_EMAIL,
        password_hash: PASSWORD_HASH,
        full_name: 'Master Admin',
        role: 'owner',
        status: 'active',
        email_verified: true,
        email_verified_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    console.log(`✓ Master user created`);
    console.log(`  Email: ${newUser.email}`);
    console.log(`  ID: ${newUser.id}`);
    console.log(`  Role: ${newUser.role}\n`);

    return newUser;
  } catch (error) {
    console.error('Error creating master user:', error.message);
    throw error;
  }
}

async function verifyUser() {
  console.log('Step 4: Verifying user creation...\n');

  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, role, company_id, status, email_verified, created_at')
      .eq('email', MASTER_EMAIL);

    if (error) {
      throw error;
    }

    if (!users || users.length === 0) {
      throw new Error('User not found after creation');
    }

    const user = users[0];
    return user;
  } catch (error) {
    console.error('Error verifying user:', error.message);
    throw error;
  }
}

async function main() {
  try {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║  Creating Master User in Supabase Database                     ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    // Step 1: Ensure tables exist
    await ensureTables();

    // Step 2: Ensure master company
    await ensureMasterCompany();

    // Step 3: Create master user
    await createMasterUser();

    // Step 4: Verify
    const user = await verifyUser();

    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║  VERIFICATION RESULTS                                          ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    console.log('SQL Query: SELECT id, email, role FROM users WHERE email=\'kairolopesoficial@gmail.com\';\n');

    console.log('Results:');
    console.log(`  user_id: ${user.id}`);
    console.log(`  email: ${user.email}`);
    console.log(`  role: ${user.role}`);
    console.log(`  company_id: ${user.company_id}`);
    console.log(`  status: ${user.status}`);
    console.log(`  email_verified: ${user.email_verified}`);
    console.log(`  created_at: ${user.created_at}\n`);

    console.log('Summary: Master user created successfully!');

  } catch (error) {
    console.error('\n✗ ERROR:', error.message);
    process.exit(1);
  }
}

main();
