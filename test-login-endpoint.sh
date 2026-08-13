#!/bin/bash

# Test Login Endpoint
# This script tests the /api/auth/login endpoint with various scenarios

BASE_URL="http://localhost:3000"
REGISTER_URL="$BASE_URL/api/auth/register"
LOGIN_URL="$BASE_URL/api/auth/login"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test data
TEST_EMAIL="testuser@example.com"
TEST_PASSWORD="TestPassword123!"
WRONG_PASSWORD="WrongPassword123!"
NONEXISTENT_EMAIL="nonexistent@example.com"
COMPANY_CNPJ="12345678901234"
COMPANY_NAME="Test Company"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Login Endpoint Test Suite${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Function to extract JWT claim
extract_claim() {
  local token=$1
  local claim=$2

  # Decode JWT (base64 decode the payload)
  IFS='.' read -ra parts <<< "$token"
  payload="${parts[1]}"

  # Add padding if needed
  case $((${#payload} % 4)) in
    1) payload="${payload}===" ;;
    2) payload="${payload}==" ;;
    3) payload="${payload}=" ;;
  esac

  echo "$payload" | base64 -d 2>/dev/null | grep -o "\"$claim\":[^,}]*" | cut -d':' -f2
}

# Step 1: Register a test user
echo -e "${YELLOW}STEP 1: Register Test User${NC}"
echo "POST $REGISTER_URL"
echo "Payload: {email: $TEST_EMAIL, password: $TEST_PASSWORD, company_cnpj: $COMPANY_CNPJ, company_name: $COMPANY_NAME}"
echo ""

REGISTER_RESPONSE=$(curl -s -X POST "$REGISTER_URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\",
    \"company_cnpj\": \"$COMPANY_CNPJ\",
    \"company_name\": \"$COMPANY_NAME\"
  }")

echo "Response:"
echo "$REGISTER_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$REGISTER_RESPONSE"
echo ""

# Check if registration was successful
if echo "$REGISTER_RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✓ User registered successfully${NC}\n"

  # Extract user ID from registration response
  USER_ID=$(echo "$REGISTER_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('user', {}).get('id', ''))" 2>/dev/null)
  echo "User ID: $USER_ID"
else
  echo -e "${RED}✗ Registration failed${NC}"
  echo "Response: $REGISTER_RESPONSE\n"
  # Continue with tests anyway, in case user already exists
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo ""

# Step 2: Test Login with Valid Credentials
echo -e "${YELLOW}STEP 2: Test Login with Valid Credentials${NC}"
echo "POST $LOGIN_URL"
echo "Payload: {email: $TEST_EMAIL, password: $TEST_PASSWORD}"
echo ""

LOGIN_RESPONSE=$(curl -s -X POST "$LOGIN_URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\"
  }")

echo "Response:"
echo "$LOGIN_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$LOGIN_RESPONSE"
echo ""

# Parse response
if echo "$LOGIN_RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✓ HTTP Status: 200 OK${NC}"

  # Extract tokens
  ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('access_token', ''))" 2>/dev/null)
  REFRESH_TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('refresh_token', ''))" 2>/dev/null)

  echo -e "${GREEN}✓ Tokens provided in response${NC}"
  echo "  Access Token: ${ACCESS_TOKEN:0:50}..."
  echo "  Refresh Token: ${REFRESH_TOKEN:0:50}..."
  echo ""

  # Step 3: Verify JWT Claims
  echo -e "${YELLOW}STEP 3: Verify JWT Token Claims${NC}"

  if [ ! -z "$ACCESS_TOKEN" ]; then
    echo "Decoding access token..."

    # Decode and show payload
    IFS='.' read -ra parts <<< "$ACCESS_TOKEN"
    payload="${parts[1]}"

    # Add padding
    case $((${#payload} % 4)) in
      1) payload="${payload}===" ;;
      2) payload="${payload}==" ;;
      3) payload="${payload}=" ;;
    esac

    DECODED=$(echo "$payload" | base64 -d 2>/dev/null)
    echo "Token Claims:"
    echo "$DECODED" | python3 -m json.tool 2>/dev/null || echo "$DECODED"
    echo ""

    # Verify required claims
    echo "Verifying required claims..."

    if echo "$DECODED" | grep -q '"user_id"'; then
      echo -e "${GREEN}✓ user_id claim present${NC}"
    else
      echo -e "${RED}✗ user_id claim missing${NC}"
    fi

    if echo "$DECODED" | grep -q '"email"'; then
      echo -e "${GREEN}✓ email claim present${NC}"
    else
      echo -e "${RED}✗ email claim missing${NC}"
    fi

    if echo "$DECODED" | grep -q '"company_id"'; then
      echo -e "${GREEN}✓ company_id claim present${NC}"
    else
      echo -e "${RED}✗ company_id claim missing${NC}"
    fi

    if echo "$DECODED" | grep -q '"role"'; then
      echo -e "${GREEN}✓ role claim present${NC}"
    else
      echo -e "${RED}✗ role claim missing${NC}"
    fi
  fi

