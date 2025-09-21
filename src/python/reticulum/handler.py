#!/usr/bin/env python3
"""
ReticulumHandler - Handles Reticulum network operations

Provides fetch-page and status commands using ReticulumClient abstraction.
"""

from typing import Dict, Any
from .client import ReticulumClient


class ReticulumHandler:
    def __init__(self):
        self.client = ReticulumClient()

    def get_commands(self) -> Dict[str, callable]:
        """Return dictionary of command names to handler methods"""
        return {
            'fetch-page': self.fetch_page,
            'reticulum-status': self.reticulum_status
        }

    def fetch_page(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """Handle fetch-page command"""
        request_id = message.get('id')

        url = message.get('url')
        if not url:
            return self._error_response(request_id, 'No URL specified')

        try:
            # Fetch the page using client (will raise exceptions on error)
            result = self.client.fetch_page(url)

            return {
                'id': request_id,
                'data': {
                    'content': result['content'],
                    'content_type': result['content_type'],
                    'status_code': result['status_code'],
                    'encoding': result['encoding']
                }
            }

        except (RuntimeError, ValueError, ConnectionError, TimeoutError) as e:
            return self._error_response(request_id, str(e))
        except Exception as e:
            return self._error_response(request_id, f'Unexpected error: {str(e)}')


    def reticulum_status(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """Handle reticulum status command"""
        request_id = message.get('id')

        status = self.client.get_status()

        return {
            'id': request_id,
            'data': status
        }


    def _error_response(self, request_id: Any, error_message: str) -> Dict[str, Any]:
        """Create a standardized error response"""
        return {
            'id': request_id,
            'error': error_message
        }