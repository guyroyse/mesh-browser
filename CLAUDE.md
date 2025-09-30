# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# MeshBrowser - Universal Decentralized Browser

## Project Context

MeshBrowser is part of the **MeshWeb** project - a universal browser for decentralized protocols. It starts with Reticulum support but is designed to eventually support IPFS, Hypercore, and other decentralized protocols.

## What MeshBrowser Does

- **Web-like browsing** over decentralized networks (starting with Reticulum)
- **Familiar interface** - address bar, back/forward, bookmarks
- **Protocol support** - handles `reticulum://` URLs (future: `ipfs://`, `hyper://`)
- **Server discovery** - finds available RServers on the network
- **Non-technical user friendly** - install and browse, no configuration needed
- **Network visualization** - shows mesh connectivity, encryption status

## Architecture: Hybrid Desktop App

### Technology Stack: Electron + Reticulum Backend
```
MeshBrowser Desktop App
├── Electron Frontend
│   ├── Main Process (src/main.js)
│   ├── Protocol Handlers (src/protocol-handlers/)
│   │   ├── protocol-schemes.js     # Single scheme registration
│   │   ├── reticulum-handler.js    # reticulum:// protocol
│   │   └── about-handler.js        # about:// protocol
│   ├── Renderer Process (src/renderer/)
│   │   ├── index.html             # Browser UI
│   │   └── app.js                 # Navigation logic
│   └── Process Management (src/process-manager/)
│       └── IPC communication utilities
└── Reticulum Backend (src/reticulum/)
    ├── main.py                    # Entry point
    ├── console_server.py          # IPC communication
    ├── command_router.py          # Command routing
    └── handler/                   # Protocol implementation
        ├── handler.py             # Command handlers
        ├── client.py              # Network coordinator
        ├── page_fetcher.py        # Content retrieval
        └── status_fetcher.py      # Status + system info
```

### Why This Approach
- **Don't reinvent web rendering** - Chromium handles HTML/CSS/JS perfectly
- **Custom protocol support** - Native `reticulum://` URL handling
- **Mesh-aware UI** - Show network topology, encryption status
- **Extensible** - Add new protocols without changing rendering engine

## Key Features

### Browser Interface
- **Address bar**: `[reticulum://destination/path] [Go]`
- **Status indicators**: Connection hops, encryption, network type
- **Discovery panel**: List of available servers on network
- **Protocol switching**: Future support for multiple decentralized protocols

### Network Features
- **Auto-discovery** - Finds RServers automatically
- **Multi-hop browsing** - Works across mesh network segments  
- **Offline operation** - Browse cached content, mesh-only mode
- **Network awareness** - Shows connection path, bandwidth

## User Experience Goals

### For Non-Technical Users
1. **Download and install** - Single executable, no dependencies
2. **Launch and browse** - Automatically connects to available networks
3. **Familiar interface** - Works like any web browser
4. **Guided discovery** - Featured servers, getting started content

### For Technical Users
- **Network diagnostics** - Connection details, routing information
- **Advanced discovery** - Manual server entry, network scanning
- **Protocol flexibility** - Switch between different decentralized networks

## Technical Implementation

### Protocol Handler Architecture
```javascript
// Electron main process - register reticulum:// as privileged scheme
protocol.registerSchemesAsPrivileged([{
  scheme: 'reticulum',
  privileges: {
    supportFetchAPI: true,
    corsEnabled: true,
    standard: true,
    secure: true,
    allowServiceWorkers: true
  }
}]);

// Stream protocol handler - intercepts reticulum:// URLs
protocol.registerStreamProtocol('reticulum', async (request, callback) => {
  const url = request.url.substring(12) // Remove 'reticulum://'
  const response = await reticulumManager.sendCommand('fetch-page', { url })
  const content = Buffer.from(response.content, 'base64')

  callback({
    statusCode: response.status_code || 200,
    headers: { 'Content-Type': response.content_type || 'text/html' },
    data: stream
  })
});
```

