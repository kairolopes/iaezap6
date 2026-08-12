# Task 1.4: Message Rules Engine Documentation

## Overview

The **Message Rules Engine** is an automation system that processes incoming WhatsApp messages and triggers predefined responses based on configurable conditions. Rules are evaluated in real-time as messages arrive, enabling automatic responses without manual intervention.

**Key Features:**
- Flexible condition syntax (contains, equals, startsWith, endsWith, regex)
- Template-based responses with variable substitution
- Priority-based rule execution
- Tenant isolation with Row-Level Security (RLS)
- Non-blocking asynchronous processing

---

## Architecture Overview

### System Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Z-API Webhook Receives Message                │
│                                                                   │
│  POST /api/webhooks/z-api                                        │
│  Body: { type: 'receive', messageId, senderPhone, text, ... }   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
         ┌───────────────────────────────────────┐
         │  Webhook Validation (Zod Schema)      │
         │  - Event type check                   │
         │  - Required fields validation         │
         │  - Phone number format validation     │
         └────────────────┬──────────────────────┘
                          │
                          ▼
         ┌───────────────────────────────────────┐
         │  Z-API Processor (event handler)      │
         │  - Extract phone & message content    │
         │  - Create/fetch conversation          │
         │  - Insert inbound message             │
         │  - Trigger rule engine (async)        │
         └────────────────┬──────────────────────┘
                          │
                          ▼
         ┌───────────────────────────────────────┐
         │  Rule Engine (message-rules.ts)       │
         │  ┌─────────────────────────────────┐  │
         │  │ 1. Fetch active rules (tenant)  │  │
         │  │ 2. Parse rule conditions        │  │
         │  │ 3. Evaluate conditions (AND)    │  │
         │  │ 4. Sort by priority (DESC)      │  │
         │  └─────────────────────────────────┘  │
         └────────────────┬──────────────────────┘
                          │
                          ▼
         ┌───────────────────────────────────────┐
         │  Rule Response Handler                │
         │  ┌─────────────────────────────────┐  │
         │  │ 1. Prepare response template    │  │
         │  │ 2. Substitute variables         │  │
         │  │ 3. Store outbound message       │  │
         │  │ 4. Send via Z-API (if tokens)   │  │
         │  └─────────────────────────────────┘  │
         └────────────────┬──────────────────────┘
                          │
                          ▼
         ┌───────────────────────────────────────┐
         │  Z-API Sender                         │
         │  - Send message to recipient          │
         │  - Store Z-API message ID             │
         │  - Return 200 to webhook              │
         └───────────────────────────────────────┘
