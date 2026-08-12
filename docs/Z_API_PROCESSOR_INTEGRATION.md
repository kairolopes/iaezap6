# Z-API Processor Integration Guide

## Overview

The `z-api-processor.ts` module provides a complete webhook event processing service for handling Z-API messages, delivery confirmations, and status updates.

**Location:** `src/lib/z-api-processor.ts`

## Main Export

```typescript
processZApiWebhook(event: WebhookEvent, tenantId: string): Promise<ProcessZApiWebhookResult>
```

### Function Signature

- **event**: A validated Z-API webhook event (from `validateWebhookEvent`)
- **tenantId**: UUID of the tenant for RLS isolation
- **Returns**: `ProcessZApiWebhookResult` with success status and relevant data

## Supported Event Types

### 1. Receive Events (Incoming Messages)

**Triggered when:** A contact sends a message to your WhatsApp number

**Processing:**
1. Extract phone number and message content from the event
2. Query for existing conversation by `(tenant_id, phone_number)` unique constraint
3. If conversation doesn't exist, create it with status='active'
4. Insert the message with:
   - `direction='inbound'`
   - `content`: extracted message text/caption/description
   - `provider_id`: Z-API message ID for idempotency
   - `timestamp`: message creation time from event
5. Trigger message rules automation via `triggerMessageRules()`

**Database Operations:**
- SELECT conversations WHERE tenant_id = ? AND phone_number = ?
- INSERT INTO conversations (if new)
- INSERT INTO messages
- Message rules evaluation (async, non-blocking)

### 2. Status Events (Message Status Changes)

**Triggered when:** A message status changes (read, replied, deleted, edited)

**Processing:**
1. Find the message by `provider_id` (Z-API message ID)
2. Verify it belongs to the correct tenant via conversation join
3. Update the message's `updated_at` timestamp
4. Silent success if message not found (idempotent)

**Database Operations:**
- SELECT messages WHERE provider_id = ?
- SELECT conversations to verify tenant ownership
- UPDATE messages SET updated_at = NOW()

### 3. Delivery Events (Delivery Confirmation)

**Triggered when:** Message successfully reaches WhatsApp servers

**Processing:**
1. Find the message by `provider_id`
2. Verify it belongs to the correct tenant via conversation join
3. Update the message's `updated_at` timestamp
4. Silent success if message not found (idempotent)

**Database Operations:**
- SELECT messages WHERE provider_id = ?
- SELECT conversations to verify tenant ownership
- UPDATE messages SET updated_at = NOW()

## Integration with Webhook Route

### Step 1: Import in webhook route

```typescript
// src/app/api/webhooks/z-api/route.ts
import { processZApiWebhook } from '@/lib/z-api-processor';
```

### Step 2: Queue event processing asynchronously

```typescript
export async function POST(request: NextRequest): Promise<NextResponse<WebhookResponse | WebhookError>> {
  // ... existing validation code ...

  const validatedEvent: WebhookEvent = eventValidation.data;

  // Return 200 immediately to prevent Z-API timeout
  // The event will be processed asynchronously
  
  // Option A: Use a job queue (Inngest, Bull, etc.)
  // await queue.enqueue('process-z-api-event', { event: validatedEvent, tenantId: identifiers.tenantId });

  // Option B: Use Next.js background task (experimental)
  // sendEvent({ event: validatedEvent, tenantId: identifiers.tenantId });

  // Option C: Fire and forget (simple but risky)
  // processZApiWebhook(validatedEvent, identifiers.tenantId!).catch(err => {
  //   console.error('[Webhook Processing Error]', err);
  // });

  return NextResponse.json(
    {
      success: true,
      message: 'Webhook received and validated',
      timestamp,
      eventId: validatedEvent.id,
    },
    { status: 200 }
  );
}
```

**Important:** Always return 200 immediately. Use a job queue or background task to process events asynchronously to prevent Z-API timeout.

## RLS Security

The processor maintains proper RLS isolation:

1. **All operations scoped by tenant_id**: Conversations are created with tenant_id, messages are accessed through conversations
2. **Service role usage**: Uses `createSupabaseServerClient()` with service role key to bypass RLS for webhook processing
3. **Tenant validation**: Status and delivery events verify conversation belongs to target tenant before updating
4. **Idempotent**: Safe to replay events - duplicate messages are prevented by `(tenant_id, phone_number)` constraint and `provider_id` uniqueness

## Error Handling

### Graceful Degradation

