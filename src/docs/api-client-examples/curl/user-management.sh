#!/bin/bash

# Tourist Hub API - User Management Examples using cURL
# This script demonstrates user management workflows for different user roles

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

# Function to login and get token
login_user() {
    local email=$1
    local password=$2
    
    LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE_URL/api/auth/login" \
      -H "$CONTENT_TYPE" \
      -d "{
        \"emailAddress\": \"$email\",
        \"password\": \"$password\"
      }")
    
    if [[ $? -eq 0 ]]; then
        ACCESS_TOKEN=$(extract_json_value "$LOGIN_RESPONSE" "accessToken")
        print_success "Logged in as $email"
        return 0
    else
        print_error "Login failed for $email"
        return 1
    fi
}

print_step "Tourist Hub API User Management Examples"

# 1. System Admin Login
print_step "1. System Admin Operations"
print_info "Logging in as System Administrator..."

if login_user "admin@touristhub.com" "admin123"; then
    
    # View all users (System Admin only)
    print_info "Fetching all users in the system..."
    
    ALL_USERS_RESPONSE=$(curl -s -X GET "$API_BASE_URL/api/users" \
      -H "$CONTENT_TYPE" \
      -H "Authorization: Bearer $ACCESS_TOKEN")
    
    if [[ $? -eq 0 ]]; then
        print_success "Retrieved all users"
        echo "Response: $ALL_USERS_RESPONSE"
    else
        print_error "Failed to retrieve users"
    fi
    
    echo ""
    
    # Create new Provider Admin user
    print_info "Creating new Provider Admin user..."
    
    CREATE_USER_RESPONSE=$(curl -s -X POST "$API_BASE_URL/api/users" \
      -H "$CONTENT_TYPE" \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -d '{
        "firstName": "Sarah",
        "lastName": "Johnson",
        "emailAddress": "sarah.johnson@premiumtours.com",
        "phoneNumber": "+1-555-0456",
        "country": "United States",
        "password": "SecurePassword456!",
        "userType": "ProviderAdmin",
        "providerId": "provider-uuid-here"
      }')
    
    if [[ $? -eq 0 ]]; then
        print_success "Provider Admin user created"
        NEW_USER_ID=$(extract_json_value "$CREATE_USER_RESPONSE" "userId")
        print_info "New User ID: $NEW_USER_ID"
        echo "Response: $CREATE_USER_RESPONSE"
    else
        print_error "Failed to create user"
    fi
    
    echo ""
    
    # Update user status
    print_info "Updating user status..."
    
    UPDATE_USER_RESPONSE=$(curl -s -X PUT "$API_BASE_URL/api/users/$NEW_USER_ID" \
      -H "$CONTENT_TYPE" \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -d '{
        "status": "Active"
      }')
    
    if [[ $? -eq 0 ]]; then
        print_success "User status updated"
        echo "Response: $UPDATE_USER_RESPONSE"
    else
        print_error "Failed to update user"
    fi
    
    echo ""
fi

# 2. Provider Admin Operations
print_step "2. Provider Admin Operations"
print_info "Logging in as Provider Administrator..."

if login_user "provider@example.com" "password123"; then
    
    # View company users
    print_info "Fetching company users..."
    
    COMPANY_USERS_RESPONSE=$(curl -s -X GET "$API_BASE_URL/api/providers/provider-uuid/users" \
      -H "$CONTENT_TYPE" \
      -H "Authorization: Bearer $ACCESS_TOKEN")
    
    if [[ $? -eq 0 ]]; then
        print_success "Retrieved company users"
        echo "Response: $COMPANY_USERS_RESPONSE"
    else
        print_error "Failed to retrieve company users"
    fi
    
    echo ""
    
    # View specific user details
    print_info "Fetching specific user details..."
    
    USER_DETAILS_RESPONSE=$(curl -s -X GET "$API_BASE_URL/api/users/user-uuid-here" \
      -H "$CONTENT_TYPE" \
      -H "Authorization: Bearer $ACCESS_TOKEN")
    
    if [[ $? -eq 0 ]]; then
        print_success "Retrieved user details"
        echo "Response: $USER_DETAILS_RESPONSE"
    else
        print_error "Failed to retrieve user details"
    fi
    
    echo ""
fi

# 3. Tourist Operations
print_step "3. Tourist Operations"
print_info "Logging in as Tourist..."

