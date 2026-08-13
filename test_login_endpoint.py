#!/usr/bin/env python3
"""
Login Endpoint Test Suite
Tests POST /api/auth/login with various scenarios
"""

import requests
import json
import base64
import sys
import io
from datetime import datetime
from typing import Dict, Any, Tuple

# Handle encoding on Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

class LoginEndpointTester:
    def __init__(self, base_url: str = "http://localhost:3000"):
        self.base_url = base_url
        self.register_url = f"{base_url}/api/auth/register"
        self.login_url = f"{base_url}/api/auth/login"
        self.test_results = []

    def print_header(self, text: str):
        """Print a formatted header"""
        print("\n" + "=" * 60)
        print(f"  {text}")
        print("=" * 60 + "\n")

    def print_step(self, step: int, text: str):
        """Print a step header"""
        print(f"\n{'─' * 60}")
        print(f"STEP {step}: {text}")
        print(f"{'─' * 60}\n")

    def print_success(self, text: str):
        """Print success message"""
        print(f"✓ {text}")

    def print_error(self, text: str):
        """Print error message"""
        print(f"✗ {text}")

    def print_warning(self, text: str):
        """Print warning message"""
        print(f"⚠ {text}")

    def print_info(self, text: str):
        """Print info message"""
        print(f"→ {text}")

    def decode_jwt(self, token: str) -> Dict[str, Any]:
        """Decode JWT token (without verification)"""
        try:
            parts = token.split('.')
            if len(parts) != 3:
                return {}

            payload = parts[1]
            # Add padding if needed
            padding = 4 - (len(payload) % 4)
            if padding != 4:
                payload += '=' * padding

            decoded = base64.urlsafe_b64decode(payload)
            return json.loads(decoded)
        except Exception as e:
            print(f"Error decoding JWT: {e}")
            return {}

    def register_user(self, email: str, password: str, company_cnpj: str, company_name: str) -> Tuple[bool, Dict]:
        """Register a test user"""
        try:
            response = requests.post(
                self.register_url,
                json={
                    "email": email,
                    "password": password,
                    "company_cnpj": company_cnpj,
                    "company_name": company_name
                },
                timeout=5
            )
            data = response.json()
            return response.status_code == 201 and data.get('success'), data
        except Exception as e:
            self.print_error(f"Registration request failed: {e}")
            return False, {}

    def test_valid_login(self, email: str, password: str) -> Tuple[bool, Dict]:
        """Test 1: Login with valid credentials"""
        try:
            response = requests.post(
                self.login_url,
                json={
                    "email": email,
                    "password": password
                },
                timeout=5
            )
            data = response.json()

            print(f"Endpoint: POST {self.login_url}")
            print(f"Request Body: {json.dumps({'email': email, 'password': '***'}, indent=2)}\n")
            print(f"HTTP Status: {response.status_code}")
            print(f"Response:\n{json.dumps(data, indent=2)}\n")

            # Verify response structure
            checks = {
                "Status 200": response.status_code == 200,
                "Success flag": data.get('success') == True,
                "Access token provided": 'access_token' in data,
                "Refresh token provided": 'refresh_token' in data,
                "User object present": 'user' in data,
                "Company ID in response": 'company_id' in data,
            }

            print("Response Structure Checks:")
            for check, passed in checks.items():
                if passed:
                    self.print_success(check)
                else:
                    self.print_error(check)

            # Verify JWT claims
            if data.get('access_token'):
                print("\nJWT Token Claims:")
                claims = self.decode_jwt(data['access_token'])

                if claims:
                    print(f"Decoded Payload:\n{json.dumps(claims, indent=2)}\n")

                    claims_checks = {
                        "user_id claim": 'user_id' in claims,
                        "email claim": 'email' in claims,
                        "company_id claim": 'company_id' in claims,
                        "role claim": 'role' in claims,
                    }

                    print("Token Claims Verification:")
                    all_claims_valid = True
                    for check, passed in claims_checks.items():
                        if passed:
                            self.print_success(check)
                        else:
                            self.print_error(check)
                            all_claims_valid = False

                    if all_claims_valid:
                        self.test_results.append(("Valid Login - JWT Claims", True))
                    else:
                        self.test_results.append(("Valid Login - JWT Claims", False))
                else:
                    self.print_error("Could not decode JWT")
                    self.test_results.append(("Valid Login - JWT Claims", False))

            if response.status_code == 200 and data.get('success'):
                self.test_results.append(("Valid Login - HTTP 200", True))
                return True, data
            else:
                self.test_results.append(("Valid Login - HTTP 200", False))
                return False, data

        except requests.exceptions.RequestException as e:
            self.print_error(f"Request failed: {e}")
            self.test_results.append(("Valid Login - HTTP 200", False))
            return False, {}

    def test_invalid_password(self, email: str, password: str) -> Tuple[bool, Dict]:
        """Test 2: Login with invalid password"""
        try:
            response = requests.post(
                self.login_url,
                json={
                    "email": email,
                    "password": password
                },
                timeout=5
            )
            data = response.json()

            print(f"Endpoint: POST {self.login_url}")
            print(f"Request Body: {json.dumps({'email': email, 'password': '***'}, indent=2)}\n")
            print(f"HTTP Status: {response.status_code}")
            print(f"Response:\n{json.dumps(data, indent=2)}\n")

            # Verify response
            checks = {
                "Status 401": response.status_code == 401,
                "Success is false": data.get('success') == False,
                "Error code is INVALID_CREDENTIALS": data.get('error', {}).get('code') == 'INVALID_CREDENTIALS',
                "Error message present": 'message' in data.get('error', {}),
            }

            print("Response Validation:")
            for check, passed in checks.items():
                if passed:
                    self.print_success(check)
                else:
                    self.print_error(check)

            if all(checks.values()):
                self.test_results.append(("Invalid Password - 401 Response", True))
                return True, data
            else:
                self.test_results.append(("Invalid Password - 401 Response", False))
                return False, data

        except requests.exceptions.RequestException as e:
            self.print_error(f"Request failed: {e}")
            self.test_results.append(("Invalid Password - 401 Response", False))
            return False, {}

    def test_nonexistent_user(self, email: str, password: str) -> Tuple[bool, Dict]:
        """Test 3: Login with non-existent user"""
        try:
            response = requests.post(
                self.login_url,
                json={
                    "email": email,
                    "password": password
                },
                timeout=5
            )
            data = response.json()

            print(f"Endpoint: POST {self.login_url}")
            print(f"Request Body: {json.dumps({'email': email, 'password': '***'}, indent=2)}\n")
            print(f"HTTP Status: {response.status_code}")
            print(f"Response:\n{json.dumps(data, indent=2)}\n")

            # Verify response
            checks = {
                "Status 401": response.status_code == 401,
                "Success is false": data.get('success') == False,
                "Error code is INVALID_CREDENTIALS": data.get('error', {}).get('code') == 'INVALID_CREDENTIALS',
                "Generic error message": 'Invalid email or password' in data.get('error', {}).get('message', ''),
            }

            print("Response Validation:")
            for check, passed in checks.items():
                if passed:
                    self.print_success(check)
                else:
                    self.print_error(check)

            if all(checks.values()):
                self.test_results.append(("Non-existent User - 401 Response", True))
                return True, data
            else:
                self.test_results.append(("Non-existent User - 401 Response", False))
                return False, data

        except requests.exceptions.RequestException as e:
            self.print_error(f"Request failed: {e}")
            self.test_results.append(("Non-existent User - 401 Response", False))
            return False, {}

    def run_all_tests(self):
        """Run the complete test suite"""
        self.print_header("Login Endpoint Test Suite")

        # Test data
        test_email = "testuser@example.com"
        test_password = "TestPassword123!"
        wrong_password = "WrongPassword123!"
        nonexistent_email = "nonexistent@example.com"
        company_cnpj = "12345678901234"
        company_name = "Test Company"

        # Step 0: Register user
        self.print_step(0, "Register Test User")
        print(f"Endpoint: POST {self.register_url}")
        print(f"Request Body:\n{json.dumps({'email': test_email, 'password': '***', 'company_cnpj': company_cnpj, 'company_name': company_name}, indent=2)}\n")

        success, response = self.register_user(test_email, test_password, company_cnpj, company_name)

        if success:
            self.print_success("User registered successfully")
            print(f"Response:\n{json.dumps(response, indent=2)}\n")
        else:
            if 'error' in response and response['error'].get('code') == 'USER_ALREADY_EXISTS':
                self.print_warning("User already exists (this is OK for testing)")
                print(f"Response:\n{json.dumps(response, indent=2)}\n")
            else:
                self.print_error("User registration failed")
                print(f"Response:\n{json.dumps(response, indent=2)}\n")

        # Step 1: Test valid login
        self.print_step(1, "Login with Valid Credentials")
        self.test_valid_login(test_email, test_password)

        # Step 2: Test invalid password
        self.print_step(2, "Login with Invalid Password (expect 401)")
        self.test_invalid_password(test_email, wrong_password)

        # Step 3: Test non-existent user
        self.print_step(3, "Login with Non-existent User (expect 401)")
        self.test_nonexistent_user(nonexistent_email, test_password)

        # Print summary
        self.print_header("Test Summary")

        passed = sum(1 for _, result in self.test_results if result)
        total = len(self.test_results)

        print(f"Results: {passed}/{total} tests passed\n")

        for test_name, result in self.test_results:
            symbol = "✓" if result else "✗"
            status = "PASS" if result else "FAIL"
            print(f"{symbol} {test_name}: {status}")

        if passed == total:
            print("\n" + "🎉 " * 10)
            print("All tests passed!")
            print("🎉 " * 10)
            return 0
        else:
            print(f"\n⚠️  {total - passed} test(s) failed")
            return 1

if __name__ == "__main__":
    tester = LoginEndpointTester()
    exit_code = tester.run_all_tests()
    sys.exit(exit_code)
