import { z } from 'zod';

/**
 * Z-API Webhook Event Types and Validation Schemas
 * Comprehensive types for all Z-API webhook events
 * Reference: https://z-api.io/
 */

/**
 * Common validation patterns
 */
const phoneNumberSchema = z
  .string()
  .regex(/^\d{10,15}$/, 'Invalid phone number format')
  .describe('Phone number without special characters, 10-15 digits');

const messageIdSchema = z
  .string()
  .min(1, 'Message ID cannot be empty')
  .describe('Unique message identifier');

const timestampSchema = z
  .number()
  .positive('Timestamp must be positive')
  .describe('Unix timestamp in milliseconds');

const isoDateTimeSchema = z
  .string()
  .datetime('Invalid datetime format')
  .describe('ISO 8601 datetime format');

/**
 * Message type enumeration
 * Represents all supported message types in Z-API
 */
export const messageTypeEnum = z.enum(
  [
    'text',
    'image',
    'video',
    'document',
    'audio',
    'location',
    'contact',
    'link',
    'sticker',
    'template',
    'reaction',
    'poll',
    'button',
    'list',
  ],
  {
    errorMap: () => ({ message: 'Invalid message type' }),
  }
);

export type MessageType = z.infer<typeof messageTypeEnum>;

/**
 * Delivery status enumeration
 * Represents delivery states for messages
 */
export const deliveryStatusEnum = z.enum(['sent', 'delivered', 'pending', 'failed'], {
  errorMap: () => ({ message: 'Invalid delivery status' }),
});

export type DeliveryStatus = z.infer<typeof deliveryStatusEnum>;

/**
 * Message status enumeration
 * Represents state changes for messages
 */
export const messageStatusEnum = z.enum(['read', 'replied', 'deleted', 'edited'], {
  errorMap: () => ({ message: 'Invalid message status' }),
});

export type MessageStatus = z.infer<typeof messageStatusEnum>;

/**
 * Disconnection reason enumeration
 * Represents reasons for connection loss
 */
export const disconnectReasonEnum = z.enum(
  [
    'user_logout',
    'network_error',
    'device_turned_off',
    'session_expired',
    'force_disconnected',
    'invalid_credentials',
    'too_many_attempts',
    'unknown',
  ],
  {
    errorMap: () => ({ message: 'Invalid disconnect reason' }),
  }
);

export type DisconnectReason = z.infer<typeof disconnectReasonEnum>;

/**
 * Base webhook event structure
 * Common fields shared across all webhook events
 */
const baseWebhookSchema = z.object({
  id: z
    .string()
    .uuid('Invalid webhook event ID')
    .describe('Unique identifier for this webhook event'),
  timestamp: timestampSchema.describe('When the event occurred (unix timestamp in ms)'),
  phoneNumber: phoneNumberSchema.describe('WhatsApp phone number (without + or -)')
    .optional(),
  phone: phoneNumberSchema.describe('WhatsApp phone number (without + or -)')
    .optional(),
});

/**
 * DELIVERY EVENT SCHEMA
 * Fired when a message successfully reaches WhatsApp servers
 * Reference: Confirms message delivery to WhatsApp infrastructure
 */
export const deliveryEventSchema = z
  .object({
    type: z.literal('delivery', {
      errorMap: () => ({ message: 'Event type must be "delivery"' }),
    }),
    messageId: messageIdSchema.describe('ID of the delivered message'),
    status: deliveryStatusEnum.describe('Delivery status'),
    recipient: phoneNumberSchema.describe('Recipient phone number'),
    timestamp: isoDateTimeSchema
      .describe('ISO 8601 timestamp of delivery')
      .optional(),
    metadata: z
      .object({
        retry: z.boolean().optional().describe('Whether this was a retry'),
        retryCount: z.number().int().nonnegative().optional(),
        context: z.string().optional().describe('Additional context'),
      })
      .optional()
      .describe('Additional delivery metadata'),
  })
  .merge(baseWebhookSchema)
  .describe('Webhook event confirming message delivery to WhatsApp');

export type DeliveryEvent = z.infer<typeof deliveryEventSchema>;

/**
 * RECEIVE EVENT SCHEMA
 * Fired when a new message is received from a contact
 * Reference: New incoming message from contact
 */
