# Webhook Integration Guide

Multi-tenant webhook system with company-based isolation. Bridges existing tenant_id webhooks with company_id database operations.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│ Webhook Arrives (POST /api/webhooks/z-api)                  │
│ Contains: tenantId, (optional) instanceId                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. Validate Origin (validateWebhookOrigin)                  │
│    - Verify tenant exists                                    │
│    - Verify instance belongs to tenant                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Resolve Context (resolveWebhookContext)                  │
│    - Query z_api_instances table                            │
│    - Extract company_id if available                        │
│    - Return resolution context                              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Process Webhook (processZApiWebhook)                     │
│    - Use company_id for RLS isolation (preferred)           │
│    - Fallback to tenant_id for backwards compatibility      │
│    - Route to appropriate event handler                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Log Processing (logWebhookProcessing)                    │
│    - Record status for auditing and debugging               │
└─────────────────────────────────────────────────────────────┘
```

## Usage

### In Webhook Handler

```typescript
import {
  resolveWebhookContext,
  validateWebhookOrigin,
  logWebhookProcessing,
} from '@/lib/webhook-integration';
import { processZApiWebhook } from '@/lib/z-api-processor';

// In your webhook endpoint
const context = await resolveWebhookContext(tenantId, instanceId);

// Process with company context
const result = await processZApiWebhook(
  validatedEvent,
  tenantId,
  context.companyId  // Pass company_id if resolved
);
```

### Migration Functions

#### Check System Readiness

```typescript
import { verifyBackwardsCompatibility } from '@/lib/webhook-integration';

// Check if system is ready for company-based isolation
const compat = await verifyBackwardsCompatibility();

console.log(compat);
// {
//   compatible: true,
//   hasCompanyIdColumn: true,
//   hasInstances: true,
//   populationStatus: 'partial',  // 'full' | 'partial' | 'none'
//   recommendations: [
//     'Only 45/100 instances have company_id populated. Complete migration.'
//   ]
// }
```

#### Populate Company IDs

```typescript
import { migrateInstancesWithCompanyId } from '@/lib/webhook-integration';

// Run migration to populate company_id in z_api_instances
const result = await migrateInstancesWithCompanyId();

console.log(result);
// {
//   success: true,
//   updated: 45,
//   skipped: 0,
//   failed: 0,
//   errors: []
// }
```

#### Check Isolation Mode

```typescript
import {
  getEffectiveIsolationId,
  resolveWebhookContext,
} from '@/lib/webhook-integration';

const context = await resolveWebhookContext(tenantId);
const isolation = getEffectiveIsolationId(context);

console.log(isolation);
// {
//   id: 'some-company-uuid',
//   type: 'company_id',
//   reason: 'company_id fully resolved from z_api_instances'
// }
```

#### Validate Webhook Origin

```typescript
import { validateWebhookOrigin } from '@/lib/webhook-integration';

const validation = await validateWebhookOrigin(tenantId, instanceId);

if (!validation.valid) {
  console.error('Invalid webhook origin:', validation.error);
}
```

## Migration Path

### Phase 1: Schema Setup (Non-Breaking)

1. Add `company_id` column to `z_api_instances` table
2. Add `company_id` column to `conversations` table (optional, for audit trail)
3. Create indexes for performance

**Status**: No data changes, zero downtime

### Phase 2: Data Population

Run migration helper to populate `company_id`:

```typescript
const result = await migrateInstancesWithCompanyId();
if (result.success) {
  console.log(`Successfully migrated ${result.updated} instances`);
} else {
  console.error('Migration failed:', result.errors);
}
```

**Status**: Backwards compatible, can rollback by clearing `company_id` values

### Phase 3: Usage Transition

Webhooks automatically start using `company_id` once available:

1. Existing webhooks continue working (fallback to `tenant_id`)
2. New webhooks automatically resolve and use `company_id`
3. No code changes required in webhook payloads

**Status**: Fully backwards compatible

### Phase 4: Cleanup (Optional)

Once all instances have `company_id`:

```typescript
const isReady = await isSystemReadyForCompanyIsolation();
// Make company_id NOT NULL in z_api_instances table
```

## Backwards Compatibility

The system maintains full backwards compatibility:

```
┌─────────────────────────────────────────┐
│ System Readiness Levels                 │
├─────────────────────────────────────────┤
│ Level 0: No company_id column           │
│ └─ Uses: tenant_id (100%)               │
│                                         │
│ Level 1: Column exists, no data         │
│ └─ Uses: tenant_id (100%)               │
│                                         │
│ Level 2: Column exists, partial data    │
│ └─ Uses: company_id if available        │
│        tenant_id as fallback            │
│                                         │
│ Level 3: Column exists, all data        │
│ └─ Uses: company_id (100%)              │
│        Can drop tenant_id checks        │
└─────────────────────────────────────────┘
```

### Handling Mixed Scenarios

During transition, webhooks may have:

1. **Full Resolution**: `company_id` available
   - Uses `company_id` for all RLS operations
   - Optimal isolation and performance

2. **Partial Resolution**: `tenant_id` available only
   - Fallback to `tenant_id` for RLS
   - Functionally identical results
   - Handles legacy webhooks

3. **Validation Failure**: Missing or invalid identifiers
   - Request rejected with clear error
   - No data operation attempted

## RLS Query Patterns

### Original Pattern (tenant_id)

```typescript
const { data } = await supabase
  .from('conversations')
  .select('*')
  .eq('tenant_id', tenantId);
```

### New Pattern (company_id preferred)

```typescript
const { data } = await supabase
  .from('conversations')
  .select('*')
  .eq(companyId ? 'company_id' : 'tenant_id', companyId || tenantId);
