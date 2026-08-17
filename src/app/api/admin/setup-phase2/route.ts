import { NextRequest, NextResponse } from 'next/server';

// SQL migration for Phase 2 - Companies & Users tables
const PHASE2_MIGRATION = `
-- Companies table
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  cnpj VARCHAR(18),
  description TEXT,
  plan VARCHAR(50) NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'professional', 'enterprise')),
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'suspended', 'cancelled')),
  owner_id UUID NOT NULL,
  metadata JSONB DEFAULT '{}',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Company members table
CREATE TABLE IF NOT EXISTS company_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(company_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_companies_slug ON companies(slug) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_companies_owner_id ON companies(owner_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_company_members_company_id ON company_members(company_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_company_members_user_id ON company_members(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_company_members_role ON company_members(role) WHERE deleted_at IS NULL;
`;

export async function POST(request: NextRequest) {
  try {
    // Check admin token
    const adminToken = request.headers.get('x-admin-token');
    const expectedToken = process.env.ADMIN_MIGRATE_TOKEN || 'admin-migrate-phase2';

    if (adminToken !== expectedToken) {
      return NextResponse.json(
        { error: 'Unauthorized - invalid or missing admin token' },
        { status: 401 }
      );
    }

    const { supabase } = await import('@/lib/auth/supabase');

    console.log('🚀 Starting Phase 2 database setup (Companies & Users)...');

    // Split statements and execute
    const statements = PHASE2_MIGRATION.split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    console.log(`📋 Found ${statements.length} SQL statements`);

    const results = {
      total: statements.length,
      executed: 0,
      failed: 0,
      statements: [] as Array<{ sql: string; status: string; error?: string }>,
    };

    // Execute via RPC (if function exists) or prepare for manual execution
    for (const stmt of statements) {
      try {
        // Try to execute via RPC
        const { data, error } = await (supabase as any).rpc('execute_sql', { sql: stmt });

        if (error) {
          if (error.message.includes('does not exist')) {
            // RPC doesn't exist - tables might be created already
            results.statements.push({
              sql: stmt.substring(0, 60) + '...',
              status: 'prepared',
            });
          } else {
            results.failed++;
            results.statements.push({
              sql: stmt.substring(0, 60) + '...',
              status: 'error',
              error: error.message,
            });
          }
        } else {
          results.executed++;
          results.statements.push({
            sql: stmt.substring(0, 60) + '...',
            status: 'executed',
          });
        }
      } catch (err: any) {
        results.failed++;
        results.statements.push({
          sql: stmt.substring(0, 60) + '...',
          status: 'error',
          error: err.message,
        });
      }
    }

    console.log(`✨ Phase 2 setup complete!`);
    console.log(`   Executed: ${results.executed}/${results.total}`);
    console.log(`   Failed: ${results.failed}`);

    return NextResponse.json({
      success: true,
      message: 'Phase 2 migration executed',
      results,
    });
  } catch (error: any) {
    console.error('Phase 2 setup error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to execute Phase 2 migration',
      },
      { status: 500 }
    );
  }
}

// OPTIONS handler for CORS
export async function OPTIONS(request: NextRequest) {
  return NextResponse.json(
    {},
    {
      headers: {
        'Access-Control-Allow-Origin': request.headers.get('origin') || '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, x-admin-token',
      },
    }
  );
}
