import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Configuration
const SUPABASE_URL = 'https://gqromcfhiosfppqlottz.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_uh1cDxnWtzRT4fhYbiEWBg_fbnZkKwQ';
const MASTER_EMAIL = 'kairolopesoficial@gmail.com';
const BCRYPT_ROUNDS = 10;

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Helper: Generate secure random password
function generateSecurePassword(length = 16) {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const special = '!@#$%^&*-_=+';

  const allChars = uppercase + lowercase + digits + special;
  let password = '';

  // Ensure at least one of each type
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += digits[Math.floor(Math.random() * digits.length)];
  password += special[Math.floor(Math.random() * special.length)];

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

// Helper: Hash password with bcrypt
async function hashPassword(password) {
  return await bcrypt.hash(password, BCRYPT_ROUNDS);
}

// Check if migration is needed
async function checkMigrationStatus() {
  console.log('Checking database schema status...\n');

  try {
    const { data, error } = await supabase
      .from('companies')
      .select('id')
      .limit(1);

    if (error?.message?.includes('does not exist')) {
      return 'NOT_INITIALIZED';
    }

    return 'INITIALIZED';
  } catch (error) {
    return 'ERROR';
  }
}

// Get or create master company
async function getMasterCompany() {
  // First check if it exists
  const { data: existing } = await supabase
    .from('companies')
    .select('*')
    .eq('slug', 'master')
    .maybeSingle();

  if (existing) {
    console.log(`✓ Found existing master company: ${existing.name}`);
    console.log(`  - ID: ${existing.id}`);
    console.log(`  - Slug: ${existing.slug}`);
    console.log(`  - Status: ${existing.status}\n`);
    return existing;
  }

  // Create new master company
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

  console.log(`✓ Created master company: ${data.name}`);
  console.log(`  - ID: ${data.id}`);
  console.log(`  - Slug: ${data.slug}\n`);

  return data;
}

// Create master user
async function createMasterUser(plainPassword, passwordHash, masterCompany) {
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

  console.log(`✓ User created successfully`);
  console.log(`  - ID: ${data.id}`);
  console.log(`  - Email: ${data.email}`);
  console.log(`  - Role: ${data.role}\n`);

  return data;
}

// Verify user was created
async function verifyUser(email) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (error) {
    throw new Error(`Failed to verify user: ${error.message}`);
  }

  return data;
}

// Print migration instructions
function printMigrationInstructions() {
  const migrationPath = resolve('./migrations/001_complete_migration_bundle.sql');

  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║  DATABASE SCHEMA NOT INITIALIZED                              ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  console.log('The Supabase database schema needs to be initialized.');
  console.log('Please follow these steps:\n');

  console.log('1. Open Supabase Dashboard:');
  console.log('   URL: https://app.supabase.com/');
  console.log('   Project: gqromcfhiosfppqlottz\n');

  console.log('2. Navigate to: SQL Editor\n');

  console.log('3. Create a new query and copy the SQL from:');
  console.log(`   File: ${migrationPath}\n`);

  console.log('4. Run the query\n');

  console.log('5. After migration completes, run this script again:\n');
  console.log('   npm run master-user  OR  node scripts/setup_master_user_final.mjs\n');

  // Show first part of migration
  try {
    const content = readFileSync(migrationPath, 'utf-8');
    const lines = content.split('\n').slice(0, 30);
    console.log('Preview of migration SQL:');
    console.log('────────────────────────────────────────────────────────────────');
    console.log(lines.join('\n'));
    console.log('────────────────────────────────────────────────────────────────\n');
  } catch (err) {
    console.log(`Error reading migration file: ${err.message}\n`);
  }
}

// Main execution
async function main() {
  try {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║  IAeZap Master User Setup                                      ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    // Check migration status
    console.log('Step 1: Checking database schema...\n');
    const status = await checkMigrationStatus();

    if (status === 'NOT_INITIALIZED') {
      printMigrationInstructions();
      process.exit(1);
    }

    if (status === 'ERROR') {
      console.error('Error: Could not determine database status');
      process.exit(1);
    }

    console.log('✓ Database schema is initialized\n');

    // Generate password
    console.log('Step 2: Generating secure master password...\n');
    const plainPassword = generateSecurePassword(16);
    console.log(`✓ Generated password: ${plainPassword}`);
    console.log(`  - Length: ${plainPassword.length} characters`);
    console.log(`  - Contains uppercase: ${/[A-Z]/.test(plainPassword)}`);
    console.log(`  - Contains lowercase: ${/[a-z]/.test(plainPassword)}`);
    console.log(`  - Contains digits: ${/[0-9]/.test(plainPassword)}`);
    console.log(`  - Contains special chars: ${/[!@#$%^&*\-_=+]/.test(plainPassword)}\n`);

    // Hash password
    console.log('Step 3: Hashing password (bcrypt, 10 rounds)...\n');
    const passwordHash = await hashPassword(plainPassword);
    console.log('✓ Password hashed securely\n');

    // Get or create master company
    console.log('Step 4: Setting up master company...\n');
    const masterCompany = await getMasterCompany();

    // Create master user
    console.log('Step 5: Creating master user...\n');
    const user = await createMasterUser(plainPassword, passwordHash, masterCompany);

    // Verify user
    console.log('Step 6: Verifying user creation...\n');
    const verifiedUser = await verifyUser(MASTER_EMAIL);

    // Display results
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║  MASTER USER CREATED SUCCESSFULLY!                             ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    console.log('LOGIN CREDENTIALS (Save securely):');
    console.log('────────────────────────────────────────────────────────────────');
    console.log(`Email:      ${verifiedUser.email}`);
    console.log(`Password:   ${plainPassword}`);
    console.log(`────────────────────────────────────────────────────────────────\n`);

    console.log('ADDITIONAL DETAILS:');
    console.log('────────────────────────────────────────────────────────────────');
    console.log(`User ID:        ${verifiedUser.id}`);
    console.log(`Company ID:     ${verifiedUser.company_id}`);
    console.log(`Role:           ${verifiedUser.role}`);
    console.log(`Status:         ${verifiedUser.status}`);
    console.log(`Email Verified: ${verifiedUser.email_verified}`);
    console.log(`Created:        ${verifiedUser.created_at}`);
    console.log('────────────────────────────────────────────────────────────────\n');

    console.log('⚠️  IMPORTANT SECURITY NOTICES:\n');
    console.log('  • This password will NOT be displayed again');
    console.log('  • Store this password securely in a password manager');
    console.log('  • Never commit this password to version control');
    console.log('  • Consider changing the password after first login');
    console.log('  • Never share this password with anyone\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('\nDebugging Info:');
    console.error(`Error Type: ${error.name}`);
    console.error(`Stack: ${error.stack}`);
    process.exit(1);
  }
}

main();
