# Supabase Mocking Guide for IAeZap Tests

This guide explains how to mock Supabase responses in authentication tests.

## Overview

IAeZap authentication tests use mock objects to simulate Supabase database operations without connecting to the actual database. This enables:

- Fast test execution
- Isolated test environments
- Predictable test data
- No external dependencies
- Easy error scenario testing

## Mocking Strategy

### 1. Mock Database Tables

The authentication system uses two main tables:

#### Companies Table
```typescript
interface Company {
  id: string;                 // UUID
  cnpj: string;              // 14-digit Brazilian CNPJ
  name: string;
  status: 'active' | 'inactive';
  created_at: string;        // ISO timestamp
  deleted_at?: string;       // Soft delete
}
```

#### Users Table
```typescript
interface User {
  id: string;                // UUID
  email: string;
  password_hash: string;     // bcrypt hash
  company_id: string;        // FK to companies
  role: 'admin' | 'user' | 'moderator';
  status: 'active' | 'inactive';
  created_at: string;        // ISO timestamp
  updated_at: string;
  deleted_at?: string;       // Soft delete
}
```

### 2. Basic Mock Client

```typescript
class MockSupabaseClient {
  private users: Map<string, any> = new Map();
  private companies: Map<string, any> = new Map();

  // Simulate database queries
  async query(table: string, options: any) {
    // Implementation
  }
}
```

### 3. Mocking Strategies by Operation

#### Register - Create Company
```typescript
// Mock: Check if company exists
const companyCheck = supabase.getCompanyByCNPJ('12345678901234');
expect(companyCheck.data).toBeNull();  // Company doesn't exist

// Mock: Create company
const { data: company } = supabase.createCompany(
  '12345678901234',
  'My Company'
);
expect(company.id).toBeDefined();
expect(company.cnpj).toBe('12345678901234');
```

#### Register - Create User
```typescript
// Mock: Create user
const hashedPassword = await bcrypt.hash('Password123!', 10);
const { data: user, error } = await supabase.createUser(
  'user@example.com',
  hashedPassword,
  'company-id'
);

// Success case
if (!error) {
  expect(user.email).toBe('user@example.com');
  expect(user.company_id).toBe('company-id');
  expect(user.role).toBe('admin');
}

// Failure case - duplicate email
if (error?.message.includes('already exists')) {
  // Handle duplicate email error
}
```

#### Login - Find User
```typescript
// Mock: Find user by email
const { data: user, error } = await supabase
  .from('users')
  .select('*')
  .eq('email', 'user@example.com')
  .eq('deleted_at', null)
  .single();

// User found
if (user) {
  expect(user.email).toBe('user@example.com');
  expect(user.password_hash).toBeDefined();
}

// User not found
if (error?.code === 'PGRST116') {
  expect(user).toBeNull();
}
```

#### Login - Verify Password
```typescript
// Mock: Check password
const passwordMatch = await bcrypt.compare(
  'correct-password',
  storedHashedPassword
);
expect(passwordMatch).toBe(true);

// Wrong password
const wrongMatch = await bcrypt.compare(
  'wrong-password',
  storedHashedPassword
);
expect(wrongMatch).toBe(false);
```

## Common Mock Patterns

### Pattern 1: Mocking Database Errors

```typescript
// Simulate database error
const mockError = {
  code: 'PGRST116',
  message: 'No rows found'
};

expect(result.error).toEqual(mockError);
expect(result.data).toBeNull();
```

### Pattern 2: Simulating Constraints

```typescript
// Unique constraint violation
class MockSupabaseClient {
  async createUser(email: string, ...) {
    // Check unique constraint
    const exists = this.users.some(u => u.email === email);
    if (exists) {
      return {
        data: null,
        error: { code: 'UNIQUE_VIOLATION' }
      };
    }
    // Create user...
  }
}
```

### Pattern 3: Simulating Soft Deletes

```typescript
// Include deleted_at in queries
async getUserByEmail(email: string) {
  for (const user of this.users.values()) {
    // Only return non-deleted users
    if (user.email === email && !user.deleted_at) {
      return { data: user, error: null };
    }
  }
  return { data: null, error: { code: 'PGRST116' } };
}
```

### Pattern 4: Simulating Timestamps

```typescript
// Add realistic timestamps
const user = {
  id: 'uuid',
  created_at: new Date().toISOString(),  // Current time
  updated_at: new Date().toISOString(),
  // ...
};
```

## Mocking with Jest

### Setup Mocks in beforeEach

```typescript
beforeEach(() => {
  // Create fresh mock client for each test
  supabase = new MockSupabaseClient();
  
  // Initialize with seed data
  supabase.init();
  
  // Can also use jest.mock()
  jest.mock('@/lib/supabase', () => ({
    supabase: supabase
  }));
});
```

### Mock Return Values

```typescript
// Single mock response
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({
        data: { id: '1', email: 'user@example.com' },
        error: null
      })
    })
  }
}));

// Different responses per test
const mockSupabase = {
  from: jest.fn((table) => ({
    select: jest.fn().mockImplementation((fields) => {
      if (table === 'users') {
        return Promise.resolve({
          data: [{ id: '1', email: 'user@example.com' }],
          error: null
        });
      }
      return Promise.resolve({ data: null, error: 'Invalid table' });
    })
  }))
};
```