```

### Data Model

#### Message Rules Table Schema

```sql
CREATE TABLE message_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  conditions JSONB NOT NULL,
  response_template TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, name),
  INDEX idx_tenant_active (tenant_id, active)
);
```

---

## 1. Rule Creation Examples

### Example 1: Basic "Hello" Greeting Rule

#### Database Insertion via SQL

```sql
INSERT INTO message_rules (
  tenant_id,
  name,
  description,
  conditions,
  response_template,
  priority,
  active
) VALUES (
  'f47ac10b-58cc-4372-a567-0e02b2c3d479', -- Your tenant_id
  'Greeting - Portuguese Olá',
  'Auto-reply with greeting when someone says olá',
  '[
    {
      "type": "contains",
      "field": "content",
      "value": "olá",
      "caseSensitive": false
    }
  ]'::jsonb,
  'Olá {name}! Bem-vindo! Como posso ajudá-lo?',
  10,
  true
);
```

#### Response Template Variables

The response template supports the following variables:
- `{name}` - Sender name (fallback to "User")
- `{sender}` - Sender identifier
- `{phone}` - Conversation phone number
- `{senderPhone}` - Sender phone number
- `{content}` - Original message content
- `{messageType}` - Type of message (text, image, etc.)
- `{date}` - Current date (localized)
- `{time}` - Current time (localized)
- `{conversationId}` - Unique conversation identifier
- `{timestamp}` - Current ISO 8601 timestamp

**Example with multiple variables:**
```
Olá {name}! Recebemos sua mensagem: "{content}" 
em {date} às {time}. Obrigado por entrar em contato!
```

### Example 2: Complex Multi-Condition Rule

Rules with multiple conditions use **AND logic** (all conditions must match):

```sql
INSERT INTO message_rules (
  tenant_id,
  name,
  description,
  conditions,
  response_template,
  priority,
  active
) VALUES (
  'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  'Business Hours Support - Schedules',
  'Reply with schedule when asked about hours and the word schedule appears',
  '[
    {
      "type": "contains",
      "field": "content",
      "value": "horário",
      "caseSensitive": false
    },
    {
      "type": "contains",
      "field": "content",
      "value": "atendimento",
      "caseSensitive": false
    }
  ]'::jsonb,
  'Nosso horário de atendimento é segunda a sexta, 9h às 18h. Feriados não atendemos.',
  20,
  true
);
```

### Example 3: Regex Pattern Rule

```sql
INSERT INTO message_rules (
  tenant_id,
  name,
  description,
  conditions,
  response_template,
  priority,
  active
) VALUES (
  'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  'Order Status Check - Pattern Match',
  'Detect order numbers and provide status',
  '[
    {
      "type": "regex",
      "field": "content",
      "value": "(pedido|order|#)\\s*\\d{4,8}",
      "caseSensitive": false
    }
  ]'::jsonb,
  'Olá {name}! Seu pedido será processado em breve. Você receberá uma confirmação em seu email.',
  15,
  true
);
```

---

## 2. Condition Syntax Reference

### Supported Condition Types

#### 1. **contains** - Substring Match
Checks if field contains the value (case-sensitive by default)

```json
{
  "type": "contains",
  "field": "content",
  "value": "olá",
  "caseSensitive": false
}
```

**Matches:** "Olá!", "OLÁLE", "oi olá tudo bem"
**Doesn't match:** "ola" (with missing diacritic)

#### 2. **equals** - Exact Match
Checks if field exactly equals the value

```json
{
  "type": "equals",
  "field": "content",
  "value": "Help",
  "caseSensitive": true
}
```

**Matches:** "Help" (exactly)
**Doesn't match:** "help", "HELP", "Help me"

#### 3. **startsWith** - Prefix Match
Checks if field starts with the value

```json
{
  "type": "startsWith",
  "field": "content",
  "value": "!",
  "caseSensitive": true
}
```

**Matches:** "!help", "!status", "!!important"
**Doesn't match:** "Please help!", "My status"

#### 4. **endsWith** - Suffix Match
Checks if field ends with the value

```json
{
  "type": "endsWith",
  "field": "content",
  "value": "?",
  "caseSensitive": true
}
```

**Matches:** "How are you?", "What time?"
**Doesn't match:** "Really! Help me"

#### 5. **regex** - Regular Expression
Uses JavaScript RegExp for pattern matching

```json
{
  "type": "regex",
  "field": "content",
  "value": "\\b(sim|yes|ok)\\b",
  "caseSensitive": false
}
```

**Matches:** "yes please", "Sim!", "OK great"
**Doesn't match:** "sims", "yesss", "okay"

**Common Patterns:**
```regex
# Email addresses
^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$

# Phone numbers (simplified)
(\d{2})\s?(\d{4,5})-?(\d{4})

# Order numbers
#\d{6,8}

# URLs
https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b

# Currency amounts
\$\d+\.?\d{0,2}|\d+\s*reais?
```

---

## 3. Rule Evaluation Logic

### Condition Evaluation

```typescript
// File: src/lib/message-rules.ts

