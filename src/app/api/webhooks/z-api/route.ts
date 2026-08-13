import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateWebhookEvent, type WebhookEvent } from '@/types/z-api';
import { processZApiWebhook } from '@/lib/z-api-processor';
import {
  resolveWebhookContext,
  validateWebhookOrigin,
  logWebhookProcessing,
} from '@/lib/webhook-integration';

/**
 * Z-API Webhook Request validation schema
 * Validates the webhook payload with optional tenant and instance identifiers
 */
const webhookRequestSchema = z.object({
  event: z.unknown().describe('The webhook event payload'),
  tenantId: z.string().uuid('Invalid tenant ID format').optional(),
  instanceId: z.string().uuid('Invalid instance ID format').optional(),
});

type WebhookRequest = z.infer<typeof webhookRequestSchema>;

/**
 * Webhook response schema for success
 */
const webhookResponseSchema = z.object({
  success: z.literal(true),
  message: z.string().optional(),
  timestamp: z.string().datetime('Invalid datetime format'),
  eventId: z.string().optional(),
});

type WebhookResponse = z.infer<typeof webhookResponseSchema>;

/**
 * Webhook response schema for errors
 */
const webhookErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
  timestamp: z.string().datetime('Invalid datetime format'),
});

type WebhookError = z.infer<typeof webhookErrorSchema>;

/**
 * Extract instanceId and tenantId from request
 * Checks query parameters, headers, and request body
 */
