import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { createSupabaseServerClient } from '@/lib/supabase';

/**
 * POST /api/dev/seed
 *
 * Development-only endpoint to seed test data
 * Should only be enabled in development mode
 */
export async function POST(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'This endpoint is only available in development' },
      { status: 403 }
    );
  }

  try {
    const supabase = createSupabaseServerClient();

    // Hash password
    const password = 'jx&CL%mFvt!x*Sm0';
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create company
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .insert([
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Master Admin Company',
          slug: 'master-admin',
          cnpj: '00.000.000/0000-00',
          plan: 'enterprise',
          status: 'active',
          owner_id: 'def4f37b-a401-451f-9fe2-238747a4e670',
          metadata: { type: 'master' },
        }
      ])
      .select();

    // Create user
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert([
        {
          id: 'def4f37b-a401-451f-9fe2-238747a4e670',
          company_id: '550e8400-e29b-41d4-a716-446655440000',
          email: 'kairolopesoficial@gmail.com',
          full_name: 'Master Admin',
          password_hash: hashedPassword,
          role: 'owner',
          status: 'active',
        }
      ])
      .select();

    return NextResponse.json({
      success: true,
      message: 'Test data seeded',
      company: company?.[0],
      user: user?.[0],
      credentials: {
        email: 'kairolopesoficial@gmail.com',
        password: 'jx&CL%mFvt!x*Sm0',
      },
      errors: {
        company: companyError?.message,
        user: userError?.message,
      },
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
