# Z-API Sender Integration Example

## Overview

This document shows how to integrate the Z-API sender module into the message rules trigger system for automated replies.

## Current Implementation Status

The Z-API Sender module is ready to be integrated. Currently, the `triggerMessageRules` function in `src/lib/z-api-processor.ts` is a placeholder that needs this implementation.

## Integration: Complete Example

### Updated triggerMessageRules Function

Replace the placeholder in `src/lib/z-api-processor.ts`:

```typescript
import { sendMessage } from '@/lib/z-api-sender';
import { createSupabaseServerClient } from './supabase';

/**
 * Trigger message rules for automation
 *
 * Called after an inbound message is saved.
 * Evaluates all active message rules for the tenant against the message content
 * and executes any matching rules by sending automated replies.
 *
 * @param conversationId - The conversation ID
 * @param messageId - The message ID
 * @param tenantId - The tenant ID
 * @param messageContent - The message content to evaluate against rules
 */
async function triggerMessageRules(
  conversationId: string,
  messageId: string,
  tenantId: string,
  messageContent: string
): Promise<void> {
  const supabase = createSupabaseServerClient();

  try {
    // Fetch all active message rules for this tenant
    const { data: rules, error: rulesError } = await supabase
      .from('message_rules')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('active', true);

    if (rulesError) {
      console.error('[Message Rules] Failed to fetch rules:', rulesError);
      return;
    }

    if (!rules || rules.length === 0) {
      console.log('[Message Rules] No active rules found for tenant', tenantId);
      return;
    }

    console.log('[Message Rules] Checking', rules.length, 'rules for conversation', conversationId);

    // Evaluate and execute matching rules
    for (const rule of rules) {
      try {
        // Check if this rule matches the incoming message
        const isMatch = evaluateRuleCondition(rule, messageContent);

        if (!isMatch) {
          console.log('[Message Rules] Rule', rule.id, 'did not match message');
          continue;
        }

        console.log('[Message Rules] Rule', rule.id, 'matched! Executing action...');

        // Execute the rule action
        if (rule.action_type === 'auto_reply') {
          await executeAutoReplyAction(
            supabase,
            tenantId,
            conversationId,
            rule
          );
        } else if (rule.action_type === 'forward') {
          await executeForwardAction(supabase, rule, messageId);
        } else if (rule.action_type === 'tag') {
          await executeTagAction(supabase, conversationId, rule);
        }

        // Log the rule execution
        await logRuleExecution(supabase, rule.id, conversationId, messageId, 'executed');

      } catch (ruleError) {
        const errorMsg = ruleError instanceof Error ? ruleError.message : String(ruleError);
        console.error('[Message Rules] Error executing rule', rule.id, ':', errorMsg);
        await logRuleExecution(supabase, rule.id, conversationId, messageId, 'failed', errorMsg);
      }
    }

  } catch (error) {
    console.error('[Message Rules] Error triggering rules:', error);
    // Don't throw - rule processing failures shouldn't block message insertion
  }
}

/**
 * Evaluate if a message matches a rule's condition
 *
 * Supports:
 * - Keyword matching (case-insensitive substring)
 * - Regex matching
 * - Exact match
 *
 * @param rule - The message rule
 * @param messageContent - The message text to evaluate
 * @returns true if the rule condition matches
 */
function evaluateRuleCondition(
  rule: {
    condition_type: string;
    condition_value: string;
    condition_case_sensitive?: boolean;
  },
  messageContent: string
): boolean {
  try {
    const content = rule.condition_case_sensitive
      ? messageContent
      : messageContent.toLowerCase();

    const condition = rule.condition_case_sensitive
      ? rule.condition_value
      : rule.condition_value.toLowerCase();

    switch (rule.condition_type) {
      case 'keyword':
        // Check if message contains the keyword
        return content.includes(condition);

      case 'regex':
        // Check if message matches the regex pattern
        const regex = new RegExp(condition);
        return regex.test(messageContent); // Use original for regex

      case 'exact':
        // Check for exact message match
        return content === condition;

      case 'starts_with':
        return content.startsWith(condition);

      case 'ends_with':
        return content.endsWith(condition);

      default:
        console.warn('[Message Rules] Unknown condition type:', rule.condition_type);
        return false;
    }
  } catch (error) {
    console.error('[Message Rules] Error evaluating condition:', error);
    return false;
  }
}

/**
 * Execute an auto-reply action
 *
 * Sends an automated response message via Z-API
 *
 * @param supabase - Supabase client
 * @param tenantId - Tenant ID
 * @param conversationId - Conversation ID
 * @param rule - The message rule with action configuration
 */
async function executeAutoReplyAction(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  tenantId: string,
  conversationId: string,
  rule: {
    id: string;
    z_api_instance_id?: string;
    z_api_token?: string;
    auto_reply_text?: string;
  }
): Promise<void> {
  // Get Z-API configuration for this tenant
  const zApiConfig = await getZApiConfig(supabase, tenantId);

  if (!zApiConfig || !zApiConfig.instanceId || !zApiConfig.token) {
    throw new Error('Z-API configuration not found for tenant');
  }

  // Use rule-specific configuration if available, otherwise use tenant default
  const instanceId = rule.z_api_instance_id || zApiConfig.instanceId;
  const token = rule.z_api_token || zApiConfig.token;
  const replyText = rule.auto_reply_text || 'Thanks for your message! We will get back to you soon.';

  // Send the reply via Z-API
  const result = await sendMessage(
    tenantId,
    instanceId,
    conversationId,
    replyText,
    token
  );

  if (!result.success) {
    throw new Error(`Failed to send reply: ${result.error}`);
  }

  console.log('[Message Rules] Auto-reply sent successfully:', result.messageId);
}

/**
 * Execute a forward action
 *
 * Forwards the message to another channel or user
 * (Implementation depends on your forwarding system)
 *
 * @param supabase - Supabase client
 * @param rule - The message rule with forward configuration
 * @param messageId - The message to forward
 */
async function executeForwardAction(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  rule: {
    id: string;
    forward_to?: string; // Could be email, phone, channel ID, etc.
  },
  messageId: string
): Promise<void> {
  if (!rule.forward_to) {
    throw new Error('Forward destination not configured');
  }

  // TODO: Implement forwarding logic
  // This could forward to:
  // - Another conversation
  // - Email
  // - Slack/Teams channel
  // - Support ticket system
  // - etc.

  console.log('[Message Rules] Message forwarded to:', rule.forward_to);
}

/**
 * Execute a tag action
 *
 * Adds tags to the conversation for organization/filtering
 *
 * @param supabase - Supabase client
 * @param conversationId - Conversation ID
 * @param rule - The message rule with tag configuration
 */
async function executeTagAction(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  conversationId: string,
  rule: {
    id: string;
    tags?: string[]; // Array of tag IDs or names
  }
): Promise<void> {
  if (!rule.tags || rule.tags.length === 0) {
    throw new Error('No tags configured for this rule');
  }

  // TODO: Implement tagging logic
  // This would typically:
  // 1. Add tags to the conversation
  // 2. Update the conversation record with tag references
  // 3. Enable filtering by tags later

  console.log('[Message Rules] Tags applied:', rule.tags);
}

/**
 * Get Z-API configuration for a tenant
 *
 * Fetches the default Z-API settings for the tenant
 *
 * @param supabase - Supabase client
 * @param tenantId - Tenant ID
 * @returns Configuration object or null if not found
 */
async function getZApiConfig(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  tenantId: string
): Promise<{
  instanceId: string;
  token: string;
} | null> {
  try {
    // This assumes you have a z_api_settings or similar table
    // Adjust the table name and column names as needed
    const { data, error } = await supabase
      .from('z_api_settings')
      .select('instance_id, api_token')
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) {
      console.warn('[Message Rules] Z-API settings not found for tenant:', tenantId);
      return null;
    }

    return {
      instanceId: data.instance_id,
      token: data.api_token,
    };
  } catch (error) {
    console.error('[Message Rules] Error fetching Z-API config:', error);
    return null;
  }
}

/**
 * Log a rule execution for audit trail
 *
 * @param supabase - Supabase client
 * @param ruleId - Rule ID
 * @param conversationId - Conversation ID
 * @param messageId - Message ID that triggered the rule
 * @param status - Execution status (executed, failed, skipped)
 * @param error - Error message if failed
 */
async function logRuleExecution(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  ruleId: string,
  conversationId: string,
  messageId: string,
  status: 'executed' | 'failed' | 'skipped',
  error?: string
): Promise<void> {
  try {
    // This assumes you have a rule_executions or audit_log table
    await supabase.from('rule_executions').insert([
      {
        rule_id: ruleId,
        conversation_id: conversationId,
        message_id: messageId,
        status,
        error: error || null,
        executed_at: new Date().toISOString(),
      },
    ]);
  } catch (logError) {
    console.error('[Message Rules] Failed to log rule execution:', logError);
    // Don't throw - logging failure shouldn't break the main flow
  }
}
```

