# IAeZap Login Endpoint - Setup Checklist

Complete this checklist to get the login endpoint up and running. Estimated time: 30-45 minutes.

## Phase 1: Preparation (5 minutes)

- [ ] Read: [LOGIN_IMPLEMENTATION_SUMMARY.md](./docs/LOGIN_IMPLEMENTATION_SUMMARY.md)
- [ ] Verify Node.js version: `node --version` (requires 18+)
- [ ] Verify npm installed: `npm --version`
- [ ] Verify Supabase project exists and is accessible

## Phase 2: JWT Key Generation (5 minutes)

- [ ] Run: `npm run generate-jwt-keys`
- [ ] Copy output from the terminal
- [ ] Open `.env.local`
- [ ] Paste `JWT_PRIVATE_KEY=...` line
- [ ] Paste `JWT_PUBLIC_KEY=...` line
- [ ] Save `.env.local`

**Expected**: No error when starting the server about missing JWT keys

## Phase 3: Database Setup (10 minutes)

### Option A: If using Supabase Dashboard

- [ ] Open Supabase Dashboard
- [ ] Go to SQL Editor
- [ ] Create new query
- [ ] Copy entire content from: `supabase/migrations/create_users_table.sql`
- [ ] Paste into SQL Editor
- [ ] Click "Run"
- [ ] Verify tables created: `companies`, `users`, `token_rotations`, `password_reset_tokens`

### Option B: If using Supabase CLI

```bash
supabase migration new create_users_table
# Edit the generated migration file
# Then run: supabase db push
```

- [ ] Database migration executed successfully
- [ ] All 4 tables created in Supabase
- [ ] Indexes created on users table

## Phase 4: Test User Creation (5 minutes)

### Step 1: Create Test Company

In Supabase SQL Editor, run:

```sql
INSERT INTO companies (name, slug, plan, status)
VALUES ('Test Company', 'test-company', 'free', 'active')
RETURNING id;
```

- [ ] Copy the returned `id` UUID
- [ ] Save this UUID for next steps

### Step 2: Generate Password Hash

In your terminal, run:

```bash
node -e "require('bcrypt').hash('TestPassword123', 12).then(h => console.log(h))"
```

- [ ] Copy the output (long hash string)
- [ ] Save this hash for next step

### Step 3: Create Test User

In Supabase SQL Editor, run:

```sql
INSERT INTO users (company_id, email, password_hash, full_name, role, status)
VALUES (
  '[PASTE_COMPANY_UUID_HERE]',
  'test@example.com',
  '[PASTE_PASSWORD_HASH_HERE]',
  'Test User',
  'user',
  'active'
);
```

- [ ] Replace `[PASTE_COMPANY_UUID_HERE]` with company UUID from Step 1
- [ ] Replace `[PASTE_PASSWORD_HASH_HERE]` with hash from Step 2
- [ ] Execute query
- [ ] Verify insertion successful

## Phase 5: Environment Verification (3 minutes)

Verify your `.env.local` has:

- [ ] `NEXT_PUBLIC_SUPABASE_URL=https://...`
- [ ] `SUPABASE_SERVICE_ROLE_KEY=...`
- [ ] `JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."`
- [ ] `JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----..."`
- [ ] `NODE_ENV=development`

## Phase 6: Start Development Server (2 minutes)

- [ ] Run: `npm run dev`
- [ ] Wait for message: "ready - started server on 0.0.0.0:3000, url: http://localhost:3000"
- [ ] No errors about missing JWT keys or Supabase configuration

## Phase 7: Test the Endpoint (5 minutes)

### Option A: Using the Browser Test Page

- [ ] Open: `http://localhost:3000/test-login.html`
- [ ] Enter email: `test@example.com`
- [ ] Enter password: `TestPassword123`
- [ ] Leave Company ID empty
- [ ] Click "Login"
- [ ] Should see: "✅ Login Successful!" with tokens
- [ ] See access_token and refresh_token in response
- [ ] Copy tokens are displayed

### Option B: Using cURL

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123"
  }' \
  | jq .
```

- [ ] Request sends successfully
- [ ] Response has `"success": true`
- [ ] Response includes `access_token` and `refresh_token`
- [ ] Response includes `user` object with email

### Option C: Using Postman

- [ ] Create new POST request
- [ ] URL: `http://localhost:3000/api/auth/login`
- [ ] Header: `Content-Type: application/json`
- [ ] Body (raw JSON):
  ```json
  {
    "email": "test@example.com",
    "password": "TestPassword123"
  }
  ```
- [ ] Click Send
- [ ] See 200 response with tokens

## Phase 8: Test Error Cases (3 minutes)

Test with wrong password:

- [ ] Email: `test@example.com`
- [ ] Password: `WrongPassword123`
- [ ] Expected: 401 Unauthorized
- [ ] Expected message: "Invalid email or password"

Test with non-existent email:

- [ ] Email: `nonexistent@example.com`
- [ ] Password: `TestPassword123`
- [ ] Expected: 401 Unauthorized
- [ ] Expected message: "Invalid email or password"

Test with missing password:

- [ ] Email: `test@example.com`
- [ ] Password: (empty)
- [ ] Expected: 400 Bad Request
- [ ] Expected: Validation error

## Phase 9: Token Verification (3 minutes)

- [ ] Visit: `https://jwt.io`
- [ ] Paste your `access_token` in the "Encoded" box
- [ ] Verify the token is valid JWT format
- [ ] Check claims in Payload:
  - [ ] Contains `sub` (user ID)
  - [ ] Contains `email`
  - [ ] Contains `tenantId` (company ID)
  - [ ] Contains `role`
  - [ ] Contains `exp` (expiration)
  - [ ] Contains `iss` (issuer: "iaezap")
  - [ ] Contains `aud` (audience: "iaezap-api")

