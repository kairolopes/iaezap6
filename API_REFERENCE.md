# IAeZap API Reference

Complete documentation for all IAeZap REST API endpoints.

## Table of Contents

1. [Base Configuration](#base-configuration)
2. [Authentication Endpoints](#authentication-endpoints)
3. [Admin Endpoints](#admin-endpoints)
4. [Company Endpoints](#company-endpoints)
5. [User Endpoints](#user-endpoints)
6. [Message Endpoints](#message-endpoints)
7. [Webhook Endpoints](#webhook-endpoints)
8. [Error Codes](#error-codes)
9. [Status Codes](#status-codes)
10. [Rate Limiting](#rate-limiting)
11. [Pagination](#pagination)
12. [Response Formats](#response-formats)

---

## Base Configuration

### API Base URL

```
Development:  http://localhost:3000/api
Production:   https://your-domain.com/api
```

### Required Headers

```
Content-Type: application/json
Authorization: Bearer <access_token>
```

### Authentication

All endpoints except `/auth/login`, `/auth/register`, and `/webhooks/z-api/*` require authentication via JWT Bearer token in the `Authorization` header.

```http
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Authentication Endpoints

### 1. Register User

Create a new user and company.

**Endpoint:**
```
POST /auth/register
```

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "admin@company.com",
  "password": "SecurePass123!@",
  "firstName": "John",
  "lastName": "Doe",
  "companyName": "My Company",
  "cnpj": "12345678901234",
  "acceptTerms": true
}
```

**Validation Rules:**
- `email`: Valid email format, unique globally
- `password`: Minimum 8 characters, 1 uppercase, 1 lowercase, 1 digit, 1 special char
- `firstName`: 2-50 characters
- `lastName`: 2-50 characters
- `companyName`: 3-255 characters
- `cnpj`: Exactly 14 digits (Brazilian CNPJ)
- `acceptTerms`: Must be `true`

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "admin@company.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "admin",
      "company_id": "550e8400-e29b-41d4-a716-446655440001",
      "status": "active",
      "created_at": "2026-08-13T10:30:00.000Z"
    },
    "token": {
      "access_token": "eyJhbGciOiJSUzI1NiIs...",
      "refresh_token": "eyJhbGciOiJSUzI1NiIs...",
      "expiresIn": 900,
      "tokenType": "Bearer",
      "issuedAt": "2026-08-13T10:30:00.000Z"
    },
    "company": {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "cnpj": "12345678901234",
      "name": "My Company",
      "createdAt": "2026-08-13T10:30:00.000Z"
    }
  }
}
```

**Error Response (400 - Validation Error):**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "password": [
        "Password must contain uppercase, lowercase, number, and special character"
      ],
      "cnpj": [
        "CNPJ must be 14 digits"
      ]
    },
    "timestamp": "2026-08-13T10:30:00.000Z"
  }
}
```

**Error Response (409 - User Exists):**
```json
{
  "success": false,
  "error": {
    "code": "USER_ALREADY_EXISTS",
    "message": "User with this email already exists",
    "timestamp": "2026-08-13T10:30:00.000Z"
  }
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@company.com",
    "password": "SecurePass123!@",
    "firstName": "John",
    "lastName": "Doe",
    "companyName": "My Company",
    "cnpj": "12345678901234",
    "acceptTerms": true
  }'
```

---

### 2. Login

Authenticate user and obtain JWT tokens.

**Endpoint:**
```
POST /auth/login
```

**Request Body:**
```json
{
  "email": "admin@company.com",
  "password": "SecurePass123!@",
  "companyId": "550e8400-e29b-41d4-a716-446655440001"
}
```

**Parameters:**
- `email` (required): User email address
- `password` (required): User password
- `companyId` (optional): Company UUID (required if user belongs to multiple companies)

**Success Response (200):**
```json
{
  "success": true,
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "admin@company.com",
    "full_name": "John Doe",
    "role": "admin",
    "company_id": "550e8400-e29b-41d4-a716-446655440001",
    "status": "active"
  },
  "company_id": "550e8400-e29b-41d4-a716-446655440001",
  "expires_in": 900,
  "token_type": "Bearer"
}
```

**Cookies Set:**
- `refresh_token`: HTTP-only cookie with 7-day expiration
- `access_token`: Non-HTTP-only cookie with 15-minute expiration

**Error Response (401 - Invalid Credentials):**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password",
    "timestamp": "2026-08-13T10:30:00.000Z"
  }
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "admin@company.com",
    "password": "SecurePass123!@"
  }'
```

---

### 3. Refresh Token

Obtain a new access token using refresh token.

**Endpoint:**
```
POST /auth/refresh
```

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Success Response (200):**
```json
{
  "success": true,
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 900,
  "tokenType": "Bearer",
  "issuedAt": "2026-08-13T10:35:00.000Z"
}
```

**Error Response (401 - Invalid Token):**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_TOKEN",
    "message": "Refresh token is invalid or expired",
    "timestamp": "2026-08-13T10:30:00.000Z"
  }
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

---

### 4. Logout

Invalidate current session.

**Endpoint:**
```
POST /auth/logout
```

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Successfully logged out"
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

## Admin Endpoints

### 1. List Users in Company

Retrieve all users in the authenticated user's company.

**Endpoint:**
```
GET /admin/users
```

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `role` (optional): Filter by role (admin, supervisor, operador)
- `status` (optional): Filter by status (active, inactive, invited, suspended)
- `search` (optional): Search by email or name
- `limit` (optional): Number of results, default 50, max 100
- `offset` (optional): Pagination offset, default 0

**Permission Required:** `admin`

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "email": "user@company.com",
        "fullName": "Jane Smith",
        "displayName": "jane.smith",
        "role": "supervisor",
        "status": "active",
        "emailVerified": true,
        "lastLoginAt": "2026-08-12T14:30:00.000Z",
        "createdAt": "2026-08-01T09:00:00.000Z",
        "updatedAt": "2026-08-12T14:30:00.000Z"
      }
    ],
    "total": 42,
    "limit": 50,
    "offset": 0
  }
}
```

**cURL Example:**
```bash
curl -X GET "http://localhost:3000/api/admin/users?role=admin&limit=10&offset=0" \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..."
```

---

### 2. Add User to Company

Create a new user in the authenticated user's company.

**Endpoint:**
```
POST /admin/users
```

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "newuser@company.com",
  "fullName": "Jane Smith",
  "role": "supervisor"
}
```

**Parameters:**
- `email` (required): Valid email format, unique within company
- `fullName` (optional): 2-255 characters
- `role` (required): One of `admin`, `supervisor`, `operador`

**Permission Required:** `admin`

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "newuser@company.com",
      "fullName": "Jane Smith",
      "displayName": "jane.smith",
      "role": "supervisor",
      "status": "active",
      "emailVerified": false,
      "createdAt": "2026-08-13T10:30:00.000Z",
      "updatedAt": "2026-08-13T10:30:00.000Z"
    }
  }
}
```

**Error Response (409 - Email Exists):**
```json
{
  "success": false,
  "error": {
    "code": "EMAIL_CONFLICT",
    "message": "Email already exists in company",
    "details": {
      "email": "newuser@company.com"
    },
    "timestamp": "2026-08-13T10:30:00.000Z"
  }
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:3000/api/admin/users \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@company.com",
    "fullName": "Jane Smith",
    "role": "supervisor"
  }'
```

---

### 3. Update User

Update user information.

**Endpoint:**
```
PATCH /admin/users/{userId}
```

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**URL Parameters:**
- `userId` (required): UUID of user to update

**Request Body:**
```json
{
  "fullName": "Jane Smith Updated",
  "status": "inactive",
  "role": "admin"
}
```

**Permission Required:** `admin`

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@company.com",
      "fullName": "Jane Smith Updated",
      "role": "admin",
      "status": "inactive",
      "updatedAt": "2026-08-13T10:30:00.000Z"
    }
  }
}
```

---

### 4. Delete User

Delete a user from company.

**Endpoint:**
```
DELETE /admin/users/{userId}
```

**Headers:**
```
Authorization: Bearer <access_token>
```

**URL Parameters:**
- `userId` (required): UUID of user to delete

**Permission Required:** `admin`

**Success Response (200):**
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

---

### 5. Update User Role

Update a user's role.

**Endpoint:**
```
POST /admin/users/{userId}/role
```

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**URL Parameters:**
- `userId` (required): UUID of user

**Request Body:**
```json
{
  "role": "admin"
}
```

**Permission Required:** `admin`

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@company.com",
      "role": "admin"
    }
  }
}
```

---

## Company Endpoints

### 1. Create Company

Create a new company (admin-only).

**Endpoint:**
```
POST /admin/companies
```

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "New Company",
  "slug": "new-company",
  "cnpj": "12.345.678/0001-90",
  "description": "Company description",
  "plan": "professional"
}
```

**Parameters:**
- `name` (required): 2-255 characters
- `slug` (required): URL-friendly name, lowercase, alphanumeric + hyphens
- `cnpj` (required): Valid Brazilian CNPJ format
- `description` (optional): Up to 1000 characters
- `plan` (optional): `starter`, `professional`, or `enterprise` (default: starter)

**Permission Required:** `admin`

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "company": {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "name": "New Company",
      "slug": "new-company",
      "cnpj": "12.345.678/0001-90",
      "plan": "professional",
      "status": "active",
      "createdAt": "2026-08-13T10:30:00.000Z"
    }
  }
}
```

---

### 2. Get Company Details

Retrieve authenticated company's details.

**Endpoint:**
```
GET /admin/companies/{companyId}
```

**Headers:**
```
Authorization: Bearer <access_token>
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "company": {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "name": "My Company",
      "slug": "my-company",
      "cnpj": "12.345.678/0001-90",
      "plan": "professional",
      "status": "active",
      "usersCount": 5,
      "messagesCount": 1234,
      "createdAt": "2026-08-01T09:00:00.000Z",
      "updatedAt": "2026-08-13T10:30:00.000Z"
    }
  }
}
```

---

### 3. List Users in Company

List all users in a specific company.

**Endpoint:**
```
GET /admin/companies/{companyId}/users
```

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `limit` (optional): Default 50, max 100
- `offset` (optional): Default 0
- `search` (optional): Search by email or name

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "email": "user@company.com",
        "fullName": "John Doe",
        "role": "admin",
        "status": "active"
      }
    ],
    "total": 5,
    "limit": 50,
    "offset": 0
  }
}
```

---

### 4. Add User to Company

Add an existing user or create new user in company.

**Endpoint:**
```
POST /admin/companies/{companyId}/users
```

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "newuser@example.com",
  "fullName": "Jane Smith",
  "role": "supervisor"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "newuser@example.com",
      "fullName": "Jane Smith",
      "role": "supervisor",
      "status": "active"
    }
  }
}
```

