# Webhook Integration Examples

Practical examples for using the multi-tenant webhook integration system.

## Example 1: Checking System Readiness

Before deploying the company-based isolation system, verify readiness:

```typescript
import {
  verifyBackwardsCompatibility,
  isSystemReadyForCompanyIsolation,
} from '@/lib/webhook-integration';

// Run during startup or in a health check endpoint
export async function checkWebhookSystemHealth() {
  const compat = await verifyBackwardsCompatibility();

  console.log('Webhook System Status:', {
    compatible: compat.compatible,
    hasCompanyIdColumn: compat.hasCompanyIdColumn,
    populationStatus: compat.populationStatus,
  });

  // Show recommendations
  if (compat.recommendations.length > 0) {
    console.warn('Recommendations:');
    compat.recommendations.forEach((rec) => console.warn(`  - ${rec}`));
  }

  // Check if fully ready
  const isReady = await isSystemReadyForCompanyIsolation();
  console.log('System ready for company-based isolation:', isReady);

  return {
    healthy: compat.compatible,
    recommendations: compat.recommendations,
    ready: isReady,
  };
}

// Usage: call at app startup
if (process.env.NODE_ENV === 'production') {
  checkWebhookSystemHealth().catch(console.error);
}
```

## Example 2: Running the Migration

Migrate all instances to use company_id:

```typescript
import { migrateInstancesWithCompanyId } from '@/lib/webhook-integration';

export async function runWebhookMigration() {
  console.log('Starting webhook integration migration...');

  const result = await migrateInstancesWithCompanyId();

  console.log('Migration Results:', {
    success: result.success,
    updated: result.updated,
    skipped: result.skipped,
    failed: result.failed,
  });

  // Show any errors
  if (result.errors.length > 0) {
    console.error('Migration Errors:');
    result.errors.forEach((err) => console.error(`  - ${err}`));

    // Partial success is acceptable - can retry failed instances
    if (result.updated > 0) {
      console.log(`Partial success: ${result.updated} instances updated`);
    }
  }

  return result;
}

// Usage: run via CLI or migration endpoint
// POST /api/admin/migrations/webhook-integration
// export async function migrateWebhookIntegration(req: NextRequest) {
//   const result = await runWebhookMigration();
//   return NextResponse.json(result);
// }
```

## Example 3: Context Resolution in Webhook Handler

Show how context is resolved in the actual webhook handler:

```typescript
import { resolveWebhookContext } from '@/lib/webhook-integration';
import { processZApiWebhook } from '@/lib/z-api-processor';

export async function handleZApiWebhook(
  event: WebhookEvent,
  tenantId: string,
  instanceId?: string
) {
  // Step 1: Resolve context
  const context = await resolveWebhookContext(tenantId, instanceId);

  console.log('Webhook Context Resolution:', {
    tenantId,
    instanceId,
    resolved: context.resolved,
    companyId: context.companyId,
    usesCompanyId: context.usesCompanyId,
    error: context.error,
  });

  // Step 2: Show isolation type being used
  if (context.usesCompanyId && context.companyId) {
    console.log(`Using company-based isolation (company_id=${context.companyId})`);
  } else {
    console.log(`Using tenant-based isolation (tenant_id=${tenantId})`);
    if (context.error) {
      console.warn(`Resolution failed: ${context.error}`);
    }
  }

  // Step 3: Process webhook with company context
  const result = await processZApiWebhook(
    event,
    tenantId,
    context.companyId  // Pass company_id if resolved
  );

  return result;
}
```

## Example 4: Debugging a Specific Tenant

When debugging webhook issues for a specific tenant:

```typescript
import {
  resolveWebhookContext,
  validateWebhookOrigin,
  getEffectiveIsolationId,
} from '@/lib/webhook-integration';

export async function debugWebhookForTenant(tenantId: string) {
  console.log(`Debugging webhook for tenant: ${tenantId}`);

  // Step 1: Validate origin
  const validation = await validateWebhookOrigin(tenantId);
  console.log('Step 1 - Validation:', {
    valid: validation.valid,
    tenantExists: validation.tenantExists,
    error: validation.error,
  });

  if (!validation.valid) {
    console.error('Webhook origin validation failed');
    return;
  }

  // Step 2: Resolve context
  const context = await resolveWebhookContext(tenantId);
  console.log('Step 2 - Context Resolution:', {
    resolved: context.resolved,
    companyId: context.companyId,
    instanceId: context.instanceId,
    error: context.error,
  });

  // Step 3: Get effective isolation
  const isolation = getEffectiveIsolationId(context);
  console.log('Step 3 - Isolation Details:', {
    type: isolation.type,
    id: isolation.id,
    reason: isolation.reason,
  });

  return {
    validation,
    context,
    isolation,
  };
}

// Usage: POST /api/debug/webhook-tenant?tenantId=xxx
```

