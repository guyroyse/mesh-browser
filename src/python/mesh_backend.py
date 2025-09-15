#!/usr/bin/env python3
"""
MeshBrowser Python Backend

Handles mesh networking operations via JSON IPC with the Electron frontend.
Communication happens over stdin/stdout with JSON messages.
"""

import json
import sys
import datetime
import os
from typing import Dict, Any

class MeshBackend:
    def __init__(self):
        self.running = True

    def handle_message(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """Handle incoming messages from Electron frontend"""

        command = message.get('command')
        request_id = message.get('id')

        try:
            if command == 'get-test-message':
                return {
                    'id': request_id,
                    'success': True,
                    'data': {
                        'message': 'Hello from Python backend! Subprocess IPC is working.',
                        'timestamp': datetime.datetime.now().isoformat(),
                        'python_version': sys.version,
                        'working_directory': os.getcwd()
                    }
                }

            elif command == 'ping':
                return {
                    'id': request_id,
                    'success': True,
                    'data': {'pong': True}
                }

            elif command == 'shutdown':
                self.running = False
                return {
                    'id': request_id,
                    'success': True,
                    'data': {'message': 'Python backend shutting down'}
                }

            else:
                return {
                    'id': request_id,
                    'success': False,
                    'error': f'Unknown command: {command}'
                }

        except Exception as e:
            return {
                'id': request_id,
                'success': False,
                'error': str(e)
            }

    def send_message(self, message: Dict[str, Any]):
        """Send message to Electron frontend via stdout"""
        json_str = json.dumps(message)
        print(json_str, flush=True)

    def run(self):
        """Main loop - read from stdin, process messages, send responses"""

        # Send startup message
        self.send_message({
            'type': 'startup',
            'message': 'Python backend initialized and ready'
        })

        try:
            while self.running:
                # Read line from stdin
                line = sys.stdin.readline()
                if not line:  # EOF
                    break

                line = line.strip()
                if not line:
                    continue

                try:
                    # Parse JSON message
                    message = json.loads(line)

                    # Handle the message
                    response = self.handle_message(message)

                    # Send response
                    self.send_message(response)

                except json.JSONDecodeError as e:
                    # Send error response for malformed JSON
                    self.send_message({
                        'success': False,
                        'error': f'Invalid JSON: {str(e)}'
                    })

        except KeyboardInterrupt:
            pass
        except Exception as e:
            self.send_message({
                'type': 'error',
                'error': f'Backend error: {str(e)}'
            })

        # Send shutdown message
        self.send_message({
            'type': 'shutdown',
            'message': 'Python backend terminated'
        })

if __name__ == '__main__':
    backend = MeshBackend()
    backend.run()