function evaluateCondition(message: Message, condition: RuleCondition): boolean {
  const fieldValue = message[condition.field];
  
  if (fieldValue === undefined || fieldValue === null) {
    return false;
  }

  const strValue = String(fieldValue);
  const conditionValue = condition.value;
  const caseSensitive = condition.caseSensitive !== false; // default: true

  // Normalize for case-insensitive comparison
  const normalizedStrValue = caseSensitive ? strValue : strValue.toLowerCase();
  const normalizedCondValue = caseSensitive ? conditionValue : conditionValue.toLowerCase();

  switch (condition.type) {
    case 'contains':
      return normalizedStrValue.includes(normalizedCondValue);
    case 'equals':
      return normalizedStrValue === normalizedCondValue;
    case 'startsWith':
      return normalizedStrValue.startsWith(normalizedCondValue);
    case 'endsWith':
      return normalizedStrValue.endsWith(normalizedCondValue);
    case 'regex': {
      const flags = caseSensitive ? 'g' : 'gi';
      const regex = new RegExp(conditionValue, flags);
      return regex.test(normalizedStrValue);
    }
    default:
      return false;
  }
}
```

### Rule Priority and Execution

Rules are evaluated in **priority order** (highest first). If multiple rules match, all are triggered:

```typescript
// Sort by priority descending (higher priority first)
const matchingRules = evaluateRules(message, rules)
  .sort((a, b) => b.priority - a.priority);

// Trigger response for each matching rule
for (const rule of matchingRules) {
  await triggerRuleResponse(conversation, rule, message, tenantId);
}
```

**Priority Best Practices:**
- **0-10:** Low priority (general responses)
- **11-20:** Medium priority (specific patterns)
- **21-50:** High priority (critical business rules)
- **51+:** Urgent (blocking/error handling)

---

## 4. Test Scenario: Complete Walkthrough

### Step 1: Create the Rule

```sql
INSERT INTO message_rules (
  tenant_id,
  name,
  description,
  conditions,
  response_template,
  priority,
  active
) VALUES (
  'YOUR_TENANT_ID',
  'Greeting - olá',
  'Responds to Portuguese greeting',
  '[
    {
      "type": "contains",
      "field": "content",
      "value": "olá",
      "caseSensitive": false
    }
  ]'::jsonb,
  'Olá {name}! Bem-vindo! Como posso ajudá-lo?',
  10,
  true
);
```

**Verify insertion:**
```sql
SELECT id, name, active FROM message_rules 
WHERE tenant_id = 'YOUR_TENANT_ID' 
AND name = 'Greeting - olá';
```

### Step 2: Send Test Message via Z-API

Using Z-API Client or API call:

```bash
curl -X POST https://api.z-api.io/instances/YOUR_INSTANCE_ID/token/YOUR_Z_API_TOKEN/send-message \
  -H "Content-Type: application/json" \
  -H "Client-Token: YOUR_CLIENT_TOKEN" \
  -d {
    "phone": "5511999999999",
    "message": "Olá!"
  }
```

Or using Z-API SDK:

```typescript
const response = await client.message.send({
  instanceId: 'YOUR_INSTANCE_ID',
  token: 'YOUR_Z_API_TOKEN',
  phone: '5511999999999',
  message: 'Olá!'
});
```

### Step 3: Webhook Reception

Z-API sends webhook to your endpoint:

```json
POST /api/webhooks/z-api

{
  "type": "receive",
  "id": "event-abc123",
  "messageId": "msg-456",
  "senderPhone": "5511999999999",
  "senderName": "João",
  "text": "Olá!",
  "messageType": "text",
  "timestamp": 1692374400000
}
```

### Step 4: Server Processing

**Webhook Handler** (`src/app/api/webhooks/z-api/route.ts`):
1. Validates event schema
2. Extracts tenant_id from request context
3. Calls `processZApiWebhook(event, tenantId)`

**Z-API Processor** (`src/lib/z-api-processor.ts`):
1. Extracts phone: "5511999999999", text: "Olá!"
2. Finds or creates conversation with phone_number: "5511999999999"
3. Inserts message: { content: "Olá!", direction: "inbound" }
4. **Async:** Calls `triggerMessageRules(conversation, message, tenantId)`

**Rule Engine** (`src/lib/message-rules.ts`):
1. Fetches active rules for tenant
2. Evaluates condition: message.content.toLowerCase().includes("olá")
   - ✓ "olá!".toLowerCase() includes "olá" = **MATCH**
3. Prepares response template:
   - Original: "Olá {name}! Bem-vindo! Como posso ajudá-lo?"
   - Substituted: "Olá João! Bem-vindo! Como posso ajudá-lo?"
4. Stores response message in database
5. Calls Z-API Sender to transmit message

**Z-API Sender** (`src/lib/z-api-sender.ts`):
1. Gets conversation phone: "5511999999999"
2. Calls Z-API endpoint to send
3. Stores Z-API response and message ID
4. Returns success status

### Step 5: Verify Response

**Check database for outbound message:**

```sql
SELECT id, direction, content, created_at 
FROM messages 
WHERE conversation_id = (
  SELECT id FROM conversations 
  WHERE phone_number = '5511999999999' 
  AND tenant_id = 'YOUR_TENANT_ID'
)
ORDER BY created_at DESC
LIMIT 2;
```

**Expected results:**
| id | direction | content | created_at |
|----|-----------|---------|-----------|
| msg-xyz | inbound | Olá! | 2024-01-10 10:00:00 |
| msg-uvw | outbound | Olá João! Bem-vindo! Como posso ajudá-lo? | 2024-01-10 10:00:01 |

**Check Z-API delivery status:**
```bash
curl -H "Client-Token: YOUR_CLIENT_TOKEN" \
  https://api.z-api.io/instances/YOUR_INSTANCE_ID/token/YOUR_Z_API_TOKEN/message-status/msg-uvw
