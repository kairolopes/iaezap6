/**
 * Database Cleanup Utilities
 *
 * Provides utilities for cleaning up test data from the database.
 * This file contains:
 * - Test data cleanup functions
 * - SQL cleanup scripts
 * - Manual cleanup instructions
 */

import { createSupabaseServerClient } from '@/lib/supabase';

/**
 * Cleanup Configuration
 */
export const cleanupConfig = {
  // Email patterns for test users
  testEmailPatterns: [
    'test-user-%@example.com',
    'test-user-%-1@example.com',
    'test-user-%-2@example.com',
    '%@example.test',
  ],

  // Company name patterns for test companies
  testCompanyPatterns: [
    'Test Company%',
    'Refresh Test Company%',
    'Isolation Company%',
    'Multi Tenant%',
  ],

  // Hours to consider "old" test data
  oldDataHours: 24,
};

/**
 * Clean up test users and companies from database
 */
export async function cleanupTestData(
  options: { dryRun?: boolean; verbose?: boolean } = {}
): Promise<{
  usersDeleted: number;
  companiesDeleted: number;
  errors: string[];
}> {
  const { dryRun = false, verbose = false } = options;
  const results = {
    usersDeleted: 0,
    companiesDeleted: 0,
    errors: [] as string[],
  };

  try {
    const supabase = createSupabaseServerClient();

    // Step 1: Delete test users
    if (verbose) {
      console.log('[Cleanup] Starting user cleanup...');
    }

    for (const pattern of cleanupConfig.testEmailPatterns) {
      try {
        const query = pattern.includes('%')
          ? supabase
              .from('users')
              .delete()
              .like('email', pattern)
          : supabase.from('users').delete().eq('email', pattern);

        if (!dryRun) {
          const { count, error } = await query;
          if (error) {
            results.errors.push(`Error deleting users with pattern ${pattern}: ${error.message}`);
          } else {
            results.usersDeleted += count || 0;
            if (verbose) {
              console.log(`[Cleanup] Deleted ${count || 0} users matching pattern: ${pattern}`);
            }
          }
        }
      } catch (error) {
        results.errors.push(
          `Exception deleting users with pattern ${pattern}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // Step 2: Delete orphaned test companies (without users)
    if (verbose) {
      console.log('[Cleanup] Starting company cleanup...');
    }

    for (const pattern of cleanupConfig.testCompanyPatterns) {
      try {
        const query = supabase
          .from('companies')
          .delete()
          .like('name', pattern);

        if (!dryRun) {
          const { count, error } = await query;
          if (error) {
            results.errors.push(`Error deleting companies with pattern ${pattern}: ${error.message}`);
          } else {
            results.companiesDeleted += count || 0;
            if (verbose) {
              console.log(`[Cleanup] Deleted ${count || 0} companies matching pattern: ${pattern}`);
            }
          }
        }
      } catch (error) {
        results.errors.push(
          `Exception deleting companies with pattern ${pattern}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // Step 3: Delete old test data (older than configured hours)
    if (verbose) {
      console.log('[Cleanup] Starting old data cleanup...');
    }

    const hoursAgo = new Date(Date.now() - cleanupConfig.oldDataHours * 60 * 60 * 1000);

    try {
      const oldUsersQuery = supabase
        .from('users')
        .delete()
        .lt('created_at', hoursAgo.toISOString());

      if (!dryRun) {
        const { count: oldUsersCount, error } = await oldUsersQuery;
        if (error) {
          results.errors.push(`Error deleting old users: ${error.message}`);
        } else {
          results.usersDeleted += oldUsersCount || 0;
          if (verbose) {
            console.log(`[Cleanup] Deleted ${oldUsersCount || 0} old users`);
          }
        }
      }
    } catch (error) {
      results.errors.push(
        `Exception deleting old users: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    if (verbose) {
      console.log('[Cleanup] Cleanup complete');
      console.log(`[Cleanup] Results: ${results.usersDeleted} users, ${results.companiesDeleted} companies deleted`);
      if (results.errors.length > 0) {
        console.log(`[Cleanup] Errors: ${results.errors.length}`);
        results.errors.forEach(err => console.error(`  - ${err}`));
      }
    }

    return results;
  } catch (error) {
    results.errors.push(
      `Fatal cleanup error: ${error instanceof Error ? error.message : String(error)}`
    );
    return results;
  }
}

/**
 * SQL Scripts for manual cleanup
 */
export const sqlCleanupScripts = {
  /**
   * Delete all test users by email pattern
   */
  deleteTestUsers: `
    -- Delete test users (keep backup first!)
    DELETE FROM users
    WHERE
      email LIKE 'test-user-%@example.com'
      OR email LIKE '%@example.test'
      OR email LIKE 'refresh-test-%@example.com'
      OR email LIKE 'isolation-user%@example.com'
      OR email LIKE 'multi-tenant-user%@example.com'
      OR email LIKE 'incomplete-%@example.com'
      OR email LIKE 'weak-password-%@example.com'
      OR email LIKE 'invalid-cnpj-%@example.com'
      OR email LIKE 'invalid-email-%@example.com'
    RETURNING id, email;
  `,

  /**
   * Delete all test companies by name pattern
   */
  deleteTestCompanies: `
    -- Delete test companies
    DELETE FROM companies
    WHERE
      name LIKE 'Test Company%'
      OR name LIKE 'Refresh Test Company%'
      OR name LIKE 'Isolation Company%'
      OR name LIKE 'Multi Tenant%'
    RETURNING id, name;
  `,

  /**
   * Delete old test data (older than 24 hours)
   */
  deleteOldData: `
    -- Delete users created more than 24 hours ago
    -- (adjust INTERVAL '24 hours' as needed)
    DELETE FROM users
    WHERE created_at < NOW() - INTERVAL '24 hours'
      AND (
        email LIKE 'test-%@example.com'
        OR email LIKE '%@example.test'
      )
    RETURNING id, email, created_at;

    -- Delete companies created more than 24 hours ago
    DELETE FROM companies
    WHERE created_at < NOW() - INTERVAL '24 hours'
      AND (
        name LIKE 'Test%'
        OR name LIKE 'Refresh%'
        OR name LIKE 'Isolation%'
        OR name LIKE 'Multi%'
      )
    RETURNING id, name, created_at;
  `,

  /**
   * Count test data (for verification)
   */
  countTestData: `
    -- Count test users
    SELECT COUNT(*) as test_users FROM users
    WHERE
      email LIKE 'test-user-%@example.com'
      OR email LIKE '%@example.test'
      OR email LIKE 'refresh-test-%@example.com'
      OR email LIKE 'isolation-user%@example.com'
      OR email LIKE 'multi-tenant-user%@example.com';

    -- Count test companies
    SELECT COUNT(*) as test_companies FROM companies
    WHERE
      name LIKE 'Test Company%'
      OR name LIKE 'Refresh Test Company%'
      OR name LIKE 'Isolation Company%'
      OR name LIKE 'Multi Tenant%';

    -- Count old data
    SELECT COUNT(*) as old_users FROM users
    WHERE created_at < NOW() - INTERVAL '24 hours'
      AND (
        email LIKE 'test-%@example.com'
        OR email LIKE '%@example.test'
      );
  `,

  /**
   * Backup test data (before deletion)
   */
  backupTestData: `
    -- Create backup tables
    CREATE TABLE IF NOT EXISTS users_backup AS
    SELECT * FROM users
    WHERE
      email LIKE 'test-user-%@example.com'
      OR email LIKE '%@example.test'
      OR email LIKE 'refresh-test-%@example.com'
      OR email LIKE 'isolation-user%@example.com'
      OR email LIKE 'multi-tenant-user%@example.com';

    CREATE TABLE IF NOT EXISTS companies_backup AS
    SELECT * FROM companies
    WHERE
      name LIKE 'Test Company%'
      OR name LIKE 'Refresh Test Company%'
      OR name LIKE 'Isolation Company%'
      OR name LIKE 'Multi Tenant%';

    -- Log backup creation
    SELECT
      (SELECT COUNT(*) FROM users_backup) as backed_up_users,
      (SELECT COUNT(*) FROM companies_backup) as backed_up_companies;
  `,

  /**
   * Drop backup tables
   */
  dropBackupTables: `
    DROP TABLE IF EXISTS users_backup;
    DROP TABLE IF EXISTS companies_backup;
  `,

  /**
   * Restore from backup (if needed)
   */
  restoreFromBackup: `
    -- WARNING: This will overwrite current test data
    -- Uncomment and run only if you want to restore backup

    -- DELETE FROM users
    -- WHERE
    --   email LIKE 'test-user-%@example.com'
    --   OR email LIKE '%@example.test';
    --
    -- INSERT INTO users SELECT * FROM users_backup;
    --
    -- DELETE FROM companies
    -- WHERE name LIKE 'Test%';
    --
    -- INSERT INTO companies SELECT * FROM companies_backup;
  `,
};

/**
 * Manual Cleanup Instructions
 */
export const manualCleanupInstructions = `
# Manual Test Data Cleanup Instructions

## Option 1: Using Supabase Dashboard

1. Go to Supabase Dashboard: https://app.supabase.com
2. Select your project
3. Go to SQL Editor
4. Run one of the SQL scripts below:

### Delete Test Users:
\`\`\`sql
${sqlCleanupScripts.deleteTestUsers}
\`\`\`

### Delete Test Companies:
\`\`\`sql
${sqlCleanupScripts.deleteTestCompanies}
\`\`\`

### Count Test Data (verify before deletion):
\`\`\`sql
${sqlCleanupScripts.countTestData}
\`\`\`

## Option 2: Using Command Line (psql)

\`\`\`bash
# Set environment variables
export PGHOST=<your-host>
export PGPORT=5432
export PGUSER=<your-username>
export PGPASSWORD=<your-password>
export PGDATABASE=postgres

# Connect and run cleanup
psql << EOF
${sqlCleanupScripts.deleteTestUsers}
${sqlCleanupScripts.deleteTestCompanies}
EOF
\`\`\`

## Option 3: Using Automated Cleanup Script

\`\`\`bash
# Run cleanup with verbose output
npm run test:cleanup

# Run cleanup in dry-run mode (shows what would be deleted)
npm run test:cleanup -- --dry-run
\`\`\`

## Option 4: Using Node.js Script

\`\`\`bash
# Create cleanup script
cat > cleanup.js << 'EOF'
const { cleanupTestData } = require('./tests/database-cleanup');

cleanupTestData({ verbose: true, dryRun: false })
  .then(results => {
    console.log('Cleanup complete:', results);
    process.exit(results.errors.length > 0 ? 1 : 0);
  })
  .catch(error => {
    console.error('Cleanup failed:', error);
    process.exit(1);
  });
EOF

# Run it
node cleanup.js
\`\`\`

## Backup Before Cleanup

If you want to preserve test data for analysis:

\`\`\`sql
${sqlCleanupScripts.backupTestData}
\`\`\`

Then delete test data safely.

## Restore From Backup

If you accidentally deleted too much:

\`\`\`sql
${sqlCleanupScripts.restoreFromBackup}
\`\`\`

## Verify Cleanup Success

\`\`\`sql
${sqlCleanupScripts.countTestData}
\`\`\`

All counts should be 0 if cleanup was successful.

## Cleanup Patterns Matched

The cleanup scripts will delete:

Test Users (by email):
- test-user-*@example.com
- *@example.test
- refresh-test-*@example.com
- isolation-user*@example.com
- multi-tenant-user*@example.com
- incomplete-*@example.com
- weak-password-*@example.com
- invalid-cnpj-*@example.com
- invalid-email-*@example.com

Test Companies (by name):
- Test Company*
- Refresh Test Company*
- Isolation Company*
- Multi Tenant*

Old Data (older than 24 hours):
- Users and companies matching test patterns
  created more than 24 hours ago
`;

/**
 * Export cleanup function as a standalone script
 */
export async function runCleanup() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const verbose = args.includes('--verbose') || !args.includes('--quiet');

  console.log(`[Cleanup] Starting test data cleanup (dryRun: ${dryRun})`);

  try {
    const results = await cleanupTestData({ dryRun, verbose });

    console.log(`\n[Cleanup Summary]`);
    console.log(`- Users deleted: ${results.usersDeleted}`);
    console.log(`- Companies deleted: ${results.companiesDeleted}`);
    console.log(`- Errors: ${results.errors.length}`);

    if (results.errors.length > 0) {
      console.log(`\n[Cleanup Errors]`);
      results.errors.forEach(error => {
        console.error(`- ${error}`);
      });
      process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    console.error('[Cleanup Fatal Error]', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runCleanup();
}

export default {
  cleanupTestData,
  cleanupConfig,
  sqlCleanupScripts,
  manualCleanupInstructions,
  runCleanup,
};
