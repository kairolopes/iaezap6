const { Pool } = require('pg');
const fs = require('fs');

// Load environment variables
const envPath = 'C:\\Users\\Kairo Lopes\\OneDrive\\Documentos\\Kairo\\claude code\\iaezap6\\.env.local';
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};

envContent.split('\n').forEach(line => {
  if (line && !line.startsWith('#')) {
    const [key, ...valueParts] = line.split('=');
    if (key) {
      env[key.trim()] = valueParts.join('=').trim();
    }
  }
});

// Supabase database connection
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
// Extract database URL from Supabase
// Format: https://xxxxx.supabase.co
// DB connection: postgres://user:password@xxxxx.supabase.co:5432/postgres

const projectId = SUPABASE_URL.split('//')[1].split('.')[0];

const pool = new Pool({
  host: `${projectId}.supabase.co`,
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: env.SUPABASE_SERVICE_ROLE_KEY ? env.SUPABASE_SERVICE_ROLE_KEY.split('_')[2] : 'temp',
  // Actually, let's try a different approach
});

// Actually, let me use a connection string approach
const connectionString = `postgresql://postgres.${projectId}:${env.SUPABASE_SERVICE_ROLE_KEY}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;

const pool2 = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function runVerification() {
  const client = await pool2.connect();

  try {
    console.log('\n=== DATABASE SCHEMA VERIFICATION ===\n');

    // Query 1: List all tables in public schema with row counts
    console.log('1. TABLES IN PUBLIC SCHEMA WITH ROW COUNTS:');
    const tablesQuery = `
      SELECT
        t.tablename,
        (SELECT n_live_tup FROM pg_stat_user_tables WHERE relname = t.tablename) as row_count
      FROM pg_tables t
      WHERE t.schemaname = 'public'
      ORDER BY t.tablename;
    `;

    const tablesResult = await client.query(tablesQuery);
    console.log(`  Found ${tablesResult.rows.length} tables:`);
    let totalRows = 0;
    tablesResult.rows.forEach(row => {
      const rowCount = row.row_count || 0;
      totalRows += rowCount;
      console.log(`    - ${row.tablename}: ${rowCount} rows`);
    });
    console.log(`  Total rows across all tables: ${totalRows}`);

    // Query 2: Count all indexes (expected 25+)
    console.log('\n2. INDEX COUNT (expected 25+):');
    const indexQuery = `
      SELECT COUNT(*) as index_count
      FROM pg_indexes
      WHERE schemaname = 'public';
    `;

    const indexResult = await client.query(indexQuery);
    const indexCount = indexResult.rows[0].index_count;
    console.log(`  Total indexes: ${indexCount}`);
    console.log(`  Status: ${indexCount >= 25 ? 'PASS' : 'FAIL'} (expected 25+)`);

    // Query 3: Count all RLS policies (expected 13+)
    console.log('\n3. RLS POLICIES COUNT (expected 13+):');
    const rlsQuery = `
      SELECT COUNT(*) as policy_count
      FROM pg_policies;
    `;

    const rlsResult = await client.query(rlsQuery);
    const policyCount = rlsResult.rows[0].policy_count;
    console.log(`  Total RLS policies: ${policyCount}`);
    console.log(`  Status: ${policyCount >= 13 ? 'PASS' : 'FAIL'} (expected 13+)`);

    // Query 4: Check master company exists (ID: 00000000-0000-0000-0000-000000000001)
    console.log('\n4. MASTER COMPANY VERIFICATION:');
    const masterCompanyId = '00000000-0000-0000-0000-000000000001';
    const companyQuery = `
      SELECT id, name, cnpj
      FROM companies
      WHERE id = $1;
    `;

    const companyResult = await client.query(companyQuery, [masterCompanyId]);
    if (companyResult.rows.length > 0) {
      const company = companyResult.rows[0];
      console.log(`  STATUS: FOUND`);
      console.log(`    - ID: ${company.id}`);
      console.log(`    - Name: ${company.name || 'N/A'}`);
      console.log(`    - CNPJ: ${company.cnpj || 'N/A'}`);
    } else {
      console.log(`  STATUS: NOT FOUND`);
    }

    // Query 5: Check master user exists (kairolopesoficial@gmail.com)
    console.log('\n5. MASTER USER VERIFICATION:');
    const masterEmail = 'kairolopesoficial@gmail.com';
    const userQuery = `
      SELECT id, email, company_id, role
      FROM users
      WHERE email = $1;
    `;

    const userResult = await client.query(userQuery, [masterEmail]);
    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      console.log(`  STATUS: FOUND`);
      console.log(`    - ID: ${user.id}`);
      console.log(`    - Email: ${user.email}`);
      console.log(`    - Company ID: ${user.company_id}`);
      console.log(`    - Role: ${user.role || 'N/A'}`);
    } else {
      console.log(`  STATUS: NOT FOUND`);
    }

    // Summary
    console.log('\n=== VERIFICATION SUMMARY ===');
    console.log(`  Tables: ${tablesResult.rows.length}`);
    console.log(`  Indexes: ${indexCount} (expected 25+) - ${indexCount >= 25 ? 'PASS' : 'FAIL'}`);
    console.log(`  RLS Policies: ${policyCount} (expected 13+) - ${policyCount >= 13 ? 'PASS' : 'FAIL'}`);
    console.log(`  Master Company: ${companyResult.rows.length > 0 ? 'FOUND' : 'NOT FOUND'}`);
    console.log(`  Master User: ${userResult.rows.length > 0 ? 'FOUND' : 'NOT FOUND'}`);
    console.log('\n');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.release();
    await pool2.end();
  }
}

runVerification();
