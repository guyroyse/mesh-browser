#!/usr/bin/env python3
"""
CommandRouter - Routes commands to appropriate handlers

Manages command delegation to different service classes.
Extensible pattern for adding new protocols and functionality.
"""

from typing import Dict, Any, Callable


class CommandRouter:
    def __init__(self):
        self.handlers: Dict[str, Callable] = {}

    def register_commands(self, command_dict: Dict[str, Callable]):
        """Register multiple command handlers at once"""
        self.handlers.update(command_dict)

    def handle_command(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """Route command to appropriate handler"""
        request_id = message.get('id')

        # Extract command
        command = message.get('command')
        if not command:
            return self._error_response(request_id, 'No command specified')

        # Find the handler
        handler = self.handlers.get(command)
        if not handler:
            return self._error_response(request_id, f'Unknown command: {command}')

        # Invoke the handler
        try:
            return handler(message)
        except Exception as e:
            return self._error_response(request_id, f'Handler error for {command}: {str(e)}')

    def _error_response(self, request_id: Any, error_message: str) -> Dict[str, Any]:
        """Create a standardized error response"""
        return {
            'id': request_id,
            'success': False,
            'error': error_message
        }

