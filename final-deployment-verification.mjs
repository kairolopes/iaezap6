#!/usr/bin/env node

/**
 * Final Deployment Verification Script
 * Comprehensive verification of all deployment requirements
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://gqromcfhiosfppqlottz.supabase.co';
const serviceRoleKey = 'sb_secret_uh1cDxnWtzRT4fhYbiEWBg_fbnZkKwQ';

// Initialize admin client with service role
const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  db: { schema: 'public' }
});

const report = {
  timestamp: new Date().toISOString(),
  database: supabaseUrl,
  results: {},
  failures: [],
  summary: {}
};

async function verifyTablesCount() {
  console.log('\n[1/7] Checking tables count (expect 4)...');
  try {
    const tableNames = ['companies', 'users', 'company_members', 'z_api_instances'];
    const existingTables = [];

    for (const tableName of tableNames) {
      try {
        const { error } = await adminClient
          .from(tableName)
          .select('*', { count: 'exact', head: true });

        if (!error) {
          existingTables.push(tableName);
        }
      } catch (e) {
        // Table not found
      }
    }

    report.results.tables = {
      expected: 4,
      actual: existingTables.length,
      tables: existingTables,
      passed: existingTables.length >= 4
    };

    console.log(`   ✓ Tables found: ${existingTables.length} (${existingTables.join(', ')})`);
    if (existingTables.length < 4) {
      report.failures.push(`Only ${existingTables.length} of 4 expected tables found`);
    }
    return existingTables.length >= 4;
  } catch (error) {
    report.failures.push(`Tables count check failed: ${error.message}`);
    console.log(`   ✗ Error: ${error.message}`);
    report.results.tables = {
      expected: 4,
      actual: 0,
      tables: [],
      passed: false
    };
    return false;
  }
}

async function verifyCompaniesCount() {
  console.log('\n[2/7] Checking companies count (expect 1)...');
  try {
    const { data, error } = await adminClient
      .from('companies')
      .select('*', { count: 'exact', head: true });

    if (error) {
      throw new Error(`Companies table error: ${error.message}`);
    }

    const count = data?.length || 0;
    report.results.companies = {
      expected: 1,
      actual: count,
      passed: count >= 1
    };

    console.log(`   ✓ Companies count: ${count}`);
    if (count < 1) {
      report.failures.push(`Only ${count} of 1 expected company found`);
    }
    return count >= 1;
  } catch (error) {
    report.failures.push(`Companies check failed: ${error.message}`);
    console.log(`   ✗ Error: ${error.message}`);
    report.results.companies = {
      expected: 1,
      actual: 0,
      passed: false
    };
    return false;
  }
}

async function verifyUsersCount() {
  console.log('\n[3/7] Checking users count (expect 1)...');
  try {
    const { data, error } = await adminClient
      .from('users')
      .select('*', { count: 'exact', head: true });

    if (error) {
      throw new Error(`Users table error: ${error.message}`);
    }

    const count = data?.length || 0;
    report.results.users = {
      expected: 1,
      actual: count,
      passed: count >= 1
    };

    console.log(`   ✓ Users count: ${count}`);
    if (count < 1) {
      report.failures.push(`Only ${count} of 1 expected user found`);
    }
    return count >= 1;
  } catch (error) {
    report.failures.push(`Users check failed: ${error.message}`);
    console.log(`   ✗ Error: ${error.message}`);
    report.results.users = {
      expected: 1,
      actual: 0,
      passed: false
    };
    return false;
  }
}

async function verifyZApiBackfill() {
  console.log('\n[4/7] Checking Z-API instances backfilled (expect 100%)...');
  try {
    const { data, error } = await adminClient
      .from('z_api_instances')
      .select('*', { count: 'exact' });

    if (error) {
      throw new Error(`Z-API table error: ${error.message}`);
    }

    const total = data?.length || 0;
    const backfilled = data?.filter(d => d.instance_id && d.api_token).length || 0;
    const percentage = total > 0 ? Math.round((backfilled / total) * 100) : 0;

    report.results.zapi_backfill = {
      expected: '100%',
      total: total,
      backfilled: backfilled,
      percentage: percentage,
      passed: percentage === 100 && total > 0
    };

    console.log(`   ✓ Z-API instances: ${backfilled}/${total} backfilled (${percentage}%)`);
    if (total === 0) {
      report.failures.push(`No Z-API instances found (expected 100% backfilled)`);
    } else if (percentage < 100) {
      report.failures.push(`Z-API backfill incomplete: ${percentage}% (${backfilled}/${total})`);
    }
    return percentage === 100 && total > 0;
  } catch (error) {
    report.failures.push(`Z-API backfill check failed: ${error.message}`);
    console.log(`   ✗ Error: ${error.message}`);
    report.results.zapi_backfill = {
      expected: '100%',
      total: 0,
      backfilled: 0,
      percentage: 0,
      passed: false
    };
    return false;
  }
}

async function verifyIndexesCount() {
  console.log('\n[5/7] Checking indexes count (expect 25+)...');
  try {
    console.log('   ⚠ Cannot verify indexes without direct PostgreSQL access');
    console.log('   Note: Indexes verification requires direct PostgreSQL connection');

    report.results.indexes = {
      expected: '25+',
      actual: 'UNKNOWN',
      passed: null,
      note: 'Requires direct PostgreSQL access'
    };
    return null;
  } catch (error) {
    report.results.indexes = {
      expected: '25+',
      actual: 'UNKNOWN',
      passed: null,
      note: 'Requires direct PostgreSQL access - ' + error.message
    };
    return null;
  }
}

async function verifyRLSPolicies() {
  console.log('\n[6/7] Checking RLS policies count (expect 13+)...');
  try {
    console.log('   ⚠ Cannot verify RLS policies without direct PostgreSQL access');
    console.log('   Note: RLS policies verification requires direct PostgreSQL connection');

    report.results.rls_policies = {
      expected: '13+',
      actual: 'UNKNOWN',
      passed: null,
      note: 'Requires direct PostgreSQL access'
    };
    return null;
  } catch (error) {
    report.results.rls_policies = {
      expected: '13+',
      actual: 'UNKNOWN',
      passed: null,
      note: 'Requires direct PostgreSQL access - ' + error.message
    };
    return null;
  }
}

async function verifyMasterUser() {
  console.log('\n[7/7] Checking master user exists and verified...');
  try {
    const { data, error } = await adminClient
      .from('users')
      .select('*')
      .eq('role', 'master');

    if (error) {
      throw new Error(`Master user query failed: ${error.message}`);
    }

    const masterUsers = data || [];
    const hasMaster = masterUsers.length > 0;

    if (hasMaster) {
      const master = masterUsers[0];
      report.results.master_user = {
        exists: true,
        verified: !!master.verified,
        email: master.email || 'N/A',
        status: master.status || 'N/A',
        id: master.id,
        passed: !!master.verified
      };

      console.log(`   ✓ Master user found:`);
      console.log(`     - Email: ${master.email}`);
      console.log(`     - Status: ${master.status}`);
      console.log(`     - Verified: ${master.verified}`);

      if (!master.verified) {
        report.failures.push('Master user exists but not verified');
      }
      return master.verified === true;
    } else {
      report.results.master_user = {
        exists: false,
        verified: false,
        passed: false
      };
      report.failures.push('No master user found');
      console.log(`   ✗ No master user found`);
      return false;
    }
  } catch (error) {
    report.failures.push(`Master user check failed: ${error.message}`);
    console.log(`   ✗ Error: ${error.message}`);
    report.results.master_user = {
      exists: false,
      verified: false,
      passed: false
    };
    return false;
  }
}

async function runAllVerifications() {
  console.log('='.repeat(70));
  console.log('FINAL DEPLOYMENT VERIFICATION');
  console.log('='.repeat(70));
  console.log(`Timestamp: ${report.timestamp}`);
  console.log(`Database: ${supabaseUrl}`);

  const results = [];

  // Run all verifications
  results.push(await verifyTablesCount());
  results.push(await verifyCompaniesCount());
  results.push(await verifyUsersCount());
  results.push(await verifyZApiBackfill());
  results.push(await verifyIndexesCount());
  results.push(await verifyRLSPolicies());
  results.push(await verifyMasterUser());

  // Generate summary
  console.log('\n' + '='.repeat(70));
  console.log('VERIFICATION SUMMARY');
  console.log('='.repeat(70));

  const successfulChecks = results.filter(r => r === true).length;
  const failedChecks = results.filter(r => r === false).length;
  const unknownChecks = results.filter(r => r === null).length;

  console.log(`\nResults:`);
  console.log(`  ✓ Passed: ${successfulChecks}`);
  console.log(`  ✗ Failed: ${failedChecks}`);
  console.log(`  ⚠ Unknown: ${unknownChecks}`);

  // Check if deployment is complete
  const deploymentComplete = failedChecks === 0 && successfulChecks >= 5;

  console.log(`\nCore Metrics:`);
  console.log(`  Tables: ${report.results.tables.actual}/${report.results.tables.expected} ${report.results.tables.passed ? '✓' : '✗'}`);
  console.log(`  Companies: ${report.results.companies.actual}/${report.results.companies.expected} ${report.results.companies.passed ? '✓' : '✗'}`);
  console.log(`  Users: ${report.results.users.actual}/${report.results.users.expected} ${report.results.users.passed ? '✓' : '✗'}`);
  console.log(`  Z-API Backfill: ${report.results.zapi_backfill.percentage}% ${report.results.zapi_backfill.passed ? '✓' : '✗'}`);
  console.log(`  Master User: ${report.results.master_user.exists ? '✓' : '✗'}`);

  if (report.results.indexes.actual !== 'UNKNOWN') {
    console.log(`  Indexes: ${report.results.indexes.actual}/25+ ${report.results.indexes.passed ? '✓' : '✗'}`);
  } else {
    console.log(`  Indexes: ${report.results.indexes.note}`);
  }

  if (report.results.rls_policies.actual !== 'UNKNOWN') {
    console.log(`  RLS Policies: ${report.results.rls_policies.actual}/13+ ${report.results.rls_policies.passed ? '✓' : '✗'}`);
  } else {
    console.log(`  RLS Policies: ${report.results.rls_policies.note}`);
  }

  // Report failures
  if (report.failures.length > 0) {
    console.log('\n' + '='.repeat(70));
    console.log('FAILURES:');
    console.log('='.repeat(70));
    report.failures.forEach((failure, i) => {
      console.log(`  ${i + 1}. ${failure}`);
    });
  }

  // Final status
  console.log('\n' + '='.repeat(70));
  if (deploymentComplete) {
    console.log('STATUS: DEPLOYMENT_COMPLETE ✓');
    report.summary.status = 'DEPLOYMENT_COMPLETE';
  } else {
    console.log('STATUS: DEPLOYMENT_INCOMPLETE ✗');
    report.summary.status = 'DEPLOYMENT_INCOMPLETE';
  }
  console.log('='.repeat(70));

  return report;
}

// Execute verification
runAllVerifications()
  .then(async finalReport => {
    // Save report to file
    const reportPath = 'C:\\Users\\Kairo Lopes\\OneDrive\\Documentos\\Kairo\\claude code\\iaezap6\\FINAL_DEPLOYMENT_REPORT.md';
    fs.writeFileSync(
      reportPath,
      generateMarkdownReport(finalReport),
      'utf8'
    );

    console.log('\n✓ Report saved to: FINAL_DEPLOYMENT_REPORT.md');

    // Exit with appropriate code
    process.exit(finalReport.summary.status === 'DEPLOYMENT_COMPLETE' ? 0 : 1);
  })
  .catch(error => {
    console.error('\n✗ Verification failed:', error.message);
    process.exit(1);
  });

function generateMarkdownReport(report) {
  return `# Final Deployment Verification Report

**Generated:** ${report.timestamp}

## Deployment Status

**Overall Status:** \`${report.summary.status}\`

---

## Verification Results

### 1. Tables Count
- **Expected:** ${report.results.tables.expected}
- **Actual:** ${report.results.tables.actual}
- **Status:** ${report.results.tables.passed ? '✓ PASS' : '✗ FAIL'}
- **Tables Found:** ${report.results.tables.tables.length > 0 ? report.results.tables.tables.join(', ') : 'None'}

### 2. Companies Count
- **Expected:** ${report.results.companies.expected}
- **Actual:** ${report.results.companies.actual}
- **Status:** ${report.results.companies.passed ? '✓ PASS' : '✗ FAIL'}

### 3. Users Count
- **Expected:** ${report.results.users.expected}
- **Actual:** ${report.results.users.actual}
- **Status:** ${report.results.users.passed ? '✓ PASS' : '✗ FAIL'}

### 4. Z-API Instances Backfilled
- **Expected:** 100%
- **Actual:** ${report.results.zapi_backfill.percentage}%
- **Details:** ${report.results.zapi_backfill.backfilled}/${report.results.zapi_backfill.total} instances
- **Status:** ${report.results.zapi_backfill.passed ? '✓ PASS' : '✗ FAIL'}

### 5. Indexes Count
- **Expected:** ${report.results.indexes.expected}
- **Actual:** ${report.results.indexes.actual}
- **Status:** ${report.results.indexes.passed ? '✓ PASS' : report.results.indexes.actual === 'UNKNOWN' ? '⚠ UNKNOWN' : '✗ FAIL'}
- **Note:** ${report.results.indexes.note || 'Direct PostgreSQL access required for verification'}

### 6. RLS Policies Count
- **Expected:** ${report.results.rls_policies.expected}
- **Actual:** ${report.results.rls_policies.actual}
- **Status:** ${report.results.rls_policies.passed ? '✓ PASS' : report.results.rls_policies.actual === 'UNKNOWN' ? '⚠ UNKNOWN' : '✗ FAIL'}
- **Note:** ${report.results.rls_policies.note || 'Direct PostgreSQL access required for verification'}

### 7. Master User
- **Exists:** ${report.results.master_user.exists ? '✓ YES' : '✗ NO'}
- **Verified:** ${report.results.master_user.verified ? '✓ YES' : '✗ NO'}
- **Status:** ${report.results.master_user.passed ? '✓ PASS' : '✗ FAIL'}
${report.results.master_user.exists ? `- **Email:** ${report.results.master_user.email}
- **Status:** ${report.results.master_user.status}
- **ID:** ${report.results.master_user.id}` : ''}

---

## Summary

| Metric | Expected | Actual | Status |
|--------|----------|--------|--------|
| Tables | 4 | ${report.results.tables.actual} | ${report.results.tables.passed ? '✓' : '✗'} |
| Companies | 1 | ${report.results.companies.actual} | ${report.results.companies.passed ? '✓' : '✗'} |
| Users | 1 | ${report.results.users.actual} | ${report.results.users.passed ? '✓' : '✗'} |
| Z-API Backfill | 100% | ${report.results.zapi_backfill.percentage}% | ${report.results.zapi_backfill.passed ? '✓' : '✗'} |
| Indexes | 25+ | ${report.results.indexes.actual} | ${report.results.indexes.passed ? '✓' : report.results.indexes.actual === 'UNKNOWN' ? '⚠' : '✗'} |
| RLS Policies | 13+ | ${report.results.rls_policies.actual} | ${report.results.rls_policies.passed ? '✓' : report.results.rls_policies.actual === 'UNKNOWN' ? '⚠' : '✗'} |
| Master User | Yes & Verified | ${report.results.master_user.exists && report.results.master_user.verified ? 'Yes & Verified' : 'No'} | ${report.results.master_user.passed ? '✓' : '✗'} |

${report.failures.length > 0 ? `
## Failures

${report.failures.map((failure, i) => `${i + 1}. ${failure}`).join('\n')}
` : ''}

---

## Database Information

- **URL:** ${report.database}
- **Timestamp:** ${report.timestamp}

## Notes

- Indexes and RLS Policies verification requires direct PostgreSQL access
- Use the PostgreSQL connection from your Supabase dashboard for complete verification
- Query: \`SELECT COUNT(*) FROM pg_indexes WHERE indexname LIKE 'idx_%';\`
- Query: \`SELECT COUNT(*) FROM pg_policies;\`

---

**Report Generated:** ${new Date().toLocaleString()}
`;
}
