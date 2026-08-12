import { createClient } from '@supabase/supabase-js';

/**
 * Creates a Supabase client for server-side operations
 * Uses service role key for admin operations
 */
export function createSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Creates a Supabase client for user-specific operations
 * Uses anon key with user-provided session
 */
export function createSupabaseAnonClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Authenticates a user with email and password
 * Returns user session and tokens
 */
export async function authenticateUser(email: string, password: string) {
  const supabase = createSupabaseAnonClient();

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }

    return {
      success: true,
      error: null,
      data: {
        user: data.user,
        session: data.session,
      },
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error during authentication';
    return {
      success: false,
      error: errorMessage,
      data: null,
    };
  }
}

/**
 * Gets user information from Supabase Auth
 */
export async function getUserInfo(userId: string) {
  const supabase = createSupabaseServerClient();

  try {
    const { data, error } = await supabase.auth.admin.getUserById(userId);

    if (error || !data.user) {
      return {
        success: false,
        error: error?.message || 'User not found',
        data: null,
      };
    }

    return {
      success: true,
      error: null,
      data: data.user,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error fetching user';
    return {
      success: false,
      error: errorMessage,
      data: null,
    };
  }
}

/**
 * Registers a new user with email and password
 * Returns user session and tokens on success
 * Handles duplicate email errors
 */
export async function registerUser(
  email: string,
  password: string,
  metadata?: Record<string, any>
) {
  const supabase = createSupabaseAnonClient();

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata || {},
      },
    });

    if (error) {
      // Check for specific error types
      const isDuplicateEmail =
        error.message.toLowerCase().includes('user already exists') ||
        error.status === 422 ||
        error.code === 'user_already_exists';

      const isWeakPassword =
        error.message.toLowerCase().includes('password') ||
        error.code === 'weak_password';

      return {
        success: false,
        error: error.message,
        code: isDuplicateEmail ? 'user_already_exists' : isWeakPassword ? 'weak_password' : 'registration_failed',
        data: null,
      };
    }

    return {
      success: true,
      error: null,
      code: 'user_created',
      data: {
        user: data.user,
        session: data.session,
      },
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error during registration';
    return {
      success: false,
      error: errorMessage,
      code: 'registration_error',
      data: null,
    };
  }
}
