# Registration Endpoint Implementation Guide

## Overview

The `/api/auth/register` endpoint implements a comprehensive registration flow for IAeZap that creates companies and registers users with bcrypt password hashing and JWT token generation.

## File Location

`src/app/api/auth/register/route.ts`

## Features

### 1. Input Validation
- Email format validation
- Password complexity requirements:
  - Minimum 8 characters
  - At least one uppercase letter (A-Z)
  - At least one lowercase letter (a-z)
  - At least one digit (0-9)
  - At least one special character (@$!%*?&)
- CNPJ format validation (exactly 14 digits)
- Company name validation (3-255 characters)

### 2. Company Management
- **Check if company exists** by CNPJ
- **Auto-create company** if it doesn't exist
- Link user to company with `company_id`

### 3. Password Security
- Hash passwords with bcrypt (10 salt rounds)
- Never store plain text passwords
- Passwords are hashed before database insertion

### 4. User Creation
- Create user record in `users` table
- First user is automatically assigned as `admin` role
- User status set to `active`
- Company association established via `company_id`

### 5. JWT Token Generation
- Generate access token (default: 1 hour expiration)
- Generate refresh token (default: 7 days expiration)
- Use RS256 algorithm with environment-based keys
- Include user_id, company_id, email, and role in claims

### 6. HTTP-Only Cookies
- Set refresh token in HTTP-only, secure cookie
- Set access token in accessible cookie for client
- Properly configured for production/development

## API Specification

### Request

**Method:** `POST`
**Endpoint:** `/api/auth/register`
**Content-Type:** `application/json`

### Request Body

```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "company_cnpj": "12345678901234",
  "company_name": "My Company"
}
```

### Success Response (201 Created)

```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "company_id": "uuid",
    "role": "admin",
    "created_at": "2026-08-13T10:00:00Z"
  },
  "token": {
    "accessToken": "eyJhbGciOiJSUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJSUzI1NiIs...",
    "expiresIn": 3600,
    "tokenType": "Bearer"
  }
}
```

### Error Responses

#### 400 Bad Request - Validation Error
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "email": ["Invalid email format"],
      "password": ["Password must contain uppercase, lowercase, number, and special character"]
    },
    "timestamp": "2026-08-13T10:00:00Z"
  }
}
```

#### 409 Conflict - User Already Exists
```json
{
  "success": false,
  "error": {
    "code": "USER_ALREADY_EXISTS",
    "message": "An account with this email already exists",
    "timestamp": "2026-08-13T10:00:00Z"
  }
}
```

#### 500 Internal Server Error
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An error occurred during registration",
    "timestamp": "2026-08-13T10:00:00Z"
  }
}
```

## Implementation Steps

The endpoint follows these steps:

1. **Parse & Validate Input**
   - Parse JSON request body
   - Validate using Zod schema
   - Return 400 if validation fails

2. **Initialize Supabase Client**
   - Create client with service role key
   - Enables admin operations (company/user creation)

3. **Check Existing User**
   - Query users table for email
   - Return 409 if user exists

4. **Check/Create Company**
   - Query companies table by CNPJ
   - Auto-create company if not found
   - Return 500 if creation fails

5. **Hash Password**
   - Use bcrypt with 10 salt rounds
   - Return 500 if hashing fails

6. **Create User Record**
   - Insert into users table
   - Set role as 'admin' (first user)
   - Link to company via company_id
   - Return 500 if creation fails

7. **Generate JWT Tokens**
   - Create access token (1 hour)
   - Create refresh token (7 days)
   - Include claims: user_id, company_id, email, role

8. **Set Cookies & Respond**
   - Set HTTP-only refresh token cookie
   - Set accessible access token cookie
   - Return 201 with user and token data

## Database Schema Requirements

### companies table
```sql
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj VARCHAR(14) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  deleted_at TIMESTAMP DEFAULT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_companies_cnpj ON companies(cnpj);
```

### users table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  company_id UUID NOT NULL REFERENCES companies(id),
  role VARCHAR(50) DEFAULT 'user',
  status VARCHAR(50) DEFAULT 'active',
  deleted_at TIMESTAMP DEFAULT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_company_id ON users(company_id);
