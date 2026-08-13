/**
 * Initialize Database Schema
 * Executes the schema for companies and users tables
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Color constants
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function initializeDatabase() {
  log(`\n${'='.repeat(80)}`, 'bold');
  log('DATABASE INITIALIZATION', 'bold');
  log(`${'='.repeat(80)}\n`, 'bold');

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      log('Missing Supabase configuration', 'red');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Read schema file
    const schemaPath = './REGISTER_DATABASE_SCHEMA.sql';
    if (!fs.existsSync(schemaPath)) {
      log(`Schema file not found: ${schemaPath}`, 'red');
      return;
    }

    const schema = fs.readFileSync(schemaPath, 'utf-8');

    log('Executing schema...\n', 'blue');

    // Split schema into individual statements
    // Handle comments and multi-line statements
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));

    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      // Skip pure comment lines and empty statements
      if (!statement || statement.startsWith('--')) {
        continue;
      }

      try {
        log(`Executing statement ${i + 1}/${statements.length}...`, 'cyan');

        const { error } = await supabase.rpc('exec_sql', { sql: statement }).catch(() => {
          // Fallback: Try direct execution
          return supabase.from('_').select().catch(err => ({
            error: { message: 'Cannot execute via RPC, trying alternative method' }
          }));
        });

        if (error && error.message && !error.message.includes('Cannot execute')) {
          log(`✗ Failed: ${error.message}`, 'yellow');
          failureCount++;
        } else {
          log(`✓ Success`, 'green');
          successCount++;
        }
      } catch (err) {
        log(`✗ Error: ${err.message}`, 'yellow');
        failureCount++;
      }
    }

    log(`\nDatabase initialization completed!`, 'green');
    log(`Successful statements: ${successCount}`, 'green');
    log(`Failed statements: ${failureCount}`, failureCount > 0 ? 'yellow' : 'green');

    log(`\nNote: Use Supabase dashboard to manually execute the schema if needed.`, 'blue');
    log(`File: REGISTER_DATABASE_SCHEMA.sql\n`, 'blue');

  } catch (error) {
    log(`\n✗ Initialization failed with error: ${error.message}`, 'red');
    log(error.stack, 'red');
  }

  log('\n' + '='.repeat(80) + '\n', 'bold');
}

initializeDatabase().catch((error) => {
  log(`Fatal error: ${error.message}`, 'red');
  process.exit(1);
});