## Phase 10: Documentation Review (10 minutes)

Read these sections:

- [ ] [QUICK_START_LOGIN.md](./docs/QUICK_START_LOGIN.md) - Quick reference
- [ ] [LOGIN_SETUP.md](./docs/LOGIN_SETUP.md) - Complete setup guide
- [ ] [LOGIN_INTEGRATION.md](./docs/LOGIN_INTEGRATION.md) - Frontend/backend integration

## Phase 11: Frontend Integration (15-30 minutes)

- [ ] Create React hook for login (see [LOGIN_INTEGRATION.md](./docs/LOGIN_INTEGRATION.md#react-example))
- [ ] Create login form component
- [ ] Test form submission
- [ ] Verify tokens stored in localStorage
- [ ] Verify tokens sent in subsequent API requests

## Phase 12: Protected Routes (10-15 minutes)

- [ ] Create protected API route with `withAuth` middleware
- [ ] Test with valid token (should succeed)
- [ ] Test with invalid token (should return 401)
- [ ] Test with expired token (should return 401)

## Phase 13: Production Preparation (20-30 minutes)

- [ ] Review [Login Setup - Security Considerations](./docs/LOGIN_SETUP.md#security-considerations)
- [ ] Generate new JWT keys for production
- [ ] Set `NODE_ENV=production`
- [ ] Verify `secure: true` in cookies (automatic)
- [ ] Enable HTTPS on production domain
- [ ] Configure CORS allowed origins
- [ ] Set up rate limiting for login endpoint
- [ ] Enable Supabase RLS policies (if using)
- [ ] Test error messages don't leak sensitive info

## Verification Checklist

After completing all phases, verify:

### Security
- [ ] JWT keys are in `.env.local`, not in code
- [ ] `.keys/` directory added to `.gitignore`
- [ ] Passwords never logged or exposed
- [ ] Tokens only sent over HTTPS (production)
- [ ] Cookies are HTTP-only for refresh tokens
- [ ] No sensitive data in error messages

### Functionality
- [ ] Login with valid credentials succeeds
- [ ] Login with invalid password fails (401)
- [ ] Login with non-existent user fails (401)
- [ ] Validation errors return 400
- [ ] Tokens can be decoded as JWT
- [ ] Tokens have correct claims
- [ ] Refresh token is different from access token
- [ ] Cookies are set in browser

### Integration
- [ ] Frontend can store tokens
- [ ] Frontend can send tokens in requests
- [ ] Backend can verify tokens
- [ ] Protected routes work correctly
- [ ] Invalid tokens rejected properly

## Troubleshooting

If you encounter errors:

1. **JWT Keys Missing**
   - Run: `npm run generate-jwt-keys`
   - Add output to `.env.local`

2. **Supabase Connection Error**
   - Check `NEXT_PUBLIC_SUPABASE_URL`
   - Check `SUPABASE_SERVICE_ROLE_KEY`
   - Verify keys are from correct Supabase project

3. **User Not Found**
   - Verify test user exists: 
     ```sql
     SELECT * FROM users WHERE email = 'test@example.com';
     ```
   - Check email case (stored as lowercase)

4. **Invalid Password Error**
   - Verify password hash is correct
   - Regenerate with: 
     ```bash
     node -e "require('bcrypt').hash('TestPassword123', 12).then(h => console.log(h))"
     ```

5. **Token Verification Fails**
   - Check JWT keys match (public/private pair)
   - Verify issuer and audience in token match config
   - Check token hasn't expired

See [Troubleshooting Guide](./docs/LOGIN_SETUP.md#troubleshooting) for more help.

## Next Steps After Setup

1. **Frontend Development**
   - Implement login page with form component
   - Add token management (storage, refresh)
   - Create protected page wrapper

2. **Backend Development**
   - Create protected API routes
   - Implement token verification middleware
   - Add role-based access control

3. **Additional Features**
   - Password reset endpoint
   - Account registration endpoint
   - Token refresh endpoint
   - Logout endpoint

4. **Production Deployment**
   - Set up monitoring and logging
   - Configure rate limiting
   - Test production environment
   - Document deployment procedure

## Support Resources

- 📖 **Documentation**: See `docs/` directory
- 🔍 **Examples**: See `docs/LOGIN_INTEGRATION.md`
- 🧪 **Testing**: Use `public/test-login.html`
- 🐛 **Troubleshooting**: See [Troubleshooting Guide](./docs/LOGIN_SETUP.md#troubleshooting)

## Time Tracking

| Phase | Task | Time | ✓ |
|-------|------|------|---|
| 1 | Preparation | 5 min | [ ] |
| 2 | JWT Key Generation | 5 min | [ ] |
| 3 | Database Setup | 10 min | [ ] |
| 4 | Test User Creation | 5 min | [ ] |
| 5 | Environment Verification | 3 min | [ ] |
| 6 | Start Dev Server | 2 min | [ ] |
| 7 | Test Endpoint | 5 min | [ ] |
| 8 | Error Testing | 3 min | [ ] |
| 9 | Token Verification | 3 min | [ ] |
| 10 | Documentation Review | 10 min | [ ] |
| **Total Core Setup** | | **51 min** | |
| 11 | Frontend Integration | 15-30 min | [ ] |
| 12 | Protected Routes | 10-15 min | [ ] |
| 13 | Production Prep | 20-30 min | [ ] |
| **Total with Integration** | | **96-126 min** | |

---

**Status**: [ ] Not Started [ ] In Progress [ ] Complete

**Last Updated**: 2026-08-13
**Version**: 1.0.0
