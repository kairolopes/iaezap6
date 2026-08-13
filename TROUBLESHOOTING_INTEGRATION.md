# IAeZap Troubleshooting & Integration Guide

Comprehensive guide for resolving common issues, debugging integration problems, and troubleshooting the IAeZap system.

## Table of Contents

1. [Authentication Issues](#authentication-issues)
2. [Authorization & Permission Issues](#authorization--permission-issues)
3. [API Endpoint Problems](#api-endpoint-problems)
4. [Webhook Integration Issues](#webhook-integration-issues)
5. [Database Connection Issues](#database-connection-issues)
6. [Multi-Tenant Data Issues](#multi-tenant-data-issues)
7. [Message Processing Issues](#message-processing-issues)
8. [Performance & Timeout Issues](#performance--timeout-issues)
9. [Security & SSL Issues](#security--ssl-issues)
10. [Z-API Integration Issues](#z-api-integration-issues)
11. [Debugging Tools & Techniques](#debugging-tools--techniques)
12. [Common Error Messages](#common-error-messages)
13. [Emergency Procedures](#emergency-procedures)

---

## Authentication Issues

### Problem: Login Returns 401 Unauthorized

**Symptoms:**
- Login endpoint returns 401 error
- "Invalid email or password" message
- Users cannot authenticate

**Possible Causes:**
1. User doesn't exist in database
2. Password hashing mismatch
3. Database connection failure
4. User status is not 'active'

**Troubleshooting Steps:**

1. **Verify user exists:**
   ```sql
   SELECT id, email, status, password_hash 
   FROM users 
   WHERE email = 'user@example.com' 
   AND deleted_at IS NULL;
   ```
   - If no results: User account doesn't exist, needs registration
   - If status != 'active': Activate user account

2. **Check password hash:**
   ```typescript
   import bcrypt from 'bcrypt';
   
   // In Node REPL:
   const hash = 'stored_hash_from_database';
   const password = 'user_input_password';
   const isValid = await bcrypt.compare(password, hash);
   console.log(isValid); // true if valid
   ```

3. **Check database connectivity:**
   ```typescript
   const { data, error } = await supabase
     .from('users')
     .select('id')
     .limit(1);
   
   if (error) {
     console.error('Database connection failed:', error);
   }
   ```

4. **Check logs:**
   ```bash
   # View application logs
   tail -f logs/app.log
   
   # Search for login errors
   grep "login" logs/app.log | grep "error"
   ```

**Solution:**
```bash
# Reset user password
curl -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'

# Or manually hash new password
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('NewPass123!', 10).then(h => console.log(h))"

# Update in database
UPDATE users SET password_hash = 'new_hash' WHERE email = 'user@example.com';
```

---

### Problem: "Invalid Authorization Token"

**Symptoms:**
- Protected endpoints return 401
- "Invalid authorization token" error
- Token was recently obtained but now invalid

**Possible Causes:**
1. Token expired (15 minute default)
2. Token signature invalid (key mismatch)
3. Public key not configured
4. Token tampered with

**Troubleshooting Steps:**

1. **Decode JWT token:**
   ```bash
   # Install jwt-cli: npm install -g jwt-cli
   jwt-cli decode 'eyJhbGciOiJSUzI1NiIs...'
   
   # Or online at: https://jwt.io
   ```

2. **Check token expiration:**
   ```typescript
   import jwt from 'jsonwebtoken';
   
   const decoded = jwt.decode(token);
   console.log('Expires at:', new Date(decoded.exp * 1000));
   console.log('Is expired:', decoded.exp < Math.floor(Date.now() / 1000));
   ```

3. **Verify public key configuration:**
   ```bash
   echo $PUBLIC_KEY
   # Should output: -----BEGIN PUBLIC KEY-----...
   ```

4. **Check key mismatch:**
   ```typescript
   import jwt from 'jsonwebtoken';
   
   try {
     const decoded = jwt.verify(token, publicKey, {
       algorithms: ['RS256']
     });
     console.log('Token valid:', decoded);
   } catch (error) {
     console.error('Verification failed:', error.message);
     // If "invalid signature": keys don't match
   }
   ```

**Solution:**

1. **Token expired - refresh it:**
   ```bash
   curl -X POST http://localhost:3000/api/auth/refresh \
     -H "Content-Type: application/json" \
     -d '{"refreshToken": "eyJhbGciOiJSUzI1NiIs..."}'
   ```

2. **Key mismatch - regenerate keys:**
   ```bash
   npm run generate-jwt-keys
   
   # Copy new keys to environment:
   echo "PRIVATE_KEY=$(cat private.pem)" >> .env.production
   echo "PUBLIC_KEY=$(cat public.pem)" >> .env.production
   
   # Restart application
   ```

---

### Problem: "Token Already Blacklisted"

**Symptoms:**
- Token was recently valid
- Suddenly returns "Token already blacklisted"
- User can't use existing token

**Possible Causes:**
1. User logged out (token blacklisted)
2. User changed password
3. Token blacklist not cleaned up
4. Manual token revocation

**Troubleshooting Steps:**

1. **Check if user logged out:**
   ```sql
   SELECT * FROM token_blacklist 
   WHERE token_hash = 'hash_of_token' 
   LIMIT 1;
   ```

2. **Remove from blacklist (if needed):**
   ```sql
   DELETE FROM token_blacklist 
   WHERE token_hash = 'hash_of_token';
   ```

**Solution:**
```bash
# User should log in again to get fresh tokens
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}'
```

---

## Authorization & Permission Issues

### Problem: "Only Admin Users Can Manage Users"

**Symptoms:**
- Trying to list/manage users
- Returns 403 Forbidden
- "Only admin users can manage users" error
- Admin endpoint not accessible

**Possible Causes:**
1. User role is not 'admin'
2. User belongs to different company
3. Role not properly loaded in JWT token

**Troubleshooting Steps:**

1. **Check user role in database:**
   ```sql
   SELECT id, email, role, company_id, status 
   FROM users 
   WHERE email = 'user@example.com';
   ```
   - Verify role is 'admin'
   - Verify status is 'active'

2. **Check role in JWT token:**
   ```typescript
   const decoded = jwt.decode(token);
   console.log('Roles in token:', decoded.roles);
   console.log('Company ID:', decoded.company_id);
   ```

3. **Verify token payload generation:**
   ```typescript
   // In auth.ts - check token generation
   const tokenPair = await generateTokens({
     userId: user.id,
     email: user.email,
     roles: user.role ? [user.role] : ['user'],  // <- role here
     tenantId: user.company_id,
   });
   ```

**Solution:**

1. **Update user role in database:**
   ```sql
   UPDATE users 
   SET role = 'admin' 
   WHERE id = 'user-uuid';
   ```

2. **User must log in again to get updated token:**
   ```bash
   curl -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "user@example.com", "password": "password"}'
   ```

---

### Problem: "Forbidden - Insufficient Permissions"

**Symptoms:**
- User has correct role but still denied
- Endpoint returns 403
- Different user in same company can access

**Possible Causes:**
1. Company ID mismatch in JWT token
2. Company ID mismatch in database
3. User not linked to company
4. Role changed recently (old token)

**Troubleshooting Steps:**

1. **Verify company_id in token matches user's company:**
   ```typescript
   const decoded = jwt.decode(token);
   
   const { data: user } = await supabase
     .from('users')
     .select('company_id')
     .eq('id', decoded.sub)
     .single();
   
   console.log('Token company:', decoded.company_id);
   console.log('User company:', user.company_id);
   console.log('Match:', decoded.company_id === user.company_id);
   ```

2. **Verify user is active:**
   ```sql
   SELECT id, email, status, role, company_id 
   FROM users 
   WHERE id = 'user-uuid';
   ```

**Solution:**
```bash
# User must re-login with fresh token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}'
```

---

## API Endpoint Problems

### Problem: Endpoint Returns 404 Not Found

**Symptoms:**
- API endpoint returns 404
- "Not Found" error
- Endpoint exists in code but not accessible

**Possible Causes:**
1. Wrong HTTP method (POST vs GET)
2. Incorrect URL path
3. API route not compiled
4. Wrong server URL

**Troubleshooting Steps:**

1. **Verify endpoint exists:**
   ```bash
   # Development
   curl -I http://localhost:3000/api/auth/login
   # Should return 405 Method Not Allowed (if using wrong method)
   # or 200 (if OPTIONS request)
   
   # Production
   curl -I https://your-domain.com/api/auth/login
   ```

2. **Check request method:**
   ```bash
   # POST required (not GET)
   curl -X POST http://localhost:3000/api/auth/login -v
   
   # Check headers
   curl -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{}' \
     -v
   ```

3. **Check Next.js build:**
   ```bash
   # Rebuild Next.js
   npm run build
   
   # Check if routes are in .next/routes-manifest.json
   cat .next/routes-manifest.json | grep "auth/login"
   ```

**Solution:**
```bash
# Rebuild and restart application
npm run build
npm run dev  # or npm start for production
```

---

### Problem: POST Request Returns 400 Bad Request

**Symptoms:**
- Request returns 400
- "Request body must be valid JSON" or validation error
- Same request works in development but not production

**Possible Causes:**
1. Invalid JSON format
2. Missing required fields
3. Wrong content type
4. Body too large

**Troubleshooting Steps:**

1. **Validate JSON:**
   ```bash
   # Test JSON validity
   echo '{"email": "test@example.com", "password": "test"}' | jq .
   ```

2. **Check Content-Type header:**
   ```bash
   curl -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "test@example.com", "password": "test"}' \
     -v
   
   # Look for: Content-Type: application/json
   ```

3. **Check request body size:**
   ```bash
   # Get body size
   echo -n '{"email": "test@example.com", "password": "test"}' | wc -c
   # Should be < 1MB
   ```

4. **Check validation errors:**
   ```javascript
   // In browser console:
   const response = await fetch('/api/auth/login', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       email: 'test@example.com',
       password: 'test'
     })
   });
   
   const json = await response.json();
   console.log('Errors:', json.error.details);
   ```

**Solution:**

1. **Validate request body:**
   ```typescript
   // Check each required field
   const loginRequest = {
     email: 'test@example.com',
     password: 'password123'  // Must be >= 6 chars
   };
   
   // Should pass validation
   ```

2. **Ensure all required fields present:**
   ```bash
   curl -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{
       "email": "test@example.com",
       "password": "Password123!"
     }'
   ```

---

### Problem: CORS Error When Calling API

**Symptoms:**
- Browser console: "CORS policy: No 'Access-Control-Allow-Origin'"
- Request blocked by browser
- Preflight OPTIONS request fails

**Possible Causes:**
1. CORS not enabled in API
2. CORS origin not configured correctly
3. Credentials not included
4. Custom headers not allowed

**Troubleshooting Steps:**

1. **Check if OPTIONS request succeeds:**
   ```bash
   curl -X OPTIONS http://localhost:3000/api/admin/users \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: Authorization" \
     -v
   
   # Look for Access-Control-* headers in response
   ```

2. **Check CORS configuration:**
   ```typescript
   // In API route
   export async function OPTIONS(request: NextRequest) {
     const headers = {
       'Access-Control-Allow-Origin': request.headers.get('origin') || '*',
       'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
       'Access-Control-Allow-Headers': 'Content-Type, Authorization',
     };
     return NextResponse.json({}, { headers, status: 200 });
   }
   ```

3. **Check frontend request:**
   ```javascript
   // Include credentials and proper headers
   fetch('http://localhost:3000/api/admin/users', {
     method: 'GET',
     headers: {
       'Authorization': 'Bearer token...',
       'Content-Type': 'application/json'
     },
     credentials: 'include'  // Important for cookies
   })
   ```

**Solution:**

1. **Update CORS in API route:**
   ```typescript
   export async function OPTIONS(request: NextRequest) {
     const origin = request.headers.get('origin');
     const allowedOrigins = [
       'http://localhost:3000',
       'https://your-domain.com'
     ];
     
     const headers = {
       'Access-Control-Allow-Origin': 
         allowedOrigins.includes(origin) ? origin : 'https://your-domain.com',
       'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
       'Access-Control-Allow-Headers': 'Content-Type, Authorization',
       'Access-Control-Allow-Credentials': 'true',
     };
     
     return NextResponse.json({}, { headers, status: 200 });
   }
   ```

2. **Update frontend fetch request:**
   ```javascript
   const response = await fetch('/api/endpoint', {
     method: 'POST',
     headers: {
       'Authorization': `Bearer ${token}`,
       'Content-Type': 'application/json'
     },
     credentials: 'include',
     body: JSON.stringify(data)
   });
   ```

---

## Webhook Integration Issues

### Problem: Webhooks Not Being Received

**Symptoms:**
- Z-API webhooks not reaching the endpoint
- No webhook logs in application
- Z-API dashboard shows "pending" or "failed"

**Possible Causes:**
1. Webhook URL not configured in Z-API
2. Endpoint returns non-200 status
3. Endpoint unreachable (DNS/firewall)
4. Endpoint timeout too short

**Troubleshooting Steps:**

1. **Verify webhook URL in Z-API:**
   - Log into Z-API dashboard
   - Check webhook URL: Should be `https://your-domain.com/api/webhooks/z-api/receive`
   - Verify HTTPS is used (not HTTP)
   - Verify domain is correct

2. **Test webhook endpoint manually:**
   ```bash
   curl -X POST https://your-domain.com/api/webhooks/z-api/receive \
     -H "Content-Type: application/json" \
     -d '{
       "type": "receive",
       "messageId": "test_123",
       "senderPhone": "5511987654321",
       "messageType": "text",
       "text": "Test message",
       "timestamp": 1692057600000,
       "phoneNumber": "5511987654321"
     }' \
     -v
   
   # Should return: { "value": true }
   ```

3. **Check if endpoint is accessible:**
   ```bash
   # From your server, test connectivity
   curl -I https://your-domain.com/api/webhooks/z-api/receive
   # Should return 200 OK or 405 Method Not Allowed
   ```

4. **Check application logs:**
   ```bash
   # View webhook logs
   tail -f logs/webhooks.log
   
   # Search for webhook errors
   grep "Webhook" logs/app.log | grep "error"
   ```

5. **Test with Z-API test tool:**
   - Z-API dashboard usually has a "Test Webhook" button
   - Send test event
   - Check application logs for received event

**Solution:**

1. **Update webhook URL in Z-API:**
   - Z-API Dashboard > Settings > Webhooks
   - Set URL: `https://your-domain.com/api/webhooks/z-api/receive`
   - Test webhook delivery

2. **Ensure endpoint returns 200:**
   ```typescript
   // api/webhooks/z-api/receive/route.ts
   export async function POST(request: NextRequest) {
     try {
       const body = await request.json();
       // Process webhook...
       return NextResponse.json({ value: true }, { status: 200 });
     } catch (error) {
       return NextResponse.json({ value: false }, { status: 400 });
     }
   }
   ```

3. **Verify endpoint is publicly accessible:**
   ```bash
   # From external service
   curl -X POST https://your-domain.com/api/webhooks/z-api/receive \
     -H "Content-Type: application/json" \
     -d '{"test": true}'
   ```

---

### Problem: "Webhook Validation Failed"

**Symptoms:**
- Webhook received but returns 400
- Validation error in logs
- Z-API dashboard shows "400 Bad Request"

**Possible Causes:**
1. Webhook payload format incorrect
2. Zod schema validation failing
3. Missing required fields
4. Field type mismatch

**Troubleshooting Steps:**

1. **Check webhook payload format:**
   ```typescript
   // api/webhooks/z-api/receive/route.ts
   console.log('[Webhook] Raw body:', JSON.stringify(body, null, 2));
   
   // Check validation
   const validation = validateWebhookEvent(event);
   if (!validation.success) {
     console.log('[Webhook] Validation errors:', 
       validation.error.flatten().fieldErrors
     );
   }
   ```

2. **Verify Z-API payload matches schema:**
   ```bash
   # Z-API sends events like:
   {
     "type": "receive",
     "messageId": "msg_123",
     "senderPhone": "5511987654321",
     "messageType": "text",
     "text": "message content",
     "timestamp": 1692057600000,
     "phoneNumber": "5511987654321"
   }
   
   # Verify all required fields present
   ```

3. **Check Zod schema:**
   ```typescript
   // types/z-api.ts - Review schema validation
   export const receiveEventSchema = z.object({
     type: z.literal('receive'),
     messageId: z.string().min(1),
     senderPhone: z.string().regex(/^\d{10,15}$/),
     messageType: messageTypeEnum,
     // ... other fields
   });
   ```

**Solution:**

1. **Log full webhook details:**
   ```typescript
   console.log('Webhook body:', JSON.stringify(body, null, 2));
   console.log('After mapping:', JSON.stringify(event, null, 2));
   ```

2. **Update webhook handler to be more lenient:**
   ```typescript
   // Map Z-API format to our schema
   const event = {
     type: body.status === 'RECEIVED' ? 'receive' : body.type,
     messageId: body.messageId || body.id,
     senderPhone: body.phone || body.senderPhone,
     // ... handle field variations
   };
   ```

3. **Test with valid payload:**
   ```bash
   curl -X POST https://your-domain.com/api/webhooks/z-api/receive \
     -H "Content-Type: application/json" \
     -d '{
       "type": "receive",
       "messageId": "msg_123456",
       "senderPhone": "5511987654321",
       "messageType": "text",
       "text": "Hello, testing the webhook!",
       "timestamp": '$(date +%s000)',
       "phoneNumber": "5511987654321"
     }'
   ```

---

### Problem: "Webhook Processing Timeout"

**Symptoms:**
- Webhook returns 200 but says "processing"
- Messages not stored in database
- Webhook logs show incomplete processing
- Async processing never completes

**Possible Causes:**
1. Long-running operation in webhook handler
2. Database query timeout
3. External service call timeout
4. Memory leak causing slowdown

**Troubleshooting Steps:**

1. **Check processing time:**
   ```typescript
   const startTime = Date.now();
   
   await processZApiWebhook(event, tenantId);
   
   const duration = Date.now() - startTime;
   console.log(`Webhook processing took ${duration}ms`);
   ```

2. **Identify slow operations:**
   ```typescript
   console.time('store-message');
   await supabase.from('z_api_messages').insert([...]);
   console.timeEnd('store-message');
   
   console.time('apply-rules');
   await applyMessageRules(message);
   console.timeEnd('apply-rules');
   ```

3. **Check database performance:**
   ```sql
   -- Check slow queries
   SELECT query, mean_exec_time 
   FROM pg_stat_statements 
   WHERE query LIKE '%z_api_messages%'
   ORDER BY mean_exec_time DESC;
   ```

**Solution:**

1. **Optimize webhook processing:**
   ```typescript
   export async function processZApiWebhook(
     event: WebhookEvent,
     tenantId: string
   ): Promise<void> {
     // Return immediately and process in background
     Promise.resolve().then(async () => {
       try {
         // Store message
         const message = await storeMessage(event, tenantId);
         
         // Apply rules without waiting
         applyRulesAsync(message, tenantId).catch(console.error);
         
       } catch (error) {
         console.error('Webhook processing error:', error);
       }
     });
   }
   ```

2. **Add database indexes:**
   ```sql
   -- Speed up message storage
   CREATE INDEX CONCURRENTLY idx_z_api_messages_company_id 
   ON z_api_messages(company_id);
   
   CREATE INDEX CONCURRENTLY idx_z_api_messages_created_at 
   ON z_api_messages(created_at DESC);
   ```

---

## Database Connection Issues

### Problem: "Error: connect ECONNREFUSED"

**Symptoms:**
- Database connection fails
- "ECONNREFUSED" error in logs
- Application can't reach database

**Possible Causes:**
1. Database server not running
2. Wrong database URL
3. Network/firewall blocking connection
4. Database credentials incorrect

**Troubleshooting Steps:**

1. **Test database connectivity:**
   ```bash
   # Supabase - check if accessible
   curl -I https://your-project.supabase.co
   
   # Direct database test (if available)
   psql postgresql://user:password@host:5432/dbname
   ```

2. **Check Supabase status:**
   - Visit https://status.supabase.com
   - Check if there are any outages

3. **Verify environment variables:**
   ```bash
   echo $NEXT_PUBLIC_SUPABASE_URL
   echo $SUPABASE_SERVICE_ROLE_KEY
   
   # Should show actual URLs/keys, not empty
   ```

4. **Test from application:**
   ```typescript
   const { data, error } = await supabase
     .from('users')
     .select('id')
     .limit(1);
   
   if (error) {
     console.error('DB Error:', error.message);
   } else {
     console.log('DB Connected:', data);
   }
   ```

**Solution:**

1. **Verify Supabase project is running:**
   - Check Supabase dashboard
   - Verify project status
   - Check organization subscription

2. **Update database URL if changed:**
   ```bash
   # Get new credentials from Supabase
   # Project Settings > Database > Connection strings
   
   NEXT_PUBLIC_SUPABASE_URL=https://new-url.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=new-key
   ```

3. **Restart application:**
   ```bash
   npm run dev
   ```

---

### Problem: "Query Timeout"

**Symptoms:**
- Database queries return timeout error
- Specific queries slow
- Application hangs on database calls

**Possible Causes:**
1. Query not optimized
2. Missing database indexes
3. Large dataset processing
4. Database under heavy load

**Troubleshooting Steps:**

1. **Identify slow query:**
   ```typescript
   console.time('query-users');
   const { data } = await supabase
     .from('users')
     .select('*')
     .eq('company_id', companyId);
   console.timeEnd('query-users');
   ```

2. **Check query plan:**
   ```sql
   -- Use EXPLAIN to analyze query
   EXPLAIN ANALYZE
   SELECT * FROM users WHERE company_id = '...';
   ```

3. **Check missing indexes:**
   ```sql
   -- List all indexes
   SELECT schemaname, tablename, indexname 
   FROM pg_indexes 
   WHERE tablename = 'users';
   ```

**Solution:**

1. **Add indexes for commonly filtered fields:**
   ```sql
   CREATE INDEX CONCURRENTLY idx_users_company_id 
   ON users(company_id);
   
   CREATE INDEX CONCURRENTLY idx_users_email 
   ON users(email);
   ```

2. **Optimize query to only fetch needed fields:**
   ```typescript
   // Instead of:
   const { data } = await supabase
     .from('users')
     .select('*');  // Fetches all columns
   
   // Use:
   const { data } = await supabase
     .from('users')
     .select('id, email, role, company_id');  // Only needed columns
   ```

3. **Add pagination to large queries:**
   ```typescript
   const { data } = await supabase
     .from('users')
     .select('*')
     .eq('company_id', companyId)
     .range(0, 49)  // Only fetch 50 items
     .order('created_at', { ascending: false });
   ```

---

## Multi-Tenant Data Issues

### Problem: "User Seeing Data From Different Company"

**Symptoms:**
- User can see other company's data
- Data isolation not working
- Multi-tenant security breach

**Critical - Immediate Action Needed!**

**Troubleshooting Steps:**

1. **Identify the issue in logs:**
   ```bash
   grep "company_id" logs/app.log | head -20
   ```

2. **Check API endpoint implementation:**
   ```typescript
   // In /api/admin/users/route.ts
   
   // WRONG - No company filter:
   const { data: users } = await supabase
     .from('users')
     .select('*')
     .eq('id', userId);  // Missing company_id check!
   
   // CORRECT - With company filter:
   const { data: users } = await supabase
     .from('users')
     .select('*')
     .eq('company_id', currentUserCompanyId)  // <- Important!
     .eq('id', userId);
   ```

3. **Verify company_id in JWT token:**
   ```typescript
   const payload = jwt.verify(token, publicKey);
   console.log('Company in token:', payload.company_id);
   ```

**Immediate Solution:**

1. **Audit affected endpoints:**
   - Review all API endpoints in `/api/**`
   - Ensure all queries filter by `company_id`
   - Enable query logging to find violations

2. **Code pattern for safe queries:**
   ```typescript
   // Always verify user's company first
   const { data: currentUser } = await supabase
     .from('users')
     .select('company_id')
     .eq('id', userId)
     .single();
   
   const companyId = currentUser.company_id;
   
   // Then filter by company_id
   const { data } = await supabase
     .from('users')
     .select('*')
     .eq('company_id', companyId);  // ALWAYS include this
   ```

3. **Add RLS (Row Level Security) policies:**
   ```sql
   -- Prevent queries without company_id
   ALTER TABLE users ENABLE ROW LEVEL SECURITY;
   
   CREATE POLICY "Users can see their company's users"
   ON users FOR SELECT
   USING (company_id = current_user_company_id());
   ```

---

### Problem: "Company ID Mismatch in Token"

**Symptoms:**
- Token has wrong company_id
- User accessing wrong company's data
- Inconsistent company context

**Troubleshooting Steps:**

1. **Check token content:**
   ```typescript
   const decoded = jwt.decode(token);
   console.log('Company in token:', decoded.company_id);
   
   const { data: user } = await supabase
     .from('users')
     .select('company_id')
     .eq('id', decoded.sub)
     .single();
   
   console.log('Actual user company:', user.company_id);
   console.log('Match:', decoded.company_id === user.company_id);
   ```

2. **Check token generation:**
   ```typescript
   // In lib/auth/tokens.ts
   const payload = {
     sub: userId,
     email: user.email,
     company_id: user.company_id,  // <- Must be correct
     roles: [user.role],
   };
   ```

**Solution:**
- User must re-login to get token with correct company_id
- Check database to ensure user.company_id is correct

---

## Message Processing Issues

### Problem: "Messages Not Appearing in Database"

**Symptoms:**
- Z-API webhooks arriving (logs show "received")
- Messages not stored in z_api_messages table
- No processing errors in logs

**Possible Causes:**
1. Database insert failing silently
2. Async processing error not logged
3. Wrong table name
4. Foreign key constraint failing

**Troubleshooting Steps:**

1. **Check if messages are being stored:**
   ```sql
   SELECT COUNT(*) FROM z_api_messages;
   
   SELECT * FROM z_api_messages 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```

2. **Check processing errors:**
   ```bash
   grep "z_api_messages" logs/app.log | grep "error"
   grep "Error storing message" logs/app.log
   ```

3. **Manually test message insertion:**
   ```typescript
   const { data, error } = await supabase
     .from('z_api_messages')
     .insert([
       {
         company_id: 'company-uuid',
         instance_id: '5511987654321',
         message_id: 'test_' + Date.now(),
         sender_phone: '5511987654321',
         recipient_phone: '5511987654321',
         message_type: 'text',
         content: 'Test message',
         status: 'received',
       }
     ]);
   
   if (error) {
     console.error('Insert error:', error);
   }
   ```

**Solution:**

1. **Check webhook processor:**
   ```typescript
   // Ensure errors are logged
   async function handleReceiveEvent(event, tenantId) {
     try {
       const { data, error } = await supabase
         .from('z_api_messages')
         .insert([...]);
       
       if (error) {
         console.error('Message storage error:', error);
         throw error;
       }
       
       return data;
     } catch (error) {
       console.error('Failed to process receive event:', error);
       throw error;  // Important: re-throw for monitoring
     }
   }
   ```

2. **Verify database schema:**
   ```sql
   -- Check if table exists
   SELECT * FROM information_schema.tables 
   WHERE table_name = 'z_api_messages';
   
   -- Check columns
   \d z_api_messages
   ```

3. **Check company_id in webhook:**
   ```typescript
   // Webhook processor should determine correct company_id
   // Not hardcode it!
   const tenantId = determineCompanyFromWebhook(event);
   ```

---

## Performance & Timeout Issues

### Problem: "API Response Timeout"

**Symptoms:**
- Requests timeout after 30 seconds
- Client gets 408 or 504 error
- Endpoint becomes unresponsive

**Possible Causes:**
1. Long-running database query
2. External API call timeout
3. Memory leak
4. Infinite loop in processing

**Troubleshooting Steps:**

1. **Add timing logs:**
   ```typescript
   const startTime = Date.now();
   
   const { data } = await supabase
     .from('users')
     .select('*')
     .eq('company_id', companyId);
   
   const duration = Date.now() - startTime;
   console.log(`Query took ${duration}ms`);
   
   if (duration > 5000) {
     console.warn('Slow query detected!');
   }
   ```

2. **Monitor resource usage:**
   ```bash
   # Check CPU/Memory
   top -p $(pgrep -f "node")
   
   # Check Node.js heap
   node --inspect app.js
   ```

3. **Check database query count:**
   ```typescript
   // Use Supabase query logging
   const { data, error, count } = await supabase
     .from('users')
     .select('*', { count: 'exact' });
   
   console.log(`Query returned ${count} rows`);
   ```

**Solution:**

1. **Optimize slow queries:**
   ```typescript
   // Add pagination
   const { data } = await supabase
     .from('z_api_messages')
     .select('*')
     .eq('company_id', companyId)
     .order('created_at', { ascending: false })
     .range(0, 99)  // Only fetch 100 items
   ```

2. **Add query timeout:**
   ```typescript
   const queryPromise = supabase
     .from('users')
     .select('*');
   
   const timeoutPromise = new Promise((_, reject) =>
     setTimeout(() => reject(new Error('Query timeout')), 5000)
   );
   
   const data = await Promise.race([queryPromise, timeoutPromise]);
   ```

3. **Use database indexes:**
   ```sql
   CREATE INDEX idx_z_api_messages_company_created 
   ON z_api_messages(company_id, created_at DESC);
   ```

---

## Security & SSL Issues

### Problem: "SSL Certificate Error"

**Symptoms:**
- HTTPS requests fail
- "Certificate verification failed"
- Browser shows "Not Secure"

**Troubleshooting Steps:**

1. **Check certificate validity:**
   ```bash
   # View certificate details
   openssl x509 -in /path/to/cert.pem -text -noout
   
   # Check expiration
   openssl x509 -in /path/to/cert.pem -noout -dates
   
   # Online tool:
   # https://www.ssllabs.com/ssltest/
   ```

2. **Verify certificate matches domain:**
   ```bash
   openssl x509 -in /path/to/cert.pem -noout -subject
   # Should contain your domain
   ```

**Solution:**

1. **Renew certificate (Let's Encrypt):**
   ```bash
   certbot renew --force-renewal
   
   # Or on Vercel/similar platform:
   # Automatic renewal usually configured
   ```

2. **Update certificate in server:**
   - Copy new certificate to `/etc/ssl/certs/`
   - Restart web server
   - Verify HTTPS works

---

### Problem: "Weak Password Accepted"

**Symptoms:**
- Users can create weak passwords
- Password validation not enforced
- Security policy violated

**Troubleshooting Steps:**

1. **Check password validation schema:**
   ```typescript
   // types/auth.ts
   const registerRequestSchema = z.object({
     password: z
       .string()
       .min(8)  // Minimum 8 chars
       .regex(
         /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/,
         'Password must have uppercase, lowercase, number, special char'
       ),
   });
   ```

2. **Test password validation:**
   ```bash
   curl -X POST http://localhost:3000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{
       "email": "test@example.com",
       "password": "weak",
       "firstName": "Test",
       "lastName": "User",
       "companyName": "Test Co",
       "acceptTerms": true
     }'
   
   # Should return validation error
   ```

**Solution:**
- Update password validation schema
- Enforce in all password endpoints (register, reset)
- Test all edge cases

---

## Z-API Integration Issues

### Problem: "Z-API Token Invalid"

**Symptoms:**
- Z-API API calls return 401
- "Invalid token" or "Unauthorized" error
- Integration stops working

**Troubleshooting Steps:**

1. **Check token in Z-API dashboard:**
   - Log into Z-API
   - Settings > API Keys
   - Verify token is active (not expired/revoked)

2. **Verify token in application:**
   ```bash
   echo $Z_API_TOKEN
   # Should return actual token, not empty
   ```

3. **Test Z-API connectivity:**
   ```bash
   curl -X GET https://api.z-api.io/clients \
     -H "Authorization: Bearer $Z_API_TOKEN"
   
   # Should return 200, not 401
   ```

**Solution:**

1. **Generate new token in Z-API:**
   - Z-API Dashboard > Settings > API Keys
   - Create new key
   - Copy token

2. **Update application:**
   ```bash
   Z_API_TOKEN=new-token-here
   ```

3. **Restart application:**
   ```bash
   npm run dev
   ```

---

## Debugging Tools & Techniques

### Enable Debug Logging

```bash
# Set debug environment variable
export DEBUG=iaezap:*

# Run application
npm run dev
```

### View Application Logs

```bash
# Real-time logs
tail -f logs/app.log

# Search logs
grep "error" logs/app.log | head -50

# Filter by timestamp
grep "2026-08-13" logs/app.log

# Count errors
grep -c "ERROR" logs/app.log
```

### Test Endpoints with cURL

```bash
# GET with auth
curl -X GET http://localhost:3000/api/admin/users \
  -H "Authorization: Bearer $TOKEN" \
  -v

# POST with data
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "pass"}' \
  -v

# Save response to file
curl ... -o response.json

# Pretty print JSON
curl ... | jq .
```

### Check Database Directly

```bash
# Connect to Supabase SQL editor
# Or use psql:
psql postgresql://user:pass@host:5432/dbname

# Common queries:
SELECT COUNT(*) FROM users;
SELECT * FROM users LIMIT 5;
SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 10;
```

### Monitor Real-Time Events

```typescript
// Enable console logging in code
const { data, error } = await supabase
  .from('z_api_messages')
  .on('*', payload => {
    console.log('Change received!', payload);
  })
  .subscribe();
```

---

## Common Error Messages

### "ReferenceError: PUBLIC_KEY is not defined"

**Cause:** JWT public key not loaded in environment
**Solution:** 
```bash
export PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
```

### "TypeError: Cannot read property 'company_id' of undefined"

**Cause:** User not found in database
**Solution:**
```typescript
const user = await getUser(userId);
if (!user) {
  throw new Error('User not found');
}
```

### "SyntaxError: Unexpected token in JSON at position X"

**Cause:** Invalid JSON in request body
**Solution:** Validate JSON format with `jq` or online validator

### "UNIQUE constraint failed: users.email"

**Cause:** Email already exists
**Solution:** Check if user exists before insert or use ON CONFLICT

---

## Emergency Procedures

### System Down - Immediate Response

1. **Check status page:**
   ```bash
   curl https://status.supabase.com
   ```

2. **Check application logs:**
   ```bash
   tail -100 logs/app.log
   ```

3. **Restart application:**
   ```bash
   npm run dev
   # Or
   systemctl restart iaezap
   ```

4. **Check database:**
   ```bash
   curl https://your-project.supabase.co
   ```

### Data Corruption - Immediate Response

1. **STOP ACCEPTING WRITES:**
   - Set application to read-only mode
   - Prevent further data corruption

2. **BACKUP CURRENT DATA:**
   ```bash
   pg_dump postgresql://... > backup-corrupted.sql
   ```

3. **RESTORE FROM BACKUP:**
   ```bash
   # Get latest clean backup
   # Restore from Supabase backups panel
   # Or manually restore:
   psql database < backup-clean.sql
   ```

4. **VERIFY DATA INTEGRITY:**
   ```sql
   -- Check for orphaned records
   SELECT * FROM users WHERE company_id NOT IN (SELECT id FROM companies);
   ```

---

For additional support, contact the development team or check the documentation at INTEGRATION_GUIDE.md and API_REFERENCE.md.
