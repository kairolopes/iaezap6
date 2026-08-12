# Z-API Sender Module Guide

## Overview

The Z-API Sender module (`src/lib/z-api-sender.ts`) provides functionality to send automated messages via the Z-API WhatsApp integration and save them to the database for audit trails and retry capabilities.

## Features

- **Automated Message Sending**: Send messages to WhatsApp conversations via Z-API
- **Database Integration**: Automatically saves outbound messages to the `messages` table
- **Resilient Error Handling**: Logs errors without throwing, enabling retry workflows
- **Tenant Isolation**: Enforces RLS isolation via `tenant_id` validation
- **Graceful Degradation**: Saves messages even if Z-API send fails, enabling later retry

## API Reference

### `sendMessage()`

Main function to send a message to a conversation.

#### Signature

```typescript
async function sendMessage(
  tenantId: string,
  instanceId: string,
  conversationId: string,
  text: string,
  zApiToken: string
): Promise<SendMessageResult>
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `tenantId` | string | UUID of the tenant (for RLS isolation) |
| `instanceId` | string | Z-API instance ID |
| `conversationId` | string | UUID of the conversation to send message to |
| `text` | string | Message text content to send |
| `zApiToken` | string | Z-API authentication token |

#### Return Type: `SendMessageResult`

```typescript
interface SendMessageResult {
  success: boolean;           // true if message was sent successfully
  messageId?: string;         // Database message ID (always set on success, often set on Z-API failure)
  error?: string;             // Error description if failed
  details?: {
    zApiMessageId?: string;   // Z-API message ID (if returned by Z-API)
    retryable?: boolean;      // true if error can be retried later
  };
}
```

#### Return Values

**Success Case:**
```typescript
{
  success: true,
  messageId: "550e8400-e29b-41d4-a716-446655440000",
  details: {
    zApiMessageId: "msg_123456"
  }
}
```

**Z-API Failure (Message Still Saved):**
```typescript
{
  success: false,
  messageId: "550e8400-e29b-41d4-a716-446655440001",
  error: "Z-API send failed: Connection refused",
  details: {
    zApiMessageId: null,
    retryable: true  // Can be retried later
  }
}
```

**Validation Failure:**
```typescript
{
  success: false,
  error: "Missing required fields: instanceId, zApiToken",
  details: {
    retryable: false  // Cannot retry - fix the inputs
  }
}
```

**Conversation Not Found:**
```typescript
{
  success: false,
  error: "Conversation not found: ...",
  details: {
    retryable: false  // Cannot retry - conversation doesn't exist
  }
}
```

## Usage Examples

### Basic Usage

```typescript
import { sendMessage } from '@/lib/z-api-sender';

const result = await sendMessage(
  'tenant-uuid-here',
  'instance-uuid-here',
  'conversation-uuid-here',
  'Hello! This is an automated reply.',
  'z-api-token-here'
);

if (result.success) {
  console.log('Message sent:', result.messageId);
} else {
  console.error('Failed to send:', result.error);
  if (result.details?.retryable) {
    console.log('This error can be retried later');
  }
}
```

### In a Message Rule Handler

```typescript
import { sendMessage } from '@/lib/z-api-sender';

async function executeAutomatedReply(
  tenantId: string,
  conversationId: string,
  zApiInstanceId: string,
  zApiToken: string,
  replyTemplate: string
) {
  // Replace template variables if needed
  const replyText = replyTemplate
    .replace('{{time}}', new Date().toLocaleTimeString())
    .replace('{{date}}', new Date().toLocaleDateString());

  const result = await sendMessage(
    tenantId,
    zApiInstanceId,
    conversationId,
    replyText,
    zApiToken
  );

  return {
    sent: result.success,
    messageId: result.messageId,
    error: result.error,
    canRetry: result.details?.retryable,
  };
}
```

### With Retry Logic

```typescript
import { sendMessage } from '@/lib/z-api-sender';

async function sendWithRetry(
  tenantId: string,
  instanceId: string,
  conversationId: string,
  text: string,
  zApiToken: string,
  maxRetries: number = 3
) {
  let lastError: string | undefined;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await sendMessage(
      tenantId,
      instanceId,
      conversationId,
      text,
      zApiToken
    );

    if (result.success) {
      return {
        success: true,
        messageId: result.messageId,
        attempts: attempt,
      };
    }

    lastError = result.error;

    // Don't retry if it's not a retryable error
    if (!result.details?.retryable) {
      return {
        success: false,
        error: lastError,
        canRetry: false,
        attempts: attempt,
      };
    }

    // Wait before next retry
    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }

  return {
    success: false,
    error: lastError,
    canRetry: true,
    attempts: maxRetries,
  };
}
```

## Implementation Details

### Data Flow

1. **Input Validation**: Checks that all required parameters are provided
2. **Conversation Lookup**: Queries the `conversations` table to get the phone number
3. **RLS Verification**: Ensures the conversation belongs to the provided `tenantId`
4. **Z-API Call**: Sends the message via Z-API REST API
5. **Database Save**: Inserts an `outbound` message record
6. **Result Return**: Returns status with message IDs and error details

### Z-API Integration

**Endpoint**: `POST https://api.z-api.io/instances/{instanceId}/token/{zApiToken}/api/send-message`

**Payload**:
```json
{
  "phone": "5521987654321",
  "message": "Hello, this is an automated reply!"
}
```

**Response**:
```json
{
  "success": true,
  "messageId": "msg_123456"
}
```

### Database Operations

#### Saved Message Record

Messages are saved to the `messages` table with:

```sql
INSERT INTO messages (
  conversation_id,    -- UUID of the conversation
  direction,          -- 'outbound'
  content,            -- Message text
  provider_id,        -- Z-API message ID (can be null on Z-API failure)
  timestamp,          -- Current time in ISO format
  created_at,         -- Current time (auto-set)
  updated_at          -- Current time (auto-set)
)
VALUES (...)
```

#### RLS Isolation

All database operations respect the tenant isolation via:
- The `conversation_id` must belong to `tenant_id`
- RLS policies enforce `tenant_id` matching automatically

### Error Handling Strategy

The module uses a **resilience-first** approach:

1. **Z-API Errors**: Logged but don't prevent database save
   - Message is still saved for later retry
   - Returns `retryable: true`
   
2. **Database Errors**: Logged and returned
   - Indicates a serious system issue
   - Depends on the specific error type
   
3. **Input Validation**: Returns immediately
   - Missing/invalid parameters
   - Returns `retryable: false`
   
4. **Conversation Not Found**: Returns immediately
   - Indicates configuration or data issue
   - Returns `retryable: false`

### Logging

The module includes comprehensive logging at multiple levels:

```typescript
// Validation errors
[Z-API Sender] Validation error: Missing required fields: ...

// Database queries
[Z-API Sender] Fetching conversation details { conversationId, tenantId }

// Z-API calls
[Z-API Call] Sending request { url, phoneNumber, messageLength }
[Z-API Call] Success { zApiMessageId, statusCode }
[Z-API Call] Failed { error, url }

// Database saves
[Z-API Sender] Saving message to database { conversationId, zApiMessageId }
[Z-API Sender] Message saved to database { messageId, conversationId }

// Completion
[Z-API Sender] Message sent successfully { messageId, zApiMessageId, conversationId }
```

## Testing

Unit tests are located in `__tests__/lib/z-api-sender.test.ts`.

Run tests with:
```bash
npm test -- z-api-sender.test.ts
# or
pnpm test -- z-api-sender.test.ts
```

### Test Coverage

- ✓ Input validation for all parameters
- ✓ Conversation lookup failures
- ✓ Z-API call failures with database save
- ✓ Successful send and save
- ✓ Database save failures
- ✓ Z-API error responses
- ✓ Long message handling
- ✓ Special characters in messages
- ✓ Z-API responses without messageId
- ✓ Multi-tenant isolation
- ✓ Network timeout handling

## Configuration

### Environment Variables

The module uses environment variables from Supabase configuration:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Z-API Configuration

You'll need to obtain from Z-API:
- **Instance ID**: Unique identifier for your Z-API instance
- **API Token**: Authentication token for your instance

These are typically passed to the function from your application state or settings.

## Integration Points

### Message Rules Engine

When implementing automated replies via message rules:

```typescript
// In triggerMessageRules() in z-api-processor.ts
await sendMessage(
  tenantId,
  rule.z_api_instance_id,
  conversationId,
  rule.auto_reply_text,
  rule.z_api_token
);
```

### API Endpoint

Create an endpoint to manually trigger message sending:

```typescript
// api/conversations/[id]/send-message
export async function POST(request: NextRequest) {
  const { conversationId, text, tenantId } = await request.json();
  
  const result = await sendMessage(
    tenantId,
    process.env.Z_API_INSTANCE_ID,
    conversationId,
    text,
    process.env.Z_API_TOKEN
  );
  
  return NextResponse.json(result);
}
```

## Performance Considerations

- **Database Queries**: Single query to fetch conversation, indexed on `(tenant_id, id)`
- **Z-API Calls**: Network calls may take 1-5 seconds; consider async processing for high volume
- **Message Save**: Fast local database operation, should not impact latency
- **RLS Enforcement**: Handled by Supabase, minimal overhead

## Security Considerations

1. **Token Handling**: Z-API tokens are masked in logs (replaced with `***`)
2. **Tenant Isolation**: RLS policies prevent data leakage between tenants
3. **Input Validation**: All inputs validated before use
4. **Error Details**: Sensitive information removed from error messages in production

## Troubleshooting

### "Conversation not found" error
- Verify the `conversationId` exists in the database
- Check that the conversation belongs to the provided `tenantId`
- Use the Supabase dashboard to inspect the conversations table

### Z-API message not sending
- Verify the phone number format (should be 10-15 digits without + or -)
- Check Z-API credentials (instanceId, token)
- Check Z-API service status
- Review Z-API logs for specific error details

### Message saved but Z-API didn't return messageId
- This is normal - Z-API may not return messageId in all cases
- The local message ID is still saved for tracking
- The message is marked for potential retry

### RLS policy violations
- Check that the conversation's `tenant_id` matches the provided `tenantId`
- Verify the service role key is correctly configured
- Check Supabase RLS policies in the console

## Future Enhancements

Potential improvements for future versions:

1. **Batch Sending**: Send multiple messages in a single call
2. **Rate Limiting**: Built-in rate limiting to respect Z-API quotas
3. **Message Status Tracking**: Track delivery status via webhooks
4. **Template Engine**: Built-in message templating with variables
5. **Queue Integration**: Integration with job queue for async processing
6. **Retry Strategy**: Automatic retry with exponential backoff
7. **Analytics**: Tracking of sent messages, delivery rates, etc.

## Related Files

- `src/lib/z-api-processor.ts` - Webhook event processing
- `src/types/z-api.ts` - Z-API webhook event types
- `src/app/api/webhooks/z-api/route.ts` - Z-API webhook endpoint
- `src/lib/message-rules.ts` - Message rule definitions
- `__tests__/lib/z-api-sender.test.ts` - Test suite

## Support

For issues or questions:
1. Check the logs for detailed error information
2. Review test cases for usage examples
3. Check Z-API documentation: https://z-api.io/
4. Verify database schema in Supabase dashboard
