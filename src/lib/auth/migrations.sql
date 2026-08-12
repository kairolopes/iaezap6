-- Create token_rotations table for tracking token rotation history
-- This table helps maintain security by tracking old tokens and detecting reuse

CREATE TABLE IF NOT EXISTS token_rotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  old_refresh_token_hash TEXT NOT NULL UNIQUE,
  new_refresh_token_hash TEXT NOT NULL UNIQUE,
  revoked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Add constraints
  CONSTRAINT token_rotations_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_token_rotations_user_id
  ON token_rotations(user_id);

CREATE INDEX IF NOT EXISTS idx_token_rotations_new_hash
  ON token_rotations(new_refresh_token_hash);

CREATE INDEX IF NOT EXISTS idx_token_rotations_old_hash
  ON token_rotations(old_refresh_token_hash);

CREATE INDEX IF NOT EXISTS idx_token_rotations_expires_at
  ON token_rotations(expires_at);

-- Create a function to automatically clean up expired token records
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM token_rotations
  WHERE expires_at < NOW() AND revoked_at IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Optional: Create a trigger or cron job to call cleanup_expired_tokens periodically
-- For Supabase, you can use their pg_cron extension if available:
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule('cleanup-tokens', '0 2 * * *', 'SELECT cleanup_expired_tokens()');
