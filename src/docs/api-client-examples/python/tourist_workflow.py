"""
Tourist Hub API - Tourist Workflow Examples

This example demonstrates common workflows for Tourist users,
including profile management, tour registration, and document handling.
"""

import os
from typing import List, Dict, Any, Optional
from datetime import datetime
import logging
from basic_client import TouristHubClient

logger = logging.getLogger(__name__)


class TouristWorkflow:
    """Tourist-specific workflow examples."""
    
    def __init__(self, base_url: str = "http://localhost:3000"):
        self.client = TouristHubClient(base_url)
    
    def register_and_setup_profile(self, registration_data: Dict[str, Any]) -> Dict[str, Any]:
        """Complete tourist registration and setup workflow."""
        try:
            logger.info("🚀 Starting tourist registration workflow...")
            
            # 1. Register new tourist account
            logger.info("📝 Registering new account...")
            registration_response = self.client.post('/api/auth/register', {
                **registration_data,
                'userType': 'Tourist'
            })
            logger.info("✅ Registration successful")
            
            # 2. Login with new credentials
            logger.info("🔐 Logging in...")
            self.client.login(registration_data['emailAddress'], registration_data['password'])
            
            # 3. Update profile with additional information
            logger.info("👤 Updating profile...")
            profile_update = {
                'passportNumber': registration_data.get('passportNumber'),
                'dateOfBirth': registration_data.get('dateOfBirth'),
                'gender': registration_data.get('gender')
            }
            
            # Remove None values
            profile_update = {k: v for k, v in profile_update.items() if v is not None}
            
            updated_user = self.client.put(f"/api/users/{self.client.user['userId']}", profile_update)
            logger.info("✅ Profile updated successfully")
            
            return updated_user
        except Exception as e:
            logger.error(f"❌ Registration workflow failed: {e}")
            raise e
    
    def browse_tour_templates(self, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Browse and search available tour templates."""
        try:
            logger.info("🔍 Browsing tour templates...")
            
            templates = self.client.get('/api/tour-templates', filters or {})
            
            logger.info(f"📋 Found {len(templates)} tour templates:")
            for template in templates:
                logger.info(f"  • {template['templateName']} ({template['type']})")
                logger.info(f"    📅 {template['startDate']} to {template['endDate']}")
                logger.info(f"    📍 {len(template.get('sitesToVisit', []))} sites to visit")
                logger.info("")
            
            return templates
        except Exception as e:
            logger.error(f"❌ Failed to browse templates: {e}")
            raise e
    
    def view_available_tour_events(self, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """View available tour events based on templates."""
        try:
            logger.info("🎯 Viewing available tour events...")
            
            events = self.client.get('/api/tour-events', filters or {})
            
            logger.info(f"🎪 Found {len(events)} available tour events:")
            for event in events:
                logger.info(f"  • {event['customTourName']}")
                logger.info(f"    📅 {event['startDate']} to {event['endDate']}")
                logger.info(f"    👥 {event['remainingTourists']}/{event['numberOfAllowedTourists']} spots available")
                logger.info(f"    🏨 Hotels: {event['place1Hotel']}, {event['place2Hotel']}")
                logger.info(f"    📊 Status: {event['status']}")
                logger.info("")
            
            return events
        except Exception as e:
            logger.error(f"❌ Failed to view tour events: {e}")
            raise e
    
    def register_for_tour(self, tour_event_id: str) -> Dict[str, Any]:
        """Register for a tour event."""
        try:
            logger.info(f"📝 Registering for tour event: {tour_event_id}")
            
            # First, get tour event details
            tour_event = self.client.get(f"/api/tour-events/{tour_event_id}")
            logger.info(f"🎪 Tour: {tour_event['customTourName']}")
            
            # Check availability
            if tour_event['remainingTourists'] <= 0:
                raise ValueError("Tour is fully booked")
            
            if tour_event['status'] != 'Active':
                raise ValueError(f"Tour is not available for registration (Status: {tour_event['status']})")
            
            # Register for the tour
            registration = self.client.post(f"/api/tour-events/{tour_event_id}/register")
            
            logger.info("✅ Registration successful!")
            logger.info(f"📋 Registration Status: {registration['status']}")
            
            if registration['status'] == 'Pending':
                logger.info("⏳ Your registration is pending approval from the provider")
            
            return registration
        except Exception as e:
            logger.error(f"❌ Tour registration failed: {e}")
            raise e
    
    def view_tour_schedule(self, tour_event_id: str) -> List[Dict[str, Any]]:
        """View tour schedule and activities."""
        try:
            logger.info(f"📅 Viewing schedule for tour: {tour_event_id}")
            
            schedule = self.client.get(f"/api/tour-events/{tour_event_id}/schedule")
            
            logger.info("📋 Tour Schedule:")
            for activity in schedule:
                logger.info(f"  📅 {activity['activityDate']} ({activity.get('islamicDate', 'N/A')})")
                logger.info(f"    🕐 {activity['startTime']} - {activity['endTime']}")
                logger.info(f"    🎯 {activity['activityType']}: {activity['description']}")
                logger.info(f"    📍 Location: {activity['location']}")
                if activity.get('webLink'):
                    logger.info(f"    🔗 Link: {activity['webLink']}")
                logger.info("")
            
            return schedule
        except Exception as e:
            logger.error(f"❌ Failed to view schedule: {e}")
            raise e
    
    def upload_document(self, file_path: str, document_type: str, description: str = "") -> Dict[str, Any]:
        """Upload document (passport, ticket, etc.)."""
        try:
            logger.info(f"📄 Uploading {document_type} document...")
            
            # Check if file exists
            if not os.path.exists(file_path):
                raise FileNotFoundError(f"File not found: {file_path}")
            
            upload_data = {
                'type': document_type,
                'description': description
            }
            
            document = self.client.upload_file('/api/documents', file_path, upload_data)
            
            logger.info("✅ Document uploaded successfully")
            logger.info(f"📄 Document ID: {document['documentId']}")
            logger.info(f"📁 File: {document['fileName']}")
            
            return document
        except Exception as e:
            logger.error(f"❌ Document upload failed: {e}")
            raise e
    
    def view_my_documents(self) -> List[Dict[str, Any]]:
        """View uploaded documents."""
        try:
            logger.info("📂 Viewing my documents...")
            
            documents = self.client.get('/api/documents')
            
            logger.info(f"📋 Found {len(documents)} documents:")
            for doc in documents:
                logger.info(f"  📄 {doc['fileName']} ({doc['type']})")
                logger.info(f"    📝 {doc.get('description', 'No description')}")
                logger.info(f"    📅 Uploaded: {datetime.fromisoformat(doc['uploadDate'].replace('Z', '+00:00')).strftime('%Y-%m-%d')}")
                logger.info(f"    💾 Size: {self._format_file_size(doc['fileSize'])}")
                logger.info("")
            
            return documents
        except Exception as e:
            logger.error(f"❌ Failed to view documents: {e}")
            raise e
    
    def download_blank_forms(self, save_path: str = "tour-forms.pdf") -> str:
        """Download blank tour forms."""
        try:
            logger.info("📋 Downloading blank tour forms...")
            
            # Make request with stream=True for file download
            import requests
            headers = self.client._get_headers()
            url = f"{self.client.base_url}/api/documents/forms/blank"
            
            response = requests.get(url, headers=headers, stream=True)
            response.raise_for_status()
            
            with open(save_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            
            logger.info(f"✅ Blank forms downloaded to: {save_path}")
            return save_path
        except Exception as e:
            logger.error(f"❌ Failed to download forms: {e}")
            raise e
    
    def view_my_registrations(self) -> List[Dict[str, Any]]:
        """View my tour registrations."""
        try:
            logger.info("📋 Viewing my tour registrations...")
            
            # Get tour events where I'm registered
            events = self.client.get('/api/tour-events')
            my_registrations = [
                event for event in events 
                if self.client.user['userId'] in event.get('registeredTourists', [])
            ]
            
            logger.info(f"🎪 Found {len(my_registrations)} registrations:")
            for event in my_registrations:
                logger.info(f"  • {event['customTourName']}")
                logger.info(f"    📅 {event['startDate']} to {event['endDate']}")
                logger.info(f"    📊 Status: {event['status']}")
                logger.info("")
            
            return my_registrations
        except Exception as e:
            logger.error(f"❌ Failed to view registrations: {e}")
            raise e
    
    def update_profile(self, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update profile information."""
        try:
            logger.info("👤 Updating profile...")
            
            updated_user = self.client.put(f"/api/users/{self.client.user['userId']}", updates)
            
            logger.info("✅ Profile updated successfully")
            logger.info(f"👤 Name: {updated_user['firstName']} {updated_user['lastName']}")
            logger.info(f"📧 Email: {updated_user['emailAddress']}")
            logger.info(f"📱 Phone: {updated_user['phoneNumber']}")
            
            return updated_user
        except Exception as e:
            logger.error(f"❌ Profile update failed: {e}")
            raise e
    
    def _format_file_size(self, bytes_size: int) -> str:
        """Format file size in human readable format."""
        if bytes_size == 0:
            return "0 Bytes"
        
        k = 1024
        sizes = ["Bytes", "KB", "MB", "GB"]
        i = 0
        
        while bytes_size >= k and i < len(sizes) - 1:
            bytes_size /= k
            i += 1
        
        return f"{bytes_size:.2f} {sizes[i]}"


def tourist_example():
    """Example usage of tourist workflow."""
    workflow = TouristWorkflow()
    
    try:
        logger.info("=== Tourist Workflow Example ===\n")
        
        # Login (assuming account already exists)
        workflow.client.login('tourist@example.com', 'password123')
        
        # Browse available tours
        workflow.browse_tour_templates()
        
        # View available tour events
        events = workflow.view_available_tour_events()
        
        if events:
            # Register for first available tour
            workflow.register_for_tour(events[0]['tourEventId'])
            
            # View tour schedule
            workflow.view_tour_schedule(events[0]['tourEventId'])
        
        # View my documents
        workflow.view_my_documents()
        
        # View my registrations
        workflow.view_my_registrations()
        
        # Logout
        workflow.client.logout()
        
    except Exception as e:
        logger.error(f"Tourist workflow example failed: {e}")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    tourist_example()