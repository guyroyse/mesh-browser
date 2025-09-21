#!/usr/bin/env python3
"""
PageFetcher - Handles fetching content from Reticulum destinations

Encapsulates the logic for establishing connections and retrieving content.
Provides a clean, curl-like interface for retrieving pages from the Reticulum network.
"""

import RNS
import time
import mimetypes
import base64
from typing import Dict, Any, Tuple


class URLParser:
    """Handles parsing of Reticulum destination URLs"""

    @staticmethod
    def parse(url: str) -> Tuple[bytes, str]:
        """
        Parse combined hash+path URL into components

        Args:
            url: Combined destination hash and path (e.g., "abc123def456.../index.html")

        Returns:
            Tuple of (destination_hash_bytes, path_string)

        Raises:
            ValueError: For invalid URL format or hash
        """
        if not url or not isinstance(url, str):
            raise ValueError('URL must be a non-empty string')

        try:
            # Split on first '/' to separate hash from path
            if '/' in url:
                dest_hash_str, path = url.split('/', 1)
                path = '/' + path
            else:
                dest_hash_str = url
                path = '/'

            # Validate and convert destination hash from hex string to bytes
            if not dest_hash_str:
                raise ValueError('Destination hash cannot be empty')

            # Check if it looks like a valid hex string
            if not all(c in '0123456789abcdefABCDEF' for c in dest_hash_str):
                raise ValueError('Destination hash must be a valid hexadecimal string')

            dest_hash = bytes.fromhex(dest_hash_str)

            # Basic length validation (RNS hashes are typically 16 or 32 bytes)
            if len(dest_hash) not in [16, 32]:
                RNS.log(f"Warning: Unusual hash length {len(dest_hash)} bytes for {dest_hash_str}", RNS.LOG_WARNING)

            return dest_hash, path

        except ValueError as e:
            raise ValueError(f'Invalid destination hash format: {e}')
        except Exception as e:
            raise ValueError(f'URL parsing error: {e}')


