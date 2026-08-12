/**
 * Tests for Z-API sender module (src/lib/z-api-sender.ts)
 *
 * Tests the sendMessage function with mocked Z-API and Supabase calls
 *
 * Run with: npm test -- z-api-sender.test.ts
 * Or: pnpm test -- z-api-sender.test.ts
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { sendMessage } from '@/lib/z-api-sender';

/**
 * Mock Supabase client
 */
vi.mock('@/lib/supabase', () => {
  return {
    createSupabaseServerClient: vi.fn(() => ({
      from: vi.fn((table: string) => ({
        select: vi.fn(function () {
          return this;
        }),
        eq: vi.fn(function () {
          return this;
        }),
        single: vi.fn(),
        insert: vi.fn(function () {
          return this;
        }),
      })),
    })),
  };
});

/**
 * Mock fetch for Z-API calls
 */
global.fetch = vi.fn();

/**
 * Test data
 */
const testTenantId = '550e8400-e29b-41d4-a716-446655440000';
const testInstanceId = '550e8400-e29b-41d4-a716-446655440001';
const testConversationId = '550e8400-e29b-41d4-a716-446655440002';
const testPhoneNumber = '5521987654321';
const testMessage = 'Hello, this is an automated reply!';
const testZApiToken = 'test-z-api-token';

