#!/bin/bash

# Tourist Hub API - Tour Management Examples using cURL
# This script demonstrates tour management workflows including templates, events, and registrations

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

print_step "Tourist Hub API Tour Management Examples"

# 1. Tour Template Management (System Admin)
print_step "1. Tour Template Management (System Admin)"
print_info "Logging in as System Administrator..."

if login_user "admin@touristhub.com" "admin123"; then
    
    # View all tour templates
    print_info "Fetching all tour templates..."
    
    TEMPLATES_RESPONSE=$(curl -s -X GET "$API_BASE_URL/api/tour-templates" \
      -H "$CONTENT_TYPE" \
      -H "Authorization: Bearer $ACCESS_TOKEN")
    
    if [[ $? -eq 0 ]]; then
        print_success "Retrieved tour templates"
        echo "Response: $TEMPLATES_RESPONSE"
    else
        print_error "Failed to retrieve templates"
    fi
    
    echo ""
    
    # Create new tour template
    print_info "Creating new tour template..."
    
    CREATE_TEMPLATE_RESPONSE=$(curl -s -X POST "$API_BASE_URL/api/tour-templates" \
      -H "$CONTENT_TYPE" \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -d '{
        "templateName": "Hajj Premium Package 2024",
        "type": "Hajj",
        "year": 2024,
        "startDate": "2024-06-15",
        "endDate": "2024-06-25",
        "detailedDescription": "Premium Hajj package with 5-star accommodations and guided tours",
        "sitesToVisit": [
          {
            "siteName": "Masjid al-Haram",
            "siteDescription": "The holiest mosque in Islam",
            "visitDate": "2024-06-16",
            "duration": "4 hours",
            "location": "Makkah, Saudi Arabia"
          },
          {
            "siteName": "Masjid an-Nabawi",
            "siteDescription": "The Prophet'\''s Mosque",
            "visitDate": "2024-06-20",
            "duration": "3 hours",
            "location": "Madinah, Saudi Arabia"
          }
        ]
      }')
    
    if [[ $? -eq 0 ]]; then
        print_success "Tour template created"
        TEMPLATE_ID=$(extract_json_value "$CREATE_TEMPLATE_RESPONSE" "templateId")
        print_info "Template ID: $TEMPLATE_ID"
        echo "Response: $CREATE_TEMPLATE_RESPONSE"
    else
        print_error "Failed to create template"
    fi
    
    echo ""
    
    # Update tour template
    print_info "Updating tour template..."
    
    UPDATE_TEMPLATE_RESPONSE=$(curl -s -X PUT "$API_BASE_URL/api/tour-templates/$TEMPLATE_ID" \
      -H "$CONTENT_TYPE" \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -d '{
        "detailedDescription": "Premium Hajj package with 5-star accommodations, guided tours, and VIP services"
      }')
    
    if [[ $? -eq 0 ]]; then
        print_success "Tour template updated"
        echo "Response: $UPDATE_TEMPLATE_RESPONSE"
    else
        print_error "Failed to update template"
    fi
    
    echo ""
fi

# 2. Tour Event Management (Provider Admin)
print_step "2. Tour Event Management (Provider Admin)"
print_info "Logging in as Provider Administrator..."

