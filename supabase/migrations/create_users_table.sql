-- Create companies table (if not already exists)
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  cnpj VARCHAR(14),
  description TEXT,
  plan VARCHAR(50) DEFAULT 'free',
  owner_id UUID,
  metadata JSONB DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

-- Create users table for IAeZap authentication
CREATE TABLE IF NOT EXISTS users (
  -- Primary Identification
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Company Association (Multi-tenancy)
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Authentication
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,

  -- Profile Information
  full_name VARCHAR(255),

  -- Authorization
  role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('admin', 'manager', 'user', 'viewer')),

  -- Status Management
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'pending')),

  -- Metadata and Tracking
  metadata JSONB DEFAULT '{}',
  last_login_at TIMESTAMP,

  -- Soft Delete Support
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP,

  -- Constraints
  UNIQUE(company_id, email),
  CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_company_email ON users(company_id, email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Create token_rotations table for refresh token tracking
CREATE TABLE IF NOT EXISTS token_rotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  old_refresh_token_hash VARCHAR(255),
  new_refresh_token_hash VARCHAR(255) NOT NULL UNIQUE,
  revoked_at TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for token_rotations
CREATE INDEX IF NOT EXISTS idx_token_rotations_user_id ON token_rotations(user_id);
CREATE INDEX IF NOT EXISTS idx_token_rotations_new_refresh_token_hash ON token_rotations(new_refresh_token_hash);
CREATE INDEX IF NOT EXISTS idx_token_rotations_expires_at ON token_rotations(expires_at);

-- Create password reset tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for password_reset_tokens
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

-- Grant appropriate permissions
-- Note: Adjust according to your Supabase RLS policies
GRANT SELECT, INSERT, UPDATE ON users TO authenticated;
GRANT SELECT ON companies TO authenticated;

-- Enable Row Level Security (RLS) if desired
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
--
-- Create RLS policies
-- CREATE POLICY "Users can view their own company's users"
--   ON users FOR SELECT
--   USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));
--
-- CREATE POLICY "Users can only update their own profile"
--   ON users FOR UPDATE
--   USING (id = auth.uid())
--   WITH CHECK (id = auth.uid());
