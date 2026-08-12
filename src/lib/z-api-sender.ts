import { createSupabaseServerClient } from './supabase';

/**
 * Result type for sending messages via Z-API
 */
export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
  details?: {
    zApiMessageId?: string;
    retryable?: boolean;
  };
}

/**
 * Send a message via Z-API to a conversation
 *
 * Steps:
 * 1. Query database to get conversation details (phone_number)
 * 2. Call Z-API endpoint to send the message
 * 3. Save the outbound message to messages table
 * 4. Return result with message ID and optional error details
 *
 * Error Handling:
 * - Catches and logs Z-API errors but doesn't throw
 * - Saves message to database even if Z-API send fails (will retry later)
 * - Returns success flag and optional error details
 *
 * @param tenantId - The tenant ID for RLS isolation
 * @param instanceId - The Z-API instance ID
 * @param conversationId - The conversation ID to send message to
 * @param text - The message text to send
 * @param zApiToken - The Z-API authentication token
 * @returns Result object with success status, messageId, and optional error
 */
export async function sendMessage(
  tenantId: string,
  instanceId: string,
  conversationId: string,
  text: string,
  zApiToken: string
): Promise<SendMessageResult> {
  const supabase = createSupabaseServerClient();

  try {
    // Validate inputs
    if (!tenantId || !instanceId || !conversationId || !text || !zApiToken) {
      const missingFields = [];
      if (!tenantId) missingFields.push('tenantId');
      if (!instanceId) missingFields.push('instanceId');
      if (!conversationId) missingFields.push('conversationId');
      if (!text) missingFields.push('text');
      if (!zApiToken) missingFields.push('zApiToken');

      const errorMsg = `Missing required fields: ${missingFields.join(', ')}`;
      console.error('[Z-API Sender] Validation error:', errorMsg);

      return {
        success: false,
        error: errorMsg,
      };
    }

    // Step 1: Get conversation details
    console.log('[Z-API Sender] Fetching conversation details', {
      conversationId,
      tenantId,
    });

    const { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .select('id, phone_number, tenant_id')
      .eq('id', conversationId)
      .eq('tenant_id', tenantId)
      .single();

    if (conversationError || !conversation) {
      const errorMsg = `Conversation not found: ${conversationError?.message || 'No conversation'}`;
      console.error('[Z-API Sender]', errorMsg);

      return {
        success: false,
        error: errorMsg,
        details: {
          retryable: false,
        },
      };
    }

    const phoneNumber = conversation.phone_number;

    // Step 2: Send message via Z-API
    console.log('[Z-API Sender] Calling Z-API endpoint', {
      instanceId,
      phoneNumber,
      messageLength: text.length,
    });

    let zApiResponse: { success: boolean; messageId?: string; error?: string };

    try {
      zApiResponse = await callZApiSendMessage(
        instanceId,
        zApiToken,
        phoneNumber,
        text
      );
    } catch (zApiError) {
      const errorMsg = zApiError instanceof Error ? zApiError.message : 'Unknown Z-API error';
      console.error('[Z-API Sender] Z-API call failed:', {
        error: errorMsg,
        instanceId,
        phoneNumber,
      });

      // Still save the message to the database even if Z-API send failed
      // It will be retried later
      const dbSaveResult = await saveOutboundMessage(
        supabase,
        conversationId,
        text,
        null // provider_id will be null since Z-API didn't return one
      );

      return {
        success: false,
        messageId: dbSaveResult.messageId,
        error: `Z-API send failed: ${errorMsg}`,
        details: {
          retryable: true,
        },
      };
    }

    // Step 3: Save the message to database
    console.log('[Z-API Sender] Saving message to database', {
      conversationId,
      zApiMessageId: zApiResponse.messageId,
    });

    const dbSaveResult = await saveOutboundMessage(
      supabase,
      conversationId,
      text,
      zApiResponse.messageId || null
    );

    if (!dbSaveResult.success) {
      console.error('[Z-API Sender] Failed to save message to database:', {
        error: dbSaveResult.error,
        conversationId,
      });

      return {
        success: false,
        error: `Message sent via Z-API but failed to save locally: ${dbSaveResult.error}`,
        details: {
          zApiMessageId: zApiResponse.messageId,
          retryable: true,
        },
      };
    }

    // Success: Message sent and saved
    console.log('[Z-API Sender] Message sent successfully', {
      messageId: dbSaveResult.messageId,
      zApiMessageId: zApiResponse.messageId,
      conversationId,
    });

    return {
      success: zApiResponse.success,
      messageId: dbSaveResult.messageId,
      details: {
        zApiMessageId: zApiResponse.messageId,
      },
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Z-API Sender] Unexpected error:', {
      error: errorMsg,
      stack: error instanceof Error ? error.stack : undefined,
      conversationId,
      instanceId,
    });

    return {
      success: false,
      error: errorMsg,
      details: {
        retryable: true,
      },
    };
  }
}

