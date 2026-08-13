-- ============================================
-- Registration Endpoint Database Schema
-- ============================================
-- Execute these SQL statements in Supabase
-- to create the required tables for the
-- registration endpoint to work properly

-- Companies Table
-- Stores company information with CNPJ
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj VARCHAR(14) NOT NULL,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,

  -- Constraints
  CONSTRAINT cnpj_unique UNIQUE(cnpj),
  CONSTRAINT cnpj_format CHECK (cnpj ~ '^\d{14}$'),
  CONSTRAINT name_not_empty CHECK (char_length(name) > 0),
  CONSTRAINT status_valid CHECK (status IN ('active', 'inactive', 'suspended'))
);

-- Create index on CNPJ for fast lookups
CREATE INDEX IF NOT EXISTS idx_companies_cnpj
  ON public.companies(cnpj)
  WHERE deleted_at IS NULL;

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_companies_status
  ON public.companies(status)
  WHERE deleted_at IS NULL;

-- Users Table
-- Stores user accounts linked to companies
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  role VARCHAR(50) DEFAULT 'user',
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,

  -- Constraints
  CONSTRAINT email_unique UNIQUE(email),
  CONSTRAINT email_format CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$'),
  CONSTRAINT role_valid CHECK (role IN ('admin', 'moderator', 'user')),
  CONSTRAINT status_valid CHECK (status IN ('active', 'inactive', 'suspended')),
  CONSTRAINT password_hash_not_empty CHECK (char_length(password_hash) > 0)
);

-- Create index on email for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_email
  ON public.users(email)
  WHERE deleted_at IS NULL;

-- Create index on company_id for company-user relationships
CREATE INDEX IF NOT EXISTS idx_users_company_id
  ON public.users(company_id)
  WHERE deleted_at IS NULL;

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_users_status
  ON public.users(status)
  WHERE deleted_at IS NULL;

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================
-- Enable RLS on tables
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Allow public registration (no authentication needed)
CREATE POLICY "Allow public to register" ON public.companies
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public to register" ON public.users
  FOR INSERT WITH CHECK (true);

-- Allow users to read their own company
CREATE POLICY "Users can read their company" ON public.companies
  FOR SELECT
  USING (
    id IN (
      SELECT company_id FROM public.users
      WHERE deleted_at IS NULL
      AND id = (auth.uid())
    )
  );

-- Allow users to read themselves and company members
CREATE POLICY "Users can read themselves and company members" ON public.users
  FOR SELECT
  USING (
    id = auth.uid()
    OR company_id IN (
      SELECT company_id FROM public.users
      WHERE id = auth.uid()
      AND deleted_at IS NULL
    )
  );

-- ============================================
-- Helper Functions
-- ============================================