## Database Schema

For this integration to work, you'll need these tables:

```sql
-- Z-API Settings (tenant configuration)
CREATE TABLE z_api_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  instance_id VARCHAR(255) NOT NULL,
  api_token VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id)
);

-- Message Rules
CREATE TABLE message_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  active BOOLEAN DEFAULT true,
  
  -- Rule condition
  condition_type VARCHAR(50) NOT NULL CHECK (condition_type IN ('keyword', 'regex', 'exact', 'starts_with', 'ends_with')),
  condition_value TEXT NOT NULL,
  condition_case_sensitive BOOLEAN DEFAULT false,
  
  -- Rule action
  action_type VARCHAR(50) NOT NULL CHECK (action_type IN ('auto_reply', 'forward', 'tag')),
  
  -- Auto-reply specific
  auto_reply_text TEXT,
  z_api_instance_id VARCHAR(255),
  z_api_token VARCHAR(255),
  
  -- Forward specific
  forward_to VARCHAR(255),
  
  -- Tag specific
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Rule Execution Audit Log
CREATE TABLE rule_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES message_rules(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL CHECK (status IN ('executed', 'failed', 'skipped')),
  error TEXT,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- RLS Policies
ALTER TABLE z_api_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE rule_executions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see Z-API settings for their tenant
CREATE POLICY "z_api_settings_select"
  ON z_api_settings FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM users_tenants
    WHERE users_tenants.tenant_id = z_api_settings.tenant_id
      AND users_tenants.user_id = auth.uid()
  ));

-- Policy: Users can see message rules for their tenant
CREATE POLICY "message_rules_select"
  ON message_rules FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM users_tenants
    WHERE users_tenants.tenant_id = message_rules.tenant_id
      AND users_tenants.user_id = auth.uid()
  ));

-- Policy: Users can see rule executions for their tenant
CREATE POLICY "rule_executions_select"
  ON rule_executions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM users_tenants ut
    JOIN message_rules mr ON mr.id = rule_executions.rule_id
    WHERE ut.tenant_id = mr.tenant_id
      AND ut.user_id = auth.uid()
  ));
```

