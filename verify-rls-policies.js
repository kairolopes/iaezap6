#!/usr/bin/env node

/**
 * RLS Policy Verification Script
 * Checks Row Level Security policies configuration
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function verifyRLSPolicies() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('❌ Missing Supabase environment variables');
    console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'SET' : 'MISSING');
    console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceRoleKey ? 'SET' : 'MISSING');
    process.exit(1);
  }

  // Create Supabase client with service role
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    console.log('🔍 RLS Policy Verification Starting...\n');

    // 1. Count total policies
    const { data: totalPolicies, error: countError } = await supabase.rpc('get_policies_count');

    if (countError) {
      console.log('📊 Total Policy Count (using pg_policies):');
      // Use direct query if RPC doesn't exist
      const { data, error } = await supabase
        .from('pg_policies')
        .select('*');

      if (error) {
        console.log('  ⚠️  Unable to query pg_policies directly');
      }
    }

    // Get all policies using information schema
    const { data: allPolicies, error: allError } = await supabase
      .rpc('check_rls_policies');

    if (!allError && allPolicies) {
      console.log('📊 Total Policies in Public Schema:', allPolicies.length);
      console.log('');
    }

    // 2. Check COMPANIES table policies
    console.log('📋 COMPANIES Table RLS Policies:');
    const { data: companiesPolicies, error: companiesError } = await supabase.rpc(
      'get_table_policies',
      { table_name: 'companies' }
    );

    if (companiesError) {
      // Fallback to direct query
      const result = await supabase.rpc(
        'get_policies_by_table',
        { target_table: 'companies' }
      );
      if (result.error) {
        console.log('  ⚠️  Unable to retrieve companies policies');
      } else {
        displayTablePolicies('companies', result.data, 3);
      }
    } else {
      displayTablePolicies('companies', companiesPolicies, 3);
    }
    console.log('');

    // 3. Check USERS table policies
    console.log('📋 USERS Table RLS Policies:');
    const { data: usersPolicies, error: usersError } = await supabase.rpc(
      'get_table_policies',
      { table_name: 'users' }
    );

    if (usersError) {
      const result = await supabase.rpc(
        'get_policies_by_table',
        { target_table: 'users' }
      );
      if (result.error) {
        console.log('  ⚠️  Unable to retrieve users policies');
      } else {
        displayTablePolicies('users', result.data, 3);
      }
    } else {
      displayTablePolicies('users', usersPolicies, 3);
    }
    console.log('');

    // 4. Check COMPANY_MEMBERS table policies
    console.log('📋 COMPANY_MEMBERS Table RLS Policies:');
    const { data: membersPolicies, error: membersError } = await supabase.rpc(
      'get_table_policies',
      { table_name: 'company_members' }
    );

    if (membersError) {
      const result = await supabase.rpc(
        'get_policies_by_table',
        { target_table: 'company_members' }
      );
      if (result.error) {
        console.log('  ⚠️  Unable to retrieve company_members policies');
      } else {
        displayTablePolicies('company_members', result.data, 2);
      }
    } else {
      displayTablePolicies('company_members', membersPolicies, 2);
    }
    console.log('');

    // 5. Check AUDIT_LOGS table policies
    console.log('📋 AUDIT_LOGS Table RLS Policies:');
    const { data: auditPolicies, error: auditError } = await supabase.rpc(
      'get_table_policies',
      { table_name: 'audit_logs' }
    );

    if (auditError) {
      const result = await supabase.rpc(
        'get_policies_by_table',
        { target_table: 'audit_logs' }
      );
      if (result.error) {
        console.log('  ⚠️  Unable to retrieve audit_logs policies');
      } else {
        displayTablePolicies('audit_logs', result.data, 2);
      }
    } else {
      displayTablePolicies('audit_logs', auditPolicies, 2);
    }
    console.log('');

    // 6. Summary report
    console.log('📊 RLS Policy Status Summary:');
    console.log('  ✓ companies:       Expected 3 policies');
    console.log('  ✓ users:           Expected 3 policies');
    console.log('  ✓ company_members: Expected 2 policies');
    console.log('  ✓ audit_logs:      Expected 2 policies');
    console.log('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  TOTAL EXPECTED:    10 policies');

  } catch (error) {
    console.error('❌ Error during verification:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

function displayTablePolicies(tableName, policies, expectedCount) {
  if (!policies || policies.length === 0) {
    console.log(`  ❌ No policies found (Expected: ${expectedCount})`);
    return;
  }

  const status = policies.length === expectedCount ? '✓' : '⚠️';
  console.log(`  ${status} Found ${policies.length} policies (Expected: ${expectedCount})`);

  policies.forEach((policy, index) => {
    console.log(`    ${index + 1}. ${policy.policyname || policy.name || 'Unknown'}`);
    if (policy.qual) {
      console.log(`       USING: ${policy.qual}`);
    }
    if (policy.with_check) {
      console.log(`       WITH CHECK: ${policy.with_check}`);
    }
  });
}

verifyRLSPolicies();
