import pkg from 'pg';
const { Client } = pkg;

// Supabase connection details (convert HTTP URL to PostgreSQL connection)
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

async function setupMasterCompany() {
  try {
    console.log('Connecting to Supabase PostgreSQL database...');
    await client.connect();
    console.log('Connected successfully!');

    // Step 1: Check if companies table exists
    console.log('\nStep 1: Checking if companies table exists...');
    const checkTable = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'companies'
      );
    `);

    const tableExists = checkTable.rows[0].exists;
    console.log('Companies table exists:', tableExists);

    if (!tableExists) {
      console.log('\nStep 2: Creating companies table...');

      // Create companies table
      await client.query(`
        CREATE TABLE companies (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          slug VARCHAR(100) NOT NULL UNIQUE,
          description TEXT,
          plan VARCHAR(50) NOT NULL DEFAULT 'enterprise'
            CHECK (plan IN ('starter', 'professional', 'enterprise')),
          status VARCHAR(50) NOT NULL DEFAULT 'active'
            CHECK (status IN ('active', 'paused', 'suspended', 'cancelled')),
          owner_id UUID,
          cnpj VARCHAR(18),
          metadata JSONB DEFAULT '{}',
          settings JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          deleted_at TIMESTAMP WITH TIME ZONE
        );
      `);

      console.log('Creating indexes...');
      await client.query(`
        CREATE INDEX idx_companies_slug ON companies(slug) WHERE deleted_at IS NULL;
        CREATE INDEX idx_companies_owner_id ON companies(owner_id);
        CREATE INDEX idx_companies_status ON companies(status) WHERE deleted_at IS NULL;
        CREATE INDEX idx_companies_plan ON companies(plan);
        CREATE INDEX idx_companies_cnpj ON companies(cnpj) WHERE cnpj IS NOT NULL;
      `);

      console.log('Companies table created successfully!');
    }

    // Step 2: Check for existing master company
    console.log('\nStep 3: Checking for existing master company...');
    const checkMaster = await client.query(`
      SELECT id, name, slug
      FROM companies
      WHERE slug IN ('master', 'default-company')
      LIMIT 1;
    `);

    if (checkMaster.rows.length > 0) {
      const master = checkMaster.rows[0];
      console.log('Found existing master company:');
      console.log('  ID:', master.id);
      console.log('  Name:', master.name);
      console.log('  Slug:', master.slug);
      return master.id;
    }

    // Step 3: Create master company
    console.log('\nStep 4: Creating master company...');
    const createMaster = await client.query(`
      INSERT INTO companies (name, slug, cnpj, plan, status, owner_id, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id;
    `, [
      'Master Company',
      'master',
      '00.000.000/0000-00',
      'enterprise',
      'active',
      null,
      JSON.stringify({ type: 'master', system_managed: true })
    ]);

    const masterId = createMaster.rows[0].id;
    console.log('Master company created successfully!');
    console.log('Master Company ID:', masterId);

    return masterId;

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

const result = await setupMasterCompany();
console.log('\n' + '='.repeat(50));
console.log('COMPANY_ID:', result);
console.log('='.repeat(50));
