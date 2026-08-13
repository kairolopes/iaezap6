const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Load environment variables
const envPath = '.env.local';
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};

envContent.split('\n').forEach(line => {
  if (line && !line.startsWith('#')) {
    const [key, ...valueParts] = line.split('=');
    if (key) {
      env[key.trim()] = valueParts.join('=').trim().replace(/^"(.*)"$/, '$1');
    }
  }
});

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Connecting to Supabase...');
console.log('URL:', SUPABASE_URL);

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function checkTableExists(tableName) {
  try {
    const { data, error, count } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    if (error && error.code === 'PGRST116') {
      return { exists: false, accessible: false };
    }
    return { exists: true, accessible: !error, count: count || 0 };
  } catch (e) {
    return { exists: false, accessible: false };
  }
}

async function runVerification() {
  try {
    console.log('\n=== DATABASE SCHEMA VERIFICATION ===\n');

    // List of tables that should exist based on migrations
    const expectedTables = [
      'companies',
      'users',
      'token_rotations',
      'password_reset_tokens',
      'webhooks',
      'messages',
      'contacts',
      'teams',
      'audit_logs'
    ];

    console.log('1. CHECKING TABLE EXISTENCE:');
    let existingTables = 0;
    let totalRows = 0;

    for (const tableName of expectedTables) {
      const result = await checkTableExists(tableName);
      if (result.accessible) {
        existingTables++;
        totalRows += result.count || 0;
        const status = result.exists ? 'EXISTS' : 'EXISTS*';
        console.log(`    ${status}: ${tableName} (${result.count || 0} rows)`);
      }
    }

    console.log(`\n  Summary: ${existingTables} tables accessible, ${totalRows} total rows`);

    // Query 4: Check master company exists (ID: 00000000-0000-0000-0000-000000000001)
    console.log('\n2. MASTER COMPANY VERIFICATION:');
    const masterCompanyId = '00000000-0000-0000-0000-000000000001';

    try {
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('id, name, slug, plan, status, owner_id')
        .eq('id', masterCompanyId)
        .single();

      if (companyError) {
        if (companyError.code === 'PGRST116') {
          console.log(`  STATUS: NOT FOUND (companies table not accessible)`);
        } else {
          console.log(`  STATUS: NOT FOUND`);
          console.log(`  Error: ${companyError.message}`);
        }
      } else if (company) {
        console.log(`  STATUS: FOUND`);
        console.log(`    - ID: ${company.id}`);
        console.log(`    - Name: ${company.name}`);
        console.log(`    - Slug: ${company.slug}`);
        console.log(`    - Plan: ${company.plan}`);
        console.log(`    - Status: ${company.status}`);
        console.log(`    - Owner ID: ${company.owner_id}`);
      } else {
        console.log(`  STATUS: NOT FOUND (query returned no results)`);
      }
    } catch (error) {
      console.log(`  STATUS: ERROR - ${error.message}`);
    }

    // Query 5: Check master user exists (kairolopesoficial@gmail.com)
    console.log('\n3. MASTER USER VERIFICATION:');
    const masterEmail = 'kairolopesoficial@gmail.com';

    try {
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, email, full_name, company_id, role, status')
        .eq('email', masterEmail)
        .single();

      if (userError) {
        if (userError.code === 'PGRST116') {
          console.log(`  STATUS: NOT FOUND (users table not accessible)`);
        } else {
          console.log(`  STATUS: NOT FOUND`);
          console.log(`  Error: ${userError.message}`);
        }
      } else if (user) {
        console.log(`  STATUS: FOUND`);
        console.log(`    - ID: ${user.id}`);
        console.log(`    - Email: ${user.email}`);
        console.log(`    - Full Name: ${user.full_name || 'N/A'}`);
        console.log(`    - Company ID: ${user.company_id}`);
        console.log(`    - Role: ${user.role}`);
        console.log(`    - Status: ${user.status}`);
        console.log(`    - Associated with Master Company: ${user.company_id === '00000000-0000-0000-0000-000000000001' ? 'YES' : 'NO'}`);
      } else {
        console.log(`  STATUS: NOT FOUND (query returned no results)`);
      }
    } catch (error) {
      console.log(`  STATUS: ERROR - ${error.message}`);
    }

    // Count companies
    console.log('\n4. COMPANY DATA:');
    try {
      const { data: companies, error: companiesError, count: companiesCount } = await supabase
        .from('companies')
        .select('*', { count: 'exact' });

      if (!companiesError) {
        console.log(`  Total companies: ${companiesCount}`);
        if (companies && companies.length > 0) {
          console.log(`  Companies in database:`);
          companies.forEach(c => {
            console.log(`    - ${c.name} (ID: ${c.id})`);
          });
        }
      } else {
        console.log(`  Error: ${companiesError.message}`);
      }
    } catch (error) {
      console.log(`  Error: ${error.message}`);
    }

    // Count users
    console.log('\n5. USER DATA:');
    try {
      const { data: users, error: usersError, count: usersCount } = await supabase
        .from('users')
        .select('*', { count: 'exact' });

      if (!usersError) {
        console.log(`  Total users: ${usersCount}`);
        if (users && users.length > 0) {
          console.log(`  Users in database:`);
          users.forEach(u => {
            console.log(`    - ${u.email} (Company: ${u.company_id})`);
          });
        }
      } else {
        console.log(`  Error: ${usersError.message}`);
      }
    } catch (error) {
      console.log(`  Error: ${error.message}`);
    }

    console.log('\n=== VERIFICATION SUMMARY ===');
    console.log('Tables accessible and verified:');
    for (const tableName of expectedTables) {
      const result = await checkTableExists(tableName);
      console.log(`  ${tableName}: ${result.accessible ? 'ACCESSIBLE' : 'NOT ACCESSIBLE'}`);
    }
    console.log('\nNote: Full index and RLS policy counts require psql access');
    console.log('      Review with: psql <connection> -c "SELECT COUNT(*) FROM pg_indexes WHERE schemaname=\'public\'"');
    console.log('                   psql <connection> -c "SELECT COUNT(*) FROM pg_policies"\n');

  } catch (error) {
    console.error('Fatal error:', error.message);
  }
}

runVerification();
