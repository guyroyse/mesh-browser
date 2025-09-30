#!/usr/bin/env python3
"""
RNS Link Management

Handles Reticulum transport layer operations: path discovery and link establishment.
"""

import RNS
import time


# Timeouts
PATH_DISCOVERY_TIMEOUT = 10  # seconds
LINK_ESTABLISHMENT_TIMEOUT = 10  # seconds


def establish_link(dest_hash: bytes, app: str, *aspects) -> RNS.Link:
    """
    Establish an RNS Link to a destination
    """

    _request_path(dest_hash)
    return _establish_connection(dest_hash, app, *aspects)


def _request_path(dest_hash: bytes) -> None:
    """Request path to destination"""

    RNS.Transport.request_path(dest_hash)
    _wait_for_path(dest_hash)


def _establish_connection(dest_hash: bytes, app: str, *aspects) -> RNS.Link:
    """Establish RNS Link to destination"""

    server_destination = _create_destination(dest_hash, app, *aspects)
    link = _establish_link(server_destination)
    return link


def _create_destination(dest_hash: bytes, app: str, *aspects) -> RNS.Destination:
    """Create RNS Destination object"""

    server_identity = RNS.Identity.recall(dest_hash)
    if not server_identity:
        raise ConnectionError(f'Could not recall server identity for {dest_hash.hex()}')

    return RNS.Destination(
        server_identity,
        RNS.Destination.OUT,
        RNS.Destination.SINGLE,
        app, *aspects
    )


def _establish_link(server_destination: RNS.Destination) -> RNS.Link:
    """Establish RNS Link to server destination"""

    link = RNS.Link(server_destination)
    _wait_for_link_active(link)
    return link


def _wait_for_path(dest_hash: bytes):
    """Wait for path discovery with timeout"""
    start_time = time.time()

    while time.time() - start_time < PATH_DISCOVERY_TIMEOUT:
        if RNS.Transport.has_path(dest_hash):
            return
        time.sleep(0.1)

    raise TimeoutError(f'Could not find path to destination {dest_hash.hex()} within {PATH_DISCOVERY_TIMEOUT}s')


def _wait_for_link_active(link: RNS.Link):
    """Wait for link to become active with timeout"""

    for i in range(LINK_ESTABLISHMENT_TIMEOUT):
        time.sleep(1)
        if link.status == RNS.Link.ACTIVE:
            return
        if link.status == RNS.Link.CLOSED:
            raise ConnectionError(f'Link failed to establish')
        
    raise ConnectionError(f'Link establishment timeout after {LINK_ESTABLISHMENT_TIMEOUT}s')