describe('sendMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Test: Missing required fields validation
   */
  it('should reject when tenantId is missing', async () => {
    const result = await sendMessage(
      '', // empty tenantId
      testInstanceId,
      testConversationId,
      testMessage,
      testZApiToken
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing required fields');
    expect(result.error).toContain('tenantId');
  });

  it('should reject when instanceId is missing', async () => {
    const result = await sendMessage(
      testTenantId,
      '', // empty instanceId
      testConversationId,
      testMessage,
      testZApiToken
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing required fields');
    expect(result.error).toContain('instanceId');
  });

  it('should reject when conversationId is missing', async () => {
    const result = await sendMessage(
      testTenantId,
      testInstanceId,
      '', // empty conversationId
      testMessage,
      testZApiToken
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing required fields');
    expect(result.error).toContain('conversationId');
  });

  it('should reject when text is empty', async () => {
    const result = await sendMessage(
      testTenantId,
      testInstanceId,
      testConversationId,
      '', // empty text
      testZApiToken
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing required fields');
    expect(result.error).toContain('text');
  });

  it('should reject when zApiToken is missing', async () => {
    const result = await sendMessage(
      testTenantId,
      testInstanceId,
      testConversationId,
      testMessage,
      '' // empty token
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing required fields');
    expect(result.error).toContain('zApiToken');
  });

  /**
   * Test: Multiple missing fields
   */
  it('should report all missing fields in error message', async () => {
    const result = await sendMessage('', '', '', '', '');

    expect(result.success).toBe(false);
    expect(result.error).toContain('tenantId');
    expect(result.error).toContain('instanceId');
    expect(result.error).toContain('conversationId');
    expect(result.error).toContain('text');
    expect(result.error).toContain('zApiToken');
  });

  /**
   * Test: Conversation not found
   */
  it('should return error when conversation is not found', async () => {
    const { createSupabaseServerClient } = await import('@/lib/supabase');
    const mockSupabase = createSupabaseServerClient();

    // Mock: conversation query returns null
    mockSupabase.from('conversations').select().eq().single.mockResolvedValue({
      data: null,
      error: { message: 'Not found', code: 'PGRST116' },
    });

    const result = await sendMessage(
      testTenantId,
      testInstanceId,
      testConversationId,
      testMessage,
      testZApiToken
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Conversation not found');
    expect(result.details?.retryable).toBe(false);
  });

  /**
   * Test: Z-API send failure but message saved
   */
  it('should save message to database even if Z-API send fails', async () => {
    const { createSupabaseServerClient } = await import('@/lib/supabase');
    const mockSupabase = createSupabaseServerClient();

    // Mock: conversation found
    mockSupabase.from('conversations').select().eq().single.mockResolvedValue({
      data: {
        id: testConversationId,
        phone_number: testPhoneNumber,
        tenant_id: testTenantId,
      },
      error: null,
    });

    // Mock: Z-API call fails
    (global.fetch as any).mockRejectedValue(new Error('Z-API connection failed'));

    // Mock: message insert succeeds
    mockSupabase.from('messages').insert().select().single.mockResolvedValue({
      data: { id: '550e8400-e29b-41d4-a716-446655440003' },
      error: null,
    });

    const result = await sendMessage(
      testTenantId,
      testInstanceId,
      testConversationId,
      testMessage,
      testZApiToken
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Z-API send failed');
    expect(result.messageId).toBeDefined();
    expect(result.details?.retryable).toBe(true);
  });

  /**
   * Test: Successful send and save
   */
  it('should successfully send message and save to database', async () => {
    const { createSupabaseServerClient } = await import('@/lib/supabase');
    const mockSupabase = createSupabaseServerClient();
    const mockZApiMessageId = '550e8400-e29b-41d4-a716-446655440004';
    const mockDbMessageId = '550e8400-e29b-41d4-a716-446655440005';

    // Mock: conversation found
    mockSupabase.from('conversations').select().eq().single.mockResolvedValue({
      data: {
        id: testConversationId,
        phone_number: testPhoneNumber,
        tenant_id: testTenantId,
      },
      error: null,
    });

    // Mock: Z-API call succeeds
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, messageId: mockZApiMessageId }),
    });

    // Mock: message insert succeeds
    mockSupabase.from('messages').insert().select().single.mockResolvedValue({
      data: { id: mockDbMessageId },
      error: null,
    });

    const result = await sendMessage(
      testTenantId,
      testInstanceId,
      testConversationId,
      testMessage,
      testZApiToken
    );

    expect(result.success).toBe(true);
    expect(result.messageId).toBe(mockDbMessageId);
    expect(result.details?.zApiMessageId).toBe(mockZApiMessageId);
    expect(result.error).toBeUndefined();
  });

  /**
   * Test: Database save fails after Z-API success
   */
  it('should report error if database save fails after Z-API success', async () => {
    const { createSupabaseServerClient } = await import('@/lib/supabase');
    const mockSupabase = createSupabaseServerClient();
    const mockZApiMessageId = '550e8400-e29b-41d4-a716-446655440006';

    // Mock: conversation found
    mockSupabase.from('conversations').select().eq().single.mockResolvedValue({
      data: {
        id: testConversationId,
        phone_number: testPhoneNumber,
        tenant_id: testTenantId,
      },
      error: null,
    });

    // Mock: Z-API call succeeds
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, messageId: mockZApiMessageId }),
    });

    // Mock: message insert fails
    mockSupabase.from('messages').insert().select().single.mockResolvedValue({
      data: null,
      error: { message: 'Database error' },
    });

    const result = await sendMessage(
      testTenantId,
      testInstanceId,
      testConversationId,
      testMessage,
      testZApiToken
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('failed to save locally');
    expect(result.details?.zApiMessageId).toBe(mockZApiMessageId);
    expect(result.details?.retryable).toBe(true);
  });

  /**
   * Test: Z-API returns error response
   */
  it('should handle Z-API error response', async () => {
    const { createSupabaseServerClient } = await import('@/lib/supabase');
    const mockSupabase = createSupabaseServerClient();

    // Mock: conversation found
    mockSupabase.from('conversations').select().eq().single.mockResolvedValue({
      data: {
        id: testConversationId,
        phone_number: testPhoneNumber,
        tenant_id: testTenantId,
      },
      error: null,
    });

    // Mock: Z-API call returns error
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Invalid phone number' }),
    });

    // Mock: message insert still succeeds (for retry)
    mockSupabase.from('messages').insert().select().single.mockResolvedValue({
      data: { id: '550e8400-e29b-41d4-a716-446655440007' },
      error: null,
    });

    const result = await sendMessage(
      testTenantId,
      testInstanceId,
      testConversationId,
      testMessage,
      testZApiToken
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Z-API send failed');
    expect(result.messageId).toBeDefined();
  });

  /**
   * Test: Long message text
   */
  it('should handle long message text', async () => {
    const { createSupabaseServerClient } = await import('@/lib/supabase');
    const mockSupabase = createSupabaseServerClient();
    const longMessage = 'a'.repeat(1000);
    const mockDbMessageId = '550e8400-e29b-41d4-a716-446655440008';

    // Mock: conversation found
    mockSupabase.from('conversations').select().eq().single.mockResolvedValue({
      data: {
        id: testConversationId,
        phone_number: testPhoneNumber,
        tenant_id: testTenantId,
      },
      error: null,
    });

    // Mock: Z-API call succeeds
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, messageId: 'z-api-msg-id' }),
    });

    // Mock: message insert succeeds
    mockSupabase.from('messages').insert().select().single.mockResolvedValue({
      data: { id: mockDbMessageId },
      error: null,
    });

    const result = await sendMessage(
      testTenantId,
      testInstanceId,
      testConversationId,
      longMessage,
      testZApiToken
    );

    expect(result.success).toBe(true);
    expect(result.messageId).toBe(mockDbMessageId);
  });

  /**
   * Test: Special characters in message
   */
  it('should handle special characters in message', async () => {
    const { createSupabaseServerClient } = await import('@/lib/supabase');
    const mockSupabase = createSupabaseServerClient();
    const messageWithSpecialChars = 'Hello! How are you? #test @user 💙';
    const mockDbMessageId = '550e8400-e29b-41d4-a716-446655440009';

    // Mock: conversation found
    mockSupabase.from('conversations').select().eq().single.mockResolvedValue({
      data: {
        id: testConversationId,
        phone_number: testPhoneNumber,
        tenant_id: testTenantId,
      },
      error: null,
    });

    // Mock: Z-API call succeeds
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, messageId: 'z-api-msg-id' }),
    });

    // Mock: message insert succeeds
    mockSupabase.from('messages').insert().select().single.mockResolvedValue({
      data: { id: mockDbMessageId },
      error: null,
    });

    const result = await sendMessage(
      testTenantId,
      testInstanceId,
      testConversationId,
      messageWithSpecialChars,
      testZApiToken
    );

    expect(result.success).toBe(true);
    expect(result.messageId).toBe(mockDbMessageId);
  });

  /**
   * Test: Z-API response without messageId
   */
  it('should handle Z-API response without explicit messageId', async () => {
    const { createSupabaseServerClient } = await import('@/lib/supabase');
    const mockSupabase = createSupabaseServerClient();
    const mockDbMessageId = '550e8400-e29b-41d4-a716-446655440010';

    // Mock: conversation found
    mockSupabase.from('conversations').select().eq().single.mockResolvedValue({
      data: {
        id: testConversationId,
        phone_number: testPhoneNumber,
        tenant_id: testTenantId,
      },
      error: null,
    });

    // Mock: Z-API call succeeds but returns no messageId
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });

    // Mock: message insert succeeds
    mockSupabase.from('messages').insert().select().single.mockResolvedValue({
      data: { id: mockDbMessageId },
      error: null,
    });

    const result = await sendMessage(
      testTenantId,
      testInstanceId,
      testConversationId,
      testMessage,
      testZApiToken
    );

    expect(result.success).toBe(true);
    expect(result.messageId).toBe(mockDbMessageId);
    expect(result.details?.zApiMessageId).toBeNull();
  });
});

