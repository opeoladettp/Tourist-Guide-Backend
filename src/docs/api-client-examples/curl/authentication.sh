#!/bin/bash

# Tourist Hub API - Authentication Examples using cURL
# This script demonstrates authentication workflows using cURL commands

# Configuration
API_BASE_URL="http://localhost:3000"
CONTENT_TYPE="Content-Type: application/json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_step() {
    echo -e "${BLUE}=== $1 ===${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

# Function to extract JSON value
extract_json_value() {
    echo "$1" | grep -o "\"$2\":[^,}]*" | cut -d':' -f2 | tr -d '"' | tr -d ' '
}

print_step "Tourist Hub API Authentication Examples"

# 1. User Registration
print_step "1. User Registration"
print_info "Registering a new tourist user..."

REGISTRATION_RESPONSE=$(curl -s -X POST "$API_BASE_URL/api/auth/register" \
  -H "$CONTENT_TYPE" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "emailAddress": "john.doe@example.com",
    "phoneNumber": "+1-555-0123",
    "country": "United States",
    "password": "SecurePassword123!",
    "userType": "Tourist",
    "passportNumber": "US123456789",
    "dateOfBirth": "1990-05-15",
    "gender": "Male"
  }')

if [[ $? -eq 0 ]]; then
    print_success "Registration successful"
    echo "Response: $REGISTRATION_RESPONSE"
else
    print_error "Registration failed"
fi

echo ""

# 2. User Login
print_step "2. User Login"
print_info "Logging in with credentials..."

LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE_URL/api/auth/login" \
  -H "$CONTENT_TYPE" \
  -d '{
    "emailAddress": "tourist@example.com",
    "password": "password123"
  }')

if [[ $? -eq 0 ]]; then
    print_success "Login successful"
    
    # Extract tokens from response
    ACCESS_TOKEN=$(extract_json_value "$LOGIN_RESPONSE" "accessToken")
    REFRESH_TOKEN=$(extract_json_value "$LOGIN_RESPONSE" "refreshToken")
    
    print_info "Access Token: ${ACCESS_TOKEN:0:50}..."
    print_info "Refresh Token: ${REFRESH_TOKEN:0:50}..."
    
    echo "Full Response: $LOGIN_RESPONSE"
else
    print_error "Login failed"
    exit 1
fi

echo ""

# 3. Making Authenticated Request
print_step "3. Making Authenticated Request"
print_info "Fetching user profile with access token..."

PROFILE_RESPONSE=$(curl -s -X GET "$API_BASE_URL/api/users/me" \
  -H "$CONTENT_TYPE" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

if [[ $? -eq 0 ]]; then
    print_success "Profile fetch successful"
    echo "Response: $PROFILE_RESPONSE"
else
    print_error "Profile fetch failed"
fi

echo ""

# 4. Token Refresh
print_step "4. Token Refresh"
print_info "Refreshing access token..."

REFRESH_RESPONSE=$(curl -s -X POST "$API_BASE_URL/api/auth/refresh" \
  -H "$CONTENT_TYPE" \
  -d "{
    \"refreshToken\": \"$REFRESH_TOKEN\"
  }")

if [[ $? -eq 0 ]]; then
    print_success "Token refresh successful"
    
    # Extract new tokens
    NEW_ACCESS_TOKEN=$(extract_json_value "$REFRESH_RESPONSE" "accessToken")
    NEW_REFRESH_TOKEN=$(extract_json_value "$REFRESH_RESPONSE" "refreshToken")
    
    print_info "New Access Token: ${NEW_ACCESS_TOKEN:0:50}..."
    print_info "New Refresh Token: ${NEW_REFRESH_TOKEN:0:50}..."
    
    # Update tokens for subsequent requests
    ACCESS_TOKEN=$NEW_ACCESS_TOKEN
    REFRESH_TOKEN=$NEW_REFRESH_TOKEN
    
    echo "Full Response: $REFRESH_RESPONSE"
else
    print_error "Token refresh failed"
fi

echo ""

# 5. Testing Token Expiration Handling
print_step "5. Testing with Invalid Token"
print_info "Making request with invalid token to test error handling..."

INVALID_RESPONSE=$(curl -s -X GET "$API_BASE_URL/api/users" \
  -H "$CONTENT_TYPE" \
  -H "Authorization: Bearer invalid_token_here")

print_info "Expected 401 Unauthorized response:"
echo "Response: $INVALID_RESPONSE"

echo ""

# 6. Logout
print_step "6. User Logout"
print_info "Logging out and invalidating tokens..."

LOGOUT_RESPONSE=$(curl -s -X POST "$API_BASE_URL/api/auth/logout" \
  -H "$CONTENT_TYPE" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d "{
    \"refreshToken\": \"$REFRESH_TOKEN\"
  }")

if [[ $? -eq 0 ]]; then
    print_success "Logout successful"
    echo "Response: $LOGOUT_RESPONSE"
else
    print_error "Logout failed"
fi

echo ""

# 7. Testing After Logout
print_step "7. Testing After Logout"
print_info "Attempting to use token after logout (should fail)..."

POST_LOGOUT_RESPONSE=$(curl -s -X GET "$API_BASE_URL/api/users" \
  -H "$CONTENT_TYPE" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

print_info "Expected 401 Unauthorized response:"
echo "Response: $POST_LOGOUT_RESPONSE"

echo ""

print_step "Authentication Examples Complete"
print_info "Key takeaways:"
echo "  • Always include 'Authorization: Bearer <token>' header for protected endpoints"
echo "  • Handle 401 responses by refreshing tokens"
echo "  • Store refresh tokens securely and use them to get new access tokens"
echo "  • Logout properly to invalidate tokens on the server"
echo "  • Implement proper error handling for authentication failures"