## Example 5: Webhook Logging and Auditing

Automatic logging of webhook processing:

```typescript
import { logWebhookProcessing } from '@/lib/webhook-integration';

export async function processWebhookWithLogging(
  event: WebhookEvent,
  tenantId: string,
  companyId?: string
) {
  // Log receipt
  await logWebhookProcessing(tenantId, companyId, event.type, 'received', {
    eventId: event.id,
    timestamp: new Date().toISOString(),
  });

  try {
    // Process webhook
    const result = await processZApiWebhook(event, tenantId, companyId);

    // Log success
    if (result.success) {
      await logWebhookProcessing(tenantId, companyId, event.type, 'success', {
        data: result.data,
      });
    } else {
      // Log failure
      await logWebhookProcessing(tenantId, companyId, event.type, 'failed', {
        error: result.error,
      });
    }

    return result;
  } catch (error) {
    // Log processing error
    await logWebhookProcessing(tenantId, companyId, event.type, 'failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    throw error;
  }
}
```

## Example 6: Gradual Rollout Strategy

Deploy company-based isolation gradually:

```typescript
export async function getWebhookProcessingStrategy(
  tenantId: string
): Promise<'tenant_id' | 'company_id'> {
  // Strategy: gradually roll out company_id usage
  // based on tenant characteristics or gradual percentage

  // Option 1: Feature flag
  const useCompanyId = await getFeatureFlag('webhook-company-isolation');
  if (!useCompanyId) return 'tenant_id';

  // Option 2: Gradual rollout by tenant hash
  const hash = tenantId.charCodeAt(0) % 100;
  const rolloutPercentage = 50; // 50% of tenants
  if (hash >= rolloutPercentage) return 'tenant_id';

  // Option 3: Check system readiness
  const context = await resolveWebhookContext(tenantId);
  if (context.companyId && context.resolved) {
    return 'company_id';
  }

  // Fallback to tenant_id
  return 'tenant_id';
}

// Usage in webhook handler:
const strategy = await getWebhookProcessingStrategy(tenantId);
const context = await resolveWebhookContext(tenantId);

const result = await processZApiWebhook(
  event,
  tenantId,
  strategy === 'company_id' ? context.companyId : undefined
);
```

## Example 7: Recovery and Retry Logic

Handle failures gracefully:

```typescript
import { resolveWebhookContext } from '@/lib/webhook-integration';

export async function processWebhookWithRetry(
  event: WebhookEvent,
  tenantId: string,
  maxRetries: number = 3
) {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Resolve context (may fail on transient database issues)
      const context = await resolveWebhookContext(tenantId);

      // Process webhook
      const result = await processZApiWebhook(
        event,
        tenantId,
        context.companyId
      );

      if (result.success) {
        console.log(
          `[Attempt ${attempt}] Webhook processed successfully`,
          result
        );
        return result;
      }

      // Non-transient failure
      console.error(
        `[Attempt ${attempt}] Processing error: ${result.error}`
      );
      throw new Error(result.error || 'Unknown processing error');
    } catch (error) {
      lastError = error as Error;

      // Transient errors: retry with backoff
      if (attempt < maxRetries) {
        const delayMs = Math.pow(2, attempt - 1) * 1000;
        console.warn(
          `[Attempt ${attempt}] Error: ${lastError.message}. Retrying in ${delayMs}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
    }
  }

  // All retries exhausted
  console.error(
    `[Failed] Webhook processing failed after ${maxRetries} attempts:`,
    lastError
  );
  throw lastError;
}
```

## Example 8: Monitoring and Metrics

Track webhook processing metrics:

```typescript
export class WebhookMetrics {
  private processed = 0;
  private successful = 0;
  private failed = 0;
  private avgResolutionTimeMs = 0;
  private resolvedWithCompanyId = 0;
  private resolvedWithTenantId = 0;

