/**
 * Test Setup
 * Configure environment and validate prerequisites before running tests
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const jwtPrivateKey = process.env.JWT_PRIVATE_KEY;
const jwtPublicKey = process.env.JWT_PUBLIC_KEY;

export async function validateSetup(): Promise<boolean> {
  console.log('Validating test setup...\n');

  const checks: { name: string; passed: boolean; error?: string }[] = [];

  // Check 1: Supabase credentials
  if (!supabaseUrl || !supabaseKey) {
    checks.push({
      name: 'Supabase credentials',
      passed: false,
      error: 'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY',
    });
  } else {
    checks.push({ name: 'Supabase credentials', passed: true });
  }

  // Check 2: JWT keys
  if (!jwtPrivateKey || !jwtPublicKey) {
    checks.push({
      name: 'JWT keys',
      passed: false,
      error: 'Missing JWT_PRIVATE_KEY or JWT_PUBLIC_KEY. Run: npm run generate-jwt-keys',
    });
  } else {
    checks.push({ name: 'JWT keys', passed: true });
  }

  // Check 3: Database connectivity
  if (supabaseUrl && supabaseKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data, error } = await supabase.from('companies').select('count', { count: 'exact' });

      if (error) {
        checks.push({
          name: 'Database connectivity',
          passed: false,
          error: `Cannot connect to database: ${error.message}`,
        });
      } else {
        checks.push({ name: 'Database connectivity', passed: true });
      }
    } catch (err) {
      checks.push({
        name: 'Database connectivity',
        passed: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  // Print results
  console.log('Setup Validation Results:\n');
  checks.forEach(check => {
    const status = check.passed ? '✓' : '✗';
    console.log(`${status} ${check.name}`);
    if (check.error) {
      console.log(`  Error: ${check.error}`);
    }
  });

  const allPassed = checks.every(c => c.passed);
  console.log(`\nSetup validation: ${allPassed ? 'PASSED ✓' : 'FAILED ✗'}\n`);

  return allPassed;
}

// Run validation if this is the main module
if (require.main === module) {
  validateSetup()
    .then(passed => {
      process.exit(passed ? 0 : 1);
    })
    .catch(error => {
      console.error('Setup validation error:', error);
      process.exit(1);
    });
}
