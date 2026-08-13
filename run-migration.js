const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gqromcfhiosfppqlottz.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_uh1cDxnWtzRT4fhYbiEWBg_fbnZkKwQ';

async function runMigration() {
  try {
    console.log('🚀 Starting database migration...\n');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Read the complete migration file
    const migrationPath = path.join(__dirname, 'migrations', '001_complete_migration_bundle.sql');
    console.log(`📄 Reading migration file: ${migrationPath}`);
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log(`✅ Migration file loaded (${migrationSQL.length} bytes)\n`);

    // For Supabase, we need to use the postgres.js client or execute via API
    // Since we can't directly execute raw SQL via JavaScript client,
    // we'll split and execute as individual statements where possible

    // Split by semicolon (simple approach - won't work with all SQL)
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📊 Found ${statements.length} SQL statements\n`);

    // Try a simple approach: list tables to verify connection
    console.log('🔍 Verifying Supabase connection...');
    const { data: tableList, error: tableError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .limit(10);

    if (tableError) {
      console.error('❌ Connection error:', tableError.message);
      console.log('\n💡 Note: Direct SQL execution is not available via JavaScript client.');
      console.log('   To run migrations, execute the SQL directly in Supabase SQL Editor:\n');
      console.log('   1. Go to: https://app.supabase.com/project/gqromcfhiosfppqlottz/sql/new');
      console.log('   2. Copy and paste the contents of: migrations/001_complete_migration_bundle.sql');
      console.log('   3. Click "Run"\n');
      return false;
    }

    console.log('✅ Connected to Supabase\n');
    console.log('📊 Existing tables:');
    if (tableList && tableList.length > 0) {
      tableList.forEach(t => console.log(`   - ${t.table_name}`));
    } else {
      console.log('   (No tables found)');
    }

    // Check if tables exist
    const { data: usersTable } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_name', 'users')
      .eq('table_schema', 'public');

    const { data: companiesTable } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_name', 'companies')
      .eq('table_schema', 'public');

    if (usersTable && usersTable.length > 0 && companiesTable && companiesTable.length > 0) {
      console.log('\n✅ Required tables already exist!');
      return true;
    }

    console.log('\n⚠️  Required tables do not exist.');
    console.log('To create tables, execute this SQL in Supabase SQL Editor:\n');

    // Show just the table creation statements
    const createTableStatements = statements.filter(s => s.toLowerCase().includes('create table'));
    createTableStatements.slice(0, 5).forEach((stmt, i) => {
      console.log(`\n-- Statement ${i + 1}:`);
      console.log(stmt.substring(0, 100) + '...');
    });

    return false;

  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

runMigration().then(success => {
  process.exit(success ? 0 : 1);
});
