# Master User Creation - Setup Instructions

## Current Status
The Supabase database schema is not yet initialized. The tables `companies` and `users` do not exist.

## Solution

You need to manually run the database migration in the Supabase SQL Editor, then create the master user.

### Step 1: Run the Database Migration

1. Open Supabase Dashboard: https://app.supabase.com/projects
2. Select project: **gqromcfhiosfppqlottz**
3. Navigate to: **SQL Editor**
4. Click: **New Query**
5. Copy the contents of this file: `migrations/001_complete_migration_bundle.sql`
6. Paste it into the SQL editor
7. Click: **Run**
8. Wait for the migration to complete (should see success messages)

### Step 2: Create the Master User

After the migration completes successfully, run this command:

```bash
node scripts/create-master-user-minimal.mjs
```

Or use the npm script:

```bash
npm run master-user
```

### Step 3: Expected Output

You should see output like:

```
╔════════════════════════════════════════════════════════════════╗
║  VERIFICATION RESULTS                                          ║
╚════════════════════════════════════════════════════════════════╝

SQL Query: SELECT id, email, role FROM users WHERE email='kairolopesoficial@gmail.com';

Results:
  user_id: 00000000-0000-0000-0000-000000000002
  email: kairolopesoficial@gmail.com
  role: owner
  company_id: 00000000-0000-0000-0000-000000000001
  status: active
  email_verified: true
  created_at: 2026-08-13T...
```

## Manual SQL Alternative

If you prefer to run the SQL directly, use these commands:

### Create Master Company:
```sql
INSERT INTO companies (
  id,
  name,
  slug,
  plan,
  status,
  owner_id,
  metadata
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Master Company',
  'master',
  'enterprise',
  'active',
  '00000000-0000-0000-0000-000000000002',
  '{}'
);
```

### Create Master User:
```sql
INSERT INTO users (
  id,
  company_id,
  email,
  password_hash,
  full_name,
  role,
  status,
  email_verified,
  created_at
) VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'kairolopesoficial@gmail.com',
  '$2b$10$vFX3Giqy3DymRSXd1.8M6uKFHD37G9WlzsJEdXE.Fv8fmQdrdJWLW',
  'Master Admin',
  'owner'::user_role,
  'active',
  true,
  NOW()
);
```

### Verify Master User:
```sql
SELECT id, email, role FROM users WHERE email='kairolopesoficial@gmail.com';
```

Expected result:
- user_id: `00000000-0000-0000-0000-000000000002`
- email: `kairolopesoficial@gmail.com`
- role: `owner`
- status: `active`
- email_verified: `true`

## Troubleshooting

### Error: "Could not find the table 'public.users' in the schema cache"
**Solution**: Run the migration first. The schema tables don't exist yet.

### Error: "duplicate key value violates unique constraint"
**Solution**: The user or company already exists. Verify it with the SELECT query above.

### Error: "type "user_role" does not exist"
**Solution**: The migration wasn't fully executed. Re-run the complete migration bundle.

## Next Steps

After the master user is created successfully:

1. Test the login endpoint with the credentials:
   - Email: `kairolopesoficial@gmail.com`
   - Password: (Use the one generated during setup, or use the bcrypt hash if testing directly)

2. Configure JWT tokens and authentication endpoints

3. Set up additional users and roles as needed
