import { appendFileSync } from 'fs';
import { createSupabaseServerClient } from './supabase';
import { triggerMessageRules } from './message-rules';
import {
  WebhookEvent,
  getMessageContent,
  getPhoneFromEvent,
  isReceiveEvent,
  isStatusEvent,
  isDeliveryEvent,
  type ReceiveEvent,
  type StatusEvent,
  type DeliveryEvent,
} from '@/types/z-api';

/**
 * Result type for webhook event processing
 */
export interface ProcessZApiWebhookResult {
  success: boolean;
  error?: string;
  data?: {
    eventType: string;
    conversationId?: string;
    messageId?: string;
    action: string;
  };
}

/**
 * Process incoming Z-API webhook events
 *
 * Handles three main event types:
 * - receive: Create/update conversation and insert inbound message
 * - status: Update message status in database
 * - delivery: Mark message as delivered
 *
 * Uses Supabase service role key for direct database access.
 * Properly handles RLS via tenant_id isolation.
 *
 * @param event - The validated Z-API webhook event
 * @param tenantId - The tenant ID for RLS isolation
 * @returns Result object with success status and relevant data
 */
export async function processZApiWebhook(
  event: WebhookEvent,
  tenantId: string
): Promise<ProcessZApiWebhookResult> {
  try {
    // Dispatch to appropriate handler based on event type
    switch (event.type) {
      case 'receive':
        return await handleReceiveEvent(event as ReceiveEvent, tenantId);
      case 'status':
        return await handleStatusEvent(event as StatusEvent, tenantId);
      case 'delivery':
        return await handleDeliveryEvent(event as DeliveryEvent, tenantId);
      default:
        // Silently ignore other event types (disconnected, etc.)
        return {
          success: true,
          data: {
            eventType: event.type,
            action: 'ignored',
          },
        };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Z-API Processor Error]', {
      eventType: event.type,
      tenantId,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Handle receive events (incoming messages)
 *
 * Steps:
 * 1. Extract phone number and message content from event
 * 2. Check if conversation exists for this phone_number + tenant_id combo
 * 3. If not, create it
 * 4. Insert message with direction='inbound'
 * 5. Call triggerMessageRules() to process automation rules
 *
 * @param event - The receive event
 * @param tenantId - The tenant ID for RLS isolation
 */
async function handleReceiveEvent(
  event: ReturnType<typeof isReceiveEvent> extends true
    ? Parameters<typeof isReceiveEvent>[0]
    : never,
  tenantId: string
): Promise<ProcessZApiWebhookResult> {
  const supabase = createSupabaseServerClient();

  try {
    const logEntry = `[${new Date().toISOString()}] handleReceiveEvent START: tenantId=${tenantId}, senderPhone=${(event as any).senderPhone}, messageId=${(event as any).messageId}\n`;
    appendFileSync('/tmp/iaezap-webhook.log', logEntry);

    console.log('[handleReceiveEvent] Processing receive event:', {
      tenantId,
      senderPhone: (event as any).senderPhone,
      messageId: (event as any).messageId,
      messageType: (event as any).messageType,
    });

    // Extract phone number and sender info
    const phoneNumber = event.senderPhone || getPhoneFromEvent(event);
    if (!phoneNumber) {
      console.log('[handleReceiveEvent] ERROR: No phone number found');
      return {
        success: false,
        error: 'No phone number found in receive event',
      };
    }

    const senderName = event.senderName || event.sender?.name;

    // Extract message content
    const messageContent = getMessageContent(event);
    console.log('[handleReceiveEvent] Extracted data:', {
      phoneNumber,
      senderName,
      messageContent: messageContent?.substring(0, 50),
    });

    // Step 1: Check if conversation exists
    appendFileSync('/tmp/iaezap-webhook.log', `[${new Date().toISOString()}] STEP 1: Checking conversation\n`);
    const { data: existingConversation, error: selectError } = await supabase
      .from('conversations')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('phone_number', phoneNumber)
      .maybeSingle();

    if (selectError && selectError.code !== 'PGRST116') {
      // PGRST116 = no rows returned, which is expected for new conversations
      appendFileSync('/tmp/iaezap-webhook.log', `[${new Date().toISOString()}] ERROR at STEP 1: ${selectError.message}\n`);
      throw new Error(`Failed to query conversation: ${selectError.message}`);
    }

    appendFileSync('/tmp/iaezap-webhook.log', `[${new Date().toISOString()}] STEP 1 OK: conversation exists = ${!!existingConversation}\n`);

    let conversationId: string;

    // Step 2: Create conversation if it doesn't exist
    appendFileSync('/tmp/iaezap-webhook.log', `[${new Date().toISOString()}] STEP 2: Creating/fetching conversation\n`);
    if (!existingConversation) {
      const { data: newConversation, error: insertError } = await supabase
        .from('conversations')
        .insert([
          {
            tenant_id: tenantId,
            phone_number: phoneNumber,
            contact_name: senderName || null,
            started_at: new Date().toISOString(),
            status: 'active',
          },
        ])
        .select('id')
        .single();

      if (insertError) {
        appendFileSync('/tmp/iaezap-webhook.log', `[${new Date().toISOString()}] ERROR at STEP 2 INSERT: ${insertError.message}\n`);
        throw new Error(`Failed to create conversation: ${insertError.message}`);
      }

      if (!newConversation) {
        appendFileSync('/tmp/iaezap-webhook.log', `[${new Date().toISOString()}] ERROR at STEP 2: No conversation returned\n`);
        throw new Error('No conversation returned after insert');
      }

      appendFileSync('/tmp/iaezap-webhook.log', `[${new Date().toISOString()}] STEP 2 OK: Created conversation ${newConversation.id}\n`);
      conversationId = newConversation.id;
    } else {
      appendFileSync('/tmp/iaezap-webhook.log', `[${new Date().toISOString()}] STEP 2 OK: Using existing conversation ${existingConversation.id}\n`);
      conversationId = existingConversation.id;
    }

    // Step 3: Insert the inbound message
    appendFileSync('/tmp/iaezap-webhook.log', `[${new Date().toISOString()}] STEP 3: Inserting message\n`);
    const { data: newMessage, error: messageError } = await supabase
      .from('messages')
      .insert([
        {
          conversation_id: conversationId,
          direction: 'inbound',
          content: messageContent,
          provider_id: event.messageId,
          timestamp: event.timestamp
            ? new Date(event.timestamp).toISOString()
            : new Date().toISOString(),
        },
      ])
      .select('id')
      .single();

    if (messageError) {
      appendFileSync('/tmp/iaezap-webhook.log', `[${new Date().toISOString()}] ERROR at STEP 3 INSERT: ${messageError.message}\n`);
      throw new Error(`Failed to insert message: ${messageError.message}`);
    }

    if (!newMessage) {
      appendFileSync('/tmp/iaezap-webhook.log', `[${new Date().toISOString()}] ERROR at STEP 3: No message returned\n`);
      throw new Error('No message returned after insert');
    }

    appendFileSync('/tmp/iaezap-webhook.log', `[${new Date().toISOString()}] STEP 3 OK: Created message ${newMessage.id}\n`);
    const messageId = newMessage.id;

    // Step 4: Fetch full conversation object for rule processing
    const { data: fullConversation, error: convFetchError } = await supabase
      .from('conversations')
      .select('id, tenant_id, phone_number')
      .eq('id', conversationId)
      .single();

    if (!convFetchError && fullConversation) {
      // Step 5: Fetch the full message object for rule processing
      const { data: fullMessage, error: msgFetchError } = await supabase
        .from('messages')
        .select('*')
        .eq('id', messageId)
        .single();

      if (!msgFetchError && fullMessage) {
        // Trigger message rules asynchronously (non-blocking, fire and forget)
        triggerMessageRules(
          {
            id: fullConversation.id,
            tenant_id: fullConversation.tenant_id,
            phone: fullConversation.phone_number,
          },
          {
            content: messageContent,
            sender: senderName || 'Unknown',
            senderPhone: phoneNumber,
            senderName: senderName,
          },
          tenantId
        ).catch(error => {
          console.error('[Processor] Error triggering message rules:', error);
          // Don't throw - rule processing failures shouldn't block webhook response
        });
      }
    }

    appendFileSync('/tmp/iaezap-webhook.log', `[${new Date().toISOString()}] handleReceiveEvent SUCCESS: conversationId=${conversationId}, messageId=${messageId}\n`);

    return {
      success: true,
      data: {
        eventType: 'receive',
        conversationId,
        messageId,
        action: 'message_received',
      },
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Handle status events (message status changes)
 *
 * Updates the message status in the messages table.
 * Status can be: read, replied, deleted, edited
 *
 * @param event - The status event
 * @param tenantId - The tenant ID for RLS isolation
 */
async function handleStatusEvent(
  event: ReturnType<typeof isStatusEvent> extends true
    ? Parameters<typeof isStatusEvent>[0]
    : never,
  tenantId: string
): Promise<ProcessZApiWebhookResult> {
  const supabase = createSupabaseServerClient();

  try {
    // First, find the message by provider_id and verify it belongs to this tenant
    const { data: message, error: selectError } = await supabase
      .from('messages')
      .select('id, conversation_id')
      .eq('provider_id', event.messageId)
      .single();

    if (selectError || !message) {
      // Message not found - this might be a message from another tenant or a delivery race condition
      console.warn('[Status Event] Message not found for provider_id:', event.messageId);
      return {
        success: true,
        data: {
          eventType: 'status',
          action: `message_${event.status}`,
        },
      };
    }

    // Verify the message belongs to the correct tenant by checking the conversation
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', message.conversation_id)
      .eq('tenant_id', tenantId)
      .single();

    if (convError || !conversation) {
      // Conversation doesn't belong to this tenant - skip
      console.warn('[Status Event] Conversation not found or not in tenant:', {
        conversationId: message.conversation_id,
        tenantId,
      });
      return {
        success: true,
        data: {
          eventType: 'status',
          action: `message_${event.status}`,
        },
      };
    }

    // Update message with the new status timestamp
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq('id', message.id);

    if (updateError) {
      throw new Error(`Failed to update message status: ${updateError.message}`);
    }

    return {
      success: true,
      data: {
        eventType: 'status',
        messageId: message.id,
        action: `message_${event.status}`,
      },
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Handle delivery events (message delivery confirmation)
 *
 * Marks message as delivered by updating its status/metadata.
 * Delivery indicates the message reached WhatsApp servers.
 *
 * @param event - The delivery event
 * @param tenantId - The tenant ID for RLS isolation
 */
async function handleDeliveryEvent(
  event: ReturnType<typeof isDeliveryEvent> extends true
    ? Parameters<typeof isDeliveryEvent>[0]
    : never,
  tenantId: string
): Promise<ProcessZApiWebhookResult> {
  const supabase = createSupabaseServerClient();

  try {
    // First, find the message by provider_id and verify it belongs to this tenant
    const { data: message, error: selectError } = await supabase
      .from('messages')
      .select('id, conversation_id')
      .eq('provider_id', event.messageId)
      .single();

    if (selectError || !message) {
      // Message not found - this might be a delivery for a message from another tenant
      console.warn('[Delivery Event] Message not found for provider_id:', event.messageId);
      return {
        success: true,
        data: {
          eventType: 'delivery',
          action: 'message_delivered',
        },
      };
    }

    // Verify the message belongs to the correct tenant by checking the conversation
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', message.conversation_id)
      .eq('tenant_id', tenantId)
      .single();

    if (convError || !conversation) {
      // Conversation doesn't belong to this tenant - skip
      console.warn('[Delivery Event] Conversation not found or not in tenant:', {
        conversationId: message.conversation_id,
        tenantId,
      });
      return {
        success: true,
        data: {
          eventType: 'delivery',
          action: 'message_delivered',
        },
      };
    }

    // Update message to mark as delivered
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq('id', message.id);

    if (updateError) {
      throw new Error(`Failed to update delivery status: ${updateError.message}`);
    }

    return {
      success: true,
      data: {
        eventType: 'delivery',
        messageId: message.id,
        action: 'message_delivered',
      },
    };
  } catch (error) {
    throw error;
  }
}