if login_user "provider@example.com" "password123"; then
    
    # View my tour events
    print_info "Fetching my tour events..."
    
    EVENTS_RESPONSE=$(curl -s -X GET "$API_BASE_URL/api/tour-events" \
      -H "$CONTENT_TYPE" \
      -H "Authorization: Bearer $ACCESS_TOKEN")
    
    if [[ $? -eq 0 ]]; then
        print_success "Retrieved tour events"
        echo "Response: $EVENTS_RESPONSE"
    else
        print_error "Failed to retrieve events"
    fi
    
    echo ""
    
    # Create new tour event
    print_info "Creating new tour event..."
    
    CREATE_EVENT_RESPONSE=$(curl -s -X POST "$API_BASE_URL/api/tour-events" \
      -H "$CONTENT_TYPE" \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -d '{
        "templateId": "template-uuid-here",
        "customTourName": "Premium Hajj Experience 2024",
        "startDate": "2024-06-15",
        "endDate": "2024-06-25",
        "packageType": "Premium",
        "place1Hotel": "Makkah Hilton",
        "place2Hotel": "Madinah Marriott",
        "numberOfAllowedTourists": 50,
        "groupChatInfo": "WhatsApp group will be created after registration approval"
      }')
    
    if [[ $? -eq 0 ]]; then
        print_success "Tour event created"
        EVENT_ID=$(extract_json_value "$CREATE_EVENT_RESPONSE" "tourEventId")
        print_info "Event ID: $EVENT_ID"
        echo "Response: $CREATE_EVENT_RESPONSE"
    else
        print_error "Failed to create event"
    fi
    
    echo ""
    
    # Update tour event status
    print_info "Updating tour event status to Active..."
    
    UPDATE_EVENT_RESPONSE=$(curl -s -X PUT "$API_BASE_URL/api/tour-events/$EVENT_ID" \
      -H "$CONTENT_TYPE" \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -d '{
        "status": "Active"
      }')
    
    if [[ $? -eq 0 ]]; then
        print_success "Tour event status updated"
        echo "Response: $UPDATE_EVENT_RESPONSE"
    else
        print_error "Failed to update event status"
    fi
    
    echo ""
    
    # Create tour schedule
    print_info "Creating tour schedule..."
    
    CREATE_ACTIVITY_RESPONSE=$(curl -s -X POST "$API_BASE_URL/api/tour-events/$EVENT_ID/activities" \
      -H "$CONTENT_TYPE" \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -d '{
        "activityDate": "2024-06-15",
        "islamicDate": "10 Dhul Hijjah 1445",
        "activityType": "Arrival",
        "description": "Airport pickup and hotel check-in",
        "startTime": "14:00",
        "endTime": "18:00",
        "location": "Jeddah Airport / Makkah Hotel",
        "webLink": "https://example.com/arrival-info"
      }')
    
    if [[ $? -eq 0 ]]; then
        print_success "Activity created"
        echo "Response: $CREATE_ACTIVITY_RESPONSE"
    else
        print_error "Failed to create activity"
    fi
    
    echo ""
    
    # View tour registrations
    print_info "Viewing tour registrations..."
    
    REGISTRATIONS_RESPONSE=$(curl -s -X GET "$API_BASE_URL/api/tour-events/$EVENT_ID/registrations" \
      -H "$CONTENT_TYPE" \
      -H "Authorization: Bearer $ACCESS_TOKEN")
    
    if [[ $? -eq 0 ]]; then
        print_success "Retrieved registrations"
        echo "Response: $REGISTRATIONS_RESPONSE"
    else
        print_error "Failed to retrieve registrations"
    fi
    
    echo ""
fi

# 3. Tourist Registration Workflow
print_step "3. Tourist Registration Workflow"
print_info "Logging in as Tourist..."

if login_user "tourist@example.com" "password123"; then
    
    # Browse available tour templates
    print_info "Browsing available tour templates..."
    
    BROWSE_TEMPLATES_RESPONSE=$(curl -s -X GET "$API_BASE_URL/api/tour-templates" \
      -H "$CONTENT_TYPE" \
      -H "Authorization: Bearer $ACCESS_TOKEN")
    
    if [[ $? -eq 0 ]]; then
        print_success "Retrieved available templates"
        echo "Response: $BROWSE_TEMPLATES_RESPONSE"
    else
        print_error "Failed to browse templates"
    fi
    
    echo ""
    
    # View available tour events
    print_info "Viewing available tour events..."
    
    AVAILABLE_EVENTS_RESPONSE=$(curl -s -X GET "$API_BASE_URL/api/tour-events" \
      -H "$CONTENT_TYPE" \
      -H "Authorization: Bearer $ACCESS_TOKEN")
    
    if [[ $? -eq 0 ]]; then
        print_success "Retrieved available events"
        echo "Response: $AVAILABLE_EVENTS_RESPONSE"
    else
        print_error "Failed to retrieve available events"
    fi
    
    echo ""
    
    # Register for tour event
    print_info "Registering for tour event..."
    
    REGISTER_RESPONSE=$(curl -s -X POST "$API_BASE_URL/api/tour-events/$EVENT_ID/register" \
      -H "$CONTENT_TYPE" \
      -H "Authorization: Bearer $ACCESS_TOKEN")
    
    if [[ $? -eq 0 ]]; then
        print_success "Registration submitted"
        echo "Response: $REGISTER_RESPONSE"
    else
        print_error "Registration failed"
    fi
    
    echo ""
    
    # View tour schedule
    print_info "Viewing tour schedule..."
    
    SCHEDULE_RESPONSE=$(curl -s -X GET "$API_BASE_URL/api/tour-events/$EVENT_ID/schedule" \
      -H "$CONTENT_TYPE" \
      -H "Authorization: Bearer $ACCESS_TOKEN")
    
    if [[ $? -eq 0 ]]; then
        print_success "Retrieved tour schedule"
        echo "Response: $SCHEDULE_RESPONSE"
    else
        print_error "Failed to retrieve schedule"
    fi
    
    echo ""
fi

# 4. Registration Management (Provider Admin)
print_step "4. Registration Management (Provider Admin)"
print_info "Logging back in as Provider Administrator..."

