import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateWebhookEvent, type WebhookEvent } from '@/types/z-api';
import { processZApiWebhook } from '@/lib/z-api-processor';
import { createSupabaseServerClient } from '@/lib/supabase';

/**
 * Z-API Webhook Request validation schema
 */
const webhookRequestSchema = z.object({
  event: z.unknown(),
});

/**
 * Lookup tenant by instance ID
 */
async function getTenantIdByInstanceId(instanceId: string): Promise<string | null> {
  console.log('[getTenantIdByInstanceId] Starting lookup for instanceId:', instanceId);

  try {
    const supabase = createSupabaseServerClient();
    console.log('[getTenantIdByInstanceId] Supabase client created');

    const { data, error } = await supabase
      .from('z_api_instances')
      .select('tenant_id')
      .eq('instance_id', instanceId)
      .single();

    console.log('[getTenantIdByInstanceId] Query result:', {
      hasData: !!data,
      hasError: !!error,
      error: error ? { code: error.code, message: error.message } : null,
      data: data,
    });

    if (error) {
      console.error('[getTenantIdByInstanceId] Database error:', error);
      return null;
    }

    if (!data) {
      console.error('[getTenantIdByInstanceId] No data returned for instanceId:', instanceId);
      return null;
    }

    console.log('[getTenantIdByInstanceId] Success - found tenantId:', data.tenant_id);
    return data.tenant_id;
  } catch (error) {
    console.error('[getTenantIdByInstanceId] Exception caught:', error);
    return null;
  }
}

/**
 * POST /api/webhooks/z-api/instances/{instanceId}/token/{token}
 *
 * Receives and validates Z-API webhook events
 * Automatically looks up tenant using instanceId
 *
 * Path Parameters:
 *   - instanceId: Z-API instance ID
 *   - token: Z-API instance token
 *
 * Request Body:
 * {
 *   "event": { webhook event payload }
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { instanceId: string; token: string } }
): Promise<NextResponse> {
  const timestamp = new Date().toISOString();

  console.log('[Webhook POST] Received request:', {
    instanceId: params.instanceId,
    token: params.token ? params.token.substring(0, 10) + '...' : 'MISSING',
    timestamp,
  });

  try {
    // Lookup tenant by instanceId
    console.log('[Webhook POST] Looking up tenant for instanceId:', params.instanceId);
    const tenantId = await getTenantIdByInstanceId(params.instanceId);

    if (!tenantId) {
      console.error('[Webhook POST] Tenant lookup failed for instanceId:', params.instanceId);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INSTANCE_NOT_FOUND',
            message: 'Instance not found or not configured',
          },
          timestamp,
        },
        { status: 404 }
      );
    }

    console.log('[Webhook POST] Tenant lookup successful:', tenantId);

    // Parse request body
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

    // Validate request schema
    const requestValidation = webhookRequestSchema.safeParse(body);
    if (!requestValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Request validation failed',
            details: requestValidation.error.flatten().fieldErrors,
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
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_WEBHOOK_EVENT',
            message: 'Webhook event validation failed',
            details: eventValidation.error.flatten().fieldErrors,
          },
          timestamp,
        },
        { status: 400 }
      );
    }

    const validatedEvent: WebhookEvent = eventValidation.data;

    console.log('[Webhook Validated]', {
      eventId: validatedEvent.id,
      eventType: validatedEvent.type,
      instanceId: params.instanceId,
      tenantId,
      timestamp,
    });

    // Process webhook asynchronously
    processZApiWebhook(validatedEvent, tenantId)
      .then(result => console.log('[Webhook Processed Successfully]', result))
      .catch(err => console.error('[Webhook Processing Error]', err));

    // Return 200 with Z-API expected format
    return NextResponse.json(
      { value: true },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Webhook Error]', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred processing the webhook',
        },
        timestamp,
      },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
    status: 200,
  });
}
