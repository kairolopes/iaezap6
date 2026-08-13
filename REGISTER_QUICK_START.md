# Register Endpoint - Quick Start

## Endpoint Details

- **URL:** `POST /api/auth/register`
- **File:** `src/app/api/auth/register/route.ts`
- **Authentication:** None required
- **Rate Limit:** None (add with middleware if needed)

## Basic Request/Response

### Request
```json
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@company.com",
  "password": "SecurePass123!",
  "company_cnpj": "12345678901234",
  "company_name": "My Company"
}
```

### Success (201)
```json
{
  "success": true,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@company.com",
    "company_id": "550e8400-e29b-41d4-a716-446655440001",
    "role": "admin",
    "created_at": "2026-08-13T10:00:00Z"
  },
  "token": {
    "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600,
    "tokenType": "Bearer"
  }
}
```

### Error (400)
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "password": ["Password must contain uppercase, lowercase, number, and special character"]
    },
    "timestamp": "2026-08-13T10:00:00Z"
  }
}
```

## JavaScript Example

```typescript
async function registerUser() {
  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include cookies
      body: JSON.stringify({
        email: 'user@example.com',
        password: 'SecurePass123!',
        company_cnpj: '12345678901234',
        company_name: 'My Company',
      }),
    });

    const data = await response.json();

    if (response.status === 201) {
      // Registration successful
      console.log('User registered:', data.user);
      console.log('Access token:', data.token.accessToken);
      
      // Token is also in cookies:
      // - access_token (accessible)
      // - refresh_token (HTTP-only)
      
      // Store token in localStorage if needed
      localStorage.setItem('accessToken', data.token.accessToken);
      
      // Redirect to dashboard
      window.location.href = '/dashboard';
    } else if (response.status === 409) {
      // User already exists
      console.error('User already exists');
    } else if (response.status === 400) {
      // Validation error
      console.error('Validation errors:', data.error.details);
    }
  } catch (error) {
    console.error('Registration failed:', error);
  }
}
```

## React Hook

```typescript
import { useState } from 'react';

export function useRegister() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const register = async (
    email: string,
    password: string,
    companyCNPJ: string,
    companyName: string
  ) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          email,
          password,
          company_cnpj: companyCNPJ,
          company_name: companyName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error?.message || 'Registration failed');
        return null;
      }

      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { register, loading, error };
}

// Usage in component
export function RegisterForm() {
  const { register, loading, error } = useRegister();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    company_cnpj: '',
    company_name: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await register(
      formData.email,
      formData.password,
      formData.company_cnpj,
      formData.company_name
    );
    if (result) {
      window.location.href = '/dashboard';
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        placeholder="Email"
        value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
      />
      <input
        type="password"
        placeholder="Password (Min 8 chars, uppercase, lowercase, number, special)"
        value={formData.password}
        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
      />
      <input
        type="text"
        placeholder="Company CNPJ (14 digits)"
        value={formData.company_cnpj}
        onChange={(e) => setFormData({ ...formData, company_cnpj: e.target.value })}
      />
      <input
        type="text"
        placeholder="Company Name"
        value={formData.company_name}
        onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Registering...' : 'Register'}
      </button>
      {error && <div className="error">{error}</div>}
    </form>
  );
}
```

## Password Requirements

Valid password example: `SecurePass123!`

Must include:
- Minimum 8 characters ✓
- Uppercase letter (A-Z) ✓ S, P
- Lowercase letter (a-z) ✓ e, c, u, r, e, e, a, s, s
- Digit (0-9) ✓ 1, 2, 3
- Special character (@$!%*?&) ✓ !

## CNPJ Format

Brazilian CNPJ: 14 digits without formatting

Example: `12345678901234`

Input as-is (no dashes or dots)

## Status Codes

| Code | Meaning | Details |
|------|---------|---------|
| 201 | Created | Registration successful, user and tokens returned |
| 400 | Bad Request | Validation failed, invalid input |
| 409 | Conflict | User email already exists |
| 500 | Server Error | Database or processing error |

## Common Errors

### Validation Error: Password
```
"Password must contain uppercase, lowercase, number, and special character"
```
Solution: Add missing character type

### Validation Error: CNPJ
```
"CNPJ must be exactly 14 digits"
```
Solution: Ensure CNPJ is 14 numeric characters, no formatting

### Validation Error: Email
```
"Invalid email format"
```
Solution: Use valid email format (user@example.com)

### Conflict: User Exists
```
"An account with this email already exists"
```
Solution: Use different email or login instead

## Database Impact

### Creates:
1. **Company** (if CNPJ doesn't exist)
   - UUID id
   - CNPJ (14 digits)
   - Name
   - Status: active
   - Timestamps

2. **User** (always)
   - UUID id
   - Email
   - Password hash (bcrypt)
   - Company ID reference
   - Role: admin (first user)
   - Status: active
   - Timestamps

## Security Checklist

- [x] Password hashed with bcrypt (10 rounds)
- [x] Input validated with Zod
- [x] Email format checked
- [x] Password complexity enforced
- [x] CNPJ format validated
- [x] Service role key used for admin operations
- [x] JWT tokens generated with RS256
- [x] Refresh token in HTTP-only cookie
- [x] Access token accessible to client
- [x] Error details hidden in production

## Next Steps After Registration

1. **Store Token**
   - Access token in memory or sessionStorage
   - Refresh token automatically in HTTP-only cookie

2. **Set Authorization Header**
   ```typescript
   headers: {
     'Authorization': `Bearer ${accessToken}`
   }
   ```

3. **Use Refresh Token**
   ```
   POST /api/auth/refresh
   ```

4. **Access Protected Routes**
   ```
   GET /api/admin/companies
   GET /api/admin/users
   ```

## Troubleshooting

### Request fails with 500
Check console logs for:
- Missing environment variables (SUPABASE, JWT)
- Database connection issues
- Bcrypt hashing errors

### User created but token generation fails
Ensure JWT keys are properly set in environment

### Password hashing slow
Expected: bcrypt uses computationally expensive algorithm for security

### CNPJ already exists but new company created
Check if CNPJ formatting is inconsistent (with/without formatting)