### Python Backend Architecture
```python
# Hybrid Architecture: HTTP for data flow, stdio for process control

# Main entry point
main.py -> HTTP Server + Console Manager

# HTTP Data Layer (Parallel Processing)
class HTTP_API_Server:
    def start():                    # Start ThreadingHTTPServer
    def stop():                     # Shutdown server

class HTTP_API_Handler:
    def do_POST():                  # Handle POST /proxy/reticulum
    def _handle_reticulum_proxy():  # Process Reticulum requests
    def _send_reticulum_response(): # Native HTTP responses

# Console Communication Layer (Process Lifecycle)
class ConsoleManager:
    def run():                    # Main stdin/stdout lifecycle loop
    def _wait_for_command():      # Wait for shutdown commands
    def _process_shutdown():      # Handle graceful shutdown
    def messenger:                # ConsoleMessageSender for structured logging

class ConsoleMessageSender:
    def send_message():           # Framed JSON messaging (ERROR:, WARNING:, etc.)
    def send_error/warning():     # Structured log messages

# Reticulum Modules (Clean separation of concerns)
src/python/
├── main.py                      # Entry point, starts HTTP + Console
├── console/                     # Process communication utilities
│   ├── manager.py              # ConsoleManager: process lifecycle
│   └── message_sender.py       # ConsoleMessageSender: structured messaging
├── http_api/                    # HTTP server package
│   ├── server.py               # HTTP_API_Server: ThreadingHTTPServer wrapper
│   └── handler.py              # HTTP_API_Handler: /proxy/reticulum endpoint
└── reticulum/                   # Reticulum networking (6 focused modules)
    ├── client.py               # ReticulumClient: thin coordinator (~47 lines)
    ├── url.py                  # parse_url(): URL parsing/validation (~58 lines)
    ├── link.py                 # establish_link(): RNS link management (~86 lines)
    ├── fetch.py                # fetch(): HTTP-like protocol over RNS (~52 lines)
    ├── response.py             # parse_response(): HTTP response parsing (~67 lines)
    └── status.py               # get_status(): network status info (~30 lines)
```

## Development Phases

### Phase 1: Core Browser ✅ COMPLETED
- ✅ **Modern Electron architecture** with protocol handlers
- ✅ **Native protocol support** - `reticulum://` and `about://` work like web protocols
- ✅ **Clean Reticulum backend** - Organized in `src/reticulum/` with handler pattern
- ✅ **Minimal renderer** - Just navigation logic, protocol handlers do heavy lifting
- ✅ **Zero unnecessary IPC** - Direct protocol handling eliminates complexity
- ✅ **Full web compatibility** - JavaScript, CSS, images, embedded resources all work
- ✅ **System diagnostics** - `about:system` and `about:reticulum` pages
- ✅ **Modern Electron APIs** - Using `protocol.handle()` instead of deprecated methods
- ✅ **Automatic resource loading** - Relative URLs, embedded links work seamlessly
- ✅ **Binary content support** - All content types via base64 encoding

### Phase 1b: Code Quality ✅ COMPLETED
- ✅ **UI modernization** - Clean, semantic HTML with professional CSS styling
- ✅ **Modular architecture** - Extracted navigation history and status management into separate modules
- ✅ **Modern JavaScript** - ES6 modules with clean separation of concerns
- ✅ **Webview integration** - Fixed webview configuration for protocol handler support
- ✅ **Protocol handler debugging** - Fixed IPC communication and large file handling
- ✅ **Binary content support** - Images and large files now load correctly
- ⏳ Server discovery and connection UI

### Phase 2: Enhanced UX  
- Network topology visualization
- Bookmarks and history
- Getting started experience
- Error handling and diagnostics

### Phase 3: Multi-Protocol
- IPFS gateway integration
- Hypercore protocol support
- Unified discovery across protocols
- Cross-protocol content linking

## Demo Scenarios

### Talk Demo Flow
1. **Launch MeshBrowser** - Shows clean, familiar interface
2. **Discovery panel** - Shows available RServers on network
3. **Browse to server** - Enter reticulum:// URL or click discovered server
4. **Page loads** - HTML/CSS renders normally in embedded browser
5. **Show network status** - Display mesh routing, encryption indicators
6. **Multi-hop demo** - Browse server on different network segment

### Key Demo Points
- **Familiar but different** - Looks like web browser, works over mesh
- **Real web content** - Actual HTML/CSS/JS, not simplified interface
- **Network visualization** - Show the underlying mesh connectivity
- **No internet required** - Pure mesh networking demonstration

## Future Vision: Universal Decentralized Browser