/**
 * Call Z-API send message endpoint
 *
 * Z-API API Documentation:
 * Endpoint: POST https://api.z-api.io/instances/{instanceId}/token/{zApiToken}/api/send-message
 * Payload: { phone, message }
 * Response: { success: boolean, messageId?: string }
 *
 * @param instanceId - Z-API instance ID
 * @param zApiToken - Z-API authentication token
 * @param phoneNumber - Recipient phone number (format: 5521987654321 without +)
 * @param message - Message text to send
 * @returns Result object with success flag and optional messageId
 * @throws Error if the API call fails
 */
async function callZApiSendMessage(
  instanceId: string,
  zApiToken: string,
  phoneNumber: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const baseUrl = 'https://api.z-api.io';
  const url = `${baseUrl}/instances/${instanceId}/token/${zApiToken}/api/send-message`;

  const payload = {
    phone: phoneNumber,
    message: message,
  };

  console.log('[Z-API Call] Sending request', {
    url: url.replace(zApiToken, '***'),
    phoneNumber,
    messageLength: message.length,
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseData = await response.json();

    if (!response.ok) {
      const errorMsg =
        typeof responseData === 'object' && responseData !== null
          ? JSON.stringify(responseData)
          : `HTTP ${response.status}`;

      throw new Error(`Z-API request failed: ${errorMsg}`);
    }

    // Z-API response format typically includes messageId in response
    const zApiMessageId =
      (typeof responseData === 'object' && responseData !== null
        ? (responseData as Record<string, any>).messageId || (responseData as Record<string, any>).id
        : null) || null;

    console.log('[Z-API Call] Success', {
      zApiMessageId,
      statusCode: response.status,
    });

    return {
      success: true,
      messageId: zApiMessageId,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Z-API Call] Failed', {
      error: errorMsg,
      url: url.replace(zApiToken, '***'),
    });

    throw error;
  }
}

/**
 * Save outbound message to database
 *
 * Inserts a message record with:
 * - direction: 'outbound'
 * - provider_id: Z-API message ID (if available)
 * - content: message text
 * - conversation_id: the target conversation
 *
 * @param supabase - Supabase client
 * @param conversationId - Conversation ID
 * @param text - Message text
 * @param zApiMessageId - Z-API message ID (optional)
 * @returns Result object with success flag and messageId
 */
async function saveOutboundMessage(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  conversationId: string,
  text: string,
  zApiMessageId: string | null
): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  try {
    const { data: newMessage, error: insertError } = await supabase
      .from('messages')
      .insert([
        {
          conversation_id: conversationId,
          direction: 'outbound',
          content: text,
          provider_id: zApiMessageId,
          timestamp: new Date().toISOString(),
        },
      ])
      .select('id')
      .single();

    if (insertError) {
      const errorMsg = `Failed to insert message: ${insertError.message}`;
      console.error('[Z-API Sender] Database insert error:', {
        error: insertError.message,
        code: insertError.code,
        conversationId,
      });

      return {
        success: false,
        error: errorMsg,
      };
    }

    if (!newMessage) {
      const errorMsg = 'No message returned after insert';
      console.error('[Z-API Sender]', errorMsg);

      return {
        success: false,
        error: errorMsg,
      };
    }

    console.log('[Z-API Sender] Message saved to database', {
      messageId: newMessage.id,
      conversationId,
    });

    return {
      success: true,
      messageId: newMessage.id,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Z-API Sender] Unexpected database error:', {
      error: errorMsg,
      conversationId,
    });

    return {
      success: false,
      error: errorMsg,
    };
  }
}