class ResponseParser:
    """Handles parsing of HTTP-like responses from Reticulum servers"""

    @staticmethod
    def parse(content: bytes, path: str) -> Dict[str, Any]:
        """
        Parse HTTP-like response into structured data

        Args:
            content: Raw response bytes from server
            path: Original request path (for content type guessing)

        Returns:
            Dict with 'content', 'content_type', 'status_code', 'encoding'
        """
        try:
            # Try to decode as UTF-8 to check for HTTP headers
            content_str = content.decode('utf-8')

            if '\r\n\r\n' in content_str:
                # HTTP-like response with headers
                headers_str, body_str = content_str.split('\r\n\r\n', 1)

                content_type = ResponseParser._extract_content_type(headers_str)
                if not content_type:
                    content_type = ResponseParser._guess_content_type(path)

                # Return body as base64 for binary safety in JSON
                return {
                    'content': base64.b64encode(body_str.encode('utf-8')).decode('ascii'),
                    'content_type': content_type,
                    'status_code': 200,
                    'encoding': 'base64'
                }
            else:
                # No headers, treat as raw content
                content_type = ResponseParser._guess_content_type(path)
                return {
                    'content': base64.b64encode(content).decode('ascii'),
                    'content_type': content_type,
                    'status_code': 200,
                    'encoding': 'base64'
                }

        except UnicodeDecodeError:
            # Binary content, return as base64
            content_type = ResponseParser._guess_content_type(path)
            return {
                'content': base64.b64encode(content).decode('ascii'),
                'content_type': content_type,
                'status_code': 200,
                'encoding': 'base64'
            }

    @staticmethod
    def _extract_content_type(headers_str: str) -> str:
        """Extract content-type from HTTP headers"""
        for line in headers_str.split('\r\n'):
            if line.lower().startswith('content-type:'):
                return line.split(':', 1)[1].strip()
        return None

    @staticmethod
    def _guess_content_type(path: str) -> str:
        """Guess content type from file extension"""
        content_type, _ = mimetypes.guess_type(path)
        return content_type or 'application/octet-stream'


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
        RNS.log(f"Fetching content from URL: {url}", RNS.LOG_INFO)

        # Parse URL into hash and path using dedicated parser
        dest_hash, path = URLParser.parse(url)
        RNS.log(f"Parsed destination: {dest_hash.hex()}, path: {path}", RNS.LOG_DEBUG)

        # Step 1: Request path to destination
        RNS.log(f"Requesting path to {dest_hash.hex()}", RNS.LOG_INFO)
        RNS.Transport.request_path(dest_hash)

        # Step 2: Wait for path discovery (only manual timeout we keep)
        if not self._wait_for_path(dest_hash, path_discovery_timeout):
            raise TimeoutError(f'Could not find path to destination {dest_hash.hex()} within {path_discovery_timeout}s')

        # Step 3: Establish connection (let RNS handle connection timeouts)
        link = self._establish_connection(dest_hash)

        try:
            # Step 4: Send request and get response (let RNS handle request/response timeouts)
            response = self._send_request(link, dest_hash, path)
            RNS.log(f"Successfully fetched {len(response.get('content', ''))} bytes", RNS.LOG_INFO)
            return response

        finally:
            # Always clean up the link
            RNS.log(f"Tearing down link to {dest_hash.hex()}", RNS.LOG_DEBUG)
            link.teardown()


    def _wait_for_path(self, dest_hash: bytes, timeout: int) -> bool:
        """
        Wait for path discovery with timeout

        This is the only timeout we manually manage - RNS handles all other timeouts
        based on network conditions and RTT measurements.
        """
        start_time = time.time()
        RNS.log(f"Waiting up to {timeout}s for path discovery to {dest_hash.hex()}", RNS.LOG_DEBUG)

        while time.time() - start_time < timeout:
            if RNS.Transport.has_path(dest_hash):
                elapsed = time.time() - start_time
                RNS.log(f"Path discovered in {elapsed:.2f}s", RNS.LOG_DEBUG)
                return True
            time.sleep(0.1)

        RNS.log(f"Path discovery timeout after {timeout}s", RNS.LOG_WARNING)
        return False

    def _establish_connection(self, dest_hash: bytes):
        """
        Establish RNS Link to destination

        Uses the same pattern as working meshcurl.py implementation.
        RNS handles connection timeouts automatically based on network conditions.
        """
        # Recall server identity and create destination (same as meshcurl.py)
        server_identity = RNS.Identity.recall(dest_hash)
        if not server_identity:
            raise ConnectionError(f'Could not recall server identity for {dest_hash.hex()}')

        # Create destination object for linking (matching meshcurl.py exactly)
        server_destination = RNS.Destination(
            server_identity,
            RNS.Destination.OUT,
            RNS.Destination.SINGLE,
            "rserver", "web"  # Added "web" aspect like meshcurl.py
        )

        # Establish link (RNS automatically manages timeouts based on RTT)
        RNS.log(f"Establishing link to {dest_hash.hex()}", RNS.LOG_INFO)
        link = RNS.Link(server_destination)

        # Wait for link to become active (using same timeout approach as meshcurl.py)
        RNS.log("Waiting for link establishment...", RNS.LOG_DEBUG)
        for i in range(10):  # 10 second timeout like meshcurl.py
            time.sleep(1)
            if link.status == RNS.Link.ACTIVE:
                break
            if link.status == RNS.Link.CLOSED:
                raise ConnectionError(f'Link to {dest_hash.hex()} failed to establish')
        else:
            raise ConnectionError(f'Link establishment timeout after 10s for {dest_hash.hex()}')

        RNS.log(f"Link to {dest_hash.hex()} established successfully", RNS.LOG_INFO)
        return link

    def _send_request(self, link, dest_hash: bytes, path: str) -> Dict[str, Any]:
        """
        Send HTTP-like request and wait for response

        Uses the same approach as working meshcurl.py implementation.
        """
        # Build HTTP-like request (matching meshcurl.py format)
        request_data = f"GET {path} HTTP/1.1\r\nHost: {dest_hash.hex()}\r\nUser-Agent: MeshBrowser/1.0\r\nAccept: text/html,*/*\r\n\r\n"
        RNS.log(f"Sending request for {path} to {dest_hash.hex()}", RNS.LOG_DEBUG)

        # Set up response handling
        response_data = {'received': False, 'content': b'', 'error': None}

        def packet_callback(message, packet):
            try:
                # Store raw bytes, don't decode yet - let ResponseParser handle it
                response_data['content'] = message
                response_data['received'] = True
                RNS.log(f"Received response: {len(message)} bytes", RNS.LOG_DEBUG)
            except Exception as e:
                response_data['error'] = str(e)
                response_data['received'] = True
                RNS.log(f"Response callback error: {e}", RNS.LOG_ERROR)

        link.set_packet_callback(packet_callback)

        # Send request using RNS.Packet like meshcurl.py
        test_message = request_data.encode('utf-8')
        packet = RNS.Packet(link, test_message)
        packet.send()
        RNS.log("Request packet sent, waiting for response...", RNS.LOG_DEBUG)

        # Wait for response (using same timeout as meshcurl.py)
        RNS.log("Waiting for response...", RNS.LOG_DEBUG)
        time.sleep(2)  # Same 2 second wait as meshcurl.py

        if not response_data['received']:
            raise ConnectionError(f'No response received within timeout for {path}')

        if response_data['error']:
            raise ConnectionError(f'Response error: {response_data["error"]}')

        # Parse HTTP-like response using dedicated parser
        return ResponseParser.parse(response_data['content'], path)

