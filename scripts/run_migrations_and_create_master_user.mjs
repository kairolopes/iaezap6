import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import crypto from 'crypto';
import bcrypt from 'bcrypt';

// Configuration
const SUPABASE_URL = 'https://gqromcfhiosfppqlottz.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_uh1cDxnWtzRT4fhYbiEWBg_fbnZkKwQ';
const MASTER_EMAIL = 'kairolopesoficial@gmail.com';
const BCRYPT_ROUNDS = 10;

// Initialize Supabase client with service role
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Helper: Execute SQL via RPC or direct query
async function executeSql(sql) {
  try {
    // Try using the rpc approach with exec_sql if available
    // Otherwise, we'll need to handle this differently
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    return { data, error };
  } catch (err) {
    console.error('RPC method not available, will create tables via REST API');
    return { data: null, error: err };
  }
}

// Check if tables exist
async function checkTablesExist() {
  console.log('Checking if tables already exist...');

  const { data, error } = await supabase
    .from('companies')
    .select('id')
    .limit(1);

  if (error && error.code === 'PGRST116') {
    console.log('Tables do not exist yet.');
    return false;
  }

  if (error && error.code?.includes('does not exist')) {
    console.log('Tables do not exist yet.');
    return false;
  }

  console.log('Tables already exist!');
  return true;
}

// Manual table creation using REST API
async function createTablesManually() {
  console.log('\nCreating tables manually via REST API...');

  // For Supabase, we would need to use the management API or PostgreSQL client
  // Since the REST API doesn't support DDL, we need a different approach

  // Option 1: Use direct PostgreSQL connection (requires pg package)
  console.log('Note: Direct table creation requires admin access');
  console.log('Please execute the migration SQL directly in Supabase dashboard:');
  console.log('Path: migrations/001_complete_migration_bundle.sql');

  return false;
}

// Step 1: Generate secure random password
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
  password = password.split('').sort(() => Math.random() - 0.5).join('');

  return password;
}

// Step 2: Hash password with bcrypt
async function hashPassword(password) {
  return await bcrypt.hash(password, BCRYPT_ROUNDS);
}

// Step 3: Query companies table for master company
async function getMasterCompany() {
  console.log('\nStep 3: Querying for master company...');

  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('slug', 'master')
    .limit(1)
    .single();

  if (error && error.code === 'PGRST116') {
    console.log('✗ No master company found. Creating one...');

    const tempOwnerId = crypto.randomUUID();

    const { data: newCompany, error: createError } = await supabase
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

    if (createError) {
      throw new Error(`Error creating master company: ${createError.message}`);
    }

    console.log(`✓ Created master company with ID: ${newCompany.id}`);
    return newCompany;
  }

  if (error) {
    throw new Error(`Error querying companies: ${error.message}`);
  }

  console.log(`✓ Found existing master company with ID: ${data.id}`);
  return data;
}

// Step 4: Insert user
async function createMasterUser(plainPassword, passwordHash, masterCompany) {
  console.log('\nStep 4: Creating master user...');

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
    throw new Error(`Error creating user: ${error.message}`);
  }

  console.log(`✓ User created with ID: ${data.id}`);
  return { user: data, password: plainPassword };
}

// Step 5: Verify insertion
async function verifyUser(email) {
  console.log('\nStep 5: Verifying user insertion...');

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (error) {
    throw new Error(`Error verifying user: ${error.message}`);
  }

  console.log('✓ User verified in database');
  console.log(`  - User ID: ${data.id}`);
  console.log(`  - Email: ${data.email}`);
  console.log(`  - Company ID: ${data.company_id}`);
  console.log(`  - Role: ${data.role}`);
  console.log(`  - Status: ${data.status}`);

  return data;
}

// Main execution
async function main() {
  try {
    console.log('========================================');
    console.log('Setting Up Supabase & Creating Master User');
    console.log('========================================');

    // Check if tables exist
    const tablesExist = await checkTablesExist();

    if (!tablesExist) {
      console.log('\n⚠️  Database schema not initialized!');
      console.log('Please run the following steps manually:');
      console.log('1. Go to Supabase Dashboard > SQL Editor');
      console.log('2. Create a new query');
      console.log('3. Copy and paste the contents of: migrations/001_complete_migration_bundle.sql');
      console.log('4. Run the query');
      console.log('5. Then run this script again\n');

      // Read migration file to show what needs to be done
      const migrationPath = resolve('./migrations/001_complete_migration_bundle.sql');
      const migrationContent = readFileSync(migrationPath, 'utf-8');
      console.log('Migration SQL (first 500 chars):');
      console.log(migrationContent.substring(0, 500));
      console.log('\n...\n');

      process.exit(1);
    }

    // Step 1: Generate password
    console.log('\nStep 1: Generating secure password...');
    const plainPassword = generateSecurePassword(16);
    console.log(`✓ Generated password: ${plainPassword}`);
    console.log(`  Length: ${plainPassword.length}`);
    console.log(`  Contains uppercase: ${/[A-Z]/.test(plainPassword)}`);
    console.log(`  Contains lowercase: ${/[a-z]/.test(plainPassword)}`);
    console.log(`  Contains digits: ${/[0-9]/.test(plainPassword)}`);
    console.log(`  Contains special: ${/[!@#$%^&*\-_=+]/.test(plainPassword)}`);

    // Step 2: Hash password
    console.log('\nStep 2: Hashing password with bcrypt (10 rounds)...');
    const passwordHash = await hashPassword(plainPassword);
    console.log(`✓ Password hashed successfully`);

    // Step 3: Get master company
    const masterCompany = await getMasterCompany();

    // Step 4: Create user
    const { user, password } = await createMasterUser(plainPassword, passwordHash, masterCompany);

    // Step 5: Verify insertion
    const verifiedUser = await verifyUser(MASTER_EMAIL);

    // Return results
    console.log('\n========================================');
    console.log('Master User Created Successfully!');
    console.log('========================================');
    console.log('\nCREDENTIALS (Save this securely):');
    console.log(`Email: ${verifiedUser.email}`);
    console.log(`Password: ${password}`);
    console.log(`User ID: ${verifiedUser.id}`);
    console.log(`Company ID: ${verifiedUser.company_id}`);
    console.log(`Role: ${verifiedUser.role}`);
    console.log(`Status: ${verifiedUser.status}`);
    console.log('\n⚠️  This password will not be shown again. Store it securely!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nStack:', error.stack);
    process.exit(1);
  }
}

main();