```

---

## 5. Z-API Configuration

### Getting Your Credentials

#### 1. Instance ID (instanceId)

**Location:** Z-API Dashboard > Instances

```
Instance ID: 1234567890
```

**Verification:**
```bash
# Test instance connection
curl -H "Client-Token: YOUR_CLIENT_TOKEN" \
  https://api.z-api.io/instances/1234567890/token/YOUR_TOKEN/me
```

#### 2. Z-API Token (token / zApiToken)

**Location:** Z-API Dashboard > Instances > [Your Instance] > API Token

**Generation Steps:**
1. Go to [z-api.io dashboard](https://www.z-api.io/)
2. Navigate to your Instance
3. Click "Generate Token"
4. Copy the token (shown only once)
5. Store securely in environment variables

**Environment Setup:**
```env
# .env.local
NEXT_PUBLIC_Z_API_INSTANCE_ID=1234567890
Z_API_TOKEN=your_secret_token_here
Z_API_CLIENT_TOKEN=your_client_token_here
```

**Usage in code:**
```typescript
const instanceId = process.env.NEXT_PUBLIC_Z_API_INSTANCE_ID;
const zApiToken = process.env.Z_API_TOKEN;
const clientToken = process.env.Z_API_CLIENT_TOKEN;
```

#### 3. Client Token (Client-Token header)

**Location:** Z-API Dashboard > Integrations > API Credentials

**Purpose:** Authenticates your application to Z-API
**Storage:** Environment variable (never expose in frontend code)

**Header Usage:**
```typescript
const headers = {
  'Client-Token': process.env.Z_API_CLIENT_TOKEN,
  'Content-Type': 'application/json',
};
```

### Webhook URL Configuration

#### Step 1: Determine Your Webhook URL

**Production:** `https://yourdomain.com/api/webhooks/z-api`

**Local Development:** Use a tunnel service
```bash
# Using ngrok
ngrok http 3000
# Output: Forwarding  https://abc123.ngrok.io → http://localhost:3000
# Webhook URL: https://abc123.ngrok.io/api/webhooks/z-api
```

#### Step 2: Register Webhook in Z-API Dashboard

1. Go to Z-API Dashboard > [Your Instance] > Settings
2. Find "Webhook Configuration" section
3. Enter Webhook URL: `https://yourdomain.com/api/webhooks/z-api`
4. Select events to receive:
   - ✓ Message Received (receive events)
   - ✓ Message Status (status events)
   - ✓ Message Delivery (delivery events)
5. Save configuration

#### Step 3: Verify Webhook Registration

**Check via API:**
```bash
curl -H "Client-Token: YOUR_CLIENT_TOKEN" \
  https://api.z-api.io/instances/YOUR_INSTANCE_ID/token/YOUR_TOKEN/webhook
```

