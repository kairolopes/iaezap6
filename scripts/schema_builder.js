#!/usr/bin/env node

/**
 * Schema Builder - Creates missing tables and columns
 * Programmatically builds the multi-tenant schema using Supabase SDK
 */

const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function checkTableExists(tableName) {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    if (error && error.message.includes('does not exist')) {
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

async function checkColumnExists(tableName, columnName) {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select(columnName, { head: true })
      .limit(1);

    if (error && error.message.includes('does not exist')) {
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

async function buildSchema() {
  console.log('\n' + '='.repeat(80));
  console.log('SCHEMA BUILDER - Multi-Tenant System Setup');
  console.log('='.repeat(80));

  try {
    // Step 1: Check if companies table exists
    console.log('\nSTEP 1: Checking tables...');
    console.log('-'.repeat(80));

    const companiesExists = await checkTableExists('companies');
    const usersExists = await checkTableExists('users');
    const apiInstancesExists = await checkTableExists('z_api_instances');

    console.log(`Companies table: ${companiesExists ? '✓ Exists' : '✗ Missing'}`);
    console.log(`Users table: ${usersExists ? '✓ Exists' : '✗ Missing'}`);
    console.log(`Z-API Instances table: ${apiInstancesExists ? '✓ Exists' : '✗ Missing'}`);

    // Step 2: Create companies table if missing
    if (!companiesExists) {
      console.log('\nSTEP 2: Creating companies table...');
      console.log('-'.repeat(80));

      // We'll insert a company to force table creation through the API
      // This is a workaround since we can't directly execute CREATE TABLE
      console.log('⚠ Companies table needs to be created in Supabase SQL editor');
      console.log('  Please run the following SQL:');
      console.log(`
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  plan VARCHAR(50) NOT NULL DEFAULT 'starter',
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  owner_id UUID NOT NULL,
  cnpj VARCHAR(18),
  metadata JSONB DEFAULT '{}',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
      `);
    } else {
      console.log('\nSTEP 2: Companies table already exists');
      console.log('-'.repeat(80));
      console.log('✓ Companies table verified');
    }

    // Step 3: Verify z_api_instances has company_id column
    console.log('\nSTEP 3: Checking z_api_instances columns...');
    console.log('-'.repeat(80));

    if (apiInstancesExists) {
      const hasCompanyId = await checkColumnExists('z_api_instances', 'company_id');
      console.log(`company_id column: ${hasCompanyId ? '✓ Exists' : '✗ Missing'}`);

      if (!hasCompanyId) {
        console.log('\n⚠ company_id column needs to be added to z_api_instances');
        console.log('  Please run the following SQL:');
        console.log(`
ALTER TABLE z_api_instances
ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_z_api_instances_company_id
  ON z_api_instances(company_id);
        `);
      }
    }

    // Step 4: Try to create default company
    console.log('\nSTEP 4: Creating default company...');
    console.log('-'.repeat(80));

    if (companiesExists) {
      const { data: existingCompany } = await supabase
        .from('companies')
        .select('id, slug')
        .eq('slug', 'default-company')
        .single()
        .catch(() => ({ data: null }));

      if (existingCompany) {
        console.log(`✓ Default company already exists`);
        console.log(`  ID: ${existingCompany.id}`);
        console.log(`  Slug: ${existingCompany.slug}`);
      } else {
        const { data: newCompany, error: createError } = await supabase
          .from('companies')
          .insert({
            id: '00000000-0000-0000-0000-000000000001',
            name: 'Default Company',
            slug: 'default-company',
            description: 'Default company for unassigned API instances',
            plan: 'starter',
            status: 'active',
            owner_id: '00000000-0000-0000-0000-000000000000',
            cnpj: '00.000.000/0000-00',
            metadata: {
              backfill_default: true,
              created_by_migration: '003_backfill_company_id',
            },
            settings: {},
          })
          .select()
          .single();

        if (createError) {
          console.log(`✗ Error creating default company: ${createError.message}`);
        } else if (newCompany) {
          console.log(`✓ Default company created`);
          console.log(`  ID: ${newCompany.id}`);
        }
      }
    }

    // Step 5: Check z_api_instances content
    console.log('\nSTEP 5: Checking z_api_instances content...');
    console.log('-'.repeat(80));

    const { data: instances, count } = await supabase
      .from('z_api_instances')
      .select('*', { count: 'exact' })
      .limit(1);

    console.log(`Total z_api_instances: ${count || 0}`);

    if (instances && instances.length > 0) {
      console.log('Sample instance columns:', Object.keys(instances[0]));
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('SCHEMA BUILDER SUMMARY');
    console.log('='.repeat(80));
    console.log('\n📋 Status:');
    console.log(`  Companies table: ${companiesExists ? '✓ Ready' : '⚠ Needs creation'}`);
    console.log(`  Z-API Instances table: ${apiInstancesExists ? '✓ Ready' : '⚠ Missing'}`);

    if (!companiesExists || !apiInstancesExists) {
      console.log('\n⚠ Some manual steps are required:');
      console.log('  1. Visit the Supabase SQL Editor: https://supabase.com/dashboard/project/gqromcfhiosfppqlottz/sql');
      console.log('  2. Run the SQL commands shown above to create missing tables/columns');
      console.log('  3. Then run: npm run backfill:execute');
    } else {
      console.log('\n✓ Schema is ready for backfill!');
    }

    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

buildSchema();