export const receiveEventSchema = z
  .object({
    type: z.literal('receive', {
      errorMap: () => ({ message: 'Event type must be "receive"' }),
    }),
    messageId: messageIdSchema.describe('Unique message identifier'),
    senderPhone: phoneNumberSchema.describe('Sender phone number'),
    sender: z
      .object({
        phone: phoneNumberSchema,
        name: z
          .string()
          .min(1, 'Sender name cannot be empty')
          .max(255, 'Sender name too long')
          .optional()
          .describe('Contact name if available'),
        isGroup: z.boolean().optional().default(false),
      })
      .optional()
      .describe('Sender information'),
    senderName: z
      .string()
      .min(1, 'Sender name cannot be empty')
      .max(255, 'Sender name too long')
      .optional()
      .describe('Name of the person who sent the message'),
    messageType: messageTypeEnum.describe('Type of message received'),
    text: z
      .string()
      .describe('Message text content')
      .optional(),
    body: z
      .string()
      .describe('Message body (alternative to text)')
      .optional(),
    caption: z
      .string()
      .optional()
      .describe('Caption for media messages (image, video, document)'),
    media: z
      .object({
        url: z.string().url('Invalid media URL'),
        type: z.enum(['image', 'video', 'document', 'audio']),
        mimeType: z.string().optional(),
        size: z.number().int().nonnegative().optional(),
        fileName: z.string().optional(),
      })
      .optional()
      .describe('Media content details'),
    location: z
      .object({
        latitude: z.number().describe('Latitude coordinate'),
        longitude: z.number().describe('Longitude coordinate'),
        accuracy: z.number().optional(),
        address: z.string().optional(),
      })
      .optional()
      .describe('Location data for location messages'),
    contact: z
      .object({
        name: z.string(),
        phone: phoneNumberSchema,
        email: z.string().email().optional(),
      })
      .optional()
      .describe('Contact information for contact messages'),
    isGroup: z
      .boolean()
      .optional()
      .default(false)
      .describe('Whether message came from a group'),
    groupId: z
      .string()
      .optional()
      .describe('Group ID if message is from a group'),
    groupName: z
      .string()
      .optional()
      .describe('Group name if message is from a group'),
    quotedMessage: z
      .object({
        messageId: messageIdSchema,
        text: z.string().optional(),
        senderPhone: phoneNumberSchema.optional(),
      })
      .optional()
      .describe('Information about quoted/replied message'),
    timestamp: isoDateTimeSchema
      .describe('ISO 8601 timestamp when message was sent')
      .optional(),
    createdAt: timestampSchema
      .describe('Unix timestamp when message was created')
      .optional(),
    metadata: z
      .object({
        context: z.string().optional(),
        encrypted: z.boolean().optional(),
        expiration: z.number().optional(),
      })
      .optional()
      .describe('Additional message metadata'),
  })
  .merge(baseWebhookSchema)
  .describe('Webhook event for incoming messages');

export type ReceiveEvent = z.infer<typeof receiveEventSchema>;

/**
 * Discriminated union type for text or media receive events
 */
export type TextReceiveEvent = ReceiveEvent & {
  messageType: Extract<MessageType, 'text'>;
  text: string;
};

export type MediaReceiveEvent = ReceiveEvent & {
  messageType: Extract<MessageType, 'image' | 'video' | 'document' | 'audio'>;
  media: NonNullable<ReceiveEvent['media']>;
};

/**
 * STATUS EVENT SCHEMA
 * Fired when a message status changes (read, replied, deleted, etc.)
 * Reference: Message state change notification
 */
export const statusEventSchema = z
  .object({
    type: z.literal('status', {
      errorMap: () => ({ message: 'Event type must be "status"' }),
    }),
    messageId: messageIdSchema.describe('ID of the message whose status changed'),
    status: messageStatusEnum.describe('New message status'),
    contactPhone: phoneNumberSchema
      .optional()
      .describe('Phone number of contact who performed the action'),
    contact: z
      .object({
        phone: phoneNumberSchema,
        name: z.string().optional(),
      })
      .optional()
      .describe('Contact who triggered the status change'),
    previousStatus: messageStatusEnum
      .optional()
      .describe('Previous message status'),
    timestamp: isoDateTimeSchema
      .describe('ISO 8601 timestamp of status change')
      .optional(),
    changedAt: timestampSchema
      .describe('Unix timestamp of status change')
      .optional(),
    isGroup: z
      .boolean()
      .optional()
      .default(false)
      .describe('Whether status change is from a group'),
    groupId: z
      .string()
      .optional()
      .describe('Group ID if applicable'),
    metadata: z
      .object({
        readAt: timestampSchema.optional(),
        repliedAt: timestampSchema.optional(),
        deletedAt: timestampSchema.optional(),
        editedAt: timestampSchema.optional(),
      })
      .optional()
      .describe('Additional status change metadata'),
  })
  .merge(baseWebhookSchema)
  .describe('Webhook event for message status changes');