  async processWebhookWithMetrics(
    event: WebhookEvent,
    tenantId: string
  ) {
    const startTime = Date.now();

    try {
      // Resolve context and track resolution time
      const resolutionStart = Date.now();
      const context = await resolveWebhookContext(tenantId);
      const resolutionTimeMs = Date.now() - resolutionStart;

      // Track resolution method
      if (context.usesCompanyId && context.companyId) {
        this.resolvedWithCompanyId++;
      } else {
        this.resolvedWithTenantId++;
      }

      // Process webhook
      const result = await processZApiWebhook(
        event,
        tenantId,
        context.companyId
      );

      // Track results
      this.processed++;
      if (result.success) {
        this.successful++;
      } else {
        this.failed++;
      }

      // Update average resolution time
      this.avgResolutionTimeMs =
        (this.avgResolutionTimeMs * (this.processed - 1) +
          resolutionTimeMs) /
        this.processed;

      return {
        result,
        metrics: {
          resolutionTimeMs,
          totalTimeMs: Date.now() - startTime,
        },
      };
    } catch (error) {
      this.processed++;
      this.failed++;
      throw error;
    }
  }

  getMetrics() {
    const successRate =
      this.processed > 0
        ? ((this.successful / this.processed) * 100).toFixed(2)
        : '0';

    return {
      processed: this.processed,
      successful: this.successful,
      failed: this.failed,
      successRate: `${successRate}%`,
      avgResolutionTimeMs: this.avgResolutionTimeMs.toFixed(2),
      resolvedWithCompanyId: this.resolvedWithCompanyId,
      resolvedWithTenantId: this.resolvedWithTenantId,
      companyIdAdoptionRate: this.processed > 0
        ? `${((this.resolvedWithCompanyId / this.processed) * 100).toFixed(2)}%`
        : '0%',
    };
  }
}

// Usage:
const metrics = new WebhookMetrics();

// Process webhooks with metrics
const { result, metrics: timing } = await metrics.processWebhookWithMetrics(
  event,
  tenantId
);

// Log metrics periodically
setInterval(() => {
  console.log('Webhook Metrics:', metrics.getMetrics());
}, 60000); // Every 60 seconds
```

## Example 9: Testing and Validation

Unit tests for webhook integration:

```typescript
import { describe, it, expect } from 'vitest';

describe('Webhook Integration', () => {
  it('should resolve company_id from tenant_id', async () => {
    const context = await resolveWebhookContext('test-tenant-id');
    expect(context.resolved).toBe(true);
    expect(context.companyId).toBeDefined();
    expect(context.usesCompanyId).toBe(true);
  });

  it('should fallback to tenant_id when company_id not available', async () => {
    const context = await resolveWebhookContext('unknown-tenant-id');
    expect(context.resolved).toBe(false);
    expect(context.backwardsCompatible).toBe(true);
    expect(context.usesCompanyId).toBe(false);
  });

  it('should validate webhook origin correctly', async () => {
    const validation = await validateWebhookOrigin('valid-tenant-id');
    expect(validation.valid).toBe(true);
    expect(validation.tenantExists).toBe(true);
  });

  it('should reject invalid webhook origin', async () => {
    const validation = await validateWebhookOrigin('invalid-tenant-id');
    expect(validation.valid).toBe(false);
    expect(validation.tenantExists).toBe(false);
  });

  it('should maintain backwards compatibility', async () => {
    const compat = await verifyBackwardsCompatibility();
    expect(compat.compatible).toBe(true);
    expect(compat.backwardsCompatible).toBe(true);
  });
});
```

## Example 10: Production Deployment Checklist

Before deploying to production:

```typescript
export async function validateProductionReadiness(): Promise<{
  ready: boolean;
  issues: string[];
}> {
  const issues: string[] = [];

  // 1. Check schema
  const compat = await verifyBackwardsCompatibility();
  if (!compat.hasCompanyIdColumn) {
    issues.push('z_api_instances.company_id column is missing');
  }

  // 2. Check data population
  if (compat.populationStatus !== 'full') {
    issues.push(
      `Not all instances have company_id: ${compat.populationStatus} population`
    );
  }

  // 3. Check system readiness
  const isReady = await isSystemReadyForCompanyIsolation();
  if (!isReady) {
    issues.push('System not ready for company-based isolation');
  }

  // 4. Check indexes
  // Verify required indexes exist (this would require raw SQL query)

  // 5. Check backwards compatibility
  if (!compat.compatible) {
    issues.push('Backwards compatibility check failed');
  }

  return {
    ready: issues.length === 0,
    issues,
  };
}

// Run before deployment
const readiness = await validateProductionReadiness();
if (!readiness.ready) {
  console.error('Production validation failed:');
  readiness.issues.forEach((issue) => console.error(`  ✗ ${issue}`));
  process.exit(1);
} else {
  console.log('✓ All production checks passed');
}
```