**Expected response:**
```json
{
  "url": "https://yourdomain.com/api/webhooks/z-api",
  "events": ["receive", "status", "delivery"],
  "active": true,
  "lastDelivery": "2024-01-10T10:15:30Z"
}
```

#### Step 4: Test Webhook Delivery

**Z-API provides a test button in the dashboard:**
1. Go to [Instance] > Webhook Settings
2. Click "Test Webhook"
3. Check server logs for received event

**Or send a test message manually:**
1. Send a message from any WhatsApp contact to your number
2. Monitor application logs
3. Verify message appears in `conversations` and `messages` tables

---

## 6. Production Checklist

### 6.1 Performance and Limits

#### Rate Limiting Per Tenant

**Objective:** Prevent rule-triggered spam and abuse

**Implementation:**
```typescript
// src/lib/message-rules.ts

interface RateLimitConfig {
  messagesPerMinute: number;
  messagesPerHour: number;
  burstLimit: number;
}

async function checkRateLimit(
  tenantId: string,
  config: RateLimitConfig
): Promise<boolean> {
  const supabase = createSupabaseServerClient();

  // Count outbound messages in last minute
  const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
  const { count: minuteCount } = await supabase
    .from('messages')
    .select('id', { count: 'exact' })
    .eq('direction', 'outbound')
    .gte('created_at', oneMinuteAgo);

  if (minuteCount >= config.messagesPerMinute) {
    return false; // Rate limit exceeded
  }

  return true;
}
```

**Recommended Limits (Per Tenant):**

| Metric | Value | Rationale |
|--------|-------|-----------|
| Messages per minute | 10 | Prevent burst spam |
| Messages per hour | 200 | Sustainable conversation volume |
| Rules per tenant | 50 | Manage complexity |
| Conditions per rule | 5 | Prevent logic explosions |
| Response template size | 4096 bytes | Match WhatsApp limits |

**Configuration Example:**
```typescript
const RATE_LIMITS = {
  free_plan: {
    messagesPerMinute: 5,
    messagesPerHour: 50,
    maxRules: 5,
  },
  pro_plan: {
    messagesPerMinute: 20,
    messagesPerHour: 500,
    maxRules: 50,
  },
  enterprise_plan: {
    messagesPerMinute: 100,
    messagesPerHour: 5000,
    maxRules: 500,
  },
};
```

#### Max Rules Per Tenant

**Database Constraint:**
```sql
-- Add constraint in migration
ALTER TABLE message_rules 
ADD CONSTRAINT max_rules_per_tenant 
CHECK (
  (SELECT COUNT(*) FROM message_rules 
   WHERE tenant_id = message_rules.tenant_id) <= 50
);
```

**Application-Level Check:**
```typescript
export async function validateRuleCreation(
  tenantId: string,
  maxRules: number = 50
): Promise<{ valid: boolean; error?: string }> {
  const supabase = createSupabaseServerClient();

  const { count, error } = await supabase
    .from('message_rules')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId);

  if (count >= maxRules) {
    return {
      valid: false,
      error: `Maximum ${maxRules} rules reached for your plan`,
    };
  }

  return { valid: true };
}
```

### 6.2 Response Delay Management

**Objective:** Avoid WhatsApp rate limiting and spam perception

**Default Delays:**
```typescript
// Delay before sending rule response (milliseconds)
const RESPONSE_DELAYS = {
  immediate: 0,        // No delay
  slight: 500,         // 0.5 seconds (natural response)
  normal: 2000,        // 2 seconds (realistic typing)
  considerate: 5000,   // 5 seconds (thoughtful response)
};
```

**Implementation:**
```typescript
async function triggerRuleResponse(
  conversation: Conversation,
  rule: MessageRule,
  message: Message,
  tenantId: string,
  instanceId?: string,
  zApiToken?: string
): Promise<void> {
  // Get rule delay config
  const delayMs = rule.response_delay || 2000; // default 2s

  // Apply delay before sending
  await new Promise(resolve => setTimeout(resolve, delayMs));

  const responseContent = prepareResponseTemplate(
    rule.response_template,
    message,
    conversation
  );

  // Continue with sending...
}
```