-- Function to verify password with bcrypt
-- Note: This requires pgcrypto extension and bcrypt wrapper
-- Install: CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE OR REPLACE FUNCTION verify_password(
  stored_hash TEXT,
  password_text TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  -- In production, use pgcrypto or separate verification service
  -- This is a placeholder - implement with your preferred hashing library
  RETURN stored_hash IS NOT NULL AND password_text IS NOT NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to update user's updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update company's updated_at timestamp
CREATE OR REPLACE FUNCTION update_company_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update user's updated_at
CREATE TRIGGER update_users_timestamp
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION update_user_timestamp();

-- Trigger to update company's updated_at
CREATE TRIGGER update_companies_timestamp
BEFORE UPDATE ON public.companies
FOR EACH ROW
EXECUTE FUNCTION update_company_timestamp();

-- ============================================
-- Initial Test Data (Optional)
-- ============================================
-- Note: Only for development/testing
-- Comment out or delete before production

-- INSERT INTO public.companies (cnpj, name, status)
-- VALUES ('12345678901234', 'Test Company', 'active');

-- ============================================
-- View: Company with User Count
-- ============================================
-- Useful for admin dashboards
CREATE OR REPLACE VIEW public.companies_with_user_count AS
SELECT
  c.id,
  c.cnpj,
  c.name,
  c.status,
  COUNT(u.id) as user_count,
  c.created_at,
  c.updated_at
FROM public.companies c
LEFT JOIN public.users u ON u.company_id = c.id AND u.deleted_at IS NULL
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.cnpj, c.name, c.status, c.created_at, c.updated_at;

-- ============================================
-- Stored Procedure: Register User
-- ============================================
-- This can be called from the application
-- or used for batch operations

CREATE OR REPLACE FUNCTION register_user_with_company(
  p_email VARCHAR,
  p_password_hash VARCHAR,
  p_company_cnpj VARCHAR,
  p_company_name VARCHAR
)
RETURNS TABLE (
  user_id UUID,
  user_email VARCHAR,
  company_id UUID,
  company_cnpj VARCHAR,
  user_role VARCHAR,
  success BOOLEAN,
  message TEXT
) AS $$
DECLARE
  v_company_id UUID;
  v_user_id UUID;
BEGIN
  -- Start transaction
  BEGIN
    -- Check if company exists
    SELECT id INTO v_company_id FROM public.companies
    WHERE cnpj = p_company_cnpj AND deleted_at IS NULL;

    -- If company doesn't exist, create it
    IF v_company_id IS NULL THEN
      INSERT INTO public.companies (cnpj, name, status)
      VALUES (p_company_cnpj, p_company_name, 'active')
      RETURNING id INTO v_company_id;
    END IF;

    -- Create user
    INSERT INTO public.users (email, password_hash, company_id, role, status)
    VALUES (p_email, p_password_hash, v_company_id, 'admin', 'active')
    RETURNING id INTO v_user_id;

    -- Return success
    RETURN QUERY SELECT
      v_user_id,
      p_email::VARCHAR,
      v_company_id,
      p_company_cnpj::VARCHAR,
      'admin'::VARCHAR,
      true,
      'User registered successfully'::TEXT;

  EXCEPTION WHEN unique_violation THEN
    RETURN QUERY SELECT
      NULL::UUID,
      p_email::VARCHAR,
      NULL::UUID,
      p_company_cnpj::VARCHAR,
      NULL::VARCHAR,
      false,
      'Email already exists'::TEXT;

  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT
      NULL::UUID,
      p_email::VARCHAR,
      NULL::UUID,
      p_company_cnpj::VARCHAR,
      NULL::VARCHAR,
      false,
      ('Error: ' || SQLERRM)::TEXT;
  END;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Usage Examples
-- ============================================

-- Example 1: Check if company exists
-- SELECT * FROM public.companies
-- WHERE cnpj = '12345678901234' AND deleted_at IS NULL;

-- Example 2: Get user with company info
-- SELECT u.id, u.email, u.role, c.cnpj, c.name
-- FROM public.users u
-- JOIN public.companies c ON u.company_id = c.id
-- WHERE u.email = 'user@example.com' AND u.deleted_at IS NULL;

-- Example 3: List all users in a company
-- SELECT u.id, u.email, u.role, u.status
-- FROM public.users u
-- WHERE u.company_id = 'company-uuid' AND u.deleted_at IS NULL
-- ORDER BY u.created_at DESC;

-- Example 4: Count users per company
-- SELECT c.name, COUNT(u.id) as user_count
-- FROM public.companies c
-- LEFT JOIN public.users u ON u.company_id = c.id AND u.deleted_at IS NULL
-- WHERE c.deleted_at IS NULL
-- GROUP BY c.id, c.name
-- ORDER BY user_count DESC;

-- Example 5: Soft delete user
-- UPDATE public.users
-- SET deleted_at = NOW()
-- WHERE id = 'user-uuid';

-- Example 6: Soft delete company
-- UPDATE public.companies
-- SET deleted_at = NOW()
-- WHERE id = 'company-uuid';

-- ============================================
-- Backup and Maintenance
-- ============================================

-- Restore soft-deleted user
-- UPDATE public.users
-- SET deleted_at = NULL
-- WHERE id = 'user-uuid';

-- Find duplicate emails (should be none)
-- SELECT email, COUNT(*)
-- FROM public.users
-- WHERE deleted_at IS NULL
-- GROUP BY email
-- HAVING COUNT(*) > 1;

-- Find duplicate CNPJ (should be none)
-- SELECT cnpj, COUNT(*)
-- FROM public.companies
-- WHERE deleted_at IS NULL
-- GROUP BY cnpj
-- HAVING COUNT(*) > 1;

-- Get users created in last 24 hours
-- SELECT id, email, created_at
-- FROM public.users
-- WHERE created_at >= NOW() - INTERVAL '24 hours'
-- ORDER BY created_at DESC;
