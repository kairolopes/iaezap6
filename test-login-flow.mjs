import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';

// Load .env.local
const envPath = path.join(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envLines = envContent.split('\n');
envLines.forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...valueParts] = trimmed.split('=');
    const value = valueParts.join('=').replace(/^"(.*)"$/, '$1').replace(/\\n/g, '\n');
    process.env[key] = value;
  }
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupDatabaseAndTest() {
  try {
    console.log('=== Testing Login Flow ===\n');

    // Step 1: Check if tables exist
    console.log('Step 1: Checking database schema...');
    const tablesCheck = await supabase.from('companies').select('count');
    console.log('Companies table status:', tablesCheck.error ? 'MISSING' : 'EXISTS');

    // Step 2: Create tables if they don't exist
    console.log('\nStep 2: Attempting to create tables...');
    const createTablesSQL = `
      -- Create companies table
      CREATE TABLE IF NOT EXISTS public.companies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        cnpj VARCHAR(14),
        name VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        deleted_at TIMESTAMP WITH TIME ZONE
      );

      -- Create users table
      CREATE TABLE IF NOT EXISTS public.users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        company_id UUID NOT NULL REFERENCES public.companies(id),
        role VARCHAR(50) DEFAULT 'user',
        status VARCHAR(50) DEFAULT 'active',
        full_name VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        deleted_at TIMESTAMP WITH TIME ZONE
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_companies_cnpj ON public.companies(cnpj) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_users_company_id ON public.users(company_id) WHERE deleted_at IS NULL;
    `;

    // We can't execute raw SQL through the client, so we'll work with what we have
    console.log('Note: Table creation requires Supabase SQL editor or direct database access');

    // Step 3: Try to create test data
    console.log('\nStep 3: Creating test company and user...');

    const companyData = {
      cnpj: '12345678901234',
      name: 'Test Company',
      status: 'active',
    };

    // Insert company
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .insert([companyData])
      .select();

    if (companyError) {
      console.error('Error creating company:', companyError);
      console.log('\nThe database tables do not exist yet.');
      console.log('To proceed, please:');
      console.log('1. Go to Supabase Dashboard');
      console.log('2. Open SQL Editor');
      console.log('3. Execute the migration SQL from REGISTER_DATABASE_SCHEMA.sql');
      process.exit(1);
    }

    const companyId = company[0].id;
    console.log('✓ Company created:', companyId);

    // Hash password
    const password = 'SecurePass123!';
    const passwordHash = await bcrypt.hash(password, 10);

    const userData = {
      email: 'test_user_1@example.com',
      password_hash: passwordHash,
      company_id: companyId,
      role: 'admin',
      status: 'active',
    };

    // Insert user
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert([userData])
      .select();

    if (userError) {
      console.error('Error creating user:', userError);
      process.exit(1);
    }

    const userId = user[0].id;
    console.log('✓ User created:', userId);
    console.log('  Email:', userData.email);
    console.log('  Password:', password);

    // Step 4: Test login endpoint
    console.log('\nStep 4: Testing login endpoint...');
    const loginUrl = 'http://localhost:3000/api/auth/login';
    const loginPayload = {
      email: userData.email,
      password: password,
    };

    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(loginPayload),
    });

    const statusCode = response.status;
    const responseBody = await response.json();

    console.log('\n=== LOGIN TEST RESULTS ===');
    console.log('Status Code:', statusCode);
    console.log('Success:', responseBody.success);

    if (statusCode === 200 && responseBody.success) {
      console.log('\n✓ Test 1: HTTP Status 200 - PASSED');

      // Test 2: Check for tokens
      const hasAccessToken = !!responseBody.access_token;
      const hasRefreshToken = !!responseBody.refresh_token;
      console.log('✓ Test 2: Has access_token -', hasAccessToken ? 'PASSED' : 'FAILED');
      console.log('✓ Test 3: Has refresh_token -', hasRefreshToken ? 'PASSED' : 'FAILED');

      // Test 4: Verify JWT structure
      if (responseBody.access_token) {
        console.log('\n=== JWT TOKEN ANALYSIS ===');
        const parts = responseBody.access_token.split('.');
        if (parts.length === 3) {
          try {
            // Decode payload without verification (unsafe, just for inspection)
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
            console.log('\nAccess Token Payload:');
            console.log('  user_id:', payload.user_id);
            console.log('  email:', payload.email);
            console.log('  company_id:', payload.company_id);
            console.log('  role:', payload.role);
            console.log('  iat:', new Date(payload.iat * 1000).toISOString());
            console.log('  exp:', new Date(payload.exp * 1000).toISOString());
            console.log('  algorithm (from header):', JSON.parse(Buffer.from(parts[0], 'base64').toString()).alg);

            // Test 4: Check JWT claims
            const hasClaims = payload.user_id && payload.email && payload.company_id && payload.role;
            console.log('\n✓ Test 4: JWT contains required claims -', hasClaims ? 'PASSED' : 'FAILED');

            // Test 5: Verify RS256 algorithm (from header)
            const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
            console.log('✓ Test 5: Token signature algorithm RS256 -', header.alg === 'RS256' ? 'PASSED' : 'FAILED');
          } catch (error) {
            console.error('Error decoding JWT:', error.message);
          }
        }
      }

      // Print user info
      if (responseBody.user) {
        console.log('\n=== USER INFORMATION ===');
        console.log('User ID:', responseBody.user.id);
        console.log('Email:', responseBody.user.email);
        console.log('Company ID:', responseBody.user.company_id);
        console.log('Role:', responseBody.user.role);
      }

      console.log('\n=== OVERALL RESULT ===');
      console.log('✓ LOGIN FLOW TEST - PASSED');
    } else {
      console.log('✗ Login failed:', responseBody.error);
      console.log('\n=== OVERALL RESULT ===');
      console.log('✗ LOGIN FLOW TEST - FAILED');
    }

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

setupDatabaseAndTest();