async function extractIdentifiers(
  request: NextRequest
): Promise<{ instanceId?: string; tenantId?: string } | null> {
  try {
    // Try to extract from query parameters
    const searchParams = request.nextUrl.searchParams;
    const instanceIdFromQuery = searchParams.get('instanceId') || undefined;
    const tenantIdFromQuery = searchParams.get('tenantId') || undefined;

    if (instanceIdFromQuery || tenantIdFromQuery) {
      return {
        instanceId: instanceIdFromQuery,
        tenantId: tenantIdFromQuery,
      };
    }

    // Try to extract from headers
    const instanceIdFromHeader = request.headers.get('x-instance-id') || undefined;
    const tenantIdFromHeader = request.headers.get('x-tenant-id') || undefined;

    if (instanceIdFromHeader || tenantIdFromHeader) {
      return {
        instanceId: instanceIdFromHeader || undefined,
        tenantId: tenantIdFromHeader || undefined,
      };
    }

    // Try to extract from request body
    const contentType = request.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      const body = await request.clone().json();
      if (
        (typeof body === 'object' && body !== null && 'instanceId' in body) ||
        'tenantId' in body
      ) {
        return {
          instanceId: (body as Record<string, unknown>).instanceId as string | undefined,
          tenantId: (body as Record<string, unknown>).tenantId as string | undefined,
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Error extracting identifiers:', error);
    return null;
  }
}

/**
 * Validate tenant and instance ownership
 * In a production environment, verify against database
 *
 * For now, this performs basic validation that IDs are UUIDs
 * In production, you would:
 * 1. Check if tenant exists
 * 2. Check if instance belongs to tenant
 * 3. Verify webhook signature if applicable
 */
async function validateOwnership(
  tenantId: string | undefined,
  instanceId: string | undefined
): Promise<{ valid: boolean; error?: string }> {
  // At minimum, require either tenantId or instanceId
  if (!tenantId && !instanceId) {
    return {
      valid: false,
      error: 'Either tenantId or instanceId must be provided',
    };
  }

  // Validate UUID format if provided (accepts with or without hyphens)
  const uuidRegex = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

  if (tenantId && !uuidRegex.test(tenantId)) {
    return {
      valid: false,
      error: 'Invalid tenantId format (must be UUID)',
    };
  }

  if (instanceId && !uuidRegex.test(instanceId)) {
    return {
      valid: false,
      error: 'Invalid instanceId format (must be UUID)',
    };
  }

  // TODO: In production, verify against database
  // const tenant = await db.tenants.findById(tenantId);
  // if (!tenant) {
  //   return { valid: false, error: 'Tenant not found' };
  // }
  //
  // if (instanceId) {
  //   const instance = await db.instances.findById(instanceId);
  //   if (!instance || instance.tenantId !== tenantId) {
  //     return { valid: false, error: 'Instance does not belong to tenant' };
  //   }
  // }

  return { valid: true };
}

/**
 * POST /api/webhooks/z-api
 *
 * Receives and validates Z-API webhook events
 * Returns 200 immediately to prevent Z-API timeout
 * Do NOT process messages here, only validate
 *
 * Query Parameters:
 *   - instanceId: UUID of the instance (optional)
 *   - tenantId: UUID of the tenant (optional)
 *
 * Headers:
 *   - x-instance-id: Instance ID (optional)
 *   - x-tenant-id: Tenant ID (optional)
 *
 * Request Body:
 * {
 *   "event": { webhook event payload },
 *   "tenantId": "uuid", (optional)
 *   "instanceId": "uuid" (optional)
 * }
 *
 * Success Response (200):
 * {
 *   "success": true,
 *   "message": "Webhook received and validated",
 *   "timestamp": "2026-08-12T10:00:00.000Z",
 *   "eventId": "550e8400-e29b-41d4-a716-446655440000"
 * }
 *
 * Error Responses:
 * 400 - Invalid payload or validation error
 * 422 - Unprocessable entity (invalid owner verification)
 * 500 - Internal server error
 */
export async function POST(request: NextRequest): Promise<NextResponse<WebhookResponse | WebhookError>> {
  const timestamp = new Date().toISOString();

  try {
    // Extract tenant and instance IDs from request
    const identifiers = await extractIdentifiers(request);

    // Validate ownership early to fail fast
    if (!identifiers) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_IDENTIFIERS',
            message: 'Could not extract tenantId or instanceId from request',
            details: {
              hint: 'Provide via query params (?instanceId=...), headers (X-Instance-Id), or request body',
            },
          },
          timestamp,
        },
        { status: 422 }
      );
    }

    // Validate tenant and instance ownership
    const ownershipValidation = await validateOwnership(
      identifiers.tenantId,
      identifiers.instanceId
    );

    if (!ownershipValidation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_OWNERSHIP',
            message: ownershipValidation.error || 'Ownership validation failed',
          },
          timestamp,
        },
        { status: 422 }
      );
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_JSON',
            message: 'Request body must be valid JSON',
          },
          timestamp,
        },
        { status: 400 }
      );
    }

    // Validate request against schema
    const requestValidation = webhookRequestSchema.safeParse(body);

    if (!requestValidation.success) {
      const fieldErrors = requestValidation.error.flatten().fieldErrors;
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Request validation failed',
            details: fieldErrors as Record<string, unknown>,
          },
          timestamp,
        },
        { status: 400 }
      );
    }

    const { event } = requestValidation.data;

    // Validate webhook event payload
    const eventValidation = validateWebhookEvent(event);

    if (!eventValidation.success) {
      const eventErrors = eventValidation.error.flatten().fieldErrors;
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_WEBHOOK_EVENT',
            message: 'Webhook event validation failed',
            details: eventErrors as Record<string, unknown>,
          },
          timestamp,
        },
        { status: 400 }
      );
    }

    const validatedEvent: WebhookEvent = eventValidation.data;

    // Log successful validation (in production, queue for async processing)
    console.log('[Webhook Validated]', {
      eventId: validatedEvent.id,
      eventType: validatedEvent.type,
      tenantId: identifiers.tenantId,
      instanceId: identifiers.instanceId,
      timestamp,
    });

    // Process webhook asynchronously (fire-and-forget)
    if (identifiers.tenantId) {
      // Non-blocking async operations
      (async () => {
        try {
          // Validate webhook origin
          const originValidation = await validateWebhookOrigin(
            identifiers.tenantId!,
            identifiers.instanceId
          );

          if (!originValidation.valid) {
            console.warn('[Webhook Origin Validation Failed]', originValidation);
            await logWebhookProcessing(
              identifiers.tenantId!,
              undefined,
              validatedEvent.type,
              'failed',
              { reason: originValidation.error }
            );
            return;
          }

          // Resolve tenant to company context
          const context = await resolveWebhookContext(
            identifiers.tenantId!,
            identifiers.instanceId
          );

          // Log webhook reception
          await logWebhookProcessing(
            identifiers.tenantId!,
            context.companyId,
            validatedEvent.type,
            'received',
            { resolved: context.resolved, usesCompanyId: context.usesCompanyId }
          );

          // Process webhook with company context if available
          const result = await processZApiWebhook(
            validatedEvent,
            identifiers.tenantId!,
            context.companyId
          );

          // Log processing result
          await logWebhookProcessing(
            identifiers.tenantId!,
            context.companyId,
            validatedEvent.type,
            result.success ? 'success' : 'failed',
            result
          );

          console.log('[Webhook Processed Successfully]', {
            result,
            contextResolved: context.resolved,
            usesCompanyId: context.usesCompanyId,
          });
        } catch (err) {
          console.error('[Webhook Processing Error]', {
            error: err instanceof Error ? err.message : 'Unknown error',
            stack: err instanceof Error ? err.stack : undefined,
          });
          await logWebhookProcessing(
            identifiers.tenantId!,
            undefined,
            validatedEvent.type,
            'failed',
            { error: err instanceof Error ? err.message : 'Unknown error' }
          );
        }
      })();
    }

    // Return 200 immediately to prevent Z-API timeout
    // Message processing happens asynchronously in background
    return NextResponse.json(
      {
        success: true,
        message: 'Webhook received and validated',
        timestamp,
        eventId: validatedEvent.id,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Webhook Error]', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp,
    });

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred processing the webhook',
          details:
            process.env.NODE_ENV === 'development'
              ? {
                  errorType: error instanceof Error ? error.constructor.name : 'Unknown',
                  errorMessage: error instanceof Error ? error.message : 'Unknown error',
                }
              : undefined,
        },
        timestamp,
      },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS handler for CORS preflight requests
 */
export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  const headers = {
    'Access-Control-Allow-Origin': request.headers.get('origin') || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Instance-Id, X-Tenant-Id',
  };

  return NextResponse.json({}, { headers, status: 200 });
}
