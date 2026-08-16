'use server';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { extractTenantId, verifyToken } from '@/lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getTokenFromRequest(request: NextRequest): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}

// GET /api/conversations - List conversations with filtering
export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Verify token and extract company_id
    const verified = await verifyToken(token);
    if (!verified) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const companyId = await extractTenantId(token);
    if (!companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const url = new URL(request.url);
    const status = url.searchParams.get('status') || 'open';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Query conversations (RLS handles company_id filtering)
    const { data: conversations, error, count } = await supabase
      .from('conversations')
      .select(
        `id,
         company_id,
         contact_id,
         status,
         created_at,
         updated_at,
         contacts:contact_id(id, name, email, phone, whatsapp_number)`,
        { count: 'exact' }
      )
      .eq('company_id', companyId)
      .eq('status', status)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json({
      conversations,
      total: count,
      limit,
      offset,
      hasMore: (offset + limit) < (count || 0),
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 });
  }
}

// POST /api/conversations - Create new conversation
export async function POST(request: NextRequest) {
  try {
    const token = await extractTokenFromRequest(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const companyId = token.company_id;
    if (!companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const body = await request.json();
    const { contact_id } = body;

    if (!contact_id) {
      return NextResponse.json({ error: 'contact_id required' }, { status: 400 });
    }

    // Verify contact belongs to company (RLS will enforce)
    const { data: contact } = await supabase
      .from('contacts')
      .select('id, company_id')
      .eq('id', contact_id)
      .eq('company_id', companyId)
      .single();

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    // Create conversation
    const { data: conversation, error } = await supabase
      .from('conversations')
      .insert([
        {
          company_id: companyId,
          contact_id,
          status: 'open',
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(conversation, { status: 201 });
  } catch (error) {
    console.error('Error creating conversation:', error);
    return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
  }
}