**WhatsApp Rate Limits to Respect:**
- Maximum 80 messages per second per instance
- Quality rating affects delivery (avoid spammy patterns)
- Recommended: 1-5 second delay between automated responses
- Never send responses faster than user could type

### 6.3 Database Optimization

**Indexes for Performance:**

```sql
-- Index for quick rule lookup by tenant and status
CREATE INDEX idx_message_rules_tenant_active 
ON message_rules(tenant_id, active) 
WHERE active = true;

-- Index for rule condition queries
CREATE INDEX idx_message_rules_priority 
ON message_rules(tenant_id, priority DESC);

-- Index for rate limiting checks
CREATE INDEX idx_messages_outbound_tenant_time 
ON messages(tenant_id, direction, created_at) 
WHERE direction = 'outbound';

-- Index for conversation lookups
CREATE INDEX idx_conversations_tenant_phone 
ON conversations(tenant_id, phone_number);
```

**Query Optimization:**

```typescript
// Optimized: Fetch only necessary fields
const { data: rules } = await supabase
  .from('message_rules')
  .select('id, name, conditions, response_template, priority', {
    count: 'estimated', // Use estimated count for speed
  })
  .eq('tenant_id', tenantId)
  .eq('active', true)
  .order('priority', { ascending: false });
```

### 6.4 Monitoring and Logging

**Structured Logging:**

```typescript
// src/lib/message-rules.ts

function logRuleEvaluation(
  tenantId: string,
  messageId: string,
  matchingRules: MessageRule[],
  evaluationTimeMs: number
) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'info',
    service: 'rule-engine',
    tenantId,
    messageId,
    matchingRulesCount: matchingRules.length,
    matchingRuleIds: matchingRules.map(r => r.id),
    evaluationTimeMs,
  }));
}
```

**Metrics to Track:**
- Rule evaluation time (target: < 100ms)
- Matching rules per message (should be low)
- Failed rule executions
- Rate limit violations
- Z-API send failures

**Alerting Rules:**
- Evaluation time > 500ms
- More than 5 rules matching single message
- 3+ consecutive send failures
- Rate limit exceeded 5+ times/hour

### 6.5 Security Considerations

#### 1. RLS (Row-Level Security)

**Verify RLS is enabled:**
```sql
-- Check RLS is enabled on message_rules
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'message_rules';
-- Output should show rowsecurity = true
```

#### 2. Input Validation

**Always validate conditions:**
```typescript
export function validateRule(rule: any): { 
  valid: boolean; 
  errors: string[] 
} {
  const errors: string[] = [];

  // Validate each condition
  if (!Array.isArray(rule.conditions)) {
    errors.push('Conditions must be an array');
  }

  rule.conditions?.forEach((cond, idx) => {
    // Check regex patterns for ReDoS
    if (cond.type === 'regex') {
      try {
        new RegExp(cond.value, 'g');
      } catch {
        errors.push(`Condition ${idx}: Invalid regex pattern`);
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}
```

#### 3. ReDoS (Regular Expression Denial of Service) Prevention

**Dangerous patterns to block:**
```typescript
const DANGEROUS_PATTERNS = [
  /.*(.+)*$/, // Catastrophic backtracking
  /(a+)+$/,   // Exponential backtracking
  /^(a|a)*$/, // Alternation with overlap
];

function isSafeRegex(pattern: string): boolean {
  try {
    // Try with timeout (simulated)
    const testString = 'a'.repeat(100);
    const start = Date.now();
    new RegExp(pattern).test(testString);
    const elapsed = Date.now() - start;

    // Flag patterns that take > 10ms on small string
    return elapsed < 10;
  } catch {
    return false;
  }
}
```

#### 4. Template Injection Prevention

