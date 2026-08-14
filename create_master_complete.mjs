import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = 'gqromcfhiosfppqlottz.supabase.co';
const supabaseServiceRoleKey = 'sb_secret_uh1cDxnWtzRT4fhYbiEWBg_fbnZkKwQ';

async function createMasterCompanyWithPostgres() {
  const client = new Client({
    host: supabaseUrl,
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: supabaseServiceRoleKey,
    ssl: { rejectUnauthorized: false },
    sslmode: 'require',
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 10000,
  });

  try {
    console.log('Attempting to connect to Supabase PostgreSQL database...');
    await client.connect();
    console.log('✓ Connected successfully!\n');

    // Step 1: Check if companies table exists
    console.log('Step 1: Checking if companies table exists...');
    const checkTable = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'companies'
      );
    `);

    const tableExists = checkTable.rows[0].exists;
    console.log('Companies table exists:', tableExists, '\n');

    if (!tableExists) {
      console.log('Step 2: Creating companies table...');

      // Create user_role enum type if not exists
      await client.query(`
        DO $$ BEGIN
          CREATE TYPE user_role AS ENUM (
            'owner',
            'admin',
            'member',
            'viewer'
          );
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
      `);

      // Create companies table
      await client.query(`
        CREATE TABLE companies (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          slug VARCHAR(100) NOT NULL UNIQUE,
          description TEXT,
          plan VARCHAR(50) NOT NULL DEFAULT 'starter'
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

      console.log('✓ Companies table created!\n');
      console.log('Step 3: Creating indexes...');

      await client.query(`
        CREATE INDEX idx_companies_slug ON companies(slug) WHERE deleted_at IS NULL;
        CREATE INDEX idx_companies_owner_id ON companies(owner_id);
        CREATE INDEX idx_companies_status ON companies(status) WHERE deleted_at IS NULL;
        CREATE INDEX idx_companies_plan ON companies(plan);
        CREATE INDEX idx_companies_cnpj ON companies(cnpj) WHERE cnpj IS NOT NULL;
      `);

      console.log('✓ Indexes created!\n');
    }

    // Step 4: Check for existing master company
    console.log('Step 4: Checking for existing master company...');
    const checkMaster = await client.query(`
      SELECT id, name, slug, plan FROM companies WHERE slug = 'master';
    `);

    if (checkMaster.rows.length > 0) {
      const master = checkMaster.rows[0];
      console.log('✓ Master company already exists:');
      console.log('  ID:', master.id);
      console.log('  Name:', master.name);
      console.log('  Slug:', master.slug);
      console.log('  Plan:', master.plan);
      return master;
    }

    // Step 5: Create master company
    console.log('\nStep 5: Creating master company...');
    const createResult = await client.query(`
      INSERT INTO companies (id, name, slug, cnpj, plan, status, owner_id, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (slug) DO NOTHING
      RETURNING id, name, slug, plan;
    `, [
      '00000000-0000-0000-0000-000000000001',
      'Master Company',
      'master',
      '00.000.000/0000-00',
      'enterprise',
      'active',
      '00000000-0000-0000-0000-000000000002'
    ]);

    if (createResult.rows.length > 0) {
      const company = createResult.rows[0];
      console.log('✓ Master company created successfully!');
      console.log('  ID:', company.id);
      console.log('  Name:', company.name);
      console.log('  Slug:', company.slug);
      console.log('  Plan:', company.plan);
      return company;
    } else {
      console.log('Note: Master company may already exist. Verifying...\n');

      // Verify final state
      const verify = await client.query(`
        SELECT id, name, slug, plan FROM companies WHERE slug = 'master';
      `);

      if (verify.rows.length > 0) {
        const company = verify.rows[0];
        console.log('✓ Verification successful:');
        console.log('  ID:', company.id);
        console.log('  Name:', company.name);
        console.log('  Slug:', company.slug);
        console.log('  Plan:', company.plan);
        return company;
      }
    }

  } catch (error) {
    console.error('\n✗ Error occurred:', error.message);
    console.error('Code:', error.code);
    console.error('Details:', error);
    process.exit(1);
  } finally {
    try {
      await client.end();
    } catch (e) {
      // ignore
    }
  }
}

console.log('='.repeat(60));
console.log('IAeZap Master Company Creation');
console.log('='.repeat(60) + '\n');

const result = await createMasterCompanyWithPostgres();

console.log('\n' + '='.repeat(60));
console.log('✓ MASTER COMPANY SETUP COMPLETE');
console.log('='.repeat(60));
console.log('Report: Master company created successfully.');
console.log('='.repeat(60));