## Test Scenarios

### Scenario 1: Happy Path - Register New User

```typescript
it('should register new user successfully', async () => {
  // Mock: Company doesn't exist
  const companyMock = supabase.getCompanyByCNPJ('12345678901234');
  expect(companyMock.data).toBeNull();

  // Mock: Create company
  const { data: company } = supabase.createCompany(
    '12345678901234',
    'New Company'
  );
  expect(company).toBeDefined();

  // Mock: User doesn't exist
  const userMock = await supabase.getUserByEmail('user@example.com');
  expect(userMock.data).toBeNull();

  // Mock: Create user
  const hashedPassword = await bcrypt.hash('ValidPass123!', 10);
  const { data: user } = await supabase.createUser(
    'user@example.com',
    hashedPassword,
    company.id
  );
  expect(user.company_id).toBe(company.id);

  // Mock: Generate tokens
  const tokens = await generateTokens({
    userId: user.id,
    email: user.email,
    tenantId: company.id
  });
  expect(tokens.accessToken).toBeDefined();
});
```

### Scenario 2: Error - Duplicate Email

```typescript
it('should reject duplicate email registration', async () => {
  // Mock: First user created
  const company = { id: 'comp-1', cnpj: '12345678901234' };
  const hashedPassword = await bcrypt.hash('ValidPass123!', 10);
  
  const { data: user1 } = await supabase.createUser(
    'user@example.com',
    hashedPassword,
    company.id
  );
  expect(user1).toBeDefined();

  // Mock: Second user with same email
  const { data: user2, error } = await supabase.createUser(
    'user@example.com',
    hashedPassword,
    company.id
  );
  expect(user2).toBeNull();
  expect(error?.message).toContain('already exists');
});
```

### Scenario 3: Error - Wrong Password

```typescript
it('should reject login with wrong password', async () => {
  // Mock: User exists
  const hashedPassword = await bcrypt.hash('CorrectPass123!', 10);
  const { data: user } = await supabase.getUserWithPassword(
    'user@example.com'
  );

  // Mock: Password verification fails
  const passwordMatch = await bcrypt.compare(
    'WrongPass123!',
    user.password_hash
  );
  expect(passwordMatch).toBe(false);

  // Should not generate tokens
  // Return 401 error
});
```

## Advanced Mocking Techniques

### Mocking with State Changes

```typescript
class MockSupabaseClient {
  private state = {
    users: new Map(),
    companies: new Map(),
    failNextQuery: false
  };

  // Enable error scenario
  simulateError() {
    this.state.failNextQuery = true;
  }

  async getUserByEmail(email: string) {
    if (this.state.failNextQuery) {
      this.state.failNextQuery = false;
      return { data: null, error: { code: 'DATABASE_ERROR' } };
    }
    // Normal query
  }
}
```

### Mocking with Spy Functions

```typescript
const mockSupabase = {
  createUser: jest.fn(),
  getUserByEmail: jest.fn()
};

// Verify mock was called
await registerUser('user@example.com', 'password');
expect(mockSupabase.getUserByEmail).toHaveBeenCalledWith('user@example.com');
expect(mockSupabase.createUser).toHaveBeenCalled();
```

### Mocking with Realistic Delays

```typescript
// Simulate network latency
jest.useFakeTimers();

const mockSupabase = {
  getUserByEmail: jest.fn(async (email) => {
    // Simulate 100ms delay
    await new Promise(resolve => setTimeout(resolve, 100));
    return { data: { id: '1', email }, error: null };
  })
};
```

## Best Practices

1. **Create fresh mocks per test** - Use `beforeEach()` to initialize new mock objects
2. **Mock at appropriate level** - Mock at the data access layer, not the HTTP layer
3. **Test both success and failure** - Include error scenarios
4. **Use realistic data** - Mock data should match production schema
5. **Document mock behavior** - Add comments explaining what's being mocked
6. **Keep mocks simple** - Don't make mocks too complex; keep them focused

## Troubleshooting

### Issue: Mock not being called

```typescript
// Wrong: Mock defined after it's used
const { data } = await supabase.getUser();
jest.mock('@/lib/supabase', () => ({ ... }));

// Correct: Mock defined before it's used
jest.mock('@/lib/supabase', () => ({ ... }));
const { data } = await supabase.getUser();
```

### Issue: Mock returning incorrect data

```typescript
// Verify mock return value
const result = mockSupabase.getUser();
console.log(result); // Debug output

// Use mockResolvedValue for async functions
mockSupabase.getUser.mockResolvedValue({
  data: { id: '1' },
  error: null
});
```

### Issue: Mock state not resetting

```typescript
// Use beforeEach to reset mocks
beforeEach(() => {
  jest.clearAllMocks();
  mockSupabase = new MockSupabaseClient();
});
```

## References

- [Jest Mocking Guide](https://jestjs.io/docs/manual-mocks)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript)
- [Unit Testing Best Practices](https://en.wikipedia.org/wiki/Unit_testing)
