import { Client } from 'pg';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import crypto from 'crypto';
import bcrypt from 'bcrypt';

const MASTER_EMAIL = 'kairolopesoficial@gmail.com';
const BCRYPT_ROUNDS = 10;

// Supabase connection details
const SUPABASE_HOST = 'gqromcfhiosfppqlottz.db.supabase.co';
const SUPABASE_PORT = 5432;
const SUPABASE_DB = 'postgres';
const SUPABASE_USER = 'postgres';

// For Supabase, we need to extract the password from the service role key
// The key format is: sb_secret_<actual_key_bytes>
// However, for PostgreSQL connections, we use the direct connection
// Let's use the environment or attempt connection with various approaches

async function executeMigrations() {
  const client = new Client({
    host: SUPABASE_HOST,
    port: SUPABASE_PORT,
    database: SUPABASE_DB,
    user: SUPABASE_USER,
    password: 'postgres', // Try default first, may need to be adjusted
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('Attempting to connect to Supabase PostgreSQL...');
    console.log(`Host: ${SUPABASE_HOST}`);
    console.log(`Port: ${SUPABASE_PORT}`);
    console.log(`Database: ${SUPABASE_DB}`);
    console.log(`User: ${SUPABASE_USER}\n`);

    await client.connect();
    console.log('✓ Connected successfully!\n');

    // Read the complete migration bundle
    const migrationPath = resolve('./migrations/001_complete_migration_bundle.sql');
    console.log(`Reading migration file: ${migrationPath}\n`);

    let sqlContent = readFileSync(migrationPath, 'utf-8');

    // Remove \echo lines as they're not valid SQL
    sqlContent = sqlContent
      .split('\n')
      .filter(line => !line.trim().startsWith('\\echo'))
      .join('\n');

    console.log(`Migration SQL size: ${sqlContent.length} bytes\n`);
    console.log('Executing migrations...\n');

    // Execute the migration
    try {
      await client.query(sqlContent);
      console.log('✓ Migrations executed successfully!\n');
    } catch (error) {
      console.error('Error executing SQL:');
      console.error(`Message: ${error.message}`);
      if (error.position) {
        console.error(`Position: ${error.position}`);
        const position = parseInt(error.position);
        const preview = sqlContent.substring(
          Math.max(0, position - 50),
          Math.min(sqlContent.length, position + 50)
        );
        console.error(`Context: ${preview.replace(/\n/g, ' ')}`);
      }

      throw error;
    }

    // Verify migration
    console.log('Verifying migration...\n');

    const tablesQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('companies', 'users', 'company_members', 'audit_logs')
      ORDER BY table_name;
    `;

    const tablesResult = await client.query(tablesQuery);
    console.log(`Tables found: ${tablesResult.rows.length}/4`);
    tablesResult.rows.forEach(row => {
      console.log(`  ✓ ${row.table_name}`);
    });

    // Now create the master user
    console.log('\n========================================');
    console.log('Creating Master User');
    console.log('========================================\n');

    // Generate password
    const plainPassword = generateSecurePassword(16);
    console.log(`✓ Generated secure password: ${plainPassword}`);
    console.log(`  - Length: ${plainPassword.length}`);
    console.log(`  - Uppercase: ${/[A-Z]/.test(plainPassword)}`);
    console.log(`  - Lowercase: ${/[a-z]/.test(plainPassword)}`);
    console.log(`  - Digits: ${/[0-9]/.test(plainPassword)}`);
    console.log(`  - Special: ${/[!@#$%^&*\-_=+]/.test(plainPassword)}\n`);

    // Hash password
    console.log('Hashing password with bcrypt (10 rounds)...');
    const passwordHash = await bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
    console.log('✓ Password hashed successfully\n');

    // Check if master company exists
    console.log('Checking for existing master company...');
    const companyQuery = 'SELECT * FROM companies WHERE slug = $1 LIMIT 1';
    const companyResult = await client.query(companyQuery, ['master']);

    let masterCompanyId;
    let companyOwnerId;

    if (companyResult.rows.length > 0) {
      const company = companyResult.rows[0];
      masterCompanyId = company.id;
      companyOwnerId = company.owner_id;
      console.log(`✓ Found existing master company: ${company.name} (ID: ${masterCompanyId})\n`);
    } else {
      console.log('✗ No master company found. Creating one...');
      masterCompanyId = crypto.randomUUID();
      companyOwnerId = crypto.randomUUID();

      const insertCompanyQuery = `
        INSERT INTO companies (id, name, slug, plan, status, owner_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING id, name, slug;
      `;

      const companyInsertResult = await client.query(insertCompanyQuery, [
        masterCompanyId,
        'Master Company',
        'master',
        'enterprise',
        'active',
        companyOwnerId
      ]);

      console.log(`✓ Created master company: ${companyInsertResult.rows[0].name} (ID: ${masterCompanyId})\n`);
    }

    // Create the master user
    console.log('Creating master user...');
    const userId = crypto.randomUUID();

    const insertUserQuery = `
      INSERT INTO users (
        id, company_id, email, role, password_hash,
        status, email_verified, email_verified_at, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), NOW())
      RETURNING id, email, role, status, company_id;
    `;

    const userInsertResult = await client.query(insertUserQuery, [
      userId,
      masterCompanyId,
      MASTER_EMAIL,
      'owner',
      passwordHash,
      'active',
      true
    ]);

    const user = userInsertResult.rows[0];
    console.log(`✓ Master user created successfully!\n`);

    // Verify the user
    console.log('Verifying user insertion...');
    const verifyQuery = 'SELECT * FROM users WHERE email = $1 LIMIT 1';
    const verifyResult = await client.query(verifyQuery, [MASTER_EMAIL]);

    if (verifyResult.rows.length > 0) {
      const verifiedUser = verifyResult.rows[0];
      console.log('✓ User verified in database\n');

      console.log('========================================');
      console.log('MASTER USER CREATED SUCCESSFULLY!');
      console.log('========================================\n');

      console.log('CREDENTIALS (Save this securely):');
      console.log(`Email: ${verifiedUser.email}`);
      console.log(`Password: ${plainPassword}`);
      console.log(`User ID: ${verifiedUser.id}`);
      console.log(`Company ID: ${verifiedUser.company_id}`);
      console.log(`Role: ${verifiedUser.role}`);
      console.log(`Status: ${verifiedUser.status}`);
      console.log(`Created At: ${verifiedUser.created_at}`);
      console.log('\n⚠️  This password will NOT be shown again. Store it securely!');
      console.log('========================================\n');
    } else {
      console.error('Error: User not found after creation!');
      process.exit(1);
    }

  } catch (error) {
    console.error('\nFatal Error:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('\nConnection refused. Possible causes:');
      console.error('1. Supabase PostgreSQL not accessible');
      console.error('2. Incorrect credentials');
      console.error('3. Network/firewall issues');
    } else if (error.code === 'ENOTFOUND') {
      console.error('\nHost not found. Check the database URL.');
    }
    process.exit(1);
  } finally {
    try {
      await client.end();
      console.log('Database connection closed.');
    } catch (err) {
      // ignore
    }
  }
}

// Helper: Generate secure password
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

// Run
executeMigrations().catch(error => {
  console.error('Execution failed:', error);
  process.exit(1);
});
