import { NextRequest, NextResponse } from 'next/server';
import { validateWebhookEvent, type WebhookEvent } from '@/types/z-api';
import { processZApiWebhook } from '@/lib/z-api-processor';

/**
 * POST /api/webhooks/z-api/receive
 *
 * Simple webhook endpoint that accepts Z-API webhooks
 * without requiring dynamic route parameters
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const timestamp = new Date().toISOString();

  try {
    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { value: false },
        { status: 400 }
      );
    }

    console.log('[Webhook Receive] Request body:', JSON.stringify(body).substring(0, 500));

    // Extract event from body
    let event = (body as any)?.event || body;

    // Map Z-API payload to our schema
    // Z-API sends raw webhook data, not wrapped in {event}
    // Determine type based on status field
    const payload = event as any;

    if (payload.status === 'RECEIVED' && !payload.type) {
      // This is a received message event from Z-API
      event = {
        type: 'receive',
        timestamp: payload.momment || Date.now(),
        messageId: payload.messageId,
        senderPhone: payload.phone,
        senderName: payload.senderName,
        messageType: 'text', // Default to text, can be enhanced
        text: payload.text || payload.body || '',
        phone: payload.connectedPhone,
        id: payload.instanceId,
      };
    }

    // Validate webhook event payload
    const eventValidation = validateWebhookEvent(event);
    if (!eventValidation.success) {
      console.log('[Webhook Receive] Validation failed:', eventValidation.error.flatten().fieldErrors);
      return NextResponse.json(
        { value: false },
        { status: 400 }
      );
    }

    const validatedEvent: WebhookEvent = eventValidation.data;

    console.log('[Webhook Receive] Event validated:', {
      eventType: validatedEvent.type,
      timestamp,
    });

    // Use default tenant for now - webhook should identify which tenant later
    const tenantId = '6e18da71-4ca4-41f7-90c6-318d79f6637b';

    // Process webhook asynchronously
    processZApiWebhook(validatedEvent, tenantId)
      .then(result => console.log('[Webhook Processed Successfully]', result))
      .catch(err => console.error('[Webhook Processing Error]', err));

    // Return Z-API expected format
    return NextResponse.json(
      { value: true },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Webhook Error]', error);
    return NextResponse.json(
      { value: false },
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
