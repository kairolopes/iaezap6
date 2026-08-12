# Register Endpoint Documentation

## Overview

The `/api/auth/register` endpoint creates a new user account with email and password authentication. It includes comprehensive validation, password complexity checking, and duplicate email handling.

## Endpoint Details

- **Route**: `POST /api/auth/register`
- **Base URL**: `http://localhost:3000` (development)
- **Content-Type**: `application/json`

## Request Format

### Headers

```
POST /api/auth/register HTTP/1.1
Host: localhost:3000
Content-Type: application/json
```

### Request Body

```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "acceptTerms": true
}
```

### Request Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | User's email address. Must be a valid email format and will be converted to lowercase. |
| `password` | string | Yes | User's password. Must be at least 8 characters and meet complexity requirements. |
| `firstName` | string | Yes | User's first name. Must be 2-50 characters. |
| `lastName` | string | Yes | User's last name. Must be 2-50 characters. |
| `acceptTerms` | boolean | Yes | Must be `true` to accept terms and conditions. |

## Password Requirements

The password must meet ALL of the following requirements:

1. **Minimum Length**: 8 characters
2. **Maximum Length**: 128 characters
3. **Uppercase**: At least one uppercase letter (A-Z)
4. **Lowercase**: At least one lowercase letter (a-z)
5. **Digit**: At least one number (0-9)
6. **Special Character**: At least one special character from: `@$!%*?&`

### Valid Password Examples

- `SecurePass123!`
- `MyPassword@2024`
- `Str0ng#Pass`
- `Complex$Password123`

### Invalid Password Examples

- `weak` - Too short, no uppercase, no digit, no special char
- `password123` - No uppercase, no special char
- `PASSWORD123` - No lowercase, no special char
- `Pass123` - No special char
- `Pass@word` - No digit

## Response Format

### Success Response (201 Created)

```json
{
  "success": true,
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "roles": ["user"],
    "createdAt": "2026-08-12T10:30:00Z",
    "updatedAt": "2026-08-12T10:30:00Z"
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 900,
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
    "code": "INVALID_CREDENTIALS",
    "message": "Validation failed",
    "details": {
      "password": [
        "Password must contain uppercase, lowercase, number, and special character"
      ]
    },
    "timestamp": "2026-08-12T10:30:00Z"
  }
}
```

#### 409 Conflict - Duplicate Email

```json
{
  "success": false,
  "error": {
    "code": "USER_ALREADY_EXISTS",
    "message": "An account with this email already exists. Please try logging in or use a different email.",
    "timestamp": "2026-08-12T10:30:00Z"
  }
}
```

#### 422 Unprocessable Entity - Weak Password

```json
{
  "success": false,
  "error": {
    "code": "WEAK_PASSWORD",
    "message": "Password does not meet security requirements",
    "timestamp": "2026-08-12T10:30:00Z"
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
    "timestamp": "2026-08-12T10:30:00Z"
  }
}
```

## Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 201 | Created | User successfully registered |
| 400 | Bad Request | Invalid request format or validation failed |
| 409 | Conflict | Email already exists (duplicate account) |
| 422 | Unprocessable Entity | Password does not meet requirements |
| 500 | Internal Server Error | Server error during registration |

## Cookies

The response sets the following HTTP cookies:

### `access_token`

- **HttpOnly**: No (accessible from JavaScript)
- **Secure**: Yes (in production, no in development)
- **SameSite**: Lax
- **MaxAge**: 15 minutes (900 seconds)
- **Path**: `/`

### `refresh_token`

- **HttpOnly**: Yes (not accessible from JavaScript)
- **Secure**: Yes (in production, no in development)
- **SameSite**: Lax
- **MaxAge**: 7 days
- **Path**: `/`

## cURL Examples

### Basic Registration

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!",
    "firstName": "John",
    "lastName": "Doe",
    "acceptTerms": true
  }'
```

### With Response Headers

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -i \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!",
    "firstName": "John",
    "lastName": "Doe",
    "acceptTerms": true
  }'
```

## JavaScript/TypeScript Examples

### Using Fetch API

```javascript
async function registerUser(email, password, firstName, lastName) {
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      firstName,
      lastName,
      acceptTerms: true,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error.message);
  }

  return data;
}

// Usage
try {
  const result = await registerUser(
    'user@example.com',
    'SecurePass123!',
    'John',
    'Doe'
  );
  console.log('Registration successful:', result.user);
} catch (error) {
  console.error('Registration failed:', error.message);
}
```

### Using Axios

```typescript
import axios from 'axios';

interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  acceptTerms: boolean;
}

interface RegisterResponse {
  success: true;
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    roles: string[];
    createdAt: string;
    updatedAt: string;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    tokenType: 'Bearer';
  };
}

async function registerUser(request: RegisterRequest): Promise<RegisterResponse> {
  const response = await axios.post('/api/auth/register', request);
  return response.data;
}

// Usage
try {
  const response = await registerUser({
    email: 'user@example.com',
    password: 'SecurePass123!',
    firstName: 'John',
    lastName: 'Doe',
    acceptTerms: true,
  });
  
  console.log('User ID:', response.user.id);
  console.log('Access Token:', response.tokens.accessToken);
} catch (error) {
  if (axios.isAxiosError(error)) {
    console.error('Error:', error.response?.data.error.message);
  }
}
```