export type StatusEvent = z.infer<typeof statusEventSchema>;

/**
 * DISCONNECTED EVENT SCHEMA
 * Fired when the WhatsApp connection is lost or terminated
 * Reference: Connection lost notification
 */
export const disconnectedEventSchema = z
  .object({
    type: z.literal('disconnected', {
      errorMap: () => ({ message: 'Event type must be "disconnected"' }),
    }),
    reason: disconnectReasonEnum.describe('Reason for disconnection'),
    message: z
      .string()
      .optional()
      .describe('Human-readable disconnection message'),
    timestamp: isoDateTimeSchema
      .describe('ISO 8601 timestamp of disconnection')
      .optional(),
    disconnectedAt: timestampSchema
      .describe('Unix timestamp of disconnection')
      .optional(),
    reconnectAttempts: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe('Number of reconnection attempts'),
    lastError: z
      .string()
      .optional()
      .describe('Last error message before disconnection'),
    metadata: z
      .object({
        willAutoReconnect: z.boolean().optional(),
        nextRetryAt: timestampSchema.optional(),
        errorCode: z.string().optional(),
      })
      .optional()
      .describe('Additional disconnection metadata'),
  })
  .merge(baseWebhookSchema)
  .describe('Webhook event for connection loss');

export type DisconnectedEvent = z.infer<typeof disconnectedEventSchema>;

/**
 * UNION SCHEMA - All possible webhook event types
 * Use discriminated unions for type narrowing
 */
export const webhookEventSchema = z.discriminatedUnion('type', [
  deliveryEventSchema,
  receiveEventSchema,
  statusEventSchema,
  disconnectedEventSchema,
]);

export type WebhookEvent = z.infer<typeof webhookEventSchema>;

/**
 * Webhook payload wrapper
 * Standard envelope for webhook delivery
 */
export const webhookPayloadSchema = z.object({
  event: webhookEventSchema.describe('The actual webhook event'),
  timestamp: timestampSchema.optional(),
  signature: z.string().optional().describe('HMAC signature for verification'),
});

export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;

/**
 * Batch webhook events (Z-API may send multiple events)
 */
export const webhookBatchSchema = z.object({
  events: z
    .array(webhookEventSchema)
    .min(1, 'At least one event is required')
    .describe('Array of webhook events'),
  timestamp: timestampSchema.optional(),
});

export type WebhookBatch = z.infer<typeof webhookBatchSchema>;

/**
 * Validation functions for webhook events
 * Provides safe parsing with error details
 */

export const validateDeliveryEvent = (data: unknown) => {
  return deliveryEventSchema.safeParse(data);
};

export const validateReceiveEvent = (data: unknown) => {
  return receiveEventSchema.safeParse(data);
};

export const validateStatusEvent = (data: unknown) => {
  return statusEventSchema.safeParse(data);
};

export const validateDisconnectedEvent = (data: unknown) => {
  return disconnectedEventSchema.safeParse(data);
};

export const validateWebhookEvent = (data: unknown) => {
  return webhookEventSchema.safeParse(data);
};

export const validateWebhookPayload = (data: unknown) => {
  return webhookPayloadSchema.safeParse(data);
};

export const validateWebhookBatch = (data: unknown) => {
  return webhookBatchSchema.safeParse(data);
};

/**
 * Type guards for discriminating between event types
 * Use these to narrow types in conditional branches
 */

export const isDeliveryEvent = (event: unknown): event is DeliveryEvent => {
  const result = deliveryEventSchema.safeParse(event);
  return result.success;
};

export const isReceiveEvent = (event: unknown): event is ReceiveEvent => {
  const result = receiveEventSchema.safeParse(event);
  return result.success;
};