**Safe template substitution:**
```typescript
function prepareResponseTemplate(
  template: string,
  message: Message,
  conversation: Conversation
): string {
  // Whitelist of allowed variables
  const SAFE_VARIABLES = [
    'name', 'sender', 'phone', 'senderPhone',
    'content', 'messageType', 'date', 'time',
    'conversationId', 'timestamp'
  ];

  let response = template;

  // Only substitute whitelisted variables
  Object.entries(getVariables(message, conversation))
    .filter(([key]) => SAFE_VARIABLES.includes(key))
    .forEach(([key, value]) => {
      const placeholder = new RegExp(`{${key}}`, 'g');
      // Safely escape value to prevent injection
      response = response.replace(placeholder, sanitizeValue(value));
    });

  return response;
}

function sanitizeValue(value: any): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
```

### 6.6 Migration and Deployment Checklist

- [ ] **Database**
  - [ ] Run migrations: `TASK_1_2_RLS_MIGRATIONS.sql`
  - [ ] Create indexes from "Database Optimization" section
  - [ ] Verify RLS policies are in place
  - [ ] Test backup/recovery procedures

- [ ] **Configuration**
  - [ ] Set all environment variables (Z-API credentials)
  - [ ] Configure webhook URL in Z-API dashboard
  - [ ] Set rate limits per plan
  - [ ] Configure monitoring/alerting

- [ ] **Testing**
  - [ ] Unit test rule evaluation
  - [ ] Integration test webhook -> rule -> response
  - [ ] Load test with concurrent messages
  - [ ] Test rate limiting
  - [ ] Test edge cases (special characters, long messages, etc.)

- [ ] **Monitoring**
  - [ ] Enable structured logging
  - [ ] Set up error alerts
  - [ ] Monitor rule evaluation time
  - [ ] Track Z-API send failures

- [ ] **Documentation**
  - [ ] Document tenant-specific limits
  - [ ] Create rule templates for common use cases
  - [ ] Write runbooks for troubleshooting
  - [ ] Document rate limit reset procedures

- [ ] **Rollout**
  - [ ] Start with small tenant cohort
  - [ ] Monitor metrics closely
  - [ ] Gradually increase traffic
  - [ ] Have rollback plan ready

---

## Appendix: Common Rule Templates

### Template 1: Support Hours Response

```sql
INSERT INTO message_rules (
  tenant_id,
  name,
  conditions,
  response_template,
  priority,
  active
) VALUES (
  'TENANT_ID',
  'Support Hours - Weekday',
  '[
    {
      "type": "contains",
      "field": "content",
      "value": "atendimento",
      "caseSensitive": false
    }
  ]'::jsonb,
  'Funcionamos segunda a sexta, 9h às 18h. Feriados não atendemos. Retornaremos em breve!',
  10,
  true
);
```

### Template 2: FAQ Matcher

```sql
INSERT INTO message_rules (
  tenant_id,
  name,
  conditions,
  response_template,
  priority,
  active
) VALUES (
  'TENANT_ID',
  'FAQ - Shipping Time',
  '[
    {
      "type": "regex",
      "field": "content",
      "value": "(entrega|envio|prazo|quando.*chega)",
      "caseSensitive": false
    }
  ]'::jsonb,
  'O prazo de entrega é de 5 a 7 dias úteis para São Paulo. Você receberá um código de rastreamento por email.',
  15,
  true
);
```

### Template 3: Lead Qualification

```sql
INSERT INTO message_rules (
  tenant_id,
  name,
  conditions,
  response_template,
  priority,
  active
) VALUES (
  'TENANT_ID',
  'Qualify - Show Price',
  '[
    {
      "type": "contains",
      "field": "content",
      "value": "preço",
      "caseSensitive": false
    },
    {
      "type": "contains",
      "field": "content",
      "value": "quanto",
      "caseSensitive": false
    }
  ]'::jsonb,
  'Ótima pergunta, {name}! Nossos produtos variam de R$ 50 a R$ 500. Qual categoria te interessa?',
  20,
  true
);
```

---

## References

- **Z-API Documentation:** https://z-api.io/docs
- **Message Rules Source:** `src/lib/message-rules.ts`
- **Processor Source:** `src/lib/z-api-processor.ts`
- **Webhook Types:** `src/types/z-api.ts`
- **Database Migrations:** `docs/TASK_1_2_RLS_MIGRATIONS.sql`
- **Webhook Setup:** `docs/TASK_1_3_WEBHOOKS_SETUP.md`
