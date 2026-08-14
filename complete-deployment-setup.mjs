#!/usr/bin/env node

/**
 * Complete Deployment Setup
 * - Create master company
 * - Create master user
 * - Create Z-API instances
 * - Create company members
 * - Run final verification
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import crypto from 'crypto';

const SUPABASE_URL = 'https://gqromcfhiosfppqlottz.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_uh1cDxnWtzRT4fhYbiEWBg_fbnZkKwQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const setupLog = [];

function log(message) {
  console.log(message);
  setupLog.push(message);
}

async function setupDatabase() {
  log('\n' + '='.repeat(80));
  log('COMPLETE DEPLOYMENT SETUP');
  log('='.repeat(80) + '\n');

  try {
    // Step 1: Create master company
    log('[STEP 1] Creating master company...\n');

    const masterCompanyId = '00000000-0000-0000-0000-000000000001';
    const masterUserId = '00000000-0000-0000-0000-000000000002';

    const { data: masterCompany, error: companyError } = await supabase
      .from('companies')
      .upsert({
        id: masterCompanyId,
        name: 'Master Company',
        slug: 'master',
        cnpj: '00.000.000/0000-00',
        plan: 'enterprise',
        status: 'active',
        owner_id: masterUserId,
      }, { onConflict: 'slug' })
      .select();

    if (companyError) {
      log(`✗ Error creating company: ${companyError.message}`);
      if (companyError.details) {
        log(`  Details: ${companyError.details}`);
      }
    } else {
      log('✓ Master company created/updated');
      if (masterCompany && masterCompany.length > 0) {
        log(`  - ID: ${masterCompany[0].id}`);
        log(`  - Name: ${masterCompany[0].name}`);
        log(`  - Slug: ${masterCompany[0].slug}`);
      }
    }

    // Step 2: Create master user
    log('\n[STEP 2] Creating master user...\n');

    // Simple password hash (in production use bcrypt)
    const simpleHash = crypto.createHash('sha256').update('MasterPassword123!@#').digest('hex');

    const { data: masterUser, error: userError } = await supabase
      .from('users')
      .upsert({
        id: masterUserId,
        company_id: masterCompanyId,
        email: 'admin@master.iaezap',
        password_hash: simpleHash,
        full_name: 'Master Admin',
        role: 'master',
        status: 'active',
        verified: true,
      }, { onConflict: 'id' })
      .select();

    if (userError) {
      log(`✗ Error creating user: ${userError.message}`);
      if (userError.details) {
        log(`  Details: ${userError.details}`);
      }
    } else {
      log('✓ Master user created/updated');
      if (masterUser && masterUser.length > 0) {
        log(`  - ID: ${masterUser[0].id}`);
        log(`  - Email: ${masterUser[0].email}`);
        log(`  - Role: ${masterUser[0].role}`);
        log(`  - Status: ${masterUser[0].status}`);
      }
    }

    // Step 3: Create Z-API instances
    log('\n[STEP 3] Creating Z-API instances...\n');

    const zApiInstances = [
      {
        id: '00000000-0000-0000-0000-000000000003',
        company_id: masterCompanyId,
        instance_id: '3ECD22ED86FE925D5A7772442EF70706',
        api_token: '9D350B8542F495AC919995C1',
        client_token: 'Ff94d05bcd8b546afb957fc52d8e33ebaS',
        status: 'active',
      },
      {
        id: '00000000-0000-0000-0000-000000000004',
        company_id: masterCompanyId,
        instance_id: 'TEST_INSTANCE_001',
        api_token: 'TEST_TOKEN_001',
        client_token: 'TEST_CLIENT_001',
        status: 'active',
      },
    ];

    const { data: zApiData, error: zApiError } = await supabase
      .from('z_api_instances')
      .upsert(zApiInstances, { onConflict: 'id' })
      .select();

    if (zApiError) {
      log(`✗ Error creating Z-API instances: ${zApiError.message}`);
      if (zApiError.details) {
        log(`  Details: ${zApiError.details}`);
      }
    } else {
      log('✓ Z-API instances created/updated');
      if (zApiData && zApiData.length > 0) {
        log(`  - Created ${zApiData.length} instances`);
        zApiData.forEach((inst, i) => {
          log(`    ${i + 1}. Instance: ${inst.instance_id} (${inst.status})`);
        });
      }
    }

    // Step 4: Create company members
    log('\n[STEP 4] Creating company members...\n');

    const { data: members, error: membersError } = await supabase
      .from('company_members')
      .upsert({
        id: '00000000-0000-0000-0000-000000000005',
        company_id: masterCompanyId,
        user_id: masterUserId,
        role: 'owner',
        status: 'active',
      }, { onConflict: 'id' })
      .select();

    if (membersError) {
      log(`✗ Error creating company member: ${membersError.message}`);
      if (membersError.details) {
        log(`  Details: ${membersError.details}`);
      }
    } else {
      log('✓ Company member created/updated');
      if (members && members.length > 0) {
        log(`  - Member ID: ${members[0].id}`);
        log(`  - Role: ${members[0].role}`);
      }
    }

    // Step 5: Run final verification
    log('\n[STEP 5] Running verification checks...\n');

    const checks = {
      companies: 0,
      users: 0,
      z_api: 0,
      members: 0,
    };

    // Check companies
    const { data: compData } = await supabase
      .from('companies')
      .select('id')
      .eq('slug', 'master');
    checks.companies = compData?.length || 0;

    // Check users
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'master');
    checks.users = userData?.length || 0;

    // Check Z-API instances
    const { data: zData } = await supabase
      .from('z_api_instances')
      .select('id')
      .eq('company_id', masterCompanyId);
    checks.z_api = zData?.length || 0;

    // Check company members
    const { data: memData } = await supabase
      .from('company_members')
      .select('id')
      .eq('company_id', masterCompanyId);
    checks.members = memData?.length || 0;

    log('Verification Results:');
    log(`  ✓ Master company exists: ${checks.companies > 0 ? 'YES' : 'NO'}`);
    log(`  ✓ Master user exists: ${checks.users > 0 ? 'YES' : 'NO'}`);
    log(`  ✓ Z-API instances count: ${checks.z_api}`);
    log(`  ✓ Company members exist: ${checks.members > 0 ? 'YES' : 'NO'}`);

    const success = checks.companies > 0 && checks.users > 0;

    return success;

  } catch (error) {
    log(`\n✗ Setup Error: ${error.message}`);
    log(error.stack);
    return false;
  }
}

async function main() {
  const success = await setupDatabase();

  // Save setup log
  const logContent = setupLog.join('\n');
  fs.writeFileSync(
    'C:\\Users\\Kairo Lopes\\OneDrive\\Documentos\\Kairo\\claude code\\iaezap6\\DEPLOYMENT_SETUP_LOG.txt',
    logContent,
    'utf8'
  );

  log('\n' + '='.repeat(80));
  if (success) {
    log('✓ DEPLOYMENT SETUP COMPLETED SUCCESSFULLY');
  } else {
    log('✗ DEPLOYMENT SETUP ENCOUNTERED ERRORS');
  }
  log('='.repeat(80));

  process.exit(success ? 0 : 1);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
