'use server';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { extractTenantId, verifyToken } from '@/lib/auth';

function getTokenFromRequest(request: NextRequest): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/crm/contacts/[id] - Get contact with conversations
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = getTokenFromRequest(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const verified = await verifyToken(token);
    if (!verified) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const companyId = await extractTenantId(token);
    const contactId = params.id;

    // Get contact
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('id, name, email, phone, whatsapp_number, status, created_at, updated_at')
      .eq('id', contactId)
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .single();

    if (contactError || !contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    // Get recent conversations for this contact
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select(
        `id,
         status,
         created_at,
         updated_at,
         messages:messages(id, sender_type, content, created_at) as recent_messages`
      )
      .eq('company_id', companyId)
      .eq('contact_id', contactId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(10);

    if (convError) throw convError;

    return NextResponse.json({
      ...contact,
      conversations: conversations || [],
    });
  } catch (error) {
    console.error('Error fetching contact:', error);
    return NextResponse.json({ error: 'Failed to fetch contact' }, { status: 500 });
  }
}

// PATCH /api/crm/contacts/[id] - Update contact
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = getTokenFromRequest(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const verified = await verifyToken(token);
    if (!verified) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const companyId = await extractTenantId(token);
    const contactId = params.id;
    const body = await request.json();
    const { name, email, phone, status } = body;

    // Validate email if provided
    if (email && !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Validate status if provided
    if (status && !['active', 'inactive', 'archived'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be: active, inactive, archived' },
        { status: 400 }
      );
    }

    // Build update object
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (status !== undefined) updateData.status = status;
    updateData.updated_at = new Date().toISOString();

    // Update contact
    const { data: contact, error } = await supabase
      .from('contacts')
      .update(updateData)
      .eq('id', contactId)
      .eq('company_id', companyId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json(contact);
  } catch (error) {
    console.error('Error updating contact:', error);
    return NextResponse.json({ error: 'Failed to update contact' }, { status: 500 });
  }
}

// DELETE /api/crm/contacts/[id] - Soft delete contact
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = getTokenFromRequest(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const verified = await verifyToken(token);
    if (!verified) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const companyId = await extractTenantId(token);
    const contactId = params.id;

    // Soft delete (set deleted_at)
    const { data: contact, error } = await supabase
      .from('contacts')
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq('id', contactId)
      .eq('company_id', companyId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ message: 'Contact deleted successfully', contact });
  } catch (error) {
    console.error('Error deleting contact:', error);
    return NextResponse.json({ error: 'Failed to delete contact' }, { status: 500 });
  }
}