if login_user "provider@example.com" "password123"; then
    
    # View pending registrations
    print_info "Viewing pending registrations..."
    
    PENDING_REGISTRATIONS_RESPONSE=$(curl -s -X GET "$API_BASE_URL/api/tour-events/$EVENT_ID/registrations" \
      -H "$CONTENT_TYPE" \
      -H "Authorization: Bearer $ACCESS_TOKEN")
    
    if [[ $? -eq 0 ]]; then
        print_success "Retrieved pending registrations"
        echo "Response: $PENDING_REGISTRATIONS_RESPONSE"
    else
        print_error "Failed to retrieve registrations"
    fi
    
    echo ""
    
    # Approve registration
    print_info "Approving tourist registration..."
    
    APPROVE_RESPONSE=$(curl -s -X PUT "$API_BASE_URL/api/tour-events/$EVENT_ID/registrations/tourist-user-id" \
      -H "$CONTENT_TYPE" \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -d '{
        "status": "Approved",
        "notes": "Registration approved. Welcome to the tour!"
      }')
    
    if [[ $? -eq 0 ]]; then
        print_success "Registration approved"
        echo "Response: $APPROVE_RESPONSE"
    else
        print_error "Failed to approve registration"
    fi
    
    echo ""
fi

# 5. Document Management
print_step "5. Document Management"
print_info "Logging in as Tourist for document upload..."

if login_user "tourist@example.com" "password123"; then
    
    # Upload document (simulated with text file)
    print_info "Uploading document..."
    
    # Create a temporary file for demonstration
    echo "This is a sample passport document" > /tmp/sample_passport.txt
    
    UPLOAD_RESPONSE=$(curl -s -X POST "$API_BASE_URL/api/documents" \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -F "file=@/tmp/sample_passport.txt" \
      -F "type=Passport" \
      -F "description=Passport copy for tour registration")
    
    if [[ $? -eq 0 ]]; then
        print_success "Document uploaded"
        echo "Response: $UPLOAD_RESPONSE"
    else
        print_error "Document upload failed"
    fi
    
    # Clean up temporary file
    rm -f /tmp/sample_passport.txt
    
    echo ""
    
    # View my documents
    print_info "Viewing my documents..."
    
    DOCUMENTS_RESPONSE=$(curl -s -X GET "$API_BASE_URL/api/documents" \
      -H "$CONTENT_TYPE" \
      -H "Authorization: Bearer $ACCESS_TOKEN")
    
    if [[ $? -eq 0 ]]; then
        print_success "Retrieved documents"
        echo "Response: $DOCUMENTS_RESPONSE"
    else
        print_error "Failed to retrieve documents"
    fi
    
    echo ""
    
    # Download blank forms
    print_info "Downloading blank forms..."
    
    curl -s -X GET "$API_BASE_URL/api/documents/forms/blank" \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -o "/tmp/blank_forms.pdf"
    
    if [[ $? -eq 0 ]]; then
        print_success "Blank forms downloaded to /tmp/blank_forms.pdf"
    else
        print_error "Failed to download blank forms"
    fi
    
    echo ""
fi

# 6. Error Handling Examples
print_step "6. Error Handling Examples"

print_info "Testing various error scenarios..."

# Tourist trying to create tour event (should fail)
if login_user "tourist@example.com" "password123"; then
    print_info "Tourist attempting to create tour event (should fail)..."
    
    UNAUTHORIZED_CREATE_RESPONSE=$(curl -s -X POST "$API_BASE_URL/api/tour-events" \
      -H "$CONTENT_TYPE" \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -d '{
        "templateId": "template-uuid",
        "customTourName": "Unauthorized Event",
        "startDate": "2024-06-15",
        "endDate": "2024-06-25",
        "packageType": "Standard",
        "place1Hotel": "Hotel",
        "place2Hotel": "Hotel 2",
        "numberOfAllowedTourists": 10
      }')
    
    print_info "Expected 403 Forbidden response: $UNAUTHORIZED_CREATE_RESPONSE"
fi

echo ""

# Invalid tour event ID
print_info "Accessing invalid tour event ID..."
INVALID_EVENT_RESPONSE=$(curl -s -X GET "$API_BASE_URL/api/tour-events/invalid-uuid" \
  -H "$CONTENT_TYPE" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

print_info "Expected 404 Not Found response: $INVALID_EVENT_RESPONSE"

echo ""

print_step "Tour Management Examples Complete"
print_info "Key takeaways:"
echo "  • System Admins manage tour templates (create, update, delete)"
echo "  • Provider Admins create and manage tour events based on templates"
echo "  • Tourists can browse templates and events, register for tours"
echo "  • Registration workflow: Tourist registers → Provider approves/rejects"
echo "  • Document management supports file uploads with metadata"
echo "  • Always handle role-based access control and error responses"
echo "  • Use appropriate HTTP methods and status codes"