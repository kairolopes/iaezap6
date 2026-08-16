'use server';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { extractTokenFromRequest } from '@/lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/conversations/[id] - Get conversation with messages
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = await extractTokenFromRequest(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const companyId = token.company_id;
    const conversationId = params.id;

    // Get conversation with contact info
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select(
        `id,
         company_id,
         status,
         created_at,
         updated_at,
         contacts:contact_id(id, name, email, phone, whatsapp_number)`
      )
      .eq('id', conversationId)
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .single();

    if (convError || !conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Get all messages for this conversation
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('id, conversation_id, sender_type, sender_id, content, media_url, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (msgError) throw msgError;

    return NextResponse.json({
      ...conversation,
      messages: messages || [],
    });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    return NextResponse.json({ error: 'Failed to fetch conversation' }, { status: 500 });
  }
}

// PATCH /api/conversations/[id] - Update conversation status
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = await extractTokenFromRequest(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const companyId = token.company_id;
    const conversationId = params.id;
    const body = await request.json();
    const { status } = body;

    if (!status || !['open', 'pending', 'resolved', 'archived'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be: open, pending, resolved, archived' },
        { status: 400 }
      );
    }

    // Update conversation
    const { data: conversation, error } = await supabase
      .from('conversations')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)
      .eq('company_id', companyId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json(conversation);
  } catch (error) {
    console.error('Error updating conversation:', error);
    return NextResponse.json({ error: 'Failed to update conversation' }, { status: 500 });
  }
}