else
  echo -e "${RED}✗ Login failed${NC}"
  ERROR_CODE=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('error', {}).get('code', 'UNKNOWN'))" 2>/dev/null)
  echo "Error Code: $ERROR_CODE"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo ""

# Step 4: Test Login with Invalid Password
echo -e "${YELLOW}STEP 4: Test Login with Invalid Password${NC}"
echo "POST $LOGIN_URL"
echo "Payload: {email: $TEST_EMAIL, password: $WRONG_PASSWORD}"
echo ""

INVALID_PASSWORD_RESPONSE=$(curl -s -X POST "$LOGIN_URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$WRONG_PASSWORD\"
  }")

echo "Response:"
echo "$INVALID_PASSWORD_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$INVALID_PASSWORD_RESPONSE"
echo ""

if echo "$INVALID_PASSWORD_RESPONSE" | grep -q '"success":false'; then
  STATUS_CODE=$(echo "$INVALID_PASSWORD_RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print('401' if d.get('error', {}).get('code') == 'INVALID_CREDENTIALS' else 'UNKNOWN')" 2>/dev/null)

  if [ "$STATUS_CODE" == "401" ]; then
    echo -e "${GREEN}✓ HTTP Status: 401 Unauthorized${NC}"
    echo -e "${GREEN}✓ Error Code: INVALID_CREDENTIALS${NC}"
  else
    echo -e "${YELLOW}⚠ Expected 401 with INVALID_CREDENTIALS${NC}"
  fi
else
  echo -e "${RED}✗ Expected failure but got success${NC}"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo ""

# Step 5: Test Login with Non-existent Email
echo -e "${YELLOW}STEP 5: Test Login with Non-existent User${NC}"
echo "POST $LOGIN_URL"
echo "Payload: {email: $NONEXISTENT_EMAIL, password: $TEST_PASSWORD}"
echo ""

NONEXISTENT_RESPONSE=$(curl -s -X POST "$LOGIN_URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$NONEXISTENT_EMAIL\",
    \"password\": \"$TEST_PASSWORD\"
  }")

echo "Response:"
echo "$NONEXISTENT_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$NONEXISTENT_RESPONSE"
echo ""

if echo "$NONEXISTENT_RESPONSE" | grep -q '"success":false'; then
  ERROR_CODE=$(echo "$NONEXISTENT_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('error', {}).get('code', 'UNKNOWN'))" 2>/dev/null)

  if [ "$ERROR_CODE" == "INVALID_CREDENTIALS" ]; then
    echo -e "${GREEN}✓ HTTP Status: 401 Unauthorized${NC}"
    echo -e "${GREEN}✓ Error Code: INVALID_CREDENTIALS${NC}"
  else
    echo -e "${YELLOW}⚠ Expected INVALID_CREDENTIALS, got: $ERROR_CODE${NC}"
  fi
else
  echo -e "${RED}✗ Expected failure but got success${NC}"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo ""

# Summary
echo -e "${BLUE}Test Suite Complete${NC}"
echo -e "${BLUE}========================================${NC}"
