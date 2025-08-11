"""
Tourist Hub API - Basic Python Client

This example demonstrates a basic API client implementation using Python
with automatic token management and error handling.
"""

import requests
import json
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class TouristHubClient:
    """Basic API client for Tourist Hub API with automatic token management."""
    
    def __init__(self, base_url: str = "http://localhost:3000"):
        self.base_url = base_url.rstrip('/')
        self.access_token: Optional[str] = None
        self.refresh_token: Optional[str] = None
        self.user: Optional[Dict[str, Any]] = None
        self.session = requests.Session()
        
        # Set default headers
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })
    
    def _get_headers(self) -> Dict[str, str]:
        """Get headers with authentication token if available."""
        headers = {}
        if self.access_token:
            headers['Authorization'] = f'Bearer {self.access_token}'
        return headers
    
    def _handle_response(self, response: requests.Response) -> Dict[str, Any]:
        """Handle API response and check for errors."""
        try:
            response.raise_for_status()
            return response.json() if response.content else {}
        except requests.exceptions.HTTPError as e:
            try:
                error_data = response.json()
                logger.error(f"API Error {response.status_code}: {error_data}")
                if 'error' in error_data:
                    logger.error(f"Error Code: {error_data['error'].get('code')}")
                    logger.error(f"Message: {error_data['error'].get('message')}")
                    if error_data['error'].get('details'):
                        logger.error(f"Details: {error_data['error']['details']}")
            except json.JSONDecodeError:
                logger.error(f"HTTP Error {response.status_code}: {response.text}")
            raise e
        except requests.exceptions.RequestException as e:
            logger.error(f"Request failed: {e}")
            raise e
    
    def _make_request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """Make HTTP request with automatic token refresh."""
        url = f"{self.base_url}{endpoint}"
        headers = kwargs.pop('headers', {})
        headers.update(self._get_headers())
        
        try:
            response = self.session.request(method, url, headers=headers, **kwargs)
            return self._handle_response(response)
        except requests.exceptions.HTTPError as e:
            # Try token refresh on 401 error
            if e.response.status_code == 401 and self.refresh_token:
                logger.info("Access token expired, attempting refresh...")
                try:
                    self.refresh_access_token()
                    # Retry the original request with new token
                    headers.update(self._get_headers())
                    response = self.session.request(method, url, headers=headers, **kwargs)
                    return self._handle_response(response)
                except Exception as refresh_error:
                    logger.error(f"Token refresh failed: {refresh_error}")
                    self.logout()
                    raise refresh_error
            raise e
    
    def login(self, email_address: str, password: str) -> Dict[str, Any]:
        """Authenticate user and store tokens."""
        try:
            logger.info(f"Logging in user: {email_address}")
            
            response = self._make_request('POST', '/api/auth/login', json={
                'emailAddress': email_address,
                'password': password
            })
            
            self.access_token = response['accessToken']
            self.refresh_token = response['refreshToken']
            self.user = response['user']
            
            logger.info(f"Logged in as {self.user['firstName']} {self.user['lastName']} ({self.user['userType']})")
            return response
        except Exception as e:
            logger.error(f"Login failed: {e}")
            raise e
    
    def refresh_access_token(self) -> Dict[str, Any]:
        """Refresh access token using refresh token."""
        if not self.refresh_token:
            raise ValueError("No refresh token available")
        
        try:
            response = self._make_request('POST', '/api/auth/refresh', json={
                'refreshToken': self.refresh_token
            })
            
            self.access_token = response['accessToken']
            self.refresh_token = response['refreshToken']
            
            logger.info("Access token refreshed successfully")
            return response
        except Exception as e:
            logger.error(f"Token refresh failed: {e}")
            raise e
    
    def logout(self) -> None:
        """Logout and clear tokens."""
        try:
            if self.refresh_token:
                self._make_request('POST', '/api/auth/logout', json={
                    'refreshToken': self.refresh_token
                })
        except Exception as e:
            logger.error(f"Logout error: {e}")
        finally:
            self.access_token = None
            self.refresh_token = None
            self.user = None
            logger.info("Logged out successfully")
    
    def is_authenticated(self) -> bool:
        """Check if user is authenticated."""
        return self.access_token is not None
    
    def get_current_user(self) -> Optional[Dict[str, Any]]:
        """Get current user information."""
        return self.user
    
    def get(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Make GET request."""
        return self._make_request('GET', endpoint, params=params)
    
    def post(self, endpoint: str, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Make POST request."""
        return self._make_request('POST', endpoint, json=data)
    
    def put(self, endpoint: str, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Make PUT request."""
        return self._make_request('PUT', endpoint, json=data)
    
    def delete(self, endpoint: str) -> Dict[str, Any]:
        """Make DELETE request."""
        return self._make_request('DELETE', endpoint)
    
    def upload_file(self, endpoint: str, file_path: str, additional_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Upload file using multipart/form-data."""
        try:
            with open(file_path, 'rb') as file:
                files = {'file': file}
                data = additional_data or {}
                
                # Don't set Content-Type header for multipart uploads
                headers = self._get_headers()
                if 'Content-Type' in headers:
                    del headers['Content-Type']
                
                url = f"{self.base_url}{endpoint}"
                response = self.session.post(url, files=files, data=data, headers=headers)
                return self._handle_response(response)
        except Exception as e:
            logger.error(f"File upload failed: {e}")
            raise e


def example_usage():
    """Example usage of the TouristHubClient."""
    client = TouristHubClient()
    
    try:
        # Login
        client.login('user@example.com', 'password123')
        
        # Make authenticated requests
        users = client.get('/api/users')
        logger.info(f"Retrieved {len(users)} users")
        
        # Logout when done
        client.logout()
        
    except Exception as e:
        logger.error(f"Example failed: {e}")


if __name__ == "__main__":
    example_usage()