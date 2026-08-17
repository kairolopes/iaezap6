import { supabase } from '@/lib/auth/supabase';
import bcrypt from 'bcrypt';
import { CreateCompanyRequest, AddUserToCompanyRequest, CreateCompanyWithUsersRequest } from '@/types/admin';

/**
 * Generate a secure random password
 */
function generateRandomPassword(length: number = 16): string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  const all = upper + lower + numbers + special;

  let password = '';
  // Ensure at least one of each type
  password += upper[Math.floor(Math.random() * upper.length)];
  password += lower[Math.floor(Math.random() * lower.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }

  // Shuffle the password
  return password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
}

/**
 * Company database operations
 */
export const companyOperations = {
  /**
   * Create a new company
   */
  async create(
    ownerId: string,
    data: CreateCompanyRequest
  ) {
    try {
      // Check if slug already exists
      const { data: existingCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('slug', data.slug)
        .eq('deleted_at', null)
        .maybeSingle();

      if (existingCompany) {
        return {
          success: false,
          error: 'Company slug already exists',
          code: 'SLUG_CONFLICT',
        };
      }

      // Generate UUID for company (explicit ID to avoid NULL)
      const companyId = crypto.randomUUID();

      // Create the company
      const { data: company, error } = await supabase
        .from('companies')
        .insert([
          {
            id: companyId,
            name: data.name,
            slug: data.slug,
            cnpj: data.cnpj,
            description: data.description || null,
            plan: data.plan,
            owner_id: ownerId,
            metadata: data.metadata || {},
            status: 'active',
          },
        ])
        .select();

      if (error) {
        console.error('Error creating company:', error);
        return {
          success: false,
          error: 'Failed to create company',
          code: 'COMPANY_CREATE_ERROR',
        };
      }

      return {
        success: true,
        data: company?.[0] || null,
      };
    } catch (err) {
      console.error('Unexpected error creating company:', err);
      return {
        success: false,
        error: 'An unexpected error occurred',
        code: 'INTERNAL_ERROR',
      };
    }
  },

  /**
   * Create a new company with initial users (atomic operation)
   */
  async createWithUsers(
    ownerId: string,
    data: CreateCompanyWithUsersRequest
  ) {
    try {
      // Check if slug already exists
      const { data: existingCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('slug', data.slug)
        .eq('deleted_at', null)
        .maybeSingle();

      if (existingCompany) {
        return {
          success: false,
          error: 'Company slug already exists',
          code: 'SLUG_CONFLICT',
        };
      }

      // Generate UUID for company
      const companyId = crypto.randomUUID();

      // Create the company
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .insert([
          {
            id: companyId,
            name: data.name,
            slug: data.slug,
            cnpj: data.cnpj,
            description: data.description || null,
            plan: data.plan,
            owner_id: ownerId,
            metadata: data.metadata || {},
            status: 'active',
          },
        ])
        .select();

      if (companyError) {
        console.error('Error creating company:', companyError);
        return {
          success: false,
          error: 'Failed to create company',
          code: 'COMPANY_CREATE_ERROR',
        };
      }

      const createdCompany = company?.[0];
      if (!createdCompany) {
        return {
          success: false,
          error: 'Failed to create company',
          code: 'COMPANY_CREATE_ERROR',
        };
      }

      // Create users for the company with generated passwords
      const usersWithPasswords: Array<{
        id: string;
        company_id: string;
        email: string;
        full_name: string | null;
        role: string;
        status: string;
        password_hash: string;
        plainPassword?: string;
      }> = [];

      for (const user of data.users) {
        const plainPassword = generateRandomPassword();
        const hashedPassword = await bcrypt.hash(plainPassword, 10);

        usersWithPasswords.push({
          id: crypto.randomUUID(),
          company_id: companyId,
          email: user.email.toLowerCase(),
          full_name: user.fullName || null,
          role: user.role,
          status: 'active',
          password_hash: hashedPassword,
          plainPassword,
        });
      }

      // Store plain passwords temporarily for response
      const plainPasswords = usersWithPasswords.map(u => ({
        email: u.email,
        password: u.plainPassword,
      }));

      // Create users (without plain passwords in DB)
      const usersToInsert = usersWithPasswords.map(({ plainPassword, ...user }) => user);
      const { data: createdUsers, error: usersError } = await supabase
        .from('users')
        .insert(usersToInsert)
        .select();

      if (usersError) {
        console.error('Error creating users:', usersError);
        return {
          success: false,
          error: 'Company created but failed to add users',
          code: 'USER_CREATE_ERROR',
        };
      }

      return {
        success: true,
        data: {
          company: createdCompany,
          users: createdUsers || [],
          credentials: plainPasswords, // Include generated passwords in response
        },
      };
    } catch (err) {
      console.error('Unexpected error creating company with users:', err);
      return {
        success: false,
        error: 'An unexpected error occurred',
        code: 'INTERNAL_ERROR',
      };
    }
  },

  /**
   * Get all companies with optional filters
   */
  async getAll(filters?: {
    status?: string;
    plan?: string;
    ownerId?: string;
    limit?: number;
    offset?: number;
  }) {
    try {
      let query = supabase
        .from('companies')
        .select('*')
        .eq('deleted_at', null);

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.plan) {
        query = query.eq('plan', filters.plan);
      }

      if (filters?.ownerId) {
        query = query.eq('owner_id', filters.ownerId);
      }

      query = query.order('created_at', { ascending: false });

      // Apply pagination
      const limit = filters?.limit || 10;
      const offset = filters?.offset || 0;
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        console.error('Error fetching companies:', error);
        return {
          success: false,
          error: 'Failed to fetch companies',
          code: 'COMPANY_FETCH_ERROR',
        };
      }

      return {
        success: true,
        data: data || [],
        count: count || 0,
      };
    } catch (err) {
      console.error('Unexpected error fetching companies:', err);
      return {
        success: false,
        error: 'An unexpected error occurred',
        code: 'INTERNAL_ERROR',
      };
    }
  },

  /**
   * Get company by ID
   */
  async getById(companyId: string) {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .eq('deleted_at', null)
        .maybeSingle();

      if (error) {
        return {
          success: false,
          error: 'Company not found',
          code: 'COMPANY_NOT_FOUND',
        };
      }

      return {
        success: true,
        data,
      };
    } catch (err) {
      console.error('Unexpected error fetching company:', err);
      return {
        success: false,
        error: 'An unexpected error occurred',
        code: 'INTERNAL_ERROR',
      };
    }
  },

  /**
   * Update company
   */
  async update(companyId: string, updates: Partial<CreateCompanyRequest>) {
    try {
      const { data, error } = await supabase
        .from('companies')
        .update(updates)
        .eq('id', companyId)
        .eq('deleted_at', null)
        .select();

      if (error) {
        console.error('Error updating company:', error);
        return {
          success: false,
          error: 'Failed to update company',
          code: 'COMPANY_UPDATE_ERROR',
        };
      }

      return {
        success: true,
        data: data?.[0] || null,
      };
    } catch (err) {
      console.error('Unexpected error updating company:', err);
      return {
        success: false,
        error: 'An unexpected error occurred',
        code: 'INTERNAL_ERROR',
      };
    }
  },
};

/**
 * User database operations within companies
 */
export const userOperations = {
  /**
   * Add a user to a company
   */
  async addToCompany(
    companyId: string,
    data: AddUserToCompanyRequest
  ) {
    try {
      // Check if user already exists in company
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('company_id', companyId)
        .eq('email', data.email.toLowerCase())
        .eq('deleted_at', null)
        .maybeSingle();

      if (existingUser) {
        return {
          success: false,
          error: 'User already exists in this company',
          code: 'USER_ALREADY_EXISTS',
        };
      }

      // Generate UUID for user
      const userId = crypto.randomUUID();

      // Create the user
      const { data: user, error } = await supabase
        .from('users')
        .insert([
          {
            id: userId,
            company_id: companyId,
            email: data.email.toLowerCase(),
            full_name: data.fullName || null,
            role: data.role,
            status: 'active',
            password_hash: '',
          },
        ])
        .select();

      if (error) {
        console.error('Error adding user to company:', error);
        return {
          success: false,
          error: 'Failed to add user to company',
          code: 'USER_ADD_ERROR',
        };
      }

      return {
        success: true,
        data: user?.[0] || null,
      };
    } catch (err) {
      console.error('Unexpected error adding user to company:', err);
      return {
        success: false,
        error: 'An unexpected error occurred',
        code: 'INTERNAL_ERROR',
      };
    }
  },

  /**
   * Get all users in a company
   */
  async getCompanyUsers(
    companyId: string,
    filters?: {
      role?: string;
      status?: string;
      limit?: number;
      offset?: number;
    }
  ) {
    try {
      let query = supabase
        .from('users')
        .select('*')
        .eq('company_id', companyId)
        .eq('deleted_at', null);

      if (filters?.role) {
        query = query.eq('role', filters.role);
      }

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      query = query.order('created_at', { ascending: false });

      // Apply pagination
      const limit = filters?.limit || 10;
      const offset = filters?.offset || 0;
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        console.error('Error fetching company users:', error);
        return {
          success: false,
          error: 'Failed to fetch company users',
          code: 'USER_FETCH_ERROR',
        };
      }

      return {
        success: true,
        data: data || [],
        count: count || 0,
      };
    } catch (err) {
      console.error('Unexpected error fetching company users:', err);
      return {
        success: false,
        error: 'An unexpected error occurred',
        code: 'INTERNAL_ERROR',
      };
    }
  },

  /**
   * Get user by ID in company
   */
  async getUserById(companyId: string, userId: string) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .eq('company_id', companyId)
        .eq('deleted_at', null)
        .single();

      if (error) {
        return {
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND',
        };
      }

      return {
        success: true,
        data,
      };
    } catch (err) {
      console.error('Unexpected error fetching user:', err);
      return {
        success: false,
        error: 'An unexpected error occurred',
        code: 'INTERNAL_ERROR',
      };
    }
  },

  /**
   * Update user in company
   */
  async updateUser(
    companyId: string,
    userId: string,
    updates: Partial<AddUserToCompanyRequest>
  ) {
    try {
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', userId)
        .eq('company_id', companyId)
        .eq('deleted_at', null)
        .select();

      if (error) {
        console.error('Error updating user:', error);
        return {
          success: false,
          error: 'Failed to update user',
          code: 'USER_UPDATE_ERROR',
        };
      }

      return {
        success: true,
        data: data?.[0] || null,
      };
    } catch (err) {
      console.error('Unexpected error updating user:', err);
      return {
        success: false,
        error: 'An unexpected error occurred',
        code: 'INTERNAL_ERROR',
      };
    }
  },

  /**
   * Remove user from company (soft delete)
   */
  async removeFromCompany(companyId: string, userId: string) {
    try {
      const { data, error } = await supabase
        .from('users')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', userId)
        .eq('company_id', companyId)
        .select();

      if (error) {
        console.error('Error removing user from company:', error);
        return {
          success: false,
          error: 'Failed to remove user from company',
          code: 'USER_REMOVE_ERROR',
        };
      }

      return {
        success: true,
        data: data?.[0] || null,
      };
    } catch (err) {
      console.error('Unexpected error removing user:', err);
      return {
        success: false,
        error: 'An unexpected error occurred',
        code: 'INTERNAL_ERROR',
      };
    }
  },
};
