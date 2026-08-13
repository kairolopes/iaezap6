#!/bin/bash

##############################################################################
# Multi-Tenant Test Setup Verification Script
#
# This script verifies that all multi-tenant testing infrastructure is
# properly set up and configured.
#
# Usage: bash tests/verify-setup.sh
##############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARNED=0

# Helper functions
print_header() {
  echo -e "\n${BLUE}===================================================${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}===================================================${NC}\n"
}

check_file() {
  if [ -f "$1" ]; then
    echo -e "${GREEN}✓${NC} Found: $1"
    ((CHECKS_PASSED++))
    return 0
  else
    echo -e "${RED}✗${NC} Missing: $1"
    ((CHECKS_FAILED++))
    return 1
  fi
}

check_command() {
  if command -v "$1" &> /dev/null; then
    echo -e "${GREEN}✓${NC} Available: $1"
    ((CHECKS_PASSED++))
    return 0
  else
    echo -e "${RED}✗${NC} Not found: $1"
    ((CHECKS_FAILED++))
    return 1
  fi
}

check_npm_package() {
  if npm list "$1" --depth=0 &> /dev/null; then
    echo -e "${GREEN}✓${NC} Installed: $1"
    ((CHECKS_PASSED++))
    return 0
  else
    echo -e "${YELLOW}⚠${NC} Missing: $1 (run: npm install --save-dev $1)"
    ((CHECKS_WARNED++))
    return 1
  fi
}

check_script() {
  if grep -q "$2" "$1" 2>/dev/null; then
    echo -e "${GREEN}✓${NC} Script found in package.json: $2"
    ((CHECKS_PASSED++))
    return 0
  else
    echo -e "${YELLOW}⚠${NC} Script missing from package.json: $2"
    ((CHECKS_WARNED++))
    return 1
  fi
}

##############################################################################
# START VERIFICATION
##############################################################################

print_header "Multi-Tenant Test Setup Verification"

# Check Node.js
print_header "1. Environment Setup"
check_command "node"
check_command "npm"

# Check files exist
print_header "2. Test Files"
check_file "tests/multi-tenant.test.ts"
check_file "tests/MULTI_TENANT_TESTING_GUIDE.md"
check_file "tests/QUICK_START.md"
check_file "jest.config.js"

# Check migrations
print_header "3. Database Migrations"
check_file "supabase/migrations/rls_policies_multi_tenant.sql"
check_file "supabase/migrations/create_users_table.sql"

# Check project files
print_header "4. Project Structure"
check_file "package.json"
check_file "tsconfig.json"
check_file "src/lib/admin/auth.ts"
check_file "src/lib/admin/database.ts"
check_file "src/types/admin.ts"

# Check npm packages
print_header "5. Dependencies"
check_npm_package "jest"
check_npm_package "@types/jest"
check_npm_package "ts-jest"
check_npm_package "jsonwebtoken"

# Check package.json scripts
print_header "6. NPM Scripts"
check_script "package.json" '"test"'
check_script "package.json" '"test:watch"'
check_script "package.json" '"test:coverage"'

# Detailed checks
print_header "7. Configuration Details"

# Check jest.config.js
if [ -f "jest.config.js" ]; then
  echo -e "${BLUE}Checking jest.config.js...${NC}"

  if grep -q "testEnvironment: 'node'" jest.config.js; then
    echo -e "${GREEN}✓${NC} testEnvironment set to 'node'"
    ((CHECKS_PASSED++))
  else
    echo -e "${RED}✗${NC} testEnvironment not set correctly"
    ((CHECKS_FAILED++))
  fi

  if grep -q "preset: 'ts-jest'" jest.config.js; then
    echo -e "${GREEN}✓${NC} preset set to 'ts-jest'"
    ((CHECKS_PASSED++))
  else
    echo -e "${RED}✗${NC} preset not configured for TypeScript"
    ((CHECKS_FAILED++))
  fi
fi

# Check tsconfig.json
if [ -f "tsconfig.json" ]; then
  echo -e "${BLUE}Checking tsconfig.json...${NC}"

  if grep -q '"paths"' tsconfig.json; then
    echo -e "${GREEN}✓${NC} Path aliases configured"
    ((CHECKS_PASSED++))
  else
    echo -e "${YELLOW}⚠${NC} Path aliases might not be configured (optional)"
    ((CHECKS_WARNED++))
  fi
fi

# Check TypeScript types
print_header "8. TypeScript Support"
if [ -f "src/types/admin.ts" ]; then
  echo -e "${BLUE}Admin types found...${NC}"
  if grep -q "CreateCompanyRequest\|AddUserToCompanyRequest" src/types/admin.ts; then
    echo -e "${GREEN}✓${NC} Admin request types defined"
    ((CHECKS_PASSED++))
  else
    echo -e "${YELLOW}⚠${NC} Admin request types not found"
    ((CHECKS_WARNED++))
  fi
fi

# Summary
print_header "Verification Summary"

TOTAL=$((CHECKS_PASSED + CHECKS_FAILED + CHECKS_WARNED))

echo "Total Checks: $TOTAL"
echo -e "${GREEN}Passed: $CHECKS_PASSED${NC}"
if [ $CHECKS_FAILED -gt 0 ]; then
  echo -e "${RED}Failed: $CHECKS_FAILED${NC}"
fi
if [ $CHECKS_WARNED -gt 0 ]; then
  echo -e "${YELLOW}Warnings: $CHECKS_WARNED${NC}"
fi

echo ""

# Next steps
print_header "Next Steps"

if [ $CHECKS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All critical checks passed!${NC}"
  echo ""
  echo "To run the tests:"
  echo "  npm test"
  echo ""
  echo "To run only multi-tenant tests:"
  echo "  npm run test:multi-tenant"
  echo ""
  echo "To run with coverage:"
  echo "  npm run test:coverage"
else
  echo -e "${RED}✗ Some critical checks failed.${NC}"
  echo ""
  echo "Missing files/packages:"
  echo "  1. Install dependencies: npm install --save-dev jest @types/jest ts-jest"
  echo "  2. Verify test files exist in tests/ directory"
  echo "  3. Check jest.config.js is in project root"
  echo ""
fi

if [ $CHECKS_WARNED -gt 0 ]; then
  echo -e "${YELLOW}⚠ Some warnings found (optional):${NC}"
  echo "  - Consider installing missing optional packages"
  echo "  - Review configuration files for completeness"
  echo ""
fi

print_header "Documentation"

echo "For detailed information, see:"
echo "  - tests/QUICK_START.md - Quick start guide"
echo "  - tests/MULTI_TENANT_TESTING_GUIDE.md - Complete documentation"
echo "  - supabase/migrations/rls_policies_multi_tenant.sql - RLS policies"
echo ""

# Exit with appropriate code
if [ $CHECKS_FAILED -gt 0 ]; then
  echo -e "${RED}Setup verification failed. Please fix the errors above.${NC}"
  exit 1
else
  echo -e "${GREEN}Setup verification successful! You're ready to run tests.${NC}"
  exit 0
fi
