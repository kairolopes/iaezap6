# IAeZap Integration Guide

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Multi-Tenant Architecture](#multi-tenant-architecture)
3. [Authentication Flow](#authentication-flow)
4. [Authorization & RBAC](#authorization--rbac)
5. [Database Schema](#database-schema)
6. [Z-API Integration](#z-api-integration)
7. [Webhook Processing](#webhook-processing)
8. [API Request/Response Cycle](#api-requestresponse-cycle)
9. [Security Considerations](#security-considerations)
10. [Development Environment Setup](#development-environment-setup)
11. [Testing Integration](#testing-integration)
12. [Deployment Architecture](#deployment-architecture)

---

## System Architecture

IAeZap is a multi-tenant WhatsApp integration platform built on Next.js 16.3 with Supabase as the backend. The system manages companies, users, authentication, and real-time WhatsApp message webhooks through the Z-API service.

### High-Level Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Applications                      │
│              (Web UI, Mobile, Third-party)                   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────┐
        │      Next.js API Routes (16.3)     │
        │  ├─ /api/auth/*                    │
        │  ├─ /api/admin/*                   │
        │  └─ /api/webhooks/z-api/*          │
        └────────────┬───────────────────────┘
                     │
        ┌────────────┼──────────────────────┐
        │            │                      │
        ▼            ▼                      ▼
    ┌────────┐  ┌──────────┐          ┌──────────┐
    │ Supabase│  │JWT Tokens│         │ Z-API    │
    │ Database│  │(RS256)   │         │ Service  │
    │         │  │          │         │          │
    │ Users   │  │ Access   │         │ Webhooks │
    │Companies│  │ Refresh  │         │ Messages │
    │Messages │  │          │         │          │
    │Logs     │  │          │         │          │
    └────────┘  └──────────┘         └──────────┘
```

---

## Multi-Tenant Architecture

IAeZap uses a **company-based multi-tenant model** where data is isolated at the company level.

### Core Concepts

**Company (Tenant)**
- Represents an organization using IAeZap
- Identified by unique UUID and CNPJ (Brazilian business registration)
- Contains multiple users
- Owns all associated data (messages, webhooks, logs)

```typescript
interface Company {
  id: string;                    // UUID
  cnpj: string;                  // 14 digits
  name: string;
  createdAt: Date;
  updatedAt?: Date;
  isActive?: boolean;
}
```

**User (Tenant Member)**
- Belongs to exactly one company
- Has a role within that company
- Uses email/password authentication
- Receives JWT tokens tied to their company

```typescript
interface User {
  id: string;                    // UUID
  email: string;
  role: 'admin' | 'moderator' | 'user';
  company_id: string;            // Foreign key to Company
  created_at: Date;
  updated_at?: Date;
  firstName?: string;
  lastName?: string;
  isActive?: boolean;
  lastLoginAt?: Date;
}
```

### Data Isolation Strategy

Every query that accesses user-specific data includes a company_id filter:

```typescript
// Example: List users in a company
const { data: users } = await supabase
  .from('users')
  .select('*')
  .eq('company_id', companyId)           // <- Tenant isolation
  .is('deleted_at', null)
  .order('created_at', { ascending: false });
```

**Key Rules:**
1. Every table has a `company_id` column (except Company itself)
2. All queries must include `.eq('company_id', companyId)` filter
3. Users can only access data from their own company
4. Admin endpoints verify the authenticated user's company_id before returning data

---

## Authentication Flow

IAeZap uses **JWT tokens with RS256 cryptographic signing** for stateless authentication.

### Authentication Sequence Diagram

```
Client                          Server                      Database
  │                               │                            │
  ├─ POST /api/auth/login ────────>                            │
  │  (email, password)            │                            │
  │                               ├─ Query user by email ──────>
  │                               <─ User data ────────────────┤
  │                               │                            │
  │                               ├─ Verify password (bcrypt)  │
  │                               │                            │
  │                               ├─ Generate JWT tokens       │
  │                               │  (RS256 with private key)  │
  │                               │                            │
  │  <─ 200 OK + tokens ──────────┤                            │
  │  {access_token, refresh_token}│                            │
  │                               │                            │
  │                               ├─ Set HTTP-only cookies    │
  │                               │  (refresh_token)           │
  │                               │                            │
  ├─ GET /api/admin/users ────────>                            │
  │  Authorization: Bearer <token>│                            │
  │                               ├─ Verify token signature   │
  │                               │  (with public key)         │
  │                               │                            │
  │                               ├─ Extract user info from token
  │                               │                            │
  │                               ├─ Query with company_id ────>
  │                               <─ Users data ──────────────┤
  │                               │                            │
  │  <─ 200 OK + users ───────────┤                            │
  │                               │                            │
```

### Token Structure

**Access Token (JWT - RS256)**
```typescript
{
  "sub": "user-uuid",              // Subject (User ID)
  "email": "user@example.com",
  "roles": ["admin"],              // Can be multiple roles
  "iat": 1692057600,               // Issued At (Unix timestamp)
  "exp": 1692061200,               // Expiration (15 minutes)
  "aud": "auth-api",               // Audience
  "iss": "auth-service",           // Issuer
  "company_id": "company-uuid"     // Tenant identifier
}
```

**Token Expiration Times:**
- Access Token: 15 minutes
- Refresh Token: 7 days
- Password Reset Token: 1 hour

### Login Endpoint Example

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "SecurePass123!",
    "companyId": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

**Success Response (200):**
```json
{
  "success": true,
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "admin@example.com",
    "role": "admin",
    "company_id": "550e8400-e29b-41d4-a716-446655440001",
    "full_name": "John Doe",
    "status": "active"
  },
  "company_id": "550e8400-e29b-41d4-a716-446655440001",
  "expires_in": 900,
  "token_type": "Bearer"
}
```

**Failure Response (401):**
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

### Token Refresh Flow

When access token expires, clients use the refresh token to obtain a new access token:

```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

---

## Authorization & RBAC

IAeZap implements Role-Based Access Control (RBAC) at the company level.

### User Roles

| Role | Permissions | Use Case |
|------|-------------|----------|
| **admin** | Full access to company data, user management, settings | Company owner/manager |
| **moderator** | Can view and manage messages, limited user access | Team lead/supervisor |
| **user** | Can only view assigned data, send messages | Regular operator |

### Role-Based Endpoint Access

```typescript
// Example: Admin-only endpoint
if (currentUserData.role !== 'admin') {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Only admin users can manage users',
      },
    },
    { status: 403 }
  );
}
```

### Permission Matrix

| Action | Admin | Moderator | User |
|--------|-------|-----------|------|
| Create Company | ✓ | ✗ | ✗ |
| Manage Users | ✓ | ✗ | ✗ |
| View Company Users | ✓ | ✓ | ✗ |
| Send Messages | ✓ | ✓ | ✓ |
| View Messages | ✓ | ✓ | ✓ |
| View Audit Logs | ✓ | ✓ | ✗ |

---

## Database Schema

### Core Tables

**companies**
```sql
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj VARCHAR(14) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

**users**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  role VARCHAR(50) NOT NULL DEFAULT 'user',
  status VARCHAR(50) DEFAULT 'active',
  email_verified BOOLEAN DEFAULT false,
  last_login_at TIMESTAMP,
  deleted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(company_id, email)
);

CREATE INDEX idx_users_company_id ON users(company_id);
CREATE INDEX idx_users_email ON users(email);
```

**z_api_instances** (WhatsApp connections)
```sql
CREATE TABLE z_api_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  instance_id VARCHAR(255) UNIQUE NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  is_connected BOOLEAN DEFAULT false,
  last_connection_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_z_api_instances_company_id ON z_api_instances(company_id);
```

**z_api_messages**
```sql
CREATE TABLE z_api_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  instance_id VARCHAR(255) NOT NULL,
  message_id VARCHAR(255) UNIQUE NOT NULL,
  sender_phone VARCHAR(20) NOT NULL,
  recipient_phone VARCHAR(20) NOT NULL,
  message_type VARCHAR(50) NOT NULL,
  content TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_z_api_messages_company_id ON z_api_messages(company_id);
CREATE INDEX idx_z_api_messages_instance_id ON z_api_messages(instance_id);
```

**audit_logs**
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  user_id UUID NOT NULL REFERENCES users(id),
  action VARCHAR(255) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id VARCHAR(255),
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_audit_logs_company_id ON audit_logs(company_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
```

---

## Z-API Integration

Z-API is the external WhatsApp integration service. IAeZap receives webhooks from Z-API for message events.

### Z-API Webhook Event Types

**1. RECEIVED (Incoming Message)**
Triggered when a message arrives via WhatsApp.

```typescript
interface ReceiveEvent {
  type: 'receive';
  messageId: string;
  senderPhone: string;
  senderName?: string;
  messageType: 'text' | 'image' | 'video' | 'document' | 'audio' | 'location';
  text?: string;
  media?: {
    url: string;
    type: string;
    fileName?: string;
  };
  timestamp: number;
  phoneNumber: string;
}
```

**2. DELIVERY (Message Delivered)**
Triggered when a message reaches WhatsApp servers.

```typescript
interface DeliveryEvent {
  type: 'delivery';
  messageId: string;
  status: 'sent' | 'delivered' | 'pending' | 'failed';
  recipient: string;
  timestamp: number;
}
```

**3. STATUS (Message Status Changed)**
Triggered when message is read or replied to.

```typescript
interface StatusEvent {
  type: 'status';
  messageId: string;
  status: 'read' | 'replied' | 'deleted' | 'edited';
  contactPhone: string;
  timestamp: number;
}
```

**4. DISCONNECTED (Connection Lost)**
Triggered when WhatsApp connection is lost.

```typescript
interface DisconnectedEvent {
  type: 'disconnected';
  reason: 'user_logout' | 'network_error' | 'session_expired';
  message?: string;
  timestamp: number;
}
```

### Webhook Endpoint Configuration

**Z-API Webhook URL:**
```
POST https://your-domain.com/api/webhooks/z-api/receive
```

**Required Headers:**
```
Content-Type: application/json
Authorization: Bearer <z-api-token> (if enabled)
```

---

## Webhook Processing

### Webhook Request/Response Flow

```
Z-API Service
      │
      ├─ POST /api/webhooks/z-api/receive
      │  {
      │    "type": "receive",
      │    "messageId": "msg_123456",
      │    "senderPhone": "5511987654321",
      │    "messageType": "text",
      │    "text": "Hello",
      │    "timestamp": 1692057600000
      │  }
      │
      ▼
Next.js API Route
      │
      ├─ 1. Parse JSON body
      │ 2. Validate against schema (Zod)
      │ 3. Extract event data
      │ 4. Map Z-API format to internal schema
      │
      ├─ Return 200 OK { value: true } immediately
      │
      └─ Async: Process webhook
         ├─ Store message in database
         ├─ Trigger business logic
         ├─ Send notifications
         └─ Log audit trail
```

### Webhook Processing Pipeline

```typescript
// File: src/lib/z-api-processor.ts

export async function processZApiWebhook(
  event: WebhookEvent,
  tenantId: string
): Promise<void> {
  switch (event.type) {
    case 'receive':
      await handleReceiveEvent(event, tenantId);
      break;
    case 'delivery':
      await handleDeliveryEvent(event, tenantId);
      break;
    case 'status':
      await handleStatusEvent(event, tenantId);
      break;
    case 'disconnected':
      await handleDisconnectedEvent(event, tenantId);
      break;
  }
}

async function handleReceiveEvent(
  event: ReceiveEvent,
  tenantId: string
): Promise<void> {
  // 1. Extract message content
  const messageContent = getMessageContent(event);

  // 2. Store in database
  const { data: storedMessage, error } = await supabase
    .from('z_api_messages')
    .insert([
      {
        company_id: tenantId,
        instance_id: event.phoneNumber,
        message_id: event.messageId,
        sender_phone: event.senderPhone,
        message_type: event.messageType,
        content: messageContent,
        status: 'received',
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('Error storing message:', error);
    throw error;
  }

  // 3. Apply message rules (if any)
  await applyMessageRules(storedMessage, tenantId);

  // 4. Trigger business logic
  await triggerIntegrations(storedMessage, tenantId);

  // 5. Create audit log
  await createAuditLog({
    company_id: tenantId,
    user_id: null,
    action: 'MESSAGE_RECEIVED',
    entity_type: 'message',
    entity_id: storedMessage.id,
    new_values: storedMessage,
  });
}
```

### Example Webhook Request

```bash
curl -X POST https://your-domain.com/api/webhooks/z-api/receive \
  -H "Content-Type: application/json" \
  -d '{
    "type": "receive",
    "timestamp": 1692057600000,
    "phoneNumber": "5511987654321",
    "messageId": "msg_abc123def456",
    "senderPhone": "5521987654321",
    "senderName": "Maria Silva",
    "messageType": "text",
    "text": "Olá, tudo bem?",
    "isGroup": false
  }'
```

**Expected Response (200):**
```json
{
  "value": true
}
```

---

## API Request/Response Cycle

### Standard Request Structure

```http
POST /api/endpoint
Host: your-domain.com
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...

{
  "field1": "value1",
  "field2": "value2"
}
```

### Standard Response Structure

**Success (200, 201):**
```json
{
  "success": true,
  "data": {
    /* Response data */
  },
  "timestamp": "2026-08-13T10:30:00.000Z"
}
```

**Error (4xx, 5xx):**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      /* Additional error context */
    },
    "timestamp": "2026-08-13T10:30:00.000Z"
  }
}
```

### Authentication Header

All protected endpoints require the `Authorization` header with a Bearer token:

```
Authorization: Bearer <access_token>
```

The token is extracted and verified on every request:

```typescript
const token = extractTokenFromRequest(request);
const payload = verifyAccessToken(token);

if (!payload) {
  return NextResponse.json(
    { success: false, error: { code: 'UNAUTHORIZED' } },
    { status: 401 }
  );
}

const userId = payload.sub;
const companyId = payload.company_id;
```

---

## Security Considerations

### 1. Password Security

- Passwords are hashed using **bcrypt** with cost factor of 10
- Passwords stored as `password_hash` in database
- Never transmitted in responses

```typescript
import bcrypt from 'bcrypt';

// Hashing
const passwordHash = await bcrypt.hash(password, 10);

// Verification
const isValid = await bcrypt.compare(inputPassword, storedHash);
```

### 2. JWT Token Security

- Signed using **RS256** (RSA with SHA-256)
- Private key stored in `PRIVATE_KEY` environment variable
- Public key stored in `PUBLIC_KEY` environment variable
- Tokens should not be stored in localStorage (use httpOnly cookies instead)

```typescript
import jwt from 'jsonwebtoken';

// Signing
const token = jwt.sign(payload, privateKey, {
  algorithm: 'RS256',
  expiresIn: '15m',
});

// Verification
const decoded = jwt.verify(token, publicKey, {
  algorithms: ['RS256'],
});
```

### 3. HTTP-Only Cookies

Refresh tokens are set as HTTP-only cookies to prevent XSS attacks:

```typescript
jsonResponse.cookies.set({
  name: 'refresh_token',
  value: tokenPair.refreshToken,
  httpOnly: true,        // Not accessible from JavaScript
  secure: true,          // Only sent over HTTPS
  sameSite: 'lax',       // CSRF protection
  maxAge: 7 * 24 * 60 * 60, // 7 days
  path: '/',
});
```

### 4. Data Isolation

All queries include company_id filters to ensure multi-tenant isolation:

```typescript
// WRONG - could leak data
const { data } = await supabase
  .from('users')
  .select('*')
  .eq('email', email);

// CORRECT - tenant-isolated
const { data } = await supabase
  .from('users')
  .select('*')
  .eq('company_id', companyId)
  .eq('email', email);
```

### 5. Rate Limiting

Implement rate limiting on authentication endpoints to prevent brute force:

```typescript
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

// Check attempt count before password verification
const attemptKey = `login_attempts:${email}`;
const attempts = await redis.get(attemptKey);
if (attempts >= MAX_LOGIN_ATTEMPTS) {
  return NextResponse.json(
    { success: false, error: { code: 'ACCOUNT_LOCKED' } },
    { status: 429 }
  );
}
```

### 6. Input Validation

All input is validated using Zod schemas before processing:

```typescript
const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const validationResult = loginSchema.safeParse(body);
if (!validationResult.success) {
  return NextResponse.json(
    { success: false, error: { code: 'VALIDATION_ERROR' } },
    { status: 400 }
  );
}
```

### 7. Webhook Signature Verification

Z-API webhooks can include a signature for verification:

```typescript
import crypto from 'crypto';

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hash = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return hash === signature;
}
```

---

## Development Environment Setup

### Prerequisites

- Node.js 18+ or Bun
- npm or yarn
- Git
- Docker (optional, for Supabase local development)

### Environment Variables

Create a `.env.local` file:

```bash
# Database
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# JWT Keys (generate with: npm run generate-jwt-keys)
PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"

# Z-API
Z_API_TOKEN=your-z-api-token
Z_API_BASE_URL=https://api.z-api.io

# Application
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
JWT_ALGORITHM=RS256
JWT_EXPIRATION=900
JWT_REFRESH_EXPIRATION=604800
```

### Installation

```bash
# Clone repository
git clone <repo-url>
cd iaezap6

# Install dependencies
npm install

# Generate JWT keys
npm run generate-jwt-keys

# Start development server
npm run dev
```

Server runs at `http://localhost:3000`

### Database Setup

```bash
# Using Supabase CLI
supabase start

# Run migrations
supabase migration up

# Or use SQL files in supabase/migrations/
```

---

## Testing Integration

### Unit Tests

```bash
npm test
npm run test:watch
npm run test:coverage
```

### Multi-Tenant Tests

```bash
npm run test:multi-tenant
```

Tests verify:
- Data isolation between companies
- User-company relationships
- RBAC enforcement

### End-to-End Tests

```bash
npm run test:e2e
npm run test:e2e:watch
```

Tests cover:
- Complete authentication flow
- Multi-tenant API access
- Webhook processing
- Error scenarios

### Example Test

```typescript
describe('Multi-Tenant Data Isolation', () => {
  it('should not allow access to other company data', async () => {
    const company1User = await createUser(company1.id);
    const company2Data = await createData(company2.id);

    const result = await getDataWithAuth(company1User, company2Data.id);

    expect(result).toEqual({
      success: false,
      error: { code: 'FORBIDDEN' },
    });
  });
});
```

---

## Deployment Architecture

### Production Environment

```
┌─────────────────────────────────────────────────────┐
│              CDN (CloudFlare/Akamai)                │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────────┐
        │   Load Balancer (SSL)      │
        │   - HTTPS Only             │
        │   - Rate Limiting          │
        └────────────┬───────────────┘
                     │
        ┌────────────┴─────────────┐
        │                          │
        ▼                          ▼
    ┌────────────┐           ┌────────────┐
    │  Next.js   │           │  Next.js   │
    │  Server 1  │           │  Server 2  │
    │ (instance) │           │ (instance) │
    └────┬───────┘           └───┬────────┘
         │                       │
         └───────────┬───────────┘
                     │
                ┌────┴──────┐
                │            │
                ▼            ▼
           ┌─────────┐  ┌──────────┐
           │ Supabase│  │ Redis    │
           │ (DB)    │  │ (Cache)  │
           └─────────┘  └──────────┘
```

### Deployment Steps

1. **Build Next.js application:**
   ```bash
   npm run build
   ```

2. **Run production server:**
   ```bash
   npm run start
   ```

3. **Environment configuration:**
   - Set all environment variables
   - Enable HTTPS
   - Configure CORS
   - Set up logging

4. **Database**:
   - Run migrations on Supabase
   - Verify indexes for performance
   - Set up backup strategy

5. **Monitoring**:
   - Set up error tracking (Sentry)
   - Monitor API performance
   - Track webhook delivery
   - Monitor resource usage

---

## Common Integration Patterns

### Pattern 1: Receiving and Processing Messages

```typescript
// In webhook handler
const receiveEvent = event as ReceiveEvent;

// Extract message
const message = {
  senderId: receiveEvent.senderPhone,
  content: receiveEvent.text,
  receivedAt: new Date(),
};

// Store in DB
await supabase
  .from('z_api_messages')
  .insert({ company_id: tenantId, ...message });

// Trigger business logic
await handleIncomingMessage(message, tenantId);
```

### Pattern 2: Sending Messages via Z-API

```typescript
import axios from 'axios';

export async function sendWhatsAppMessage(
  companyId: string,
  instanceId: string,
  phone: string,
  message: string
): Promise<void> {
  const response = await axios.post(
    `${process.env.Z_API_BASE_URL}/instances/${instanceId}/send-message`,
    {
      phone: phone.replace(/\D/g, ''),
      message,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.Z_API_TOKEN}`,
      },
    }
  );

  return response.data;
}
```

### Pattern 3: Role-Based Data Access

```typescript
// Fetch data based on user role
const query = supabase
  .from('z_api_messages')
  .select('*')
  .eq('company_id', companyId);

if (userRole === 'user') {
  // Users can only see their own messages
  query = query.eq('assigned_to', userId);
}

const { data } = await query;
```

---

## Next Steps

1. Review API_REFERENCE.md for endpoint documentation
2. Check DEPLOYMENT_CHECKLIST.md before going live
3. Refer to TROUBLESHOOTING_INTEGRATION.md for common issues
4. Set up monitoring and logging for production
5. Implement custom message rules for your use case