MeshBrowser positions itself as **the browser for decentralized protocols**:
- Chrome/Firefox for HTTP/HTTPS
- **MeshBrowser for reticulum://, ipfs://, hyper://**

This creates a new product category and establishes first-mover advantage in the growing decentralized web space.

## Why This Matters

MeshBrowser makes decentralized networking accessible to regular users. Instead of technical CLI tools, it provides a familiar web browsing experience that demonstrates the practical benefits of mesh networking and decentralized protocols.

## Implementation Status

### Completed Backend Components

**ReticulumHandler API:**
```json
// fetch-page command
{
  "id": "request-123",
  "command": "fetch-page",
  "url": "abc123def456.../path/to/file.html"
}

// Response
{
  "id": "request-123",
  "success": true,
  "data": {
    "content": "base64-encoded-content",
    "content_type": "text/html",
    "status_code": 200,
    "encoding": "base64"
  }
}
```

**Key Features:**
- **Curl-like interface** - Takes hash+path string, no protocol parsing needed
- **Binary support** - All content returned as base64 for JSON safety
- **MIME type detection** - From HTTP headers or file extension
- **Smart timeouts** - Only path discovery (10s), trusts RNS for the rest
- **Clean exceptions** - ValueError, ConnectionError, TimeoutError, RuntimeError
- **Modular design** - PageFetcher and StatusFetcher handle specialized logic

## Development Commands

### Running the Application
```bash
npm start                    # Start Electron app with Python backend
```

### Prerequisites
- Node.js v24.7.0+ and npm 11.5.1+
- Python 3.13.7+
- No additional Python dependencies file exists (installs RNS at runtime)

### Development Workflow
The application automatically starts a Python backend process when launched. The Python backend handles Reticulum networking while Electron provides the UI.

## Code Architecture

### Modern Architecture: Protocol Handlers + Reticulum Backend
- **Main Process** (`src/main.js`) - App lifecycle, protocol registration
- **Protocol Handlers** (`src/protocol-handlers/`) - Native protocol implementations
- **Renderer Process** (`src/renderer/`) - Minimal browser UI
- **Reticulum Backend** (`src/reticulum/`) - All networking logic
- **Process Management** (`src/process-manager/`) - Backend lifecycle utilities

### Current File Structure
```
src/
├── main.js                           # App entry, protocol registration, backend startup
├── protocol-handlers/                # Protocol implementations
│   ├── protocol-schemes.js          # Single scheme registration (reticulum + about)
│   ├── reticulum-handler.js          # Handles reticulum:// URLs
│   └── about-handler.js              # Handles about:// URLs (system, status)
├── renderer/                         # Minimal browser UI
│   ├── index.html                    # Browser interface (address bar + webview)
│   └── app.js                        # Navigation logic only
├── process-managers.js               # Backend process management
├── process-manager/                  # Process utilities
│   ├── manager.js                    # Process lifecycle
│   ├── message-handler.js            # IPC communication
│   └── [utils...]                    # Supporting utilities
└── reticulum/                        # Pure Reticulum backend
    ├── main.py                       # Backend entry point
    ├── console_server.py             # IPC server (stdin/stdout/stderr)
    ├── command_router.py             # Command routing
    └── handler/                      # Protocol implementation
        ├── handler.py                # Command handlers (fetch-page, reticulum-status)
        ├── client.py                 # Reticulum networking coordinator
        ├── page_fetcher.py           # Content retrieval with base64 encoding
        └── status_fetcher.py         # Network + system status
```

### Modern Browser Integration
Protocol handlers provide seamless web-like browsing:

```javascript
// User navigates to any URL
browserView.src = url  // That's it!

// Protocol handlers automatically:
// reticulum://hash/path → reticulumHandler fetches from network
// about:system         → aboutHandler generates system info
// about:reticulum      → aboutHandler generates network status

// All embedded resources work automatically:
// <img src="logo.png"> → reticulum://abc123def456.../logo.png
// <link href="style.css"> → reticulum://abc123def456.../style.css
```

### Zero Manual IPC Needed
Protocol handlers eliminate the need for renderer IPC:

```javascript
// OLD: Manual IPC calls from renderer
window.meshBrowserAPI.reticulumStatus()  // ❌ No longer needed

// NEW: Automatic protocol handling
browserView.src = 'about:reticulum'      // ✅ Protocol handler does everything
```

