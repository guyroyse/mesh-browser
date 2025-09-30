#!/usr/bin/env python3
"""
URL parsing utilities for Reticulum destinations

Handles parsing of reticulum:// URLs with destination hash and path.
"""

from typing import Tuple


def parse_url(url: str) -> Tuple[bytes, str]:
    """
    Parse combined hash+path URL into components
    """

    dest_hash_str, path = _split_hash_and_path(url)
    dest_hash = _validate_and_convert_hash(dest_hash_str)
    return dest_hash, path


def _split_hash_and_path(url: str) -> Tuple[str, str]:
    """Split URL into destination hash string and path"""
    if '/' in url:
        dest_hash_str, path = url.split('/', 1)
        path = '/' + path
    else:
        dest_hash_str = url
        path = '/'

    return dest_hash_str, path


def _validate_and_convert_hash(dest_hash_str: str) -> bytes:
    """Validate and convert destination hash from hex string to bytes"""
    if not dest_hash_str:
        raise ValueError('Destination hash cannot be empty')

    # Validate length (RNS destination hashes are exactly 32 hex characters / 16 bytes)
    if len(dest_hash_str) != 32:
        raise ValueError(f'Destination hash must be 32 hex characters, got {len(dest_hash_str)}')

    # Convert hex string to bytes
    try:
        return bytes.fromhex(dest_hash_str)
    except ValueError as e:
        raise ValueError(f'Invalid destination hash format: {e}')