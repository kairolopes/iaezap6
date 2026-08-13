# Master User Setup Guide - IAeZap

## Overview

This guide explains how to initialize the Supabase database and create the master user for the IAeZap platform.

**Email:** kairolopesoficial@gmail.com  
**Role:** owner (Full system access)  
**Status:** active

---

## Prerequisites

- Supabase project initialized: `gqromcfhiosfppqlottz`
- Access to Supabase Dashboard
- Node.js environment set up

---

## Step 1: Execute Database Migrations

The database schema must be created before the master user can be created.

### Option A: Using Supabase SQL Editor (Recommended)

1. Open Supabase Dashboard: https://app.supabase.com
2. Navigate to Project: `gqromcfhiosfppqlottz`
3. Go to: **SQL Editor** → **New Query**
4. Copy the entire contents of: `migrations/001_complete_migration_bundle.sql`
5. Paste into the SQL editor
6. Click **Run** button
7. Wait for completion (may take 1-2 minutes)

The migration creates:
- `companies` table (multi-tenant support)
- `users` table (user accounts with roles)
- `company_members` table (membership tracking)
- `audit_logs` table (audit trail)
- Indexes for performance optimization
- RLS policies for security
- Helper functions for common operations

### Option B: Using Database Connection

If you have direct PostgreSQL access:

```bash
psql postgresql://user:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres < migrations/001_complete_migration_bundle.sql
```

---

## Step 2: Create Master User

After migrations complete, create the master user:

```bash
# Navigate to project directory
cd /path/to/iaezap6

# Run master user setup script
node migrate-and-create-user.mjs
```

### Expected Output

```
╔════════════════════════════════════════════════════════════════╗
║  Master User Creation - IAeZap Setup                            ║
╚════════════════════════════════════════════════════════════════╝

Step 1: Checking database connection...
✓ Database schema exists

Step 2: Generating secure password...
✓ Generated: [RANDOM_PASSWORD_16_CHARS]

Step 3: Hashing password (bcrypt, 12 rounds)...
✓ Password hashed

Step 4: Setting up master company...
✓ Created master company
  ID: [UUID]

Step 5: Creating master user...
✓ User created

Step 6: Verifying user creation...

╔════════════════════════════════════════════════════════════════╗
║  MASTER USER CREATED SUCCESSFULLY!                             ║
╚════════════════════════════════════════════════════════════════╝

CREDENTIALS (Save securely!):
────────────────────────────────────────────────────────────────
Email:      kairolopesoficial@gmail.com
Password:   [RANDOM_PASSWORD_16_CHARS]
────────────────────────────────────────────────────────────────

VERIFICATION:
SELECT * FROM users WHERE email='kairolopesoficial@gmail.com';

Result:
  user_id:      [UUID]
  email:        kairolopesoficial@gmail.com
  role:         owner
  company_id:   [UUID]
  status:       active
  email_verified: true

AUTOMATION OUTPUT:
USER_ID=[UUID]
EMAIL=kairolopesoficial@gmail.com
ROLE=owner
COMPANY_ID=[UUID]
```

---

## Step 3: Verify Master User

### Verify via SQL

Run this query in Supabase SQL Editor:

```sql
SELECT 
  id as user_id,
  email,
  role,
  company_id,
  status,
  email_verified
FROM users 
WHERE email = 'kairolopesoficial@gmail.com';
```

Expected result:
```
| user_id | email                          | role  | company_id | status | email_verified |
|---------|--------------------------------|-------|-----------|--------|----------------|
| [UUID]  | kairolopesoficial@gmail.com    | owner | [UUID]    | active | true           |
```

### Verify Master Company

```sql
SELECT 
  id as company_id,
  name,
  slug,
  plan,
  status,
  owner_id
FROM companies 
WHERE slug = 'master';
```

---

## Step 4: Test Login Endpoint

After the development server is running:

```bash
# Start the development server
npm run dev

# Test login with master credentials
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "kairolopesoficial@gmail.com",
    "password": "[PASSWORD_FROM_MASTER_USER_CREATION]"
  }'
```

Expected response:
```json
{
  "success": true,
  "user": {
    "id": "[UUID]",
    "email": "kairolopesoficial@gmail.com",
    "role": "owner",
    "company_id": "[UUID]"
  },
  "token": "[JWT_TOKEN]",
  "refresh_token": "[REFRESH_TOKEN]"
}
```

---

## Troubleshooting

### Issue: "Table does not exist" error

**Solution:** Run the database migration first using Supabase SQL Editor

```bash
# In Supabase Dashboard:
# 1. SQL Editor → New Query
# 2. Copy: migrations/001_complete_migration_bundle.sql
# 3. Click Run
```

### Issue: "Master user not found" error

**Solution:** Run the master user creation script

```bash
node migrate-and-create-user.mjs
```

### Issue: Connection timeout

**Solution:** Verify Supabase credentials in `.env.local`

```
NEXT_PUBLIC_SUPABASE_URL=https://gqromcfhiosfppqlottz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_Upj5Ce8z7Eg_kyZKpdxzeQ_ZvFEkwHd
SUPABASE_SERVICE_ROLE_KEY=sb_secret_uh1cDxnWtzRT4fhYbiEWBg_fbnZkKwQ
```

### Issue: "Could not find the table 'public.companies' in the schema cache"

**Solution:** This means the migration hasn't been run yet. Follow **Step 1** above.

---

## Master User Details

### Returned Values

After successful creation, you will receive:

| Field | Value | Description |
|-------|-------|-------------|
| USER_ID | UUID | Unique identifier for the master user |
| EMAIL | kairolopesoficial@gmail.com | Master user email address |
| ROLE | owner | Full system access role |
| COMPANY_ID | UUID | ID of the master company |
| PASSWORD | [Randomly generated] | Secure password (shown only once) |

### Database Queries

```sql
-- Get master user details
SELECT * FROM users WHERE email = 'kairolopesoficial@gmail.com';

-- Get master company details
SELECT * FROM companies WHERE slug = 'master';

-- Get all users in master company
SELECT id, email, role, status FROM users WHERE company_id = '[MASTER_COMPANY_ID]';
```

---

## Security Notes

- The master password is generated randomly and displayed only once
- Store the password securely (password manager recommended)
- Never commit credentials to version control
- Change the master password after first login in production
- Use environment variables for all sensitive data
- Never share credentials via email or chat

---

## Next Steps

1. ✓ Database schema created
2. ✓ Master user created
3. Start development server: `npm run dev`
4. Test login endpoint with master credentials
5. Create additional users as needed
6. Configure Z-API webhook integration
7. Run test suite: `npm test`

---

## Support Files

- Migration SQL: `migrations/001_complete_migration_bundle.sql`
- Master user script: `migrate-and-create-user.mjs`
- Environment config: `.env.local`
- API Reference: `API_REFERENCE.md`
- Deployment Status: `DEPLOYMENT_STATUS.md`

---

**Created:** 2026-08-13  
**Project:** IAeZap Multi-Tenant WhatsApp Business Platform  
**Version:** 1.0
