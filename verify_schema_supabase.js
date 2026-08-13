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

async function runVerification() {
  try {
    console.log('\n=== DATABASE SCHEMA VERIFICATION ===\n');

    // Query 1: List all tables in public schema with row counts
    console.log('1. TABLES IN PUBLIC SCHEMA WITH ROW COUNTS:');

    // Get all table names by trying to fetch from information_schema
    const { data: tables, error: tablesError } = await supabase.rpc('get_tables_with_row_count');

    if (tablesError) {
      console.log('  Note: RPC function not available, fetching tables directly...');

      // Try to fetch from public tables we know should exist
      const knownTables = [
        'companies',
        'users',
        'auth.users',
        'webhooks',
        'audit_logs',
        'messages',
        'contacts',
        'teams'
      ];

      console.log(`  Checking known tables:`);
      let totalRows = 0;

      for (const tableName of knownTables) {
        try {
          const { data, error, count } = await supabase
            .from(tableName)
            .select('*', { count: 'exact', head: true });

          if (!error) {
            console.log(`    - ${tableName}: ${count || 0} rows`);
            totalRows += count || 0;
          }
        } catch (e) {
          // Table doesn't exist or not accessible
        }
      }
      console.log(`  Total rows in accessible tables: ${totalRows}`);
    } else if (tables && tables.length > 0) {
      console.log(`  Found ${tables.length} tables:`);
      tables.forEach(t => {
        console.log(`    - ${t.table_name}: ${t.row_count} rows`);
      });
    }

    // Query 2: Count all indexes (expected 25+)
    console.log('\n2. INDEX COUNT (expected 25+):');
    const { data: indexData, error: indexError } = await supabase.rpc('count_indexes_by_schema', {
      schema_name: 'public'
    });

    if (indexError) {
      console.log('  Note: RPC not available - check via database tool');
    } else if (indexData && indexData.length > 0) {
      const count = indexData[0].count;
      console.log(`  Total indexes: ${count}`);
      console.log(`  Status: ${count >= 25 ? 'PASS' : 'FAIL'} (expected 25+)`);
    }

    // Query 3: Count all RLS policies (expected 13+)
    console.log('\n3. RLS POLICIES COUNT (expected 13+):');
    const { data: rlsData, error: rlsError } = await supabase.rpc('count_rls_policies');

    if (rlsError) {
      console.log('  Note: RPC not available - check via database tool');
    } else if (rlsData && rlsData.length > 0) {
      const count = rlsData[0].count;
      console.log(`  Total RLS policies: ${count}`);
      console.log(`  Status: ${count >= 13 ? 'PASS' : 'FAIL'} (expected 13+)`);
    }

    // Query 4: Check master company exists (ID: 00000000-0000-0000-0000-000000000001)
    console.log('\n4. MASTER COMPANY VERIFICATION:');
    const masterCompanyId = '00000000-0000-0000-0000-000000000001';
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, name, cnpj')
      .eq('id', masterCompanyId)
      .single();

    if (companyError) {
      console.log(`  STATUS: NOT FOUND`);
      console.log(`  Error: ${companyError.message}`);
    } else if (company) {
      console.log(`  STATUS: FOUND`);
      console.log(`    - ID: ${company.id}`);
      console.log(`    - Name: ${company.name || 'N/A'}`);
      console.log(`    - CNPJ: ${company.cnpj || 'N/A'}`);
    }

    // Query 5: Check master user exists (kairolopesoficial@gmail.com)
    console.log('\n5. MASTER USER VERIFICATION:');
    const masterEmail = 'kairolopesoficial@gmail.com';
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, company_id, role')
      .eq('email', masterEmail)
      .single();

    if (userError) {
      console.log(`  STATUS: NOT FOUND`);
      console.log(`  Error: ${userError.message}`);
    } else if (user) {
      console.log(`  STATUS: FOUND`);
      console.log(`    - ID: ${user.id}`);
      console.log(`    - Email: ${user.email}`);
      console.log(`    - Company ID: ${user.company_id}`);
      console.log(`    - Role: ${user.role || 'N/A'}`);
    }

    console.log('\n=== VERIFICATION COMPLETE ===');
    console.log('Note: Some metrics require psql access or custom RPC functions');
    console.log('      that may not be available in this environment.\n');

  } catch (error) {
    console.error('Fatal error:', error.message);
  }
}

runVerification();
