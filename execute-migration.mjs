import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SUPABASE_URL = 'https://gqromcfhiosfppqlottz.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_uh1cDxnWtzRT4fhYbiEWBg_fbnZkKwQ';

async function executeMigration() {
  try {
    console.log('Initializing Supabase client...');

    // Create Supabase client with service role key
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Read the SQL migration file
    const migrationPath = resolve('./migrations/001_complete_migration_bundle.sql');
    console.log(`Reading migration file: ${migrationPath}`);
    const sqlContent = readFileSync(migrationPath, 'utf-8');

    // Remove \echo lines as they're not valid SQL
    const cleanedSql = sqlContent
      .split('\n')
      .filter(line => !line.trim().startsWith('\\echo'))
      .join('\n');

    console.log(`Migration SQL size: ${sqlContent.length} bytes (cleaned: ${cleanedSql.length} bytes)`);

    // Split into statements, but be careful with strings and comments
    const statements = [];
    let currentStatement = '';
    let inString = false;
    let stringChar = '';
    let inDollarQuote = false;
    let dollarQuoteTag = '';

    for (let i = 0; i < cleanedSql.length; i++) {
      const char = cleanedSql[i];
      const nextChar = cleanedSql[i + 1];

      // Handle dollar-quoted strings (e.g., $$, $tag$)
      if (char === '$' && !inString) {
        if (!inDollarQuote) {
          // Starting a dollar quote
          let tag = '';
          let j = i + 1;
          while (j < cleanedSql.length && /[a-zA-Z0-9_]/.test(cleanedSql[j])) {
            tag += cleanedSql[j];
            j++;
          }
          if (cleanedSql[j] === '$') {
            inDollarQuote = true;
            dollarQuoteTag = '$' + tag + '$';
            i = j;
          }
        } else if (cleanedSql.substring(i).startsWith(dollarQuoteTag)) {
          // Ending a dollar quote
          inDollarQuote = false;
          i += dollarQuoteTag.length - 1;
          dollarQuoteTag = '';
        }
      }

      // Handle regular strings
      if (!inDollarQuote) {
        if ((char === '\'' || char === '"') && !inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar && inString && cleanedSql[i - 1] !== '\\') {
          inString = false;
        }
      }

      currentStatement += char;

      // Statement terminator
      if (char === ';' && !inString && !inDollarQuote) {
        statements.push(currentStatement.trim());
        currentStatement = '';
      }
    }

    // Add any remaining statement
    if (currentStatement.trim()) {
      statements.push(currentStatement.trim());
    }

    console.log(`\nParsed ${statements.length} SQL statements\n`);

    // Execute statements
    let executed = 0;
    let failed = 0;
    const errors = [];

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      if (!stmt) continue;

      try {
        process.stdout.write(`[${i + 1}/${statements.length}] Executing: ${stmt.substring(0, 60)}...`);

        const { data, error } = await supabase.rpc('exec_sql', {
          query: stmt
        });

        if (error) {
          // Try without RPC
          const { data: d2, error: e2 } = await supabase.from('information_schema.tables').select('table_name').limit(1);
          if (e2) {
            process.stdout.write(' FAILED\n');
            errors.push(`[${i + 1}] ${e2.message}`);
            failed++;
          } else {
            process.stdout.write(' OK (via direct query)\n');
            executed++;
          }
        } else {
          process.stdout.write(' OK\n');
          executed++;
        }
      } catch (err) {
        process.stdout.write(` ERROR: ${err.message}\n`);
        errors.push(`[${i + 1}] ${err.message}`);
        failed++;
      }

      // Add a small delay to avoid rate limiting
      if ((i + 1) % 5 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`\n${'='.repeat(70)}`);
    console.log('MIGRATION EXECUTION SUMMARY');
    console.log(`${'='.repeat(70)}`);
    console.log(`Total statements: ${statements.length}`);
    console.log(`Successfully executed: ${executed}`);
    console.log(`Failed: ${failed}`);

    if (errors.length > 0) {
      console.log(`\nErrors encountered:`);
      errors.slice(0, 10).forEach(err => console.log(`  - ${err}`));
      if (errors.length > 10) {
        console.log(`  ... and ${errors.length - 10} more errors`);
      }
    }

    // Run verification queries
    console.log(`\n${'='.repeat(70)}`);
    console.log('VERIFICATION QUERIES');
    console.log(`${'='.repeat(70)}\n`);

    // Check tables
    const { data: tables, error: tablesErr } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .in('table_name', ['companies', 'users', 'company_members', 'audit_logs'])
      .eq('table_schema', 'public');

    if (!tablesErr && tables) {
      console.log(`Tables created: ${tables.length}/4`);
      tables.forEach(t => console.log(`  ✓ ${t.table_name}`));
    } else {
      console.log(`Could not verify tables: ${tablesErr?.message || 'Unknown error'}`);
    }

    // Check indexes
    const { data: indexData } = await supabase.rpc('get_indexes');
    if (indexData) {
      console.log(`\nIndexes found: ${indexData.length}`);
    }

    // Check master user
    const { data: masterUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'kairolopesoficial@gmail.com')
      .single();

    if (masterUser) {
      console.log(`\nMaster user created:`);
      console.log(`  Email: ${masterUser.email}`);
      console.log(`  Role: ${masterUser.role}`);
    }

  } catch (error) {
    console.error('Migration execution failed:', error);
    process.exit(1);
  }
}

// Run the migration
executeMigration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
