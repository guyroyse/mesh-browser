#!/usr/bin/env python3
"""
Backend - IPC communication handler

Pure plumbing layer for JSON communication between Electron and Python.
Handles stdin/stdout messaging, routing commands, and response formatting.
"""

import json
import sys
from typing import Dict, Any


class ConsoleServer:
    def __init__(self, command_router):
        self.command_router = command_router
        self.running = True

    def run(self):
        """Main IPC loop - read from stdin, process messages, send responses"""
        self._send_startup_message()

        try:
            while self.running and self._process_next_line():
                pass  # All work done in _process_next_line()
        except Exception as e:
            self._send_error_message(str(e))

        self._send_shutdown_message()

    def _process_next_line(self) -> bool:
        """Read and process one line from stdin. Returns False on EOF."""
        # Read line from stdin
        line = sys.stdin.readline()

        # If EOF, stop running
        if not line:
            return False

        # If the line is empty or whitespace, skip it
        if not line or line.isspace():
            return True  # Empty or whitespace-only line, continue

        # Process the JSON message
        self._process_message(line)

        # Continue running
        return True

    def _process_message(self, line: str):
        """Parse and handle a JSON message line."""
        try:
            message = json.loads(line)
            response = self._handle_message(message)
            self._send_message(response)

        except json.JSONDecodeError as e:
            self._send_message({
                'success': False,
                'error': f'Invalid JSON: {str(e)}'
            })

    def _handle_message(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """Route message to appropriate command handler"""

        # Extract and validate request ID
        request_id = message.get('id')
        if request_id is None:
            return self._error_response(None, 'No request ID specified')

        # Extract command
        command = message.get('command')
        if not command:
            return self._error_response(request_id, 'No command specified')

        # Handle special shutdown command
        if command == 'shutdown':
            self.running = False
            return self._success_response(request_id, {'message': 'Python backend shutting down'})

        # Delegate to command router
        try:
            return self.command_router.handle_command(message)
        except Exception as e:
            return self._error_response(request_id, str(e))
        
    def _success_response(self, request_id: Any, data: Any) -> Dict[str, Any]:
        """Create a standardized success response"""
        return {
            'id': request_id,
            'success': True,
            'data': data
        }
        
    def _error_response(self, request_id: Any, error_message: str) -> Dict[str, Any]:
        """Create a standardized error response"""
        return {
            'id': request_id,
            'success': False,
            'error': error_message
        }

    def _send_message(self, message: Dict[str, Any]):
        """Send structured JSON message to Electron frontend via stdout"""
        json_str = json.dumps(message)
        print(json_str, flush=True)

    def _send_startup_message(self):
        """Send startup notification to stderr"""
        self._log_info("Python backend initialized and ready")

    def _send_shutdown_message(self):
        """Send shutdown notification to stderr"""
        self._log_info("Python backend terminated")

    def _send_error_message(self, error: str):
        """Send error notification to stderr"""
        self._log_error(f"Backend error: {error}")

    def _log_debug(self, message: str):
        """Send debug message to stderr"""
        print(f"DEBUG: {message}", file=sys.stderr, flush=True)

    def _log_info(self, message: str):
        """Send info message to stderr"""
        print(f"INFO: {message}", file=sys.stderr, flush=True)

    def _log_error(self, message: str):
        """Send error message to stderr"""
        print(f"ERROR: {message}", file=sys.stderr, flush=True)
        