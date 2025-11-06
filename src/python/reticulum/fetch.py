#!/usr/bin/env python3
"""
Content Fetching over Reticulum

Handles application-level HTTP-like request/response protocol over RNS Links.
"""

import RNS
import threading


# Timeout
RESPONSE_TIMEOUT = 10  # seconds


def fetch(link, dest_hash: bytes, path: str) -> bytes:
    """
    Fetch raw content over an established RNS Link

    Returns:
        Raw response bytes from server
    """
    # Build HTTP-like request
    request_data = f"GET {path} HTTP/1.1\r\nHost: {dest_hash.hex()}\r\nUser-Agent: MeshBrowser/1.0\r\nAccept: text/html,*/*\r\n\r\n"

    # Set up response handling
    response_event = threading.Event()
    response_data = {'content': b'', 'error': None}

    def resource_concluded_callback(resource):
        """Callback when resource transfer concludes"""
        try:
            if resource.status == RNS.Resource.COMPLETE:
                # Read the complete transferred data
                response_data['content'] = resource.data.read()
            else:
                response_data['error'] = f'Resource transfer failed with status: {resource.status}'
        except Exception as e:
            response_data['error'] = str(e)
        finally:
            response_event.set()

    # Configure link to auto-accept incoming resources
    link.set_resource_strategy(RNS.Link.ACCEPT_ALL)
    link.set_resource_concluded_callback(resource_concluded_callback)

    # Send request using RNS.Packet
    request_bytes = request_data.encode('utf-8')
    packet = RNS.Packet(link, request_bytes)
    packet.send()

    # Wait for response callback to be triggered
    if not response_event.wait(timeout=RESPONSE_TIMEOUT):
        raise ConnectionError(f'No response received within {RESPONSE_TIMEOUT}s for {path}')

    if response_data['error']:
        raise ConnectionError(f'Response error: {response_data["error"]}')

    return response_data['content']
