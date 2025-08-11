"""
Tourist Hub API - Provider Admin Workflow Examples

This example demonstrates common workflows for Provider Admin users,
including tour event management, tourist registration handling, and schedule management.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime
import logging
from basic_client import TouristHubClient

logger = logging.getLogger(__name__)


class ProviderAdminWorkflow:
    """Provider Admin-specific workflow examples."""
    
    def __init__(self, base_url: str = "http://localhost:3000"):
        self.client = TouristHubClient(base_url)
    
    def create_tour_event(self, tour_event_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new custom tour event based on a template."""
        try:
            logger.info("🎪 Creating new tour event...")
            
            # First, verify the template exists
            template = self.client.get(f"/api/tour-templates/{tour_event_data['templateId']}")
            logger.info(f"📋 Using template: {template['templateName']}")
            
            # Create the tour event
            tour_event = self.client.post('/api/tour-events', tour_event_data)
            
            logger.info("✅ Tour event created successfully!")
            logger.info(f"🎪 Event: {tour_event['customTourName']}")
            logger.info(f"📅 Dates: {tour_event['startDate']} to {tour_event['endDate']}")
            logger.info(f"👥 Capacity: {tour_event['numberOfAllowedTourists']} tourists")
            logger.info(f"🏨 Hotels: {tour_event['place1Hotel']}, {tour_event['place2Hotel']}")
            
            return tour_event
        except Exception as e:
            logger.error(f"❌ Failed to create tour event: {e}")
            raise e
    
    def view_my_tour_events(self) -> List[Dict[str, Any]]:
        """View and manage tour events for this provider."""
        try:
            logger.info("🎪 Viewing my tour events...")
            
            events = self.client.get('/api/tour-events')
            
            logger.info(f"📋 Found {len(events)} tour events:")
            for event in events:
                registered = event['numberOfAllowedTourists'] - event['remainingTourists']
                logger.info(f"  • {event['customTourName']} ({event['status']})")
                logger.info(f"    📅 {event['startDate']} to {event['endDate']}")
                logger.info(f"    👥 {registered}/{event['numberOfAllowedTourists']} registered")
                logger.info(f"    🆔 ID: {event['tourEventId']}")
                logger.info("")
            
            return events
        except Exception as e:
            logger.error(f"❌ Failed to view tour events: {e}")
            raise e
    
    def update_tour_event(self, tour_event_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update tour event details."""
        try:
            logger.info(f"✏️ Updating tour event: {tour_event_id}")
            
            updated_event = self.client.put(f"/api/tour-events/{tour_event_id}", updates)
            
            logger.info("✅ Tour event updated successfully")
            logger.info(f"🎪 Event: {updated_event['customTourName']}")
            logger.info(f"📊 Status: {updated_event['status']}")
            
            return updated_event
        except Exception as e:
            logger.error(f"❌ Failed to update tour event: {e}")
            raise e
    
    def view_tour_registrations(self, tour_event_id: str) -> List[Dict[str, Any]]:
        """View tourist registrations for a tour event."""
        try:
            logger.info(f"👥 Viewing registrations for tour: {tour_event_id}")
            
            registrations = self.client.get(f"/api/tour-events/{tour_event_id}/registrations")
            
            logger.info(f"📋 Found {len(registrations)} registrations:")
            for registration in registrations:
                user = registration['user']
                logger.info(f"  • {user['firstName']} {user['lastName']}")
                logger.info(f"    📧 {user['emailAddress']}")
                logger.info(f"    📱 {user['phoneNumber']}")
                logger.info(f"    📊 Status: {registration['status']}")
                logger.info(f"    📅 Registered: {datetime.fromisoformat(registration['registrationDate'].replace('Z', '+00:00')).strftime('%Y-%m-%d')}")
                logger.info("")
            
            return registrations
        except Exception as e:
            logger.error(f"❌ Failed to view registrations: {e}")
            raise e
    
    def handle_registration(self, tour_event_id: str, user_id: str, action: str, notes: str = "") -> Dict[str, Any]:
        """Approve or reject tourist registration."""
        try:
            action_emoji = "✅" if action == "approve" else "❌"
            logger.info(f"{action_emoji} {action.capitalize()}ing registration for user: {user_id}")
            
            status = "Approved" if action == "approve" else "Rejected"
            result = self.client.put(f"/api/tour-events/{tour_event_id}/registrations/{user_id}", {
                'status': status,
                'notes': notes
            })
            
            logger.info(f"✅ Registration {action}ed successfully")
            if notes:
                logger.info(f"📝 Notes: {notes}")
            
            return result
        except Exception as e:
            logger.error(f"❌ Failed to {action} registration: {e}")
            raise e
    
    def create_tour_schedule(self, tour_event_id: str, activities: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Create daily schedule activities for a tour event."""
        try:
            logger.info(f"📅 Creating schedule for tour: {tour_event_id}")
            
            created_activities = []
            
            for activity in activities:
                logger.info(f"  📝 Adding activity: {activity['description']}")
                
                created_activity = self.client.post(f"/api/tour-events/{tour_event_id}/activities", activity)
                created_activities.append(created_activity)
                
                logger.info(f"    ✅ Added: {activity['activityType']} on {activity['activityDate']}")
            
            logger.info(f"✅ Schedule created with {len(created_activities)} activities")
            return created_activities
        except Exception as e:
            logger.error(f"❌ Failed to create schedule: {e}")
            raise e
    
    def update_activity(self, tour_event_id: str, activity_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update an existing activity in the schedule."""
        try:
            logger.info(f"✏️ Updating activity: {activity_id}")
            
            updated_activity = self.client.put(f"/api/tour-events/{tour_event_id}/activities/{activity_id}", updates)
            
            logger.info("✅ Activity updated successfully")
            logger.info(f"📝 {updated_activity['activityType']}: {updated_activity['description']}")
            logger.info(f"📅 {updated_activity['activityDate']} {updated_activity['startTime']}-{updated_activity['endTime']}")
            
            return updated_activity
        except Exception as e:
            logger.error(f"❌ Failed to update activity: {e}")
            raise e
    
    def view_company_users(self) -> List[Dict[str, Any]]:
        """View and manage company users."""
        try:
            logger.info("👥 Viewing company users...")
            
            provider = self.client.get(f"/api/providers/{self.client.user['providerId']}")
            users = self.client.get(f"/api/providers/{self.client.user['providerId']}/users")
            
            logger.info(f"🏢 Company: {provider['companyName']}")
            logger.info(f"👥 Found {len(users)} users:")
            
            for user in users:
                logger.info(f"  • {user['firstName']} {user['lastName']} ({user['userType']})")
                logger.info(f"    📧 {user['emailAddress']}")
                logger.info(f"    📱 {user['phoneNumber']}")
                logger.info(f"    📊 Status: {user['status']}")
                logger.info("")
            
            return users
        except Exception as e:
            logger.error(f"❌ Failed to view company users: {e}")
            raise e
    
    def view_tourist_documents(self, user_id: str) -> List[Dict[str, Any]]:
        """View tourist documents (for registered tourists)."""
        try:
            logger.info(f"📂 Viewing documents for user: {user_id}")
            
            documents = self.client.get(f"/api/users/{user_id}/documents")
            
            logger.info(f"📋 Found {len(documents)} documents:")
            for doc in documents:
                logger.info(f"  📄 {doc['fileName']} ({doc['type']})")
                logger.info(f"    📝 {doc.get('description', 'No description')}")
                logger.info(f"    📅 Uploaded: {datetime.fromisoformat(doc['uploadDate'].replace('Z', '+00:00')).strftime('%Y-%m-%d')}")
                logger.info(f"    💾 Size: {self._format_file_size(doc['fileSize'])}")
                logger.info("")
            
            return documents
        except Exception as e:
            logger.error(f"❌ Failed to view tourist documents: {e}")
            raise e
    
    def generate_tour_report(self, tour_event_id: str) -> Dict[str, Any]:
        """Generate tour event report."""
        try:
            logger.info(f"📊 Generating report for tour: {tour_event_id}")
            
            # Get tour event details
            tour_event = self.client.get(f"/api/tour-events/{tour_event_id}")
            
            # Get registrations
            registrations = self.client.get(f"/api/tour-events/{tour_event_id}/registrations")
            
            # Get schedule
            schedule = self.client.get(f"/api/tour-events/{tour_event_id}/schedule")
            
            # Calculate summary statistics
            approved_registrations = [r for r in registrations if r['status'] == 'Approved']
            pending_registrations = [r for r in registrations if r['status'] == 'Pending']
            rejected_registrations = [r for r in registrations if r['status'] == 'Rejected']
            
            occupancy_rate = (len(approved_registrations) / tour_event['numberOfAllowedTourists']) * 100
            
            report = {
                'tourEvent': tour_event,
                'registrations': registrations,
                'schedule': schedule,
                'summary': {
                    'totalRegistrations': len(registrations),
                    'approvedRegistrations': len(approved_registrations),
                    'pendingRegistrations': len(pending_registrations),
                    'rejectedRegistrations': len(rejected_registrations),
                    'totalActivities': len(schedule),
                    'occupancyRate': round(occupancy_rate, 1)
                }
            }
            
            logger.info("📊 Tour Event Report:")
            logger.info(f"🎪 Event: {report['tourEvent']['customTourName']}")
            logger.info(f"📅 Dates: {report['tourEvent']['startDate']} to {report['tourEvent']['endDate']}")
            logger.info(f"👥 Registrations: {report['summary']['totalRegistrations']} total")
            logger.info(f"  ✅ Approved: {report['summary']['approvedRegistrations']}")
            logger.info(f"  ⏳ Pending: {report['summary']['pendingRegistrations']}")
            logger.info(f"  ❌ Rejected: {report['summary']['rejectedRegistrations']}")
            logger.info(f"📈 Occupancy Rate: {report['summary']['occupancyRate']}%")
            logger.info(f"📅 Activities: {report['summary']['totalActivities']} scheduled")
            
            return report
        except Exception as e:
            logger.error(f"❌ Failed to generate report: {e}")
            raise e
    
    def bulk_approve_registrations(self, tour_event_id: str, user_ids: List[str], notes: str = "") -> List[Dict[str, Any]]:
        """Bulk approve registrations."""
        try:
            logger.info(f"✅ Bulk approving {len(user_ids)} registrations...")
            
            results = []
            
            for user_id in user_ids:
                try:
                    result = self.handle_registration(tour_event_id, user_id, 'approve', notes)
                    results.append({'userId': user_id, 'success': True, 'result': result})
                except Exception as error:
                    results.append({'userId': user_id, 'success': False, 'error': str(error)})
            
            successful = len([r for r in results if r['success']])
            failed = len([r for r in results if not r['success']])
            
            logger.info(f"✅ Bulk approval completed: {successful} successful, {failed} failed")
            
            return results
        except Exception as e:
            logger.error(f"❌ Bulk approval failed: {e}")
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


def provider_admin_example():
    """Example usage of provider admin workflow."""
    workflow = ProviderAdminWorkflow()
    
    try:
        logger.info("=== Provider Admin Workflow Example ===\n")
        
        # Login as provider admin
        workflow.client.login('provider@example.com', 'password123')
        
        # View existing tour events
        events = workflow.view_my_tour_events()
        
        # Create a new tour event (example data)
        new_tour_data = {
            'templateId': 'template-uuid-here',
            'customTourName': 'Premium Hajj Package 2024',
            'startDate': '2024-06-15',
            'endDate': '2024-06-25',
            'packageType': 'Premium',
            'place1Hotel': 'Makkah Hilton',
            'place2Hotel': 'Madinah Marriott',
            'numberOfAllowedTourists': 50,
            'groupChatInfo': 'WhatsApp group will be created'
        }
        
        # Uncomment to create new tour event
        # new_event = workflow.create_tour_event(new_tour_data)
        
        if events:
            event_id = events[0]['tourEventId']
            
            # View registrations for first event
            registrations = workflow.view_tour_registrations(event_id)
            
            # Create sample schedule
            sample_activities = [
                {
                    'activityDate': '2024-06-15',
                    'activityType': 'Arrival',
                    'description': 'Airport pickup and hotel check-in',
                    'startTime': '14:00',
                    'endTime': '18:00',
                    'location': 'Jeddah Airport / Makkah Hotel'
                },
                {
                    'activityDate': '2024-06-16',
                    'activityType': 'Religious',
                    'description': 'First Umrah performance',
                    'startTime': '05:00',
                    'endTime': '12:00',
                    'location': 'Masjid al-Haram'
                }
            ]
            
            # Uncomment to create schedule
            # workflow.create_tour_schedule(event_id, sample_activities)
            
            # Generate report
            workflow.generate_tour_report(event_id)
        
        # View company users
        workflow.view_company_users()
        
        # Logout
        workflow.client.logout()
        
    except Exception as e:
        logger.error(f"Provider admin workflow example failed: {e}")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    provider_admin_example()