```

### In z-api-processor.ts

The processor automatically selects the correct column:

```typescript
let query = supabase
  .from('conversations')
  .select('id');

if (companyId) {
  query = query.eq('company_id', companyId);
} else {
  query = query.eq('tenant_id', tenantId);
}
```

## Debugging

### Check Resolution Status

```typescript
const context = await resolveWebhookContext(tenantId);
console.log('Resolution:', {
  resolved: context.resolved,
  usesCompanyId: context.usesCompanyId,
  backwardsCompatible: context.backwardsCompatible,
  error: context.error,
});
```

### Verify Compatibility

```typescript
const compat = await verifyBackwardsCompatibility();
console.log('Recommendations:', compat.recommendations);
```

### Webhook Logs

Webhook processing is logged with full context:

```typescript
// Automatic logging includes:
// - tenantId
// - companyId (if resolved)
// - eventType
// - status (received|processing|success|failed)
// - details (errors, resolution info)
```

Check `/tmp/iaezap-webhook.log` for detailed processing logs.

## Database Schema Requirements

### z_api_instances Table

```sql
CREATE TABLE z_api_instances (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  company_id UUID REFERENCES companies(id),  -- NEW COLUMN
  -- ... other columns
  
  -- Optional: unique constraint
  UNIQUE(company_id, id)
);

CREATE INDEX idx_z_api_instances_company_id ON z_api_instances(company_id);
```

### conversations Table (Optional)

For audit trail and easier debugging:

```sql
ALTER TABLE conversations ADD COLUMN company_id UUID;
-- Reference conversations table's RLS to use company_id when available
```

## Error Handling

The system is designed to never fail webhooks:

```
┌──────────────────────────┐
│ Webhook Arrives          │
└────────────┬─────────────┘
             │
    ┌────────▼────────┐
    │ Context         │
    │ Resolution      │
    └────────┬────────┘
             │
      ┌──────▴──────┐
      │             │
   Success      Not Found
      │             │
      ▼             ▼
  Use company_id  Use tenant_id
  + Log success   + Log fallback
      │             │
      └─────┬───────┘
            │
            ▼
    ┌──────────────────┐
    │ Process Webhook  │
    │ (same logic)     │
    └──────────────────┘
```

**Key Principle**: System always processes webhooks, falling back gracefully when company_id unavailable.

## Performance Considerations

### Index Strategy

```sql
-- Required indexes for webhook processing
CREATE INDEX idx_z_api_instances_tenant_id ON z_api_instances(tenant_id);
CREATE INDEX idx_z_api_instances_company_id ON z_api_instances(company_id);
CREATE INDEX idx_z_api_instances_tenant_company ON z_api_instances(tenant_id, company_id);

-- For conversations queries
CREATE INDEX idx_conversations_company_phone ON conversations(company_id, phone_number);
CREATE INDEX idx_conversations_tenant_phone ON conversations(tenant_id, phone_number);
```

### Resolution Caching (Optional)

For high-volume systems, consider caching resolution:

```typescript
const cache = new Map<string, WebhookTenantResolution>();

async function cachedResolveContext(tenantId: string) {
  if (cache.has(tenantId)) {
    return cache.get(tenantId)!;
  }

  const context = await resolveWebhookContext(tenantId);
  cache.set(tenantId, context);
  return context;
}
```

## Troubleshooting

### Issue: webhooks always using tenant_id

**Cause**: company_id not populated in z_api_instances

**Solution**:
```typescript
const compat = await verifyBackwardsCompatibility();
console.log(compat.populationStatus);  // Check: should be 'full'

// If not, run:
await migrateInstancesWithCompanyId();
```

### Issue: company_id resolution failing

**Cause**: Instance missing from z_api_instances or has no company mapping

**Solution**:
```typescript
const context = await resolveWebhookContext(tenantId);
console.log(context.error);  // Check error message

// Verify company_tenants mapping exists:
// SELECT * FROM company_tenants WHERE tenant_id = ?
```

### Issue: inconsistent isolation between webhooks

**Cause**: Mixed company_id and tenant_id usage

**Solution**: Ensure all instances are migrated:
```typescript
const result = await migrateInstancesWithCompanyId();
console.log(`Updated: ${result.updated}, Failed: ${result.failed}`);
```

## API Reference

### resolveWebhookContext(tenantId, instanceId?)

Resolves tenant_id to company_id via z_api_instances lookup.

**Returns**: `WebhookTenantResolution`
- `tenantId`: Original tenant ID
- `companyId?`: Resolved company ID
- `instanceId?`: Z-API instance ID
- `resolved`: Whether company_id was found
- `usesCompanyId`: Whether company_id should be used
- `backwardsCompatible`: Whether tenant_id can be used as fallback
- `error?`: Error message if resolution failed

### verifyBackwardsCompatibility()

Checks system readiness for company-based isolation.

**Returns**: Compatibility status object with recommendations

### migrateInstancesWithCompanyId()

Populates company_id in z_api_instances from company_tenants table.

**Returns**: Migration result with statistics

### validateWebhookOrigin(tenantId, instanceId?)

Validates webhook originates from authorized source.

**Returns**: Validation result

### getEffectiveIsolationId(context, preferCompanyId?)

Gets the actual isolation ID to use (company_id or tenant_id).

**Returns**: Object with `id`, `type`, and `reason`

### isSystemReadyForCompanyIsolation()

Checks if system is fully ready for company-based isolation.

**Returns**: Boolean

### logWebhookProcessing(tenantId, companyId, eventType, status, details?)

Logs webhook processing for auditing.

**Returns**: Promise<void>
