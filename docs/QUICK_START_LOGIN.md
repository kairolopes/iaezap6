# Login Endpoint - Quick Start Guide

## 5-Minute Setup

### Step 1: Generate JWT Keys

```bash
npm run generate-jwt-keys
```

This will output your RSA key pair. Copy the output and paste into `.env.local`:

```bash
JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
```

### Step 2: Verify Database Schema

Ensure your `users` table has these columns:

```sql
id UUID PRIMARY KEY
company_id UUID NOT NULL
email VARCHAR(255) NOT NULL
password_hash VARCHAR(255) NOT NULL
full_name VARCHAR(255)
role VARCHAR(50) DEFAULT 'user'
status VARCHAR(50) DEFAULT 'active'
deleted_at TIMESTAMP (for soft deletes)
```

### Step 3: Create a Test User

```sql
INSERT INTO users (company_id, email, password_hash, full_name, role, status)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000',  -- company_id
  'test@example.com',
  '$2b$12$...',  -- bcrypt hash (see Step 4)
  'Test User',
  'user',
  'active'
);
```

### Step 4: Hash a Test Password

Use bcrypt to hash a password:

```bash
# Node.js
node -e "require('bcrypt').hash('password123', 12).then(h => console.log(h))"

# Or use an online tool like: https://bcrypt-generator.com/
```

### Step 5: Test the Login Endpoint

#### Using cURL

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "companyId": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

#### Using JavaScript

```javascript
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'test@example.com',
    password: 'password123',
    companyId: '550e8400-e29b-41d4-a716-446655440000',
  }),
});

const data = await response.json();
console.log(data);
```

### Expected Success Response

```json
{
  "success": true,
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "test@example.com",
    "full_name": "Test User",
    "role": "user",
    "company_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "active"
  },
  "company_id": "550e8400-e29b-41d4-a716-446655440000",
  "expires_in": 3600,
  "token_type": "Bearer"
}
```

## Common Error Messages

### 400 Bad Request - Missing email

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "email": ["Required"]
    }
  }
}
```

**Fix:** Include `email` field in request body

### 401 Unauthorized - Invalid credentials

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password"
  }
}
```

**Fix:** Check email exists and password hash is correct

### 500 Internal Server Error - JWT keys missing

```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An error occurred during login",
    "details": {
      "errorMessage": "JWT_PRIVATE_KEY and JWT_PUBLIC_KEY environment variables are required"
    }
  }
}
```

**Fix:** Run `npm run generate-jwt-keys` and add keys to `.env.local`

## Using the Access Token

The `access_token` is a JWT signed with RS256. Use it in subsequent requests:

```javascript
const token = data.access_token;

const apiResponse = await fetch('/api/protected-route', {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});
```

## Token Expiration

The access token expires in 1 hour (3600 seconds). To get a new token:

1. **Option A:** Save the refresh token and use it to get a new access token
2. **Option B:** Make another login request with credentials

See [Token Refresh Guide](./TOKEN_REFRESH.md) for details.

## Testing with Postman

1. **Create a new POST request**
   - URL: `http://localhost:3000/api/auth/login`
   - Method: `POST`

2. **Set Headers**
   - Key: `Content-Type`
   - Value: `application/json`

3. **Set Body (raw JSON)**
   ```json
   {
     "email": "test@example.com",
     "password": "password123",
     "companyId": "550e8400-e29b-41d4-a716-446655440000"
   }
   ```

4. **Click Send**

5. **Extract access_token from response**
   - In Postman, use `{{response_body.access_token}}` in future requests

## Environment Checklist

- [ ] Node.js 18+ installed
- [ ] `npm install` completed
- [ ] Supabase project created
- [ ] `.env.local` configured with Supabase keys
- [ ] JWT keys generated and added to `.env.local`
- [ ] `users` table created with proper schema
- [ ] Test user created in database
- [ ] `npm run dev` started

## Next Steps

- Read [Login Setup Guide](./LOGIN_SETUP.md) for detailed documentation
- Set up [Token Refresh Endpoint](./TOKEN_REFRESH.md)
- Configure [Protected Routes](./PROTECTED_ROUTES.md)
- Review [Security Best Practices](./SECURITY.md)

## Troubleshooting

### "Cannot find module 'bcrypt'"
```bash
npm install bcrypt
npm install -D @types/bcrypt
```

### "JWT_PRIVATE_KEY is not configured"
```bash
npm run generate-jwt-keys
# Copy output to .env.local
```

### "User not found" error

Check if user exists:
```sql
SELECT * FROM users WHERE email = 'test@example.com';
```

If not found, insert a test user with proper password hash.

### "Password verification failed"

Ensure the stored `password_hash` matches the bcrypt hash of the password you're testing with:

```bash
# Generate hash for testing
node -e "require('bcrypt').hash('password123', 12).then(h => console.log(h))"

# Use this hash when inserting test user
```

## Support

For detailed troubleshooting, see [Troubleshooting Guide](./LOGIN_SETUP.md#troubleshooting)
