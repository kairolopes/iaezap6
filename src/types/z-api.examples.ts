/**
 * Z-API Types and Validation - Usage Examples
 * This file demonstrates common usage patterns for Z-API webhook types
 */

import {
  webhookEventSchema,
  isDeliveryEvent,
  isReceiveEvent,
  isStatusEvent,
  isDisconnectedEvent,
  isTextReceiveEvent,
  isMediaReceiveEvent,
  isGroupMessage,
  getMessageContent,
  formatPhoneNumber,
  getPhoneFromEvent,
  getEventTimestamp,
  isCriticalEvent,
  validateWebhookEvent,
  type WebhookEvent,
  type ReceiveEvent,
  type DeliveryEvent,
} from './z-api';

// ============================================================================
// Example 1: Validating incoming webhook
// ============================================================================

export function handleWebhookReceived(payload: unknown) {
  const result = validateWebhookEvent(payload);

  if (!result.success) {
    console.error('Webhook validation failed:', result.error);
    return { success: false, errors: result.error.errors };
  }

  const event = result.data;
  console.log('Valid webhook event received:', event.type);

  return { success: true, event };
}

// ============================================================================
// Example 2: Type narrowing with discriminated unions
// ============================================================================

export function processWebhookEvent(event: WebhookEvent) {
  if (isDeliveryEvent(event)) {
    // Within this block, event is narrowed to DeliveryEvent type
    console.log(`Message ${event.messageId} delivered to ${event.recipient}`);
    handleDelivery(event);
  } else if (isReceiveEvent(event)) {
    // event is narrowed to ReceiveEvent type
    console.log(`New message from ${event.senderPhone}`);
    handleIncomingMessage(event);
  } else if (isStatusEvent(event)) {
    // event is narrowed to StatusEvent type
    console.log(`Message status changed to ${event.status}`);
    handleStatusChange(event);
  } else if (isDisconnectedEvent(event)) {
    // event is narrowed to DisconnectedEvent type
    console.log(`Connection lost: ${event.reason}`);
    handleDisconnection(event);
  }
}

// ============================================================================
// Example 3: Handling receive events with message type narrowing
// ============================================================================

export function handleIncomingMessage(event: ReceiveEvent) {
  const phone = getPhoneFromEvent(event);
  const timestamp = getEventTimestamp(event);

  // Check if this is a group message
  if (isGroupMessage(event)) {
    console.log(`Message from group ${event.groupName} (${event.groupId})`);
  }

  // Narrow message type
  if (isTextReceiveEvent(event)) {
    // event.text is guaranteed to exist here
    console.log(`Text message: ${event.text}`);
    handleTextMessage(event);
  } else if (isMediaReceiveEvent(event)) {
    // event.media is guaranteed to exist here
    console.log(`Media message: ${event.media.type} (${event.media.fileName})`);
    handleMediaMessage(event);
  } else if (event.messageType === 'location') {
    if (event.location) {
      console.log(`Location received: ${event.location.address}`);
    }
  }
}

// ============================================================================
// Example 4: Processing different message types
// ============================================================================

export function handleTextMessage(event: ReceiveEvent & { messageType: 'text' }) {
  const content = getMessageContent(event);
  const senderName = event.senderName || event.sender?.name || 'Unknown';

  // Process text message
  console.log(`[${senderName}]: ${content}`);
}

export function handleMediaMessage(event: ReceiveEvent) {
  if (!event.media) return;

  const { type, fileName, size, url } = event.media;
  console.log(`Media: ${type}`);
  console.log(`File: ${fileName}`);
  console.log(`Size: ${size} bytes`);
  console.log(`URL: ${url}`);

  // Download or process media
  downloadMedia(url, fileName);
}

// ============================================================================
// Example 5: Format phone numbers
// ============================================================================

export function formatContactPhone(event: WebhookEvent): string {
  const phone = getPhoneFromEvent(event);
  if (!phone) throw new Error('No phone number in event');

  // Format as international number (Brazil example)
  return formatPhoneNumber(phone, '55'); // +5511999999999
}

// ============================================================================
// Example 6: Handle critical events
// ============================================================================

export function monitorCriticalEvents(event: WebhookEvent) {
  if (isCriticalEvent(event)) {
    console.error('CRITICAL EVENT:', event.type, event);

    // Send alert to monitoring system
    sendAlert({
      severity: 'high',
      eventType: event.type,
      timestamp: getEventTimestamp(event),
      details: event,
    });
  }
}

// ============================================================================
// Example 7: API route handler (Next.js)
// ============================================================================

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate the webhook
    const validation = validateWebhookEvent(body);

    if (!validation.success) {
      console.error('Invalid webhook:', validation.error);
      return new Response(JSON.stringify({ error: 'Invalid webhook' }), {
        status: 400,
      });
    }

    const event = validation.data;

    // Process different event types
    switch (event.type) {
      case 'delivery':
        await processDeliveryEvent(event);
        break;
      case 'receive':
        await processReceiveEvent(event);
        break;
      case 'status':
        await processStatusEvent(event);
        break;
      case 'disconnected':
        await processDisconnectedEvent(event);
        break;
    }

    // Return 200 OK to confirm receipt
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
    });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
    });
  }
}

// ============================================================================
// Example 8: Database operations
// ============================================================================

export async function storeWebhookEvent(event: WebhookEvent) {
  const phone = getPhoneFromEvent(event);
  const timestamp = getEventTimestamp(event);

  // Store event in database for audit trail
  const record = {
    id: event.id,
    type: event.type,
    phone,
    timestamp,
    data: event,
    createdAt: new Date(),
  };

  // Save to database
  // await db.webhookEvents.create(record);
}

export async function trackMessageDelivery(event: DeliveryEvent) {
  // Update message status in database
  // await db.messages.update(
  //   { id: event.messageId },
  //   {
  //     status: event.status,
  //     deliveredAt: getEventTimestamp(event),
  //     retryCount: event.metadata?.retryCount || 0,
  //   }
  // );
}

// ============================================================================
// Stub implementations (replace with actual logic)
// ============================================================================

function handleDelivery(event: DeliveryEvent) {
  console.log('Processing delivery event');
}

async function processDeliveryEvent(event: DeliveryEvent) {
  console.log('Processing delivery event');
}

async function processReceiveEvent(event: ReceiveEvent) {
  console.log('Processing receive event');
}

async function processStatusEvent(event: any) {
  console.log('Processing status event');
}

async function processDisconnectedEvent(event: any) {
  console.log('Processing disconnected event');
}

function downloadMedia(url: string, fileName?: string) {
  console.log(`Downloading ${fileName} from ${url}`);
}

function sendAlert(alert: any) {
  console.log('Sending alert:', alert);
}
