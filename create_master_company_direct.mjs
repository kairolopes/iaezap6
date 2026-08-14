import pkg from 'pg';
const { Client } = pkg;

const supabaseUrl = 'gqromcfhiosfppqlottz.supabase.co';
const supabaseServiceRoleKey = 'sb_secret_uh1cDxnWtzRT4fhYbiEWBg_fbnZkKwQ';

const client = new Client({
  host: supabaseUrl,
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: supabaseServiceRoleKey,
  ssl: { rejectUnauthorized: false },
  sslmode: 'require'
});

async function createMasterCompany() {
  try {
    console.log('Connecting to Supabase PostgreSQL database...');
    await client.connect();
    console.log('Connected successfully!\n');

    // Execute the INSERT statement
    console.log('Executing INSERT statement...');
    const insertResult = await client.query(`
      INSERT INTO companies (id, name, slug, cnpj, plan, status, owner_id, created_at)
      VALUES ('00000000-0000-0000-0000-000000000001', 'Master Company', 'master', '00.000.000/0000-00', 'enterprise', 'active', '00000000-0000-0000-0000-000000000002', NOW())
      ON CONFLICT (slug) DO NOTHING;
    `);

    console.log('Insert result:', insertResult);
    console.log('Rows affected:', insertResult.rowCount);

    // Verify with SELECT statement
    console.log('\nVerifying master company creation...');
    const verifyResult = await client.query(`
      SELECT id, name, slug, plan FROM companies WHERE slug='master';
    `);

    if (verifyResult.rows.length > 0) {
      const company = verifyResult.rows[0];
      console.log('\n✓ Company created successfully!');
      console.log('  ID:', company.id);
      console.log('  Name:', company.name);
      console.log('  Slug:', company.slug);
      console.log('  Plan:', company.plan);
    } else {
      console.log('Warning: Company not found after insert. It may already exist.');
      // Try to fetch if it exists
      const checkExisting = await client.query(`
        SELECT id, name, slug, plan FROM companies WHERE slug='master';
      `);

      if (checkExisting.rows.length > 0) {
        const company = checkExisting.rows[0];
        console.log('\n✓ Master Company already exists:');
        console.log('  ID:', company.id);
        console.log('  Name:', company.name);
        console.log('  Slug:', company.slug);
        console.log('  Plan:', company.plan);
      }
    }

  } catch (error) {
    console.error('Error occurred:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

await createMasterCompany();
console.log('\nDone!');