- **Message not found in status/delivery events**: Returns success (idempotent, safe)
- **Conversation not in tenant**: Returns success (prevents cross-tenant data leak)
- **Rule processing errors**: Logged but don't block message insertion (non-critical)

### Exceptions

Throws errors for:
- Database connection failures
- Invalid phone number format
- Missing required event fields
- Database integrity violations

## Message Rules Automation

The `triggerMessageRules()` function:

1. Fetches all active message rules for the tenant
2. Evaluates rule conditions against message content
3. Executes matching rule actions (placeholder for expansion)

**Current implementation:** Logs rule check, placeholder for condition evaluation

**Future enhancements needed:**
- Keyword matching logic
- Regex pattern matching
- Context-based conditions (sender, conversation history, etc.)
- Action execution (send template response, create task, etc.)
- Rate limiting to prevent spam

### Example Rule Expansion

```typescript
async function evaluateRule(
  rule: MessageRule,
  conversation: Conversation,
  message: Message,
  tenantId: string
): Promise<boolean> {
  const conditions = rule.conditions as {
    keywords?: string[];
    pattern?: string;
    minLength?: number;
  };

  // Keyword matching
  if (conditions.keywords) {
    const hasKeyword = conditions.keywords.some(kw => 
      message.content.toLowerCase().includes(kw.toLowerCase())
    );
    if (!hasKeyword) return false;
  }

  // Regex pattern matching
  if (conditions.pattern) {
    const regex = new RegExp(conditions.pattern, 'i');
    if (!regex.test(message.content)) return false;
  }

  // Minimum message length
  if (conditions.minLength && message.content.length < conditions.minLength) {
    return false;
  }

  return true;
}
```

## Database Schema Reference

### Conversations Table
```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  phone_number VARCHAR(20) NOT NULL,
  contact_name VARCHAR(255),
  started_at TIMESTAMP,
  status VARCHAR(50) CHECK (status IN ('active', 'archived', 'closed')),
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  UNIQUE(tenant_id, phone_number)
);
```

### Messages Table
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  direction VARCHAR(20) CHECK (direction IN ('inbound', 'outbound')),
  content TEXT NOT NULL,
  timestamp TIMESTAMP,
  provider_id VARCHAR(100),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Message Rules Table
```sql
CREATE TABLE message_rules (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  rule_name VARCHAR(255),
  conditions JSONB,
  response_template TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

## Logging

All processing operations log to console with structured JSON:

```typescript
// Receive event success
console.log('[Z-API Processor] Inbound message processed', {
  conversationId: '...',
  messageId: '...',
  tenantId: '...',
});

// Error
console.error('[Z-API Processor Error]', {
  eventType: 'receive',
  tenantId: '...',
  error: 'error message',
});

// Rule processing
console.log('[Message Rules] Checking 5 rules for conversation', conversationId);
```

## Testing

### Unit Test Example

```typescript
import { processZApiWebhook } from '@/lib/z-api-processor';
import { ReceiveEvent } from '@/types/z-api';

describe('processZApiWebhook', () => {
  it('creates conversation and message for new contact', async () => {
    const event: ReceiveEvent = {
      type: 'receive',
      id: 'event-123',
      messageId: 'msg-456',
      senderPhone: '5511999999999',
      senderName: 'John Doe',
      text: 'Hello!',
      messageType: 'text',
      timestamp: new Date().toISOString(),
    };

    const result = await processZApiWebhook(event, tenantId);

    expect(result.success).toBe(true);
    expect(result.data?.conversationId).toBeDefined();
    expect(result.data?.messageId).toBeDefined();
  });
});
```

## Performance Considerations

1. **Conversation lookup**: Uses unique index on (tenant_id, phone_number) for O(log n) lookup
2. **Message insertion**: Single INSERT with provider_id for idempotency
3. **Rule evaluation**: Loads all active rules at once (optimize with indexing on tenant_id, active)
4. **Async processing**: Must be handled by calling application (queue, background job, etc.)

## Migration Checklist

- [ ] Run TASK_1_2_RLS_MIGRATIONS.sql for database schema
- [ ] Copy z-api-processor.ts to src/lib/
- [ ] Update webhook route to call processZApiWebhook asynchronously
- [ ] Set up job queue for async event processing
- [ ] Add error monitoring/alerting for processor failures
- [ ] Implement rule evaluation logic
- [ ] Add message audit logging for compliance
- [ ] Test with real Z-API webhook delivery
