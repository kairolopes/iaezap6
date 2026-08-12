import { createClient } from '@supabase/supabase-js';

// Initialize Supabase admin client
export const getSupabaseAdmin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Missing Supabase credentials in environment variables');
  }

  return createClient(url, serviceKey);
};

/**
 * Adds a token to the blacklist in Supabase
 * @param token - The authentication token to blacklist
 * @param expiresInHours - How many hours until the blacklist entry expires (default: 24)
 * @returns Object with success status and message
 */
export async function blacklistToken(
  token: string,
  expiresInHours: number = 24
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabaseAdmin();

    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();

    const { error } = await supabase.from('token_blacklist').insert([
      {
        token: token,
        created_at: new Date().toISOString(),
        expires_at: expiresAt,
      },
    ]);

    if (error) {
      // Code 23505 is PostgreSQL unique constraint violation
      if (error.code === '23505') {
        return { success: true }; // Token already blacklisted
      }

      console.error('Token blacklist error:', error);
      return {
        success: false,
        error: 'Failed to blacklist token',
      };
    }

    return { success: true };
  } catch (error) {
    console.error('Unexpected error during token blacklist:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}

/**
 * Checks if a token is blacklisted
 * @param token - The token to check
 * @returns Object with isBlacklisted status
 */
export async function isTokenBlacklisted(token: string): Promise<{ isBlacklisted: boolean; error?: string }> {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('token_blacklist')
      .select('id')
      .eq('token', token)
      .single();

    if (error) {
      // If "not found" error, token is not blacklisted
      if (error.code === 'PGRST116') {
        return { isBlacklisted: false };
      }

      console.error('Token blacklist check error:', error);
      return {
        isBlacklisted: false,
        error: 'Failed to check token status',
      };
    }

    return { isBlacklisted: !!data };
  } catch (error) {
    console.error('Unexpected error during token check:', error);
    return {
      isBlacklisted: false,
      error: 'An unexpected error occurred',
    };
  }
}

/**
 * Cleans up expired blacklist entries from the database
 * Should be run periodically via a cron job or background task
 */
export async function cleanupExpiredBlacklist(): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('token_blacklist')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select();

    if (error) {
      console.error('Cleanup error:', error);
      return {
        success: false,
        error: 'Failed to cleanup expired tokens',
      };
    }

    return {
      success: true,
      deletedCount: data?.length || 0,
    };
  } catch (error) {
    console.error('Unexpected error during cleanup:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}
