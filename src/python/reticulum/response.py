#!/usr/bin/env python3
"""
HTTP response parsing utilities

Handles parsing of HTTP-like responses from Reticulum servers.
"""

import base64
import mimetypes
from typing import Dict, Any


def parse_response(content: bytes, path: str) -> Dict[str, Any]:
    """
    Parse HTTP-like response into structured data

    Args:
        content: Raw response bytes from server
        path: Original request path (for content type guessing)

    Returns:
        Dict with 'content', 'content_type', 'status_code', 'encoding'
    """
    # Check if content starts with HTTP headers
    if b'\r\n\r\n' in content:
        # HTTP-like response with headers - split on bytes
        headers_bytes, body_bytes = content.split(b'\r\n\r\n', 1)

        try:
            # Decode headers as UTF-8 for parsing
            headers_str = headers_bytes.decode('utf-8')
            status_code = _extract_status_code(headers_str)
            content_type = _extract_content_type(headers_str)
            if not content_type:
                content_type = _guess_content_type(path)

            # Return body as base64
            return {
                'content': base64.b64encode(body_bytes).decode('ascii'),
                'content_type': content_type,
                'status_code': status_code,
                'encoding': 'base64'
            }
        except UnicodeDecodeError:
            # Headers couldn't be decoded as UTF-8, treat entire content as binary
            pass

    # No HTTP headers or headers couldn't be decoded - treat as raw binary content
    content_type = _guess_content_type(path)
    return {
        'content': base64.b64encode(content).decode('ascii'),
        'content_type': content_type,
        'status_code': 200,
        'encoding': 'base64'
    }


def _extract_status_code(headers_str: str) -> int:
    """Extract status code from HTTP response (e.g., 'HTTP/1.1 200 OK' -> 200)"""
    first_line = headers_str.split('\r\n')[0]
    parts = first_line.split(' ', 2)
    if len(parts) >= 2:
        try:
            return int(parts[1])
        except ValueError:
            pass
    return 200  # Default to 200 if parsing fails


def _extract_content_type(headers_str: str) -> str:
    """Extract content-type from HTTP headers"""
    for line in headers_str.split('\r\n'):
        if line.lower().startswith('content-type:'):
            return line.split(':', 1)[1].strip()
    return None


def _guess_content_type(path: str) -> str:
    """Guess content type from file extension"""
    content_type, _ = mimetypes.guess_type(path)
    return content_type or 'application/octet-stream'