---

## Message Endpoints

### 1. Send Message

Send a WhatsApp message via Z-API instance.

**Endpoint:**
```
POST /messages/send
```

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "instanceId": "550e8400-e29b-41d4-a716-446655440000",
  "phone": "5511987654321",
  "message": "Hello, this is a test message!",
  "messageType": "text"
}
```

**Parameters:**
- `instanceId` (required): Z-API instance UUID
- `phone` (required): Recipient phone number (11 digits for Brazil)
- `message` (required): Message content
- `messageType` (optional): `text` (default), `template`, `media`

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "message": {
      "id": "msg_550e8400e29b41d4",
      "instanceId": "550e8400-e29b-41d4-a716-446655440000",
      "phone": "5511987654321",
      "messageType": "text",
      "content": "Hello, this is a test message!",
      "status": "pending",
      "sentAt": "2026-08-13T10:30:00.000Z"
    }
  }
}
```

---

### 2. Get Message History

Retrieve message history for a phone number.

**Endpoint:**
```
GET /messages/history
```

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `phone` (required): Phone number to get history for
- `instanceId` (optional): Filter by Z-API instance
- `limit` (optional): Default 50, max 100
- `offset` (optional): Default 0
- `startDate` (optional): ISO 8601 datetime
- `endDate` (optional): ISO 8601 datetime

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": "msg_550e8400e29b41d4",
        "phone": "5511987654321",
        "content": "Hello!",
        "direction": "inbound",
        "messageType": "text",
        "status": "delivered",
        "createdAt": "2026-08-13T10:30:00.000Z"
      }
    ],
    "total": 234,
    "limit": 50,
    "offset": 0
  }
}
```

---

## Webhook Endpoints

### 1. Z-API Receive Webhook

Receive webhooks from Z-API for incoming messages.

**Endpoint:**
```
POST /webhooks/z-api/receive
```

**Headers:**
```
Content-Type: application/json
```

**No authentication required for webhooks** (secured by Z-API IP whitelist).

**Request Body Example (Incoming Message):**
```json
{
  "type": "receive",
  "timestamp": 1692057600000,
  "phoneNumber": "5511987654321",
  "messageId": "msg_abc123def456",
  "senderPhone": "5521987654321",
  "senderName": "Maria Silva",
  "messageType": "text",
  "text": "Olá, tudo bem?",
  "isGroup": false,
  "phone": "5511987654321"
}
```

**Success Response (200):**
```json
{
  "value": true
}
```

**Response Codes:**
- `200` - Webhook received and queued for processing
- `400` - Invalid webhook format
- `500` - Server error

**Webhook Types:**

**receive** - Incoming message
```json
{
  "type": "receive",
  "messageId": "msg_123",
  "senderPhone": "5511987654321",
  "messageType": "text",
  "text": "Message content",
  "timestamp": 1692057600000
}
```

**delivery** - Message delivered
```json
{
  "type": "delivery",
  "messageId": "msg_123",
  "status": "delivered",
  "recipient": "5511987654321",
  "timestamp": 1692057600000
}
```

**status** - Message status changed
```json
{
  "type": "status",
  "messageId": "msg_123",
  "status": "read",
  "contactPhone": "5511987654321",
  "timestamp": 1692057600000
}
```

**disconnected** - Connection lost
```json
{
  "type": "disconnected",
  "reason": "network_error",
  "message": "Network connectivity lost",
  "timestamp": 1692057600000
}
```

---

### 2. Z-API Instance Token Webhook

Receive token updates from Z-API instances.

**Endpoint:**
```
POST /webhooks/z-api/instances/{instanceId}/token/{token}
```

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "instanceId": "550e8400-e29b-41d4-a716-446655440000",
  "phoneNumber": "5511987654321",
  "token": "new_z_api_token",
  "timestamp": 1692057600000
}
```

**Success Response (200):**
```json
{
  "value": true
}
```

---

## Error Codes

### Authentication Errors

| Code | Status | Description |
|------|--------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid authorization token |
| `INVALID_TOKEN` | 401 | Token is expired or malformed |
| `TOKEN_EXPIRED` | 401 | Token has expired |
| `FORBIDDEN` | 403 | Insufficient permissions for this action |

### Validation Errors

| Code | Status | Description |
|------|--------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `INVALID_REQUEST` | 400 | Malformed request body |
| `INVALID_EMAIL` | 400 | Invalid email format |
| `WEAK_PASSWORD` | 400 | Password does not meet requirements |

### User Errors

| Code | Status | Description |
|------|--------|-------------|
| `USER_NOT_FOUND` | 404 | User does not exist |
| `USER_ALREADY_EXISTS` | 409 | Email already registered |
| `INVALID_CREDENTIALS` | 401 | Email or password incorrect |
| `ACCOUNT_LOCKED` | 429 | Too many login attempts |
| `EMAIL_CONFLICT` | 409 | Email already exists in company |

### Server Errors

| Code | Status | Description |
|------|--------|-------------|
| `INTERNAL_SERVER_ERROR` | 500 | Unexpected server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |

---

## Status Codes

| Code | Name | Meaning |
|------|------|---------|
| 200 | OK | Successful GET/PATCH/DELETE request |
| 201 | Created | Successful POST request creating resource |
| 202 | Accepted | Request accepted for async processing |
| 400 | Bad Request | Invalid request format or validation error |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource does not exist |
| 409 | Conflict | Resource already exists |
| 422 | Unprocessable Entity | Validation failed |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

