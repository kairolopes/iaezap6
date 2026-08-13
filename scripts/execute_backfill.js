#!/usr/bin/env node

/**
 * Backfill Execution Script for z_api_instances.company_id
 * Executes the 003_backfill_company_id.sql migration and verifies results
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: Missing Supabase credentials in .env.local');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', SUPABASE_URL ? 'SET' : 'MISSING');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function executeBackfill() {
  console.log('\n' + '='.repeat(80));
  console.log('BACKFILL EXECUTION: company_id in z_api_instances');
  console.log('='.repeat(80));
  console.log();

  try {
    // PHASE 1: COLLECT INITIAL STATE
    console.log('PHASE 1: Collecting initial state...');
    console.log('-'.repeat(80));

    const { data: beforeData, error: beforeError, count: beforeCount } = await supabase
      .from('z_api_instances')
      .select('id, company_id', { count: 'exact' });

    if (beforeError) {
      console.error('❌ Error fetching initial data:', beforeError.message);
      return;
    }

    const totalBefore = beforeCount || beforeData?.length || 0;
    const withCompanyIdBefore = (beforeData || []).filter(d => d.company_id).length;
    const withoutCompanyIdBefore = totalBefore - withCompanyIdBefore;

    console.log(`✓ Total instances before: ${totalBefore}`);
    console.log(`✓ Instances with company_id: ${withCompanyIdBefore}`);
    console.log(`✓ Instances without company_id: ${withoutCompanyIdBefore}`);
    console.log();

    // PHASE 2: READ MIGRATION SCRIPT
    console.log('PHASE 2: Reading migration script...');
    console.log('-'.repeat(80));

    const migrationPath = path.join(__dirname, '../src/lib/auth/003_backfill_company_id.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    console.log(`✓ Migration file loaded: ${migrationPath}`);
    console.log(`✓ File size: ${migrationSql.length} bytes`);
    console.log();

    // PHASE 3: CREATE DEFAULT COMPANY
    console.log('PHASE 3: Creating/verifying default company...');
    console.log('-'.repeat(80));

    // Check if default company exists
    const { data: existingCompany } = await supabase
      .from('companies')
      .select('id, name, slug, cnpj, status')
      .eq('slug', 'default-company')
      .single()
      .catch(() => ({ data: null }));

    if (existingCompany) {
      console.log(`✓ Default company already exists`);
      console.log(`  ID: ${existingCompany.id}`);
      console.log(`  Name: ${existingCompany.name}`);
      console.log(`  CNPJ: ${existingCompany.cnpj}`);
      console.log(`  Status: ${existingCompany.status}`);
    } else {
      console.log(`⏳ Creating default company...`);
      const { data: newCompany, error: createError } = await supabase
        .from('companies')
        .insert({
          id: '00000000-0000-0000-0000-000000000001',
          name: 'Default Company',
          slug: 'default-company',
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
        .single()
        .catch(err => {
          // Handle conflict gracefully
          if (err.code === 'PGRST116' || err.message.includes('no rows')) {
            return { data: null, error: null };
          }
          return { data: null, error: err };
        });

      if (createError && !createError.message?.includes('conflict')) {
        console.error(`❌ Error creating default company:`, createError.message);
        return;
      }

      if (newCompany) {
        console.log(`✓ Default company created successfully`);
        console.log(`  ID: ${newCompany.id}`);
      } else {
        console.log(`ℹ Default company creation handled (may have already existed)`);
      }
    }
    console.log();

    // PHASE 4: VERIFY DEFAULT COMPANY EXISTS
    console.log('PHASE 4: Verifying default company...');
    console.log('-'.repeat(80));

    const { data: defaultCompany, error: companyError } = await supabase
      .from('companies')
      .select('id, name, slug, cnpj, status, metadata, created_at')
      .eq('slug', 'default-company')
      .single();

    if (companyError) {
      console.error(`❌ Error fetching default company:`, companyError.message);
      return;
    }

    if (!defaultCompany) {
      console.error(`❌ Default company not found after creation`);
      return;
    }

    console.log(`✓ Default company verified:`);
    console.log(`  ID: ${defaultCompany.id}`);
    console.log(`  Name: ${defaultCompany.name}`);
    console.log(`  CNPJ: ${defaultCompany.cnpj}`);
    console.log(`  Plan: ${defaultCompany.metadata?.plan || 'starter'}`);
    console.log(`  Status: ${defaultCompany.status}`);
    console.log(`  Created: ${defaultCompany.created_at}`);
    console.log();

    // PHASE 5: BACKFILL COMPANY_ID
    console.log('PHASE 5: Backfilling company_id in z_api_instances...');
    console.log('-'.repeat(80));

    const { error: updateError, count: updatedCount } = await supabase
      .from('z_api_instances')
      .update({
        company_id: defaultCompany.id,
        updated_at: new Date().toISOString(),
      })
      .is('company_id', null)
      .select('id', { count: 'exact' });

    if (updateError) {
      console.error(`❌ Error updating z_api_instances:`, updateError.message);
      return;
    }

    console.log(`✓ Backfill completed`);
    console.log(`  Instances updated: ${updatedCount || 0}`);
    console.log();

    // PHASE 6: COLLECT FINAL STATE
    console.log('PHASE 6: Collecting final state...');
    console.log('-'.repeat(80));

    const { data: afterData, error: afterError, count: afterCount } = await supabase
      .from('z_api_instances')
      .select('id, company_id', { count: 'exact' });

    if (afterError) {
      console.error('❌ Error fetching final data:', afterError.message);
      return;
    }

    const totalAfter = afterCount || afterData?.length || 0;
    const withCompanyIdAfter = (afterData || []).filter(d => d.company_id).length;
    const withoutCompanyIdAfter = totalAfter - withCompanyIdAfter;

    console.log(`✓ Total instances after: ${totalAfter}`);
    console.log(`✓ Instances with company_id: ${withCompanyIdAfter}`);
    console.log(`✓ Instances without company_id: ${withoutCompanyIdAfter}`);
    console.log();

    // PHASE 7: CALCULATE STATISTICS
    console.log('PHASE 7: Calculating statistics...');
    console.log('-'.repeat(80));

    const instancesBackfilled = withCompanyIdAfter - withCompanyIdBefore;
    const percentageBackfilled = totalAfter > 0 ? ((withCompanyIdAfter / totalAfter) * 100).toFixed(2) : 0;
    const instancesLost = totalBefore - totalAfter;
    const dataIntegrity = {
      no_instances_lost: instancesLost === 0,
      all_have_company_id: withoutCompanyIdAfter === 0,
      count_maintained: totalBefore === totalAfter,
    };

    console.log(`✓ Instances backfilled: ${instancesBackfilled}`);
    console.log(`✓ Percentage backfilled: ${percentageBackfilled}%`);
    console.log(`✓ Instances lost: ${instancesLost}`);
    console.log();

    // PHASE 8: VERIFY DATA INTEGRITY
    console.log('PHASE 8: Verifying data integrity...');
    console.log('-'.repeat(80));

    const integrityChecks = [
      { name: 'No instances lost', passed: dataIntegrity.no_instances_lost },
      { name: 'All instances have company_id', passed: dataIntegrity.all_have_company_id },
      { name: 'Instance count maintained', passed: dataIntegrity.count_maintained },
    ];

    for (const check of integrityChecks) {
      console.log(`${check.passed ? '✓' : '❌'} ${check.name}`);
    }
    console.log();

    // PHASE 9: COMPANY DISTRIBUTION
    console.log('PHASE 9: Company distribution...');
    console.log('-'.repeat(80));

    const { data: distribution, error: distError } = await supabase
      .from('z_api_instances')
      .select('company_id');

    if (!distError && distribution) {
      const companyGroups = {};
      distribution.forEach(inst => {
        const cid = inst.company_id || 'UNASSIGNED';
        companyGroups[cid] = (companyGroups[cid] || 0) + 1;
      });

      for (const [cid, count] of Object.entries(companyGroups)) {
        if (cid !== 'UNASSIGNED') {
          const { data: comp } = await supabase
            .from('companies')
            .select('slug, name')
            .eq('id', cid)
            .single()
            .catch(() => ({ data: null }));
          console.log(`✓ ${comp?.slug || cid}: ${count} instances`);
        } else {
          console.log(`⚠ UNASSIGNED: ${count} instances`);
        }
      }
    }
    console.log();

    // PHASE 10: SAMPLE DATA VERIFICATION
    console.log('PHASE 10: Sample backfilled instances...');
    console.log('-'.repeat(80));

    const { data: samples } = await supabase
      .from('z_api_instances')
      .select('id, instance_id, tenant_id, company_id, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(5);

    if (samples && samples.length > 0) {
      console.log(`Found ${samples.length} sample instances:`);
      samples.forEach((sample, index) => {
        console.log(`  ${index + 1}. ID: ${sample.id.substring(0, 8)}...`);
        console.log(`     Instance ID: ${sample.instance_id?.substring(0, 12) || 'N/A'}...`);
        console.log(`     Company ID: ${sample.company_id?.substring(0, 8) || 'UNASSIGNED'}...`);
      });
    }
    console.log();

    // FINAL SUMMARY
    console.log('='.repeat(80));
    console.log('BACKFILL COMPLETION SUMMARY');
    console.log('='.repeat(80));
    console.log();
    console.log('STATISTICS:');
    console.log(`  Total instances before: ${totalBefore}`);
    console.log(`  Total instances after:  ${totalAfter}`);
    console.log(`  Instances backfilled:   ${instancesBackfilled}`);
    console.log(`  Percentage backfilled:  ${percentageBackfilled}%`);
    console.log(`  Instances lost:         ${instancesLost}`);
    console.log();
    console.log('DATA INTEGRITY:');
    console.log(`  ${dataIntegrity.no_instances_lost ? '✓' : '❌'} No instances lost`);
    console.log(`  ${dataIntegrity.all_have_company_id ? '✓' : '❌'} All instances have company_id`);
    console.log(`  ${dataIntegrity.count_maintained ? '✓' : '❌'} Instance count maintained`);
    console.log();

    const allChecksPassed = integrityChecks.every(check => check.passed);
    console.log(`OVERALL STATUS: ${allChecksPassed ? '✓ SUCCESS' : '⚠ ISSUES DETECTED'}`);
    console.log('='.repeat(80));
    console.log();

    process.exit(allChecksPassed ? 0 : 1);

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

executeBackfill();
