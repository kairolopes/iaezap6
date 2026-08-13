import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const DEFAULT_COMPANY_ID = '00000000-0000-0000-0000-000000000001';

async function executeFullMigration() {
  try {
    console.log('========================================');
    console.log('FULL COMPANY MIGRATION & BACKFILL');
    console.log('========================================\n');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    console.log('Connecting to Supabase...');
    console.log(`URL: ${SUPABASE_URL}\n`);

    // ========================================
    // PHASE 1: Check and Create Companies Table
    // ========================================
    console.log('========================================');
    console.log('PHASE 1: Setup Companies Table');
    console.log('========================================\n');

    console.log('Checking if companies table exists...');
    let companiesTableExists = false;

    try {
      const { data: companiesCheck, error } = await supabase
        .from('companies')
        .select('count', { count: 'exact', head: true });

      companiesTableExists = !error;
    } catch (e) {
      companiesTableExists = false;
    }

    if (companiesTableExists) {
      console.log('✓ Companies table already exists\n');
    } else {
      console.log('✗ Companies table does not exist');
      console.log('  Creating companies table using direct table operations...\n');

      // Create companies table by attempting an insert that will fail but create the table
      // This is a workaround since Supabase JS client can't execute CREATE TABLE
      console.log('Note: Manual table creation required.');
      console.log('Please execute the following SQL in Supabase SQL Editor:\n');

      const createTableSQL = `
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  plan VARCHAR(50) NOT NULL DEFAULT 'starter'
    CHECK (plan IN ('starter', 'professional', 'enterprise')),
  status VARCHAR(50) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'suspended', 'cancelled')),
  owner_id UUID NOT NULL,
  cnpj VARCHAR(18),
  metadata JSONB DEFAULT '{}',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_companies_slug
  ON companies(slug)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_companies_owner_id
  ON companies(owner_id);

CREATE INDEX IF NOT EXISTS idx_companies_status
  ON companies(status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_companies_plan
  ON companies(plan);

CREATE INDEX IF NOT EXISTS idx_companies_created_at
  ON companies(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_companies_status_plan
  ON companies(status, plan)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_companies_cnpj
  ON companies(cnpj)
  WHERE cnpj IS NOT NULL;

ALTER TABLE IF EXISTS z_api_instances
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_z_api_instances_company_id
  ON z_api_instances(company_id);

CREATE INDEX IF NOT EXISTS idx_z_api_instances_instance_id_company
  ON z_api_instances(instance_id, company_id);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
      `;

      console.log(createTableSQL);
      console.log('\n⚠️  After executing the above SQL, please run this script again.\n');
      return;
    }

    // ========================================
    // PHASE 2: Check z_api_instances Structure
    // ========================================
    console.log('========================================');
    console.log('PHASE 2: Verify z_api_instances Schema');
    console.log('========================================\n');

    console.log('Checking z_api_instances table...');

    // Try to query with company_id to see if column exists
    let hasCompanyIdColumn = true;
    try {
      const result = await supabase
        .from('z_api_instances')
        .select('id, company_id', { count: 'exact', head: true });

      const testError = result.error;

      if (testError) {
        console.log(`  Error details: code=${testError.code}, message="${testError.message}"`);
        if (testError.message && testError.message.includes('company_id')) {
          hasCompanyIdColumn = false;
        } else if (testError.code === 'PGRST100') {
          // Table doesn't exist
          console.log('✗ z_api_instances table does not exist');
          console.log('  This is unexpected as the table should exist.\n');
          throw testError;
        } else if (testError.message && testError.message.includes('does not exist')) {
          console.log('✗ z_api_instances table does not exist');
          console.log('  This is unexpected as the table should exist.\n');
          throw testError;
        } else {
          throw testError;
        }
      }
    } catch (e) {
      console.log(`  Caught exception: ${e.message}`);
      if (e.message && e.message.includes('company_id')) {
        hasCompanyIdColumn = false;
      } else if (!e.message) {
        // Empty error message, assume column doesn't exist
        console.log('  Assuming column error due to empty message');
        hasCompanyIdColumn = false;
      } else {
        throw e;
      }
    }

    if (!hasCompanyIdColumn) {
      console.log('✗ company_id column does not exist on z_api_instances');
      console.log('  Please add it with: ALTER TABLE z_api_instances ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;\n');
      return;
    }

    console.log('✓ z_api_instances table has company_id column\n');

    // Get instance count
    const { count: instanceCount, data: allInstances, error: countError } = await supabase
      .from('z_api_instances')
      .select('id, company_id', { count: 'exact' });

    if (countError) {
      throw countError;
    }

    const totalInstances = instanceCount || 0;
    const withCompany = allInstances ? allInstances.filter(i => i.company_id !== null).length : 0;
    const withoutCompany = totalInstances - withCompany;

    console.log(`Found ${totalInstances} z_api_instances:`);
    console.log(`  - With company_id: ${withCompany}`);
    console.log(`  - Without company_id: ${withoutCompany}\n`);

    // ========================================
    // PHASE 3: Create Default Company
    // ========================================
    console.log('========================================');
    console.log('PHASE 3: Setup Default Company');
    console.log('========================================\n');

    console.log('Checking for existing default company...');
    const { data: existingCompany, error: checkError } = await supabase
      .from('companies')
      .select('id, name')
      .eq('id', DEFAULT_COMPANY_ID)
      .single();

    if (existingCompany) {
      console.log(`✓ Default company already exists`);
      console.log(`  ID: ${existingCompany.id}`);
      console.log(`  Name: ${existingCompany.name}\n`);
    } else {
      console.log('✗ Default company does not exist');
      console.log('  Creating default company...\n');

      const { error: insertError, data: insertedData } = await supabase
        .from('companies')
        .insert({
          id: DEFAULT_COMPANY_ID,
          name: 'Default Company',
          slug: 'default-company',
          plan: 'starter',
          status: 'active',
          owner_id: '00000000-0000-0000-0000-000000000000',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select();

      if (insertError) {
        throw new Error(`Failed to create default company: ${insertError.message}`);
      }

      console.log('✓ Default company created successfully');
      console.log(`  ID: ${DEFAULT_COMPANY_ID}`);
      console.log(`  Name: Default Company`);
      console.log(`  Slug: default-company\n`);
    }

    // ========================================
    // PHASE 4: Backfill company_id
    // ========================================
    console.log('========================================');
    console.log('PHASE 4: Backfill company_id');
    console.log('========================================\n');

    if (withoutCompany > 0) {
      console.log(`Updating ${withoutCompany} instances with NULL company_id...\n`);

      const { error: updateError, count: updatedCount } = await supabase
        .from('z_api_instances')
        .update({
          company_id: DEFAULT_COMPANY_ID,
          updated_at: new Date().toISOString()
        })
        .is('company_id', null)
        .select('id', { count: 'exact' });

      if (updateError) {
        throw new Error(`Failed to update instances: ${updateError.message}`);
      }

      console.log(`✓ Updated ${withoutCompany} instances\n`);
    } else {
      console.log('✓ All instances already have company_id assigned\n');
    }

    // ========================================
    // PHASE 5: Verification
    // ========================================
    console.log('========================================');
    console.log('PHASE 5: Verification');
    console.log('========================================\n');

    const { data: finalInstances, count: finalCount, error: finalError } = await supabase
      .from('z_api_instances')
      .select('id, company_id', { count: 'exact' });

    if (finalError) {
      throw finalError;
    }

    const finalTotal = finalCount || 0;
    const finalWithCompany = finalInstances ? finalInstances.filter(i => i.company_id !== null).length : 0;
    const finalWithoutCompany = finalTotal - finalWithCompany;

    console.log('Final State:');
    console.log(`  Total instances: ${finalTotal}`);
    console.log(`  With company_id: ${finalWithCompany}`);
    console.log(`  Without company_id: ${finalWithoutCompany}`);

    if (finalTotal > 0) {
      const percentageBackfilled = (finalWithCompany / finalTotal * 100).toFixed(2);
      console.log(`  Percentage backfilled: ${percentageBackfilled}%\n`);

      console.log('Backfill Summary:');
      console.log(`  Before: ${withCompany} instances with company_id`);
      console.log(`  After: ${finalWithCompany} instances with company_id`);
      console.log(`  Records updated: ${finalWithCompany - withCompany}`);
      console.log(`  Success rate: ${percentageBackfilled}%\n`);
    }

    // Breakdown by company
    const { data: breakdown, error: breakdownError } = await supabase
      .from('z_api_instances')
      .select('company_id');

    if (!breakdownError && breakdown) {
      const groupedByCompany = {};
      breakdown.forEach(item => {
        const companyId = item.company_id || 'NULL';
        groupedByCompany[companyId] = (groupedByCompany[companyId] || 0) + 1;
      });

      console.log('Breakdown by Company:');
      Object.entries(groupedByCompany)
        .sort((a, b) => b[1] - a[1])
        .forEach(([companyId, count]) => {
          const companyName = companyId === DEFAULT_COMPANY_ID ?
            'Default Company' :
            companyId === 'NULL' ?
            'No Company (NULL)' :
            `Company ${companyId}`;
          console.log(`  ${companyName}: ${count} instances`);
        });
      console.log();
    }

    console.log('========================================');
    console.log('✓ MIGRATION & BACKFILL COMPLETE');
    console.log('========================================\n');

    // Final verification
    if (finalWithoutCompany === 0 && finalTotal > 0) {
      console.log('✓ SUCCESS: All instances have been backfilled with company_id');
      console.log(`✓ Total records processed: ${finalTotal}`);
      console.log(`✓ Percentage backfilled: ${((finalWithCompany / finalTotal) * 100).toFixed(2)}%`);
    } else if (finalWithoutCompany > 0) {
      console.log(`⚠️  WARNING: ${finalWithoutCompany} instances still have NULL company_id`);
    }

  } catch (error) {
    console.error('\n========================================');
    console.error('FATAL ERROR');
    console.error('========================================');
    console.error(`\nMessage: ${error.message}`);
    console.error('========================================\n');
    process.exit(1);
  }
}

// Run
executeFullMigration().catch(error => {
  console.error('Operation failed:', error);
  process.exit(1);
});