if login_user "tourist@example.com" "password123"; then
    
    # View own profile
    print_info "Fetching own profile..."
    
    PROFILE_RESPONSE=$(curl -s -X GET "$API_BASE_URL/api/users/me" \
      -H "$CONTENT_TYPE" \
      -H "Authorization: Bearer $ACCESS_TOKEN")
    
    if [[ $? -eq 0 ]]; then
        print_success "Retrieved profile"
        USER_ID=$(extract_json_value "$PROFILE_RESPONSE" "userId")
        echo "Response: $PROFILE_RESPONSE"
    else
        print_error "Failed to retrieve profile"
    fi
    
    echo ""
    
    # Update own profile
    print_info "Updating profile information..."
    
    UPDATE_PROFILE_RESPONSE=$(curl -s -X PUT "$API_BASE_URL/api/users/$USER_ID" \
      -H "$CONTENT_TYPE" \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -d '{
        "phoneNumber": "+1-555-9999",
        "passportNumber": "US987654321",
        "dateOfBirth": "1985-03-20"
      }')
    
    if [[ $? -eq 0 ]]; then
        print_success "Profile updated"
        echo "Response: $UPDATE_PROFILE_RESPONSE"
    else
        print_error "Failed to update profile"
    fi
    
    echo ""
    
    # Attempt to view all users (should fail for Tourist)
    print_info "Attempting to view all users (should fail)..."
    
    UNAUTHORIZED_RESPONSE=$(curl -s -X GET "$API_BASE_URL/api/users" \
      -H "$CONTENT_TYPE" \
      -H "Authorization: Bearer $ACCESS_TOKEN")
    
    print_info "Expected 403 Forbidden response:"
    echo "Response: $UNAUTHORIZED_RESPONSE"
    
    echo ""
fi

# 4. Role-based Access Control Examples
print_step "4. Role-based Access Control Examples"

print_info "Testing different access levels..."

# Test System Admin access
print_info "System Admin trying to delete user..."
if login_user "admin@touristhub.com" "admin123"; then
    DELETE_RESPONSE=$(curl -s -X DELETE "$API_BASE_URL/api/users/user-to-delete-uuid" \
      -H "$CONTENT_TYPE" \
      -H "Authorization: Bearer $ACCESS_TOKEN")
    
    print_info "System Admin delete response: $DELETE_RESPONSE"
fi

echo ""

# Test Provider Admin access
print_info "Provider Admin trying to access other provider's data..."
if login_user "provider@example.com" "password123"; then
    OTHER_PROVIDER_RESPONSE=$(curl -s -X GET "$API_BASE_URL/api/providers/other-provider-uuid/users" \
      -H "$CONTENT_TYPE" \
      -H "Authorization: Bearer $ACCESS_TOKEN")
    
    print_info "Expected 403 Forbidden response: $OTHER_PROVIDER_RESPONSE"
fi

echo ""

# Test Tourist access
print_info "Tourist trying to create user..."
if login_user "tourist@example.com" "password123"; then
    CREATE_USER_TOURIST_RESPONSE=$(curl -s -X POST "$API_BASE_URL/api/users" \
      -H "$CONTENT_TYPE" \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -d '{
        "firstName": "Test",
        "lastName": "User",
        "emailAddress": "test@example.com",
        "phoneNumber": "+1-555-0000",
        "country": "United States",
        "password": "password123",
        "userType": "Tourist"
      }')
    
    print_info "Expected 403 Forbidden response: $CREATE_USER_TOURIST_RESPONSE"
fi

echo ""

# 5. Error Handling Examples
print_step "5. Error Handling Examples"

print_info "Testing various error scenarios..."

# Invalid user ID
print_info "Fetching user with invalid ID..."
INVALID_USER_RESPONSE=$(curl -s -X GET "$API_BASE_URL/api/users/invalid-uuid" \
  -H "$CONTENT_TYPE" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

print_info "Expected 404 Not Found response: $INVALID_USER_RESPONSE"

echo ""

# Invalid data format
print_info "Creating user with invalid data..."
INVALID_DATA_RESPONSE=$(curl -s -X POST "$API_BASE_URL/api/users" \
  -H "$CONTENT_TYPE" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "firstName": "",
    "emailAddress": "invalid-email",
    "userType": "InvalidRole"
  }')

print_info "Expected 400 Bad Request response: $INVALID_DATA_RESPONSE"

echo ""

print_step "User Management Examples Complete"
print_info "Key takeaways:"
echo "  • System Admins have full access to all users and operations"
echo "  • Provider Admins can only access users within their company"
echo "  • Tourists can only view and update their own profile"
echo "  • Always handle 403 Forbidden responses for unauthorized access"
echo "  • Validate user input and handle 400 Bad Request responses"
echo "  • Use appropriate HTTP methods: GET (read), POST (create), PUT (update), DELETE (remove)"