**Recent Major Progress (Latest Sessions):**
- ✅ **HTTP Architecture Refactor** - Replaced serial stdio with parallel HTTP communication
- ✅ **ThreadingHTTPServer** - Enables simultaneous parallel requests for faster page loading
- ✅ **Hybrid Communication** - HTTP for data flow, stdio for process lifecycle management
- ✅ **Clean API Design** - `/proxy/reticulum` endpoint with native HTTP semantics
- ✅ **Python Backend Reorganization** - Moved to `src/python/` with modular structure
- ✅ **Console Package** - Extracted ConsoleManager and ConsoleMessageSender utilities
- ✅ **Structured Messaging** - Framed messages (ERROR:, WARNING:, INFO:, DEBUG:) replace stderr
- ✅ **Protocol Handler Modernization** - Updated to modern `protocol.handle()` API
- ✅ **Multi-frame Message Parsing** - Electron handles all frame types from Python backend
- ✅ **UI Modernization Complete** - Semantic HTML, CSS custom properties, Font Awesome icons
- ✅ **Modular JavaScript** - Navigation history and status management extracted to separate classes
- ✅ **Webview Configuration** - Added `webviewTag: true` to enable webview functionality
- ✅ **Protocol-Agnostic Browser** - Handles any URL protocol, not just mesh protocols
- ✅ **Large File Support** - Fixed JSON message buffering for large content transmission
- ✅ **Binary Content Handling** - Proper HTTP header separation for images and binary files
- ✅ **Reticulum Module Refactor** - Clean separation into 6 focused modules with single responsibilities
  - Removed unused `self.identity` (not needed for outbound client connections)
  - Replaced blocking `time.sleep()` with `threading.Event` for efficient waiting
  - Client controls link lifecycle (establish, use, teardown)
  - Configurable destinations via `establish_link(hash, app, *aspects)`
  - URL validation enforces 16-byte Reticulum hash length
  - All timeouts as module-level constants
  - Net reduction: 107 lines while adding better structure

**Current State:**
MeshBrowser now has a **hybrid parallel architecture** with **professional UI** and **full protocol support**! The app features:
- **HTTP data flow** - Parallel requests via ThreadingHTTPServer for web-like performance
- **stdio process control** - Robust lifecycle management and structured logging
- **Clean backend structure** - All Reticulum code in `src/reticulum/`
- **Modern UI** - Semantic HTML, CSS custom properties, dark mode support, Font Awesome icons
- **Modular JavaScript** - ES6 modules with clean separation of concerns
- **Protocol-agnostic browsing** - Works with any URL protocol (HTTP, HTTPS, mesh protocols)
- **Professional styling** - Clean navigation, status indicators, responsive design
- **Full binary support** - Images, large files, and all content types work correctly
- **Robust message handling** - Proper buffering and parsing for any size content

## **Current Issue: RNS Threading Error**

**Problem:** `RNS.Reticulum()` raises `ValueError: signal only works in main thread` when instantiated in HTTP handler threads.

**Error Details:**
```python
File "src/python/http_api/handler.py", line 23, in __init__
    self.reticulum_client = Reticulum.Client()
File "src/python/reticulum/client.py", line 23, in __init__
    self.reticulum = RNS.Reticulum()
ValueError: signal only works in main thread of the main interpreter
```

**Root Cause:**
- `ThreadingHTTPServer` creates new thread for each request
- Each HTTP request handler creates new `ReticulumClient()` in `__init__`
- `RNS.Reticulum()` tries to register SIGINT handler in non-main thread
- After first request succeeds, subsequent requests fail with "Attempt to reinitialise Reticulum"

**Solution Needed:**
- Create single shared `ReticulumClient` instance in main thread
- Pass or share this instance with HTTP handler threads
- Avoid creating new `RNS.Reticulum()` instances per request

## **Next Priority Tasks**

### **Immediate: Fix Threading Issue**
- ⏳ **Fix RNS threading error** - Create shared ReticulumClient instance in main thread

### **Phase 2: Enhanced Features**
- **Server discovery UI** - Panel showing available RServers on the network
- **Network visualization** - Show mesh connectivity and routing information
- **Bookmarks and history** - Persistent navigation features