## Implementation Details

### Password Validation

1. **Zod Schema Validation**: The `registerRequestSchema` validates all input fields using Zod
2. **Password Regex**: `/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/`
   - Uses lookahead assertions to ensure all character types are present
   - Validates the final pattern matches the allowed characters

### Duplicate Email Handling

The endpoint detects duplicate emails in two ways:

1. **Supabase Error Detection**: When Supabase returns a 422 status with "user already exists" message
2. **Error Code Matching**: Checks for `user_already_exists` error code from Supabase

### Email Processing

- Email is automatically converted to lowercase by the Zod schema
- Email is trimmed of whitespace
- Email is validated as a valid email format

### Token Management

1. **Access Token**: 15-minute expiration
2. **Refresh Token**: 7-day expiration
3. **Token Type**: Bearer tokens (standard JWT format)
4. **Supabase Tokens**: Uses tokens from Supabase Auth session

### User Metadata

User metadata is stored with the Supabase user account:
- `first_name`: User's first name
- `last_name`: User's last name

This metadata is included in the user object returned by the endpoint.

## Error Handling

The endpoint handles multiple error scenarios:

1. **JSON Parse Error**: Returns 400 if request body is not valid JSON
2. **Validation Error**: Returns 400 if any field fails validation
3. **Duplicate Email**: Returns 409 with conflict error
4. **Weak Password**: Returns 422 with password error (redundant but handled)
5. **Supabase Error**: Returns 500 with internal error message
6. **Missing Response Data**: Returns 500 if Supabase response is incomplete

### Development vs. Production

In development mode, error responses include detailed error information:

```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An error occurred during registration",
    "details": {
      "errorType": "TypeError",
      "errorMessage": "Cannot read property 'id' of null"
    },
    "timestamp": "2026-08-12T10:30:00Z"
  }
}
```

In production, the `details` field is omitted for security.

## Security Considerations

1. **Password Hashing**: Supabase handles password hashing securely
2. **HTTPS**: Should always use HTTPS in production
3. **CORS**: CORS headers are set correctly for OPTIONS requests
4. **HTTP-Only Cookies**: Refresh tokens use HTTP-only flag
5. **Secure Cookies**: Cookies use Secure flag in production
6. **SameSite Protection**: Cookies use SameSite=Lax for CSRF protection

## Rate Limiting

Consider implementing rate limiting on this endpoint to prevent brute-force attacks. Current implementation does not include built-in rate limiting.

## Next Steps After Registration

After successful registration, clients should:

1. Store the `accessToken` for API requests
2. Store the `refreshToken` securely (HTTP-only cookie is set automatically)
3. Use the `expiresIn` value to know when to refresh the token
4. Redirect user to login page or authenticated area

## Testing

### Using Postman

1. Create a new POST request to `http://localhost:3000/api/auth/register`
2. Set header: `Content-Type: application/json`
3. Set request body with valid registration data
4. Send and check response

### Using Jest/Vitest

```typescript
describe('POST /api/auth/register', () => {
  it('should successfully register a new user', async () => {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User',
        acceptTerms: true,
      }),
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.user.email).toBe('test@example.com');
    expect(data.tokens.accessToken).toBeDefined();
  });

  it('should reject duplicate email', async () => {
    // Register first user
    await fetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User',
        acceptTerms: true,
      }),
    });

    // Try to register with same email
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'SecurePass123!',
        firstName: 'Test2',
        lastName: 'User2',
        acceptTerms: true,
      }),
    });

    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.error.code).toBe('USER_ALREADY_EXISTS');
  });
});
```

## Troubleshooting

### "User already exists" but I haven't registered before

Check if:
1. You registered with this email previously
2. There's a test/demo account with this email in your database
3. Try with a different email address

### "Password does not meet requirements"

Ensure password has:
- At least 8 characters
- Uppercase letter (A-Z)
- Lowercase letter (a-z)
- Number (0-9)
- Special character (@$!%*?&)

### No cookies being set

Check:
1. Response status is 201 (Created)
2. Cookies are enabled in browser
3. HTTPS is used in production
4. Domain and SameSite settings are correct

### Token expired immediately after registration

This is normal - tokens have 15-minute expiration. Use the refresh token endpoint to get a new access token before it expires.

## Future Enhancements

Potential improvements to the registration endpoint:

1. Email verification: Send confirmation email before account activation
2. Password strength meter: Return detailed password strength feedback
3. Rate limiting: Prevent registration spam
4. CAPTCHA: Add bot protection
5. Two-factor authentication: Optional 2FA setup during registration
6. Username: Add optional username field
7. Phone verification: Optional phone number with SMS verification
8. Social signup: OAuth/social login integration
