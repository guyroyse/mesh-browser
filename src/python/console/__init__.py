"""
Console Communication Package

Handles console I/O communication between Python backend and Electron frontend.
Provides structured messaging and process lifecycle management.
"""

from .manager import ConsoleManager
from .message_sender import ConsoleMessageSender

# Provide shorter aliases for cleaner usage
Manager = ConsoleManager
MessageSender = ConsoleMessageSender

__all__ = ['ConsoleManager', 'Manager', 'ConsoleMessageSender', 'MessageSender']