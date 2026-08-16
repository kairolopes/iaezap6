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

// GET /api/crm/contacts - List contacts with search and pagination
export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const verified = await verifyToken(token);
    if (!verified) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const companyId = await extractTenantId(token);
    if (!companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const url = new URL(request.url);
    const search = url.searchParams.get('search') || '';
    const status = url.searchParams.get('status') || '';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Build query
    let query = supabase
      .from('contacts')
      .select('id, name, email, phone, whatsapp_number, status, created_at', { count: 'exact' })
      .eq('company_id', companyId)
      .is('deleted_at', null);

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }

    if (search) {
      // Search by name, email, phone
      query = query.or(
        `name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%,whatsapp_number.ilike.%${search}%`
      );
    }

    const { data: contacts, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json({
      contacts,
      total: count,
      limit,
      offset,
      hasMore: (offset + limit) < (count || 0),
    });
  } catch (error) {
    console.error('Error fetching contacts:', error);
    return NextResponse.json({ error: 'Failed to fetch contacts' }, { status: 500 });
  }
}

// POST /api/crm/contacts - Create new contact
export async function POST(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const verified = await verifyToken(token);
    if (!verified) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const companyId = await extractTenantId(token);
    if (!companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const body = await request.json();
    const { name, email, phone, whatsapp_number } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Validate email format if provided
    if (email && !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Check for duplicate whatsapp_number
    if (whatsapp_number) {
      const { data: existing } = await supabase
        .from('contacts')
        .select('id')
        .eq('company_id', companyId)
        .eq('whatsapp_number', whatsapp_number)
        .is('deleted_at', null)
        .single();

      if (existing) {
        return NextResponse.json(
          { error: 'Contact with this WhatsApp number already exists' },
          { status: 409 }
        );
      }
    }

    // Create contact
    const { data: contact, error } = await supabase
      .from('contacts')
      .insert([
        {
          company_id: companyId,
          name,
          email: email || null,
          phone: phone || null,
          whatsapp_number: whatsapp_number || null,
          status: 'active',
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(contact, { status: 201 });
  } catch (error) {
    console.error('Error creating contact:', error);
    return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 });
  }
}
