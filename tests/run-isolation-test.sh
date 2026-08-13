#!/bin/bash

##############################################################################
# Multi-Tenant Isolation Test Runner
#
# This script runs comprehensive multi-tenant data isolation tests to verify:
# 1. User isolation between companies
# 2. JWT token claims include correct company_id
# 3. RLS policies enforce data isolation
# 4. Cross-tenant access is properly blocked
# 5. Audit logs are isolated per company
#
# Prerequisites:
# - Node.js installed
# - .env.local configured with:
#   - NEXT_PUBLIC_SUPABASE_URL
#   - SUPABASE_SERVICE_ROLE_KEY
#   - JWT_PRIVATE_KEY
#   - JWT_PUBLIC_KEY
#
# Usage:
#   bash tests/run-isolation-test.sh
#
# Output:
#   - Console output with detailed test results
#   - Exit code 0 if all tests pass
#   - Exit code 1 if any tests fail
##############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}MULTI-TENANT ISOLATION TEST SUITE${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Check if .env.local exists
if [ ! -f "$PROJECT_ROOT/.env.local" ]; then
  echo -e "${RED}Error: .env.local not found${NC}"
  echo "Please create .env.local with the required environment variables"
  exit 1
fi

# Check if node_modules exists
if [ ! -d "$PROJECT_ROOT/node_modules" ]; then
  echo -e "${YELLOW}Installing dependencies...${NC}"
  cd "$PROJECT_ROOT"
  npm install
fi

# Check if JWT keys are configured
if grep -q "YOUR_PRIVATE_KEY_HERE" "$PROJECT_ROOT/.env.local" || \
   grep -q "YOUR_PUBLIC_KEY_HERE" "$PROJECT_ROOT/.env.local"; then
  echo -e "${YELLOW}Warning: JWT keys not yet configured${NC}"
  echo -e "${YELLOW}Generating JWT keys...${NC}"
  cd "$PROJECT_ROOT"
  npm run generate-jwt-keys || true
fi

# Run the isolation test
echo -e "${BLUE}Running isolation tests...${NC}\n"

cd "$PROJECT_ROOT"

# Use ts-node to run the test
npx ts-node -O '{"module":"commonjs"}' \
  -P tsconfig.json \
  "tests/multi-tenant-isolation.test.ts"

TEST_RESULT=$?

if [ $TEST_RESULT -eq 0 ]; then
  echo -e "\n${GREEN}========================================${NC}"
  echo -e "${GREEN}All tests PASSED!${NC}"
  echo -e "${GREEN}========================================${NC}"
else
  echo -e "\n${RED}========================================${NC}"
  echo -e "${RED}Some tests FAILED${NC}"
  echo -e "${RED}========================================${NC}"
fi

exit $TEST_RESULT