describe('Z-API Sender: Integration scenarios', () => {
  /**
   * Test: Multi-tenant isolation
   */
  it('should enforce tenant isolation when querying conversation', async () => {
    const { createSupabaseServerClient } = await import('@/lib/supabase');
    const mockSupabase = createSupabaseServerClient();
    const wrongTenantId = '550e8400-e29b-41d4-a716-446655440099';

    // Mock: conversation not found for this tenant
    mockSupabase.from('conversations').select().eq().single.mockResolvedValue({
      data: null,
      error: { message: 'Not found' },
    });

    const result = await sendMessage(
      wrongTenantId,
      testInstanceId,
      testConversationId,
      testMessage,
      testZApiToken
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Conversation not found');
  });

  /**
   * Test: Network timeout handling
   */
  it('should handle network timeout errors gracefully', async () => {
    const { createSupabaseServerClient } = await import('@/lib/supabase');
    const mockSupabase = createSupabaseServerClient();

    // Mock: conversation found
    mockSupabase.from('conversations').select().eq().single.mockResolvedValue({
      data: {
        id: testConversationId,
        phone_number: testPhoneNumber,
        tenant_id: testTenantId,
      },
      error: null,
    });

    // Mock: fetch timeout
    (global.fetch as any).mockRejectedValue(new Error('Fetch timeout'));

    // Mock: message insert for retry
    mockSupabase.from('messages').insert().select().single.mockResolvedValue({
      data: { id: '550e8400-e29b-41d4-a716-446655440011' },
      error: null,
    });

    const result = await sendMessage(
      testTenantId,
      testInstanceId,
      testConversationId,
      testMessage,
      testZApiToken
    );

    expect(result.success).toBe(false);
    expect(result.details?.retryable).toBe(true);
  });
});
