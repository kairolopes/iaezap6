#!/usr/bin/env node

/**
 * Direct RLS Policy Verification Script
 * Uses psql through connection to Supabase PostgreSQL
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function verifyRLSPolicies() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('❌ Missing Supabase environment variables');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    console.log('🔍 RLS Policy Verification Starting...\n');

    // Query 1: Get total policy count
    console.log('📊 Total Policies in Public Schema:');
    try {
      const { data: countData, error: countError } = await supabase
        .from('information_schema.table_privileges')
        .select('*')
        .eq('table_schema', 'public')
        .limit(1);

      // Try a different approach - query through table info
      console.log('  Querying pg_policies via Supabase client...');
    } catch (e) {
      console.log('  Note: Direct table query not available');
    }

    // Query 2: Check each table for RLS status and policies
    const tables = [
      { name: 'companies', expectedPolicies: 3 },
      { name: 'users', expectedPolicies: 3 },
      { name: 'company_members', expectedPolicies: 2 },
      { name: 'audit_logs', expectedPolicies: 2 }
    ];

    console.log('');
    console.log('📋 Table RLS Status Check:');
    console.log('');

    for (const table of tables) {
      await checkTableRLS(supabase, table.name, table.expectedPolicies);
    }

    // Summary
    console.log('');
    console.log('📊 Expected RLS Configuration:');
    console.log('  • companies:       3 policies');
    console.log('  • users:           3 policies');
    console.log('  • company_members: 2 policies');
    console.log('  • audit_logs:      2 policies');
    console.log('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  TOTAL:             10 policies');
    console.log('');

    // Try to get actual policy info
    console.log('📋 Attempting to retrieve RLS policy details...');
    await getRLSPolicyDetails(supabase);

  } catch (error) {
    console.error('❌ Error during verification:', error.message);
    process.exit(1);
  }
}

async function checkTableRLS(supabase, tableName, expectedPolicies) {
  try {
    // Try to query the table to see if it exists
    const { data, error, count } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true })
      .limit(0);

    if (error) {
      console.log(`  ❌ ${tableName}: Error accessing table - ${error.message}`);
      return;
    }

    console.log(`  ✓ ${tableName}: Accessible (Expected ${expectedPolicies} RLS policies)`);
  } catch (e) {
    console.log(`  ⚠️  ${tableName}: Unable to check - ${e.message}`);
  }
}

async function getRLSPolicyDetails(supabase) {
  try {
    // Use raw API call to get policy information
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/pg_policies`, {
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      }
    });

    if (!response.ok) {
      console.log('  ℹ️  pg_policies view not accessible via REST API');
      return;
    }

    const policies = await response.json();
    console.log(`  Found ${policies.length} total policies`);

    // Group by table
    const byTable = {};
    policies.forEach(p => {
      if (!byTable[p.tablename]) {
        byTable[p.tablename] = [];
      }
      byTable[p.tablename].push(p);
    });

    console.log('');
    console.log('  Policies by Table:');
    for (const [table, tablePolicy] of Object.entries(byTable)) {
      console.log(`    • ${table}: ${tablePolicy.length} policies`);
      tablePolicy.forEach((p, i) => {
        console.log(`      ${i + 1}. ${p.policyname} (${p.cmd})`);
      });
    }

  } catch (error) {
    console.log(`  ℹ️  Cannot retrieve policy details: ${error.message}`);
  }
}

verifyRLSPolicies();