---

## Rate Limiting

### Rate Limit Headers

Responses include rate limit information:

```
RateLimit-Limit: 1000
RateLimit-Remaining: 999
RateLimit-Reset: 1692144600
```

### Rate Limits by Endpoint

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/auth/login` | 5 requests | 15 minutes |
| `/auth/register` | 3 requests | 1 hour |
| `/admin/*` | 100 requests | 1 minute |
| `/messages/*` | 500 requests | 1 minute |
| `/webhooks/*` | Unlimited | N/A |

### Example Rate Limit Response (429)

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again in 60 seconds.",
    "timestamp": "2026-08-13T10:30:00.000Z"
  }
}
```

---

## Pagination

### Query Parameters

```
?limit=50&offset=0
```

- `limit` (optional): Number of items per page (default: 50, max: 100)
- `offset` (optional): Number of items to skip (default: 0)

### Response Format

```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "total": 1000,
      "limit": 50,
      "offset": 0,
      "totalPages": 20,
      "currentPage": 1
    }
  }
}
```

### Example

```bash
# First page
curl -X GET "http://localhost:3000/api/admin/users?limit=50&offset=0" \
  -H "Authorization: Bearer ..."

# Second page
curl -X GET "http://localhost:3000/api/admin/users?limit=50&offset=50" \
  -H "Authorization: Bearer ..."

# Get all (with pagination)
for page in 0 50 100 150; do
  curl -X GET "http://localhost:3000/api/admin/users?limit=50&offset=$page" \
    -H "Authorization: Bearer ..."
done
```

---

## Response Formats

### Success Response Format

```json
{
  "success": true,
  "data": {
    // Response-specific data structure
  },
  "timestamp": "2026-08-13T10:30:00.000Z"
}
```

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      // Optional: Additional error context
      "field": "error description"
    },
    "timestamp": "2026-08-13T10:30:00.000Z"
  }
}
```

### Paginated Response Format

```json
{
  "success": true,
  "data": {
    "items": [...],
    "total": 1000,
    "limit": 50,
    "offset": 0,
    "totalPages": 20
  },
  "timestamp": "2026-08-13T10:30:00.000Z"
}
```

---

## Common Request Patterns

### Include Authorization Header

```bash
curl -X GET http://localhost:3000/api/admin/users \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..."
```

### Handle Pagination

```javascript
async function getAllUsers(authToken) {
  const allUsers = [];
  let offset = 0;
  const limit = 100;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(
      `http://localhost:3000/api/admin/users?limit=${limit}&offset=${offset}`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      }
    );

    const json = await response.json();
    allUsers.push(...json.data.users);

    hasMore = json.data.total > offset + limit;
    offset += limit;
  }

  return allUsers;
}
```

### Handle Token Refresh

```javascript
async function apiCall(endpoint, options = {}, authToken) {
  let response = await fetch(endpoint, {
    ...options,
    headers: {
      'Authorization': `Bearer ${authToken}`,
      ...options.headers
    }
  });

  if (response.status === 401) {
    // Try to refresh token
    const refreshResponse = await fetch(
      'http://localhost:3000/api/auth/refresh',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: getRefreshToken() })
      }
    );

    if (refreshResponse.ok) {
      const { access_token } = await refreshResponse.json();
      saveAccessToken(access_token);

      // Retry original request
      response = await fetch(endpoint, {
        ...options,
        headers: {
          'Authorization': `Bearer ${access_token}`,
          ...options.headers
        }
      });
    }
  }

  return response;
}
```

---

## API Version

Current API Version: **1.0.0**

All endpoints are stable and production-ready. Breaking changes will follow semantic versioning and be announced with at least 30 days notice.
