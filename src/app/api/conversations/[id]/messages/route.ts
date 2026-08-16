'use server';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { extractTokenFromRequest } from '@/lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/conversations/[id]/messages - Send message
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = await extractTokenFromRequest(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const companyId = token.company_id;
    const conversationId = params.id;
    const body = await request.json();
    const { content, sender_type = 'agent', sender_id, media_url } = body;

    // Validate
    if (!content && !media_url) {
      return NextResponse.json(
        { error: 'Either content or media_url required' },
        { status: 400 }
      );
    }

    if (!['agent', 'contact'].includes(sender_type)) {
      return NextResponse.json(
        { error: 'sender_type must be: agent or contact' },
        { status: 400 }
      );
    }

    // Verify conversation exists and belongs to company
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id, company_id')
      .eq('id', conversationId)
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .single();

    if (convError || !conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Create message
    const { data: message, error } = await supabase
      .from('messages')
      .insert([
        {
          conversation_id: conversationId,
          sender_type,
          sender_id: sender_id || token.sub,
          content,
          media_url,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    // Update conversation updated_at
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error('Error creating message:', error);
    return NextResponse.json({ error: 'Failed to create message' }, { status: 500 });
  }
}
