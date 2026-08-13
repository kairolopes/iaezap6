#!/usr/bin/env node

/**
 * Complete Backfill Script
 * Executes full backfill including schema setup and data migration
 */

const fs = require('fs');
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

// Helper functions
async function tableExists(tableName) {
  try {
    const { error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    return !error || !error.message.includes('does not exist');
  } catch (e) {
    return false;
  }
}

async function columnExists(tableName, columnName) {
  try {
    const { error } = await supabase
      .from(tableName)
      .select(columnName, { head: true })
      .limit(1);

    return !error || !error.message.includes('does not exist');
  } catch (e) {
    return false;
  }
}

async function executeBackfill() {
  console.log('\n' + '='.repeat(80));
  console.log('COMPLETE Z-API INSTANCES BACKFILL EXECUTION');
  console.log('='.repeat(80));

  try {
    // PHASE 1: Schema Verification
    console.log('\nPHASE 1: Schema Verification');
    console.log('-'.repeat(80));

    const companiesTableExists = await tableExists('companies');
    const apiInstancesTableExists = await tableExists('z_api_instances');

    console.log(`Companies table: ${companiesTableExists ? '✓' : '✗'}`);
    console.log(`Z-API Instances table: ${apiInstancesTableExists ? '✓' : '✗'}`);

    if (!companiesTableExists) {
      console.log('\n⚠ Companies table does not exist');
      console.log('  ACTION REQUIRED: Run the following SQL in Supabase SQL Editor:');
      console.log('  https://supabase.com/dashboard/project/gqromcfhiosfppqlottz/sql');
      console.log('\n  SQL:');

      const createCompaniesSQL = fs.readFileSync(
        path.join(__dirname, '../migrations/002_add_company_support.sql'),
        'utf-8'
      ).split('\n').filter(l => !l.trim().startsWith('--')).join('\n');

      console.log(createCompaniesSQL.substring(0, 500) + '...\n');

      return;
    }

    if (!apiInstancesTableExists) {
      console.log('\n❌ Z-API Instances table does not exist');
      return;
    }

    // Check for company_id column
    const companyIdExists = await columnExists('z_api_instances', 'company_id');
    console.log(`company_id column in z_api_instances: ${companyIdExists ? '✓' : '✗'}`);

    if (!companyIdExists) {
      console.log('\n⚠ company_id column is missing from z_api_instances');
      console.log('  ACTION REQUIRED: Run the following SQL in Supabase SQL Editor:');
      console.log('\n  SQL:');
      console.log(`
ALTER TABLE z_api_instances
ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_z_api_instances_company_id
  ON z_api_instances(company_id);
      `);
      return;
    }

    // PHASE 2: Initial State Verification
    console.log('\nPHASE 2: Initial State Collection');
    console.log('-'.repeat(80));

    const { count: totalInstancesBefore, error: beforeError } = await supabase
      .from('z_api_instances')
      .select('id, company_id', { count: 'exact' });

    if (beforeError) {
      console.error('❌ Error fetching initial state:', beforeError.message);
      return;
    }

    const { data: beforeData } = await supabase
      .from('z_api_instances')
      .select('id, company_id');

    const withCompanyIdBefore = (beforeData || []).filter(d => d.company_id).length;
    const withoutCompanyIdBefore = (totalInstancesBefore || 0) - withCompanyIdBefore;

    console.log(`Total instances: ${totalInstancesBefore || 0}`);
    console.log(`  With company_id: ${withCompanyIdBefore}`);
    console.log(`  Without company_id: ${withoutCompanyIdBefore}`);

    // PHASE 3: Default Company Creation
    console.log('\nPHASE 3: Default Company Setup');
    console.log('-'.repeat(80));

    const DEFAULT_COMPANY_ID = '00000000-0000-0000-0000-000000000001';
    const DEFAULT_COMPANY_SLUG = 'default-company';

    let defaultCompanyId = DEFAULT_COMPANY_ID;

    // Check if default company already exists
    const { data: existingCompany } = await supabase
      .from('companies')
      .select('id, name, slug, cnpj')
      .eq('slug', DEFAULT_COMPANY_SLUG)
      .single()
      .catch(() => ({ data: null }));

    if (existingCompany) {
      console.log(`✓ Default company already exists`);
      console.log(`  ID: ${existingCompany.id}`);
      console.log(`  Name: ${existingCompany.name}`);
      console.log(`  Slug: ${existingCompany.slug}`);
      console.log(`  CNPJ: ${existingCompany.cnpj}`);
      defaultCompanyId = existingCompany.id;
    } else {
      console.log(`Creating default company...`);

      const { data: newCompany, error: createError } = await supabase
        .from('companies')
        .insert({
          id: DEFAULT_COMPANY_ID,
          name: 'Default Company',
          slug: DEFAULT_COMPANY_SLUG,
          description: 'Default company for unassigned API instances during migration',
          plan: 'starter',
          status: 'active',
          owner_id: '00000000-0000-0000-0000-000000000000',
          cnpj: '00.000.000/0000-00',
          metadata: {
            backfill_default: true,
            created_by_migration: '003_backfill_company_id',
            created_at_migration: new Date().toISOString(),
          },
          settings: {},
        })
        .select()
        .single();

      if (createError) {
        if (createError.message.includes('duplicate') || createError.message.includes('conflict')) {
          console.log(`✓ Default company already exists (duplicate key error)`);
        } else {
          console.error(`❌ Error creating default company: ${createError.message}`);
          return;
        }
      } else if (newCompany) {
        console.log(`✓ Default company created`);
        console.log(`  ID: ${newCompany.id}`);
        defaultCompanyId = newCompany.id;
      }
    }

    // Verify default company exists
    const { data: verifyCompany, error: verifyError } = await supabase
      .from('companies')
      .select('id, name, slug, cnpj')
      .eq('slug', DEFAULT_COMPANY_SLUG)
      .single();

    if (verifyError) {
      console.error(`❌ Default company verification failed: ${verifyError.message}`);
      return;
    }

    console.log(`✓ Default company verified: ${verifyCompany.id}`);

    // PHASE 4: Backfill company_id
    console.log('\nPHASE 4: Backfilling company_id');
    console.log('-'.repeat(80));

    const { error: updateError, count: updatedCount } = await supabase
      .from('z_api_instances')
      .update({
        company_id: verifyCompany.id,
        updated_at: new Date().toISOString(),
      })
      .is('company_id', null);

    if (updateError) {
      console.error(`❌ Error backfilling: ${updateError.message}`);
      return;
    }

    console.log(`✓ Backfill update completed`);
    console.log(`  Instances updated: ${updatedCount || 0}`);

    // PHASE 5: Final Verification
    console.log('\nPHASE 5: Final State Verification');
    console.log('-'.repeat(80));

    const { count: totalInstancesAfter } = await supabase
      .from('z_api_instances')
      .select('id, company_id', { count: 'exact' });

    const { data: afterData } = await supabase
      .from('z_api_instances')
      .select('id, company_id');

    const withCompanyIdAfter = (afterData || []).filter(d => d.company_id).length;
    const withoutCompanyIdAfter = (totalInstancesAfter || 0) - withCompanyIdAfter;

    console.log(`Total instances: ${totalInstancesAfter || 0}`);
    console.log(`  With company_id: ${withCompanyIdAfter}`);
    console.log(`  Without company_id: ${withoutCompanyIdAfter}`);

    const percentageBackfilled = (totalInstancesAfter || 0) > 0
      ? ((withCompanyIdAfter / (totalInstancesAfter || 1)) * 100).toFixed(2)
      : 0;

    console.log(`✓ Backfill percentage: ${percentageBackfilled}%`);

    // PHASE 6: Data Integrity Check
    console.log('\nPHASE 6: Data Integrity Verification');
    console.log('-'.repeat(80));

    // Check that expected count is 2
    if (totalInstancesAfter === 2 && withCompanyIdAfter === 2) {
      console.log(`✓ PERFECT: All ${withCompanyIdAfter}/${totalInstancesAfter} instances have company_id`);
    } else if (withCompanyIdAfter === totalInstancesAfter) {
      console.log(`✓ SUCCESS: All ${withCompanyIdAfter}/${totalInstancesAfter} instances have company_id`);
    } else {
      console.log(`⚠ WARNING: ${withoutCompanyIdAfter} instances still missing company_id`);
    }

    // PHASE 7: Company Distribution
    console.log('\nPHASE 7: Company Distribution');
    console.log('-'.repeat(80));

    const { data: distribution } = await supabase
      .from('z_api_instances')
      .select('company_id');

    const groupedByCompany = {};
    (distribution || []).forEach(item => {
      const cid = item.company_id || 'UNASSIGNED';
      groupedByCompany[cid] = (groupedByCompany[cid] || 0) + 1;
    });

    for (const [cid, count] of Object.entries(groupedByCompany)) {
      if (cid !== 'UNASSIGNED') {
        const { data: company } = await supabase
          .from('companies')
          .select('slug, name')
          .eq('id', cid)
          .single()
          .catch(() => ({ data: null }));

        const label = company ? `${company.slug} (${company.name})` : cid;
        console.log(`  ${label}: ${count} instances`);
      } else {
        console.log(`  UNASSIGNED: ${count} instances`);
      }
    }

    // PHASE 8: Sample Data
    console.log('\nPHASE 8: Sample Backfilled Instances');
    console.log('-'.repeat(80));

    const { data: samples } = await supabase
      .from('z_api_instances')
      .select('id, instance_id, tenant_id, company_id, updated_at')
      .order('updated_at', { ascending: false })
      .limit(5);

    if (samples && samples.length > 0) {
      console.log(`Sample of ${samples.length} most recently updated instances:`);
      samples.forEach((sample, idx) => {
        console.log(`  ${idx + 1}. ID: ${sample.id.substring(0, 8)}...`);
        console.log(`     Company: ${sample.company_id?.substring(0, 8) || 'NULL'}...`);
      });
    }

    // FINAL SUMMARY
    console.log('\n' + '='.repeat(80));
    console.log('BACKFILL COMPLETION SUMMARY');
    console.log('='.repeat(80));

    const backfillStats = {
      totalBefore: totalInstancesBefore || 0,
      totalAfter: totalInstancesAfter || 0,
      withCompanyIdBefore: withCompanyIdBefore,
      withCompanyIdAfter: withCompanyIdAfter,
      backfilledCount: withCompanyIdAfter - withCompanyIdBefore,
      percentageBackfilled: parseFloat(percentageBackfilled),
      instancesLost: (totalInstancesBefore || 0) - (totalInstancesAfter || 0),
      allHaveCompanyId: withCompanyIdAfter === (totalInstancesAfter || 0),
    };

    console.log('\nStatistics:');
    console.log(`  Total instances before: ${backfillStats.totalBefore}`);
    console.log(`  Total instances after: ${backfillStats.totalAfter}`);
    console.log(`  With company_id before: ${backfillStats.withCompanyIdBefore}`);
    console.log(`  With company_id after: ${backfillStats.withCompanyIdAfter}`);
    console.log(`  Instances backfilled: ${backfillStats.backfilledCount}`);
    console.log(`  Percentage backfilled: ${backfillStats.percentageBackfilled}%`);
    console.log(`  Instances lost: ${backfillStats.instancesLost}`);

    console.log('\nData Integrity:');
    console.log(`  ${backfillStats.instancesLost === 0 ? '✓' : '❌'} No instances lost`);
    console.log(`  ${backfillStats.allHaveCompanyId ? '✓' : '⚠'} All instances have company_id`);
    console.log(`  ${backfillStats.totalBefore === backfillStats.totalAfter ? '✓' : '⚠'} Instance count maintained`);

    const allChecksPassed = backfillStats.instancesLost === 0 &&
                           backfillStats.allHaveCompanyId &&
                           backfillStats.totalBefore === backfillStats.totalAfter;

    console.log(`\nOVERALL STATUS: ${allChecksPassed ? '✅ SUCCESS - All checks passed!' : '⚠ PARTIAL - Some checks need attention'}`);

    // Expected Results Check
    if (backfillStats.totalAfter === 2 && backfillStats.withCompanyIdAfter === 2) {
      console.log('✅ PERFECT MATCH: Expected 2 instances, 2 with company_id - BACKFILL 100% COMPLETE');
    }

    console.log('='.repeat(80) + '\n');

    process.exit(allChecksPassed ? 0 : 1);

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

executeBackfill();
