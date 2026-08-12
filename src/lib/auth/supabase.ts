import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function storeTokenRotation(
  userId: string,
  oldTokenHash: string,
  newTokenHash: string,
  expiresAt: Date
) {
  try {
    const { data, error } = await supabase
      .from('token_rotations')
      .insert([
        {
          user_id: userId,
          old_refresh_token_hash: oldTokenHash,
          new_refresh_token_hash: newTokenHash,
          expires_at: expiresAt.toISOString(),
          created_at: new Date().toISOString(),
        },
      ])
      .select();

    if (error) {
      console.error('Error storing token rotation:', error);
      return null;
    }

    return data?.[0];
  } catch (err) {
    console.error('Error storing token rotation:', err);
    return null;
  }
}

export async function revokeRefreshToken(refreshTokenHash: string) {
  try {
    const { error } = await supabase
      .from('token_rotations')
      .update({ revoked_at: new Date().toISOString() })
      .eq('new_refresh_token_hash', refreshTokenHash);

    if (error) {
      console.error('Error revoking token:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error revoking token:', err);
    return false;
  }
}

export async function isTokenRevoked(refreshTokenHash: string) {
  try {
    const { data, error } = await supabase
      .from('token_rotations')
      .select('revoked_at')
      .eq('new_refresh_token_hash', refreshTokenHash)
      .single();

    if (error) {
      // Token hash not found in rotation history
      return false;
    }

    return data?.revoked_at !== null;
  } catch (err) {
    console.error('Error checking token revocation:', err);
    return false;
  }
}
