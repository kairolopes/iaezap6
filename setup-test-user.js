/**
 * Setup Test User for JWT Claims Testing
 * Creates a company and test user in the database
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('crypto').randomUUID ? require('crypto') : { v4: () => Math.random().toString(36).substring(7) };

// Color constants
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function setupTestUser() {
  log(`\n${'='.repeat(80)}`, 'bold');
  log('SETUP TEST USER', 'bold');
  log(`${'='.repeat(80)}\n`, 'bold');

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      log('Missing Supabase configuration', 'red');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Generate UUIDs for company and user
    const crypto = require('crypto');
    const companyId = crypto.randomUUID();
    const userId = crypto.randomUUID();

    // Test data
    const testEmail = 'test.jwt@example.com';
    const testPassword = 'TestPassword123!@#';
    const hashedPassword = await bcrypt.hash(testPassword, 10);

    log('Step 1: Creating test company...', 'blue');
    log('-'.repeat(80), 'blue');

    // Check if company exists
    const { data: existingCompanies } = await supabase
      .from('companies')
      .select('id')
      .eq('cnpj', '12345678901234')
      .limit(1);

    let company = existingCompanies && existingCompanies.length > 0 ? existingCompanies[0] : null;

    if (!company) {
      const { data: newCompany, error: companyError } = await supabase
        .from('companies')
        .insert([
          {
            id: companyId,
            cnpj: '12345678901234',
            name: 'JWT Test Company',
            status: 'active',
            created_at: new Date().toISOString(),
          },
        ])
        .select('id, cnpj, name')
        .single();

      if (companyError) {
        log(`Error creating company: ${companyError.message}`, 'red');
        return;
      }

      company = newCompany;
      log(`Company created: ${company.id}`, 'green');
    } else {
      log(`Company already exists: ${company.id}`, 'yellow');
    }

    // Step 2: Create test user
    log('\nStep 2: Creating test user...', 'blue');
    log('-'.repeat(80), 'blue');

    // Check if user exists
    const { data: existingUsers } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', testEmail)
      .limit(1);

    let testUser = existingUsers && existingUsers.length > 0 ? existingUsers[0] : null;

    if (!testUser) {
      const { data: newUser, error: userError } = await supabase
        .from('users')
        .insert([
          {
            id: userId,
            email: testEmail,
            password_hash: hashedPassword,
            company_id: company.id,
            role: 'admin',
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ])
        .select('id, email, company_id, role')
        .single();

      if (userError) {
        log(`Error creating user: ${userError.message}`, 'red');
        return;
      }

      testUser = newUser;
      log(`User created: ${testUser.id}`, 'green');
    } else {
      log(`User already exists: ${testUser.id}`, 'yellow');
      // Update the password
      const { error: updateError } = await supabase
        .from('users')
        .update({ password_hash: hashedPassword })
        .eq('id', testUser.id);

      if (updateError) {
        log(`Error updating password: ${updateError.message}`, 'red');
      } else {
        log(`Password updated for user ${testUser.email}`, 'green');
      }
    }

    log('\n' + '='.repeat(80), 'bold');
    log('TEST USER SETUP COMPLETE', 'bold');
    log('='.repeat(80), 'bold');

    log('\nTest Credentials:', 'cyan');
    log(`  Email: ${testEmail}`, 'cyan');
    log(`  Password: ${testPassword}`, 'cyan');
    log(`  Company ID: ${company.id}`, 'cyan');
    log(`  User ID: ${testUser.id}`, 'cyan');
    log(`  Role: ${testUser.role}`, 'cyan');

    log('\nYou can now run: node test-jwt-direct.js', 'green');

  } catch (error) {
    log(`\n✗ Setup failed with error: ${error.message}`, 'red');
    log(error.stack, 'red');
  }

  log('\n' + '='.repeat(80) + '\n', 'bold');
}

setupTestUser().catch((error) => {
  log(`Fatal error: ${error.message}`, 'red');
  process.exit(1);
});
