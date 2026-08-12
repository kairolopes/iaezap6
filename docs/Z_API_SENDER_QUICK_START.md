# Z-API Sender Quick Start

## Import

```typescript
import { sendMessage } from '@/lib/z-api-sender';
```

## Basic Usage

```typescript
const result = await sendMessage(
  tenantId,           // e.g., 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
  instanceId,         // Z-API instance ID
  conversationId,     // UUID of the conversation
  'Hello from bot!',  // Message text
  zApiToken          // Z-API authentication token
);

if (result.success) {
  console.log('Message sent:', result.messageId);
} else {
  console.error('Failed:', result.error);
}
```

## Common Scenarios

### Scenario 1: Send Automated Reply from Message Rule

```typescript
import { sendMessage } from '@/lib/z-api-sender';
import { createSupabaseServerClient } from '@/lib/supabase';

async function handleAutomatedReply(
  tenantId: string,
  conversationId: string,
  messageRuleId: string
) {
  const supabase = createSupabaseServerClient();

  // Fetch the rule configuration
  const { data: rule } = await supabase
    .from('message_rules')
    .select('z_api_instance_id, z_api_token, reply_template')
    .eq('id', messageRuleId)
    .eq('tenant_id', tenantId)
    .single();

  if (!rule) {
    console.error('Rule not found');
    return;
  }

  // Send the reply
  const result = await sendMessage(
    tenantId,
    rule.z_api_instance_id,
    conversationId,
    rule.reply_template,
    rule.z_api_token
  );

  return result;
}
```

### Scenario 2: Send Message from API Endpoint

```typescript
// api/conversations/[id]/send-message
import { sendMessage } from '@/lib/z-api-sender';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { text, tenantId } = await request.json();

    // Get Z-API configuration from environment or database
    const result = await sendMessage(
      tenantId,
      process.env.Z_API_INSTANCE_ID!,
      params.id,
      text,
      process.env.Z_API_TOKEN!
    );

    if (!result.success && !result.details?.retryable) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, {
      status: result.success ? 201 : 202, // 202 = accepted, will retry
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### Scenario 3: Send with Retry Logic

```typescript
import { sendMessage } from '@/lib/z-api-sender';

async function sendWithRetry(
  tenantId: string,
  instanceId: string,
  conversationId: string,
  text: string,
  token: string
) {
  const maxAttempts = 3;
  
  for (let i = 0; i < maxAttempts; i++) {
    const result = await sendMessage(tenantId, instanceId, conversationId, text, token);
    
    if (result.success || !result.details?.retryable) {
      return result;
    }
    
    if (i < maxAttempts - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  
  return { success: false, error: 'Max retries exceeded' };
}
```

### Scenario 4: Batch Send to Multiple Conversations

```typescript
import { sendMessage } from '@/lib/z-api-sender';

async function broadcastMessage(
  tenantId: string,
  conversationIds: string[],
  message: string,
  instanceId: string,
  token: string
) {
  const results = await Promise.allSettled(
    conversationIds.map(convId =>
      sendMessage(tenantId, instanceId, convId, message, token)
    )
  );

  const successful = results.filter(r => r.status === 'fulfilled' && r.value.success);
  const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success));

  return {
    total: conversationIds.length,
    successCount: successful.length,
    failureCount: failed.length,
    failed: failed.map((r, idx) => ({
      conversationId: conversationIds[idx],
      error: r.status === 'fulfilled' ? r.value.error : String(r.reason),
    })),
  };
}
```

## Response Handling

```typescript
const result = await sendMessage(...);

// Check success
if (result.success) {
  // Message was sent successfully
  const messageId = result.messageId; // Local database ID
  const zApiId = result.details?.zApiMessageId; // Z-API ID
}

// Check if retriable
if (!result.success && result.details?.retryable) {
  // Can retry this operation
  // Typical causes: network issues, Z-API temporary failure
}

// Non-retriable error
if (!result.success && !result.details?.retryable) {
  // Cannot retry, fix the issue
  // Typical causes: invalid conversation, missing parameters
  console.error('Cannot retry:', result.error);
}
```

## Error Messages

| Error | Retryable | Meaning | Action |
|-------|-----------|---------|--------|
| "Missing required fields" | false | Missing inputs | Check parameters |
| "Conversation not found" | false | Invalid conversation ID | Verify conversation exists |
| "Z-API send failed" | true | Network/Z-API issue | Retry later |
| "Message sent via Z-API but failed to save locally" | true | Database issue | Retry or check DB |
| "Unknown error" | true | Unexpected error | Retry and investigate |

## Testing

```typescript
// Example test
import { sendMessage } from '@/lib/z-api-sender';

it('should send message successfully', async () => {
  const result = await sendMessage(
    'test-tenant-id',
    'test-instance-id',
    'test-conversation-id',
    'Test message',
    'test-token'
  );

  expect(result.success).toBe(true);
  expect(result.messageId).toBeDefined();
});
```

## Best Practices

1. **Always check `result.success`** before assuming message was sent
2. **Use `result.details?.retryable`** to determine if retrying makes sense
3. **Implement exponential backoff** for retries to avoid hammering the API
4. **Log all failures** for debugging and monitoring
5. **Store the `messageId`** for tracking and reconciliation
6. **Pass the correct `tenantId`** to enforce RLS isolation
7. **Handle Z-API token rotation** - tokens may change over time
8. **Monitor Z-API response times** - set appropriate timeouts

## Troubleshooting

**Message says "Conversation not found"**
- Check that conversationId exists in your database
- Verify the conversation is linked to the correct tenantId
- Use Supabase UI to inspect the conversations table

**Z-API keeps failing**
- Verify Z-API credentials (instanceId, token)
- Check phone number format in conversation (10-15 digits)
- Check Z-API service status and logs
- May be Z-API rate limiting - implement exponential backoff

**Message saved but not delivered**
- Check Z-API logs for delivery issues
- Verify phone number is a valid WhatsApp account
- Check Z-API instance is connected and authenticated

**Getting RLS policy errors**
- Verify tenantId matches the conversation's tenant_id
- Check Supabase RLS policies are correctly configured
- Ensure service role key is being used (for server-side operations)

## See Also

- Full documentation: [Z_API_SENDER_GUIDE.md](./Z_API_SENDER_GUIDE.md)
- Z-API webhook processing: [z-api-processor.ts](../src/lib/z-api-processor.ts)
- Test examples: [z-api-sender.test.ts](../__tests__/lib/z-api-sender.test.ts)