export const isStatusEvent = (event: unknown): event is StatusEvent => {
  const result = statusEventSchema.safeParse(event);
  return result.success;
};

export const isDisconnectedEvent = (event: unknown): event is DisconnectedEvent => {
  const result = disconnectedEventSchema.safeParse(event);
  return result.success;
};

export const isWebhookEvent = (event: unknown): event is WebhookEvent => {
  const result = webhookEventSchema.safeParse(event);
  return result.success;
};

/**
 * Type narrowing functions
 * Specialized guards for narrowing event subtypes
 */

export const isTextReceiveEvent = (event: ReceiveEvent): event is TextReceiveEvent => {
  return event.messageType === 'text' && !!event.text;
};

export const isMediaReceiveEvent = (
  event: ReceiveEvent
): event is MediaReceiveEvent => {
  return (
    ['image', 'video', 'document', 'audio'].includes(event.messageType) &&
    !!event.media
  );
};

export const isLocationReceiveEvent = (
  event: ReceiveEvent
): event is ReceiveEvent & { location: NonNullable<ReceiveEvent['location']> } => {
  return event.messageType === 'location' && !!event.location;
};

export const isContactReceiveEvent = (
  event: ReceiveEvent
): event is ReceiveEvent & { contact: NonNullable<ReceiveEvent['contact']> } => {
  return event.messageType === 'contact' && !!event.contact;
};

export const isGroupMessage = (event: ReceiveEvent | StatusEvent): boolean => {
  return event.isGroup === true;
};

export const isQuotedMessage = (event: ReceiveEvent): boolean => {
  return !!event.quotedMessage;
};

/**
 * Helper functions for common operations
 */

/**
 * Extract phone number from webhook event
 * Handles both phoneNumber and phone field variations
 */
export const getPhoneFromEvent = (event: WebhookEvent): string | undefined => {
  return event.phoneNumber || event.phone;
};

/**
 * Format phone number to international format
 * Assumes input is in format without special characters
 */
export const formatPhoneNumber = (phone: string, countryCode: string = '55'): string => {
  const cleaned = phone.replace(/\D/g, '');
  const code = cleaned.startsWith(countryCode) ? '' : countryCode;
  return `+${code}${cleaned}`;
};

/**
 * Extract message content based on type
 * Returns the actual message text or description
 */
export const getMessageContent = (event: ReceiveEvent): string => {
  if (event.text) return event.text;
  if (event.body) return event.body;
  if (event.caption) return event.caption;
  if (event.messageType === 'location' && event.location?.address)
    return `Location: ${event.location.address}`;
  if (event.messageType === 'contact' && event.contact?.name)
    return `Contact: ${event.contact.name}`;
  return `[${event.messageType.toUpperCase()} message]`;
};

/**
 * Get human-readable timestamp from event
 */
export const getEventTimestamp = (event: WebhookEvent): Date => {
  if ('timestamp' in event && typeof event.timestamp === 'string') {
    return new Date(event.timestamp);
  }
  if ('timestamp' in event && typeof event.timestamp === 'number') {
    return new Date(event.timestamp);
  }
  return new Date();
};

/**
 * Check if event indicates a critical issue
 */
export const isCriticalEvent = (event: WebhookEvent): boolean => {
  if (isDisconnectedEvent(event)) {
    return ['network_error', 'session_expired', 'invalid_credentials'].includes(
      event.reason
    );
  }
  if (isDeliveryEvent(event)) {
    return event.status === 'failed';
  }
  return false;
};

/**
 * HTTP Status codes for webhook handling
 */
export const WEBHOOK_STATUS_CODES = {
  OK: 200,
  ACCEPTED: 202,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  UNPROCESSABLE_ENTITY: 422,
  RATE_LIMIT_EXCEEDED: 429,
  INTERNAL_SERVER_ERROR: 500,
} as const;

/**
 * Webhook event type constants
 */
export const WEBHOOK_EVENT_TYPES = {
  DELIVERY: 'delivery',
  RECEIVE: 'receive',
  STATUS: 'status',
  DISCONNECTED: 'disconnected',
} as const;

/**
 * Default webhook timeout (in milliseconds)
 */
export const WEBHOOK_TIMEOUT = 30000; // 30 seconds

/**
 * Maximum retry attempts for webhook delivery
 */
export const MAX_WEBHOOK_RETRIES = 3;