```

## Environment Variables Required

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# JWT
JWT_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...
JWT_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----\n...
JWT_ISSUER=iaezap
JWT_AUDIENCE=iaezap-api
JWT_ACCESS_TOKEN_EXPIRY=3600
JWT_REFRESH_TOKEN_EXPIRY=604800
```

## Example Usage

### cURL
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123!",
    "company_cnpj": "12345678901234",
    "company_name": "Acme Corporation"
  }'
```

### JavaScript/TypeScript
```typescript
const response = await fetch('/api/auth/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'john@example.com',
    password: 'SecurePass123!',
    company_cnpj: '12345678901234',
    company_name: 'Acme Corporation',
  }),
});

const data = await response.json();

if (data.success) {
  console.log('Registration successful!');
  console.log('User ID:', data.user.id);
  console.log('Access Token:', data.token.accessToken);
  // Token is also available in cookies
} else {
  console.error('Registration failed:', data.error.message);
}
```

### Python
```python
import requests
import json

url = "http://localhost:3000/api/auth/register"
payload = {
    "email": "john@example.com",
    "password": "SecurePass123!",
    "company_cnpj": "12345678901234",
    "company_name": "Acme Corporation"
}

response = requests.post(url, json=payload)
data = response.json()

if data['success']:
    print(f"Registration successful!")
    print(f"User ID: {data['user']['id']}")
    print(f"Access Token: {data['token']['accessToken']}")
else:
    print(f"Registration failed: {data['error']['message']}")
```

## Security Features

### Password Hashing
- Bcrypt with 10 salt rounds
- Resistant to rainbow table attacks
- Computation time increases with salt rounds

### Token Security
- RS256 signed tokens (asymmetric)
- Tokens include expiration claims
- Refresh tokens stored in HTTP-only cookies
- Access tokens accessible to client for API calls

### Input Validation
- Zod schema validation
- Email format checking
- Password complexity requirements
- CNPJ format validation

### Error Handling
- Detailed validation errors in development
- Minimal error details in production
- Consistent error response format
- Proper HTTP status codes

## Future Enhancements

1. **Email Verification**
   - Send verification email before activation
   - Require email confirmation

2. **Two-Factor Authentication**
   - SMS/Email OTP support
   - TOTP authentication

3. **Rate Limiting**
   - Prevent brute force registration
   - IP-based rate limits

4. **CAPTCHA Integration**
   - Bot prevention
   - Human verification

5. **Social Authentication**
   - Google/GitHub sign-up
   - OAuth integration

6. **Audit Logging**
   - Log all registration events
   - Track company creation events

## Troubleshooting

### "Missing Supabase environment variables"
- Ensure `NEXT_PUBLIC_SUPABASE_URL` is set
- Ensure `SUPABASE_SERVICE_ROLE_KEY` is set
- Check `.env.local` file

### "JWT_PRIVATE_KEY and JWT_PUBLIC_KEY environment variables are required"
- Generate RSA keys (see JWT setup)
- Add to `.env.local`

### "CNPJ must be exactly 14 digits"
- CNPJ format: 14 numeric characters
- Remove formatting (dashes, dots)

### "Password must contain uppercase, lowercase, number, and special character"
- Add uppercase letter (A-Z)
- Add lowercase letter (a-z)
- Add digit (0-9)
- Add special character (@$!%*?&)

## Testing

### Unit Tests
```typescript
describe('POST /api/auth/register', () => {
  it('should register a new user with company', async () => {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'TestPass123!',
        company_cnpj: '12345678901234',
        company_name: 'Test Company',
      }),
    });
    
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.user.email).toBe('test@example.com');
  });
});
```

## Performance Considerations

- Bcrypt hashing: ~100-200ms (intentional delay for security)
- Database operations: Network dependent
- Token generation: ~10ms
- Total endpoint time: ~200-400ms typical

## Related Endpoints

- `POST /api/auth/login` - Authenticate existing user
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Revoke refresh token
- `GET /api/admin/companies` - List companies (admin only)
- `GET /api/admin/users` - List users (admin only)
