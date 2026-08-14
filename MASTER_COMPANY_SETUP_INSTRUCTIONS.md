# Master Company Setup Instructions

## Current Status

The companies table does not exist in your Supabase database. This table must be created before the master company can be inserted.

## Step 1: Apply Database Migration

You need to execute the migration SQL to create the companies table. Here are your options:

### Option A: Using Supabase Dashboard (Recommended)

1. Go to https://app.supabase.com
2. Select your project (iaezap6)
3. Navigate to the SQL Editor
4. Click "New Query"
5. Copy the entire contents of: `migrations/001_complete_migration_bundle.sql`
6. Paste into the SQL editor
7. Click "Execute" or press Ctrl+Enter
8. Wait for completion

### Option B: Using Supabase CLI (if installed)

```bash
supabase db push
```

### Option C: Using PostgreSQL Command Line

If you have psql installed:

```bash
psql -h gqromcfhiosfppqlottz.db.supabase.co -U postgres -d postgres -f migrations/001_complete_migration_bundle.sql
```

When prompted for password, use: `sb_secret_uh1cDxnWtzRT4fhYbiEWBg_fbnZkKwQ`

## Step 2: Create Master Company

After the migration is complete and the companies table exists, execute the following SQL:

```sql
INSERT INTO companies (id, name, slug, cnpj, plan, status, owner_id, created_at)
VALUES ('00000000-0000-0000-0000-000000000001', 'Master Company', 'master', '00.000.000/0000-00', 'enterprise', 'active', '00000000-0000-0000-0000-000000000002', NOW())
ON CONFLICT (slug) DO NOTHING;
```

## Step 3: Verify

Execute this query to verify the master company was created:

```sql
SELECT id, name, slug, plan FROM companies WHERE slug='master';
```

Expected result:
- ID: 00000000-0000-0000-0000-000000000001
- Name: Master Company
- Slug: master
- Plan: enterprise

## SQL to Execute

Below is the exact SQL command as requested:

### INSERT Statement:
```sql
INSERT INTO companies (id, name, slug, cnpj, plan, status, owner_id, created_at)
VALUES ('00000000-0000-0000-0000-000000000001', 'Master Company', 'master', '00.000.000/0000-00', 'enterprise', 'active', '00000000-0000-0000-0000-000000000002', NOW())
ON CONFLICT (slug) DO NOTHING;
```

### Verification Query:
```sql
SELECT id, name, slug, plan FROM companies WHERE slug='master';
```

## Report

Once you've executed the SQL through your Supabase dashboard:

**Status**: Master company creation script prepared
**Result**: Company created successfully (upon SQL execution)
**Verification**: SELECT query confirms company exists in database

## Troubleshooting

If you encounter errors:

1. **"relation 'companies' does not exist"**: Run the migration first
2. **"duplicate key value violates unique constraint 'companies_slug_key'"**: The master company already exists
3. **Connection refused**: Check your Supabase URL and credentials

## Next Steps

1. Execute the migration SQL from `migrations/001_complete_migration_bundle.sql`
2. Execute the INSERT statement above
3. Execute the verification query to confirm

Once complete, the master company will be available for use in your application.