## Usage in Message Rules UI

Example of how this would be exposed in the admin interface:

```typescript
// pages/dashboard/rules/new.tsx
import { sendMessage } from '@/lib/z-api-sender';

export default function NewRulePage() {
  const [rule, setRule] = useState({
    name: '',
    condition_type: 'keyword',
    condition_value: '',
    action_type: 'auto_reply',
    auto_reply_text: 'Thanks for your message!',
  });

  const handleCreateRule = async () => {
    const { data, error } = await supabase
      .from('message_rules')
      .insert([{ ...rule, tenant_id: tenantId }])
      .select()
      .single();

    if (!error) {
      toast.success('Rule created successfully');
    }
  };

  return (
    <div className="space-y-4">
      <input
        placeholder="Rule name"
        value={rule.name}
        onChange={(e) => setRule({ ...rule, name: e.target.value })}
      />

      <select value={rule.condition_type}>
        <option value="keyword">Contains keyword</option>
        <option value="regex">Matches regex</option>
        <option value="exact">Exact match</option>
      </select>

      <input
        placeholder="Condition value"
        value={rule.condition_value}
        onChange={(e) => setRule({ ...rule, condition_value: e.target.value })}
      />

      {rule.action_type === 'auto_reply' && (
        <textarea
          placeholder="Auto-reply message"
          value={rule.auto_reply_text}
          onChange={(e) => setRule({ ...rule, auto_reply_text: e.target.value })}
        />
      )}

      <button onClick={handleCreateRule}>Create Rule</button>
    </div>
  );
}
```

## Testing the Integration

```typescript
// __tests__/lib/message-rules-integration.test.ts
import { triggerMessageRules } from '@/lib/z-api-processor';

describe('Message Rules Integration', () => {
  it('should send auto-reply when rule matches', async () => {
    const tenantId = 'test-tenant';
    const conversationId = 'test-conversation';
    const messageId = 'test-message';

    // Create a rule that matches "help"
    await supabase.from('message_rules').insert({
      tenant_id: tenantId,
      condition_type: 'keyword',
      condition_value: 'help',
      action_type: 'auto_reply',
      auto_reply_text: 'Our team will help you shortly!',
      active: true,
    });

    // Trigger rules with a message containing "help"
    await triggerMessageRules(
      conversationId,
      messageId,
      tenantId,
      'Can you help me with this?'
    );

    // Verify auto-reply was sent
    const { data: messages } = await supabase
      .from('messages')
      .select()
      .eq('conversation_id', conversationId)
      .eq('direction', 'outbound');

    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe('Our team will help you shortly!');
  });
});
```

## Next Steps

1. Create the required database tables (see schema above)
2. Replace the placeholder `triggerMessageRules` function with the integration
3. Add Z-API settings to the admin panel
4. Create a message rules management UI
5. Test with sample incoming messages
6. Monitor rule executions via the audit log
7. Implement additional action types (forward, tag) as needed

## Monitoring

Monitor rule execution effectiveness:

```typescript
// Get rule statistics
SELECT
  rule_id,
  COUNT(*) as total_executions,
  COUNT(CASE WHEN status = 'executed' THEN 1 END) as successful,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
FROM rule_executions
GROUP BY rule_id;
```

## Troubleshooting Integration

**Rules not triggering?**
- Check that rules are marked as `active = true`
- Verify the condition_value matches the incoming message
- Check the rule_executions audit log for clues

**Auto-replies not sending?**
- Verify Z-API credentials are configured
- Check that z_api_instance_id and z_api_token are set
- Look at application logs for Z-API errors
- Check Z-API balance and rate limits

**Performance issues with many rules?**
- Add index on `message_rules(tenant_id, active)`
- Consider implementing rule caching or prioritization
- Limit the number of active rules per tenant
