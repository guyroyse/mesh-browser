#!/usr/bin/env python3
"""
PageFetcher - Handles fetching content from Reticulum destinations

Encapsulates the logic for establishing connections and retrieving content.
"""

import RNS
import time
import mimetypes
import base64
from typing import Dict, Any


class PageFetcher:
    def __init__(self, reticulum_instance, identity):
        self.reticulum = reticulum_instance
        self.identity = identity

    def fetch(self, url: str, path_discovery_timeout: int = 10) -> Dict[str, Any]:
        """
        Fetch content from a Reticulum destination

        Args:
            url: Combined destination hash and path (e.g., "abc123def456.../index.html")
            path_discovery_timeout: Timeout for path discovery only (RNS handles other timeouts)

        Returns:
            Dict with 'content', 'content_type', 'status_code', 'encoding'

        Raises:
            ValueError: For invalid URL format
            ConnectionError: For network/connection issues
            TimeoutError: For path discovery timeout
        """
        # Parse URL into hash and path
        dest_hash, path = self._parse_url(url)

        # Request path to destination
        RNS.log(f"Requesting path to {dest_hash.hex()}", RNS.LOG_INFO)
        RNS.Transport.request_path(dest_hash)

        # Wait for path discovery (only manual timeout we keep)
        if not self._wait_for_path(dest_hash, path_discovery_timeout):
            raise TimeoutError('Could not find path to destination')

        # Establish connection (let RNS handle timeouts)
        link = self._establish_connection(dest_hash)

        try:
            # Send request and get response (let RNS handle timeouts)
            response = self._send_request(link, dest_hash, path)
            return response

        finally:
            # Always clean up the link
            link.teardown()

    def _parse_url(self, url: str) -> tuple[bytes, str]:
        """Parse combined hash+path URL into components"""
        try:
            # Split on first '/' to separate hash from path
            if '/' in url:
                dest_hash_str, path = url.split('/', 1)
                path = '/' + path
            else:
                dest_hash_str = url
                path = '/'

            # Convert destination hash from hex string to bytes
            dest_hash = bytes.fromhex(dest_hash_str)

            return dest_hash, path

        except ValueError as e:
            raise ValueError(f'Invalid destination hash format: {e}')
        except Exception as e:
            raise ValueError(f'URL parsing error: {e}')

    def _wait_for_path(self, dest_hash: bytes, timeout: int) -> bool:
        """Wait for path discovery with timeout"""
        start_time = time.time()
        while time.time() - start_time < timeout:
            if RNS.Transport.has_path(dest_hash):
                return True
            time.sleep(0.1)
        return False

    def _establish_connection(self, dest_hash: bytes):
        """Establish RNS Link to destination (RNS handles timeouts automatically)"""
        # Recall server identity and create destination
        server_identity = RNS.Identity.recall(dest_hash)
        if not server_identity:
            raise ConnectionError('Could not recall server identity')

        server_destination = RNS.Destination(
            server_identity,
            RNS.Destination.OUT,
            RNS.Destination.SINGLE,
            "rserver"
        )

        # Establish link (RNS uses 6 seconds per hop timeout)
        RNS.log(f"Establishing link to {dest_hash.hex()}", RNS.LOG_INFO)
        link = RNS.Link(server_destination)

        # Simple wait for link to become active (RNS handles timeouts)
        while link.status != RNS.Link.ACTIVE:
            if link.status == RNS.Link.CLOSED:
                raise ConnectionError('Link failed to establish')
            time.sleep(0.1)

        return link

    def _send_request(self, link, dest_hash: bytes, path: str) -> Dict[str, Any]:
        """Send HTTP-like request and wait for response (uses RNS built-in timeouts)"""
        # Build HTTP-like request
        request_data = f"GET {path} HTTP/1.1\r\nHost: {dest_hash.hex()}\r\n\r\n"

        # Set up response handling
        response_data = {'received': False, 'content': b'', 'error': None}

        def packet_callback(message, packet):
            try:
                # Store raw bytes, don't decode yet
                response_data['content'] = message
                response_data['received'] = True
            except Exception as e:
                response_data['error'] = str(e)
                response_data['received'] = True

        link.set_packet_callback(packet_callback)

        # Send request (RNS will handle timeouts based on RTT)
        link.send(request_data.encode('utf-8'))

        # Wait for response (no manual timeout, trust RNS)
        while not response_data['received']:
            time.sleep(0.1)

        if response_data['error']:
            raise ConnectionError(f'Response error: {response_data["error"]}')

        # Parse HTTP-like response
        return self._parse_response(response_data['content'], path)

    def _parse_response(self, content: bytes, path: str) -> Dict[str, Any]:
        """Parse HTTP-like response into structured data"""
        try:
            # Try to decode as UTF-8 to check for HTTP headers
            content_str = content.decode('utf-8')

            if '\r\n\r\n' in content_str:
                headers_str, body_str = content_str.split('\r\n\r\n', 1)

                # Parse headers for content-type
                content_type = self._extract_content_type(headers_str)
                if not content_type:
                    content_type = self._guess_content_type(path)

                # Return body as base64 for binary safety
                return {
                    'content': base64.b64encode(body_str.encode('utf-8')).decode('ascii'),
                    'content_type': content_type,
                    'status_code': 200,
                    'encoding': 'base64'
                }
            else:
                # No headers, treat as raw content
                content_type = self._guess_content_type(path)
                return {
                    'content': base64.b64encode(content).decode('ascii'),
                    'content_type': content_type,
                    'status_code': 200,
                    'encoding': 'base64'
                }

        except UnicodeDecodeError:
            # Binary content, return as base64
            content_type = self._guess_content_type(path)
            return {
                'content': base64.b64encode(content).decode('ascii'),
                'content_type': content_type,
                'status_code': 200,
                'encoding': 'base64'
            }

    def _extract_content_type(self, headers_str: str) -> str:
        """Extract content-type from HTTP headers"""
        for line in headers_str.split('\r\n'):
            if line.lower().startswith('content-type:'):
                return line.split(':', 1)[1].strip()
        return None

    def _guess_content_type(self, path: str) -> str:
        """Guess content type from file extension"""
        content_type, _ = mimetypes.guess_type(path)
        return content_type or 'application/octet-stream'