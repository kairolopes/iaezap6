#!/usr/bin/env node

const jwt = require('jsonwebtoken');

const BASE_URL = 'http://localhost:3000';
const JWT_SECRET = 'sb_secret_uh1cDxnWtzRT4fhYbiEWBg_fbnZkKwQ';

function generateToken(userId, email, role = 'user') {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: userId,
    email: email,
    role: role,
    iat: now,
    exp: now + 3600,
    iss: 'supabase',
    aud: 'authenticated',
  };

  return jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256' });
}

async function makeRequest(method, endpoint, token = null, body = null) {
  const url = `${BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    const contentType = response.headers.get('content-type');
    let data;

    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return {
      status: response.status,
      statusText: response.statusText,
      data: data,
    };
  } catch (error) {
    return {
      status: 0,
      statusText: 'Network Error',
      error: error.message,
    };
  }
}

const results = {
  passed: 0,
  failed: 0,
  tests: [],
};

async function test(name, fn) {
  try {
    console.log(`\n[TEST] ${name}`);
    const result = await fn();
    if (result.passed) {
      results.passed++;
      console.log(`  PASSED`);
    } else {
      results.failed++;
      console.log(`  FAILED: ${result.message}`);
    }
    results.tests.push({ name, status: result.passed ? 'PASSED' : 'FAILED', ...result });
  } catch (error) {
    results.failed++;
    console.log(`  ERROR: ${error.message}`);
    results.tests.push({ name, status: 'ERROR', error: error.message });
  }
}

async function runTests() {
  console.log('\n========================================');
  console.log('Admin Endpoints Test Suite');
  console.log('========================================\n');

  const masterUserId = 'master-user-' + Date.now();
  const normalUserId = 'normal-user-' + Date.now();

  const masterToken = generateToken(masterUserId, 'master@example.com', 'admin');
  const normalToken = generateToken(normalUserId, 'user@example.com', 'user');

  console.log('Generated tokens:');
  console.log(`  Master token (role: admin): ${masterToken.substring(0, 50)}...`);
  console.log(`  Normal token (role: user): ${normalToken.substring(0, 50)}...\n`);

  await test('GET /api/admin/companies without auth - expect 401', async () => {
    const result = await makeRequest('GET', '/api/admin/companies');
    return {
      passed: result.status === 401,
      message: `Expected 401, got ${result.status}`,
      statusCode: result.status,
    };
  });

  await test('GET /api/admin/companies with master token - expect 200', async () => {
    const result = await makeRequest('GET', '/api/admin/companies', masterToken);
    return {
      passed: result.status === 200,
      message: `Expected 200, got ${result.status}`,
      statusCode: result.status,
      hasSuccess: result.data?.success === true,
      responseData: result.status === 500 ? result.data : undefined,
    };
  });

  await test('POST /api/admin/companies with master token - expect 201', async () => {
    const companyData = {
      name: 'Test Company ' + Date.now(),
      slug: 'test-company-' + Date.now(),
      cnpj: '12.345.678/0001-90',
      plan: 'professional',
    };
    const result = await makeRequest('POST', '/api/admin/companies', masterToken, companyData);
    return {
      passed: result.status === 201,
      message: `Expected 201, got ${result.status}`,
      statusCode: result.status,
      companyId: result.data?.data?.id,
    };
  });

  await test('POST /api/admin/companies with invalid CNPJ - expect 400', async () => {
    const invalidData = {
      name: 'Test Company',
      slug: 'test-company-' + Date.now(),
      cnpj: 'invalid-cnpj',
    };
    const result = await makeRequest('POST', '/api/admin/companies', masterToken, invalidData);
    return {
      passed: result.status === 400,
      message: `Expected 400, got ${result.status}`,
      statusCode: result.status,
      errorCode: result.data?.error?.code,
    };
  });

  await test('Non-master tries GET /api/admin/companies - expect 403', async () => {
    const result = await makeRequest('GET', '/api/admin/companies', normalToken);
    return {
      passed: result.status === 403,
      message: `Expected 403, got ${result.status}`,
      statusCode: result.status,
      errorCode: result.data?.error?.code,
    };
  });

  await test('Non-master tries POST /api/admin/companies - expect 403', async () => {
    const companyData = {
      name: 'Test Company',
      slug: 'test-company-' + Date.now(),
      cnpj: '12.345.678/0001-90',
    };
    const result = await makeRequest('POST', '/api/admin/companies', normalToken, companyData);
    return {
      passed: result.status === 403,
      message: `Expected 403, got ${result.status}`,
      statusCode: result.status,
      errorCode: result.data?.error?.code,
    };
  });

  await test('GET /api/admin/users with master token - expect 200/403/401', async () => {
    const result = await makeRequest('GET', '/api/admin/users', masterToken);
    return {
      passed: result.status === 200 || result.status === 403 || result.status === 401,
      message: `Expected 200/403/401, got ${result.status}`,
      statusCode: result.status,
      note: 'Endpoint requires user to be admin in company context',
    };
  });

  await test('Non-master tries GET /api/admin/users - expect 403/401', async () => {
    const result = await makeRequest('GET', '/api/admin/users', normalToken);
    return {
      passed: result.status === 403 || result.status === 401,
      message: `Expected 403/401, got ${result.status}`,
      statusCode: result.status,
      errorCode: result.data?.error?.code,
    };
  });

  await test('POST /api/admin/companies with missing name - expect 400', async () => {
    const invalidData = {
      slug: 'test-company-' + Date.now(),
      cnpj: '12.345.678/0001-90',
    };
    const result = await makeRequest('POST', '/api/admin/companies', masterToken, invalidData);
    return {
      passed: result.status === 400,
      message: `Expected 400, got ${result.status}`,
      statusCode: result.status,
      errorCode: result.data?.error?.code,
    };
  });

  await test('GET /api/admin/companies with query parameters - expect 200', async () => {
    const result = await makeRequest(
      'GET',
      '/api/admin/companies?status=active&plan=professional&limit=10&offset=0',
      masterToken
    );
    return {
      passed: result.status === 200,
      message: `Expected 200, got ${result.status}`,
      statusCode: result.status,
      isArray: Array.isArray(result.data?.data),
    };
  });

  console.log('\n========================================');
  console.log('Test Summary');
  console.log('========================================');
  console.log(`Total Tests: ${results.tests.length}`);
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);

  if (results.failed > 0) {
    console.log('\nFailed Tests:');
    results.tests.filter(t => t.status === 'FAILED').forEach((t) => {
      console.log(`  - ${t.name}`);
      console.log(`    ${t.message}`);
    });
  }

  console.log('\n========================================');
  console.log('Detailed Test Results');
  console.log('========================================\n');

  results.tests.forEach((t) => {
    console.log(`[${t.status}] ${t.name}`);
    console.log(`  Status Code: ${t.statusCode}`);
    if (t.errorCode) console.log(`  Error Code: ${t.errorCode}`);
    if (t.companyId) console.log(`  Company ID: ${t.companyId}`);
    if (t.hasSuccess !== undefined) console.log(`  Has Success Field: ${t.hasSuccess}`);
    if (t.isArray !== undefined) console.log(`  Is Array: ${t.isArray}`);
    console.log();
  });

  process.exit(results.failed > 0 ? 1 : 0);
}

runTests().catch((error) => {
  console.error('Test suite error:', error);
  process.exit(1);
});
