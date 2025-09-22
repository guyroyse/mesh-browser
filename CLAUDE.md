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
# Clean modular architecture with protocol-based organization

# Main entry point
main.py -> ConsoleServer(CommandRouter)

# IPC Communication Layer
class ConsoleServer:
    def run():                    # Main stdin/stdout JSON loop
    def _process_next_line():     # Read and validate input
    def _process_message():       # Parse JSON messages
    def _handle_message():        # Route commands, handle shutdown
    def _send_message():          # Send JSON responses
    def _log_info/debug/error():  # stderr logging

# Command Routing Layer
class CommandRouter:
    def register_commands():      # Register handler classes
    def handle_command():         # Route to appropriate handlers

# Protocol Modules (Extensible)
src/python/
├── system/
│   └── handler.py               # SystemHandler: ping, version
├── reticulum/
│   ├── handler.py               # ReticulumHandler: fetch-page, status
│   ├── client.py                # ReticulumClient: networking coordinator
│   ├── page_fetcher.py          # PageFetcher: content retrieval
│   └── status_fetcher.py        # StatusFetcher: network information
└── ipfs/                        # Future IPFS support
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

### Phase 1b: Code Quality (IN PROGRESS)
- 🔄 **Protocol handler refactoring** - Break down long handler files
- 🔄 **UI modernization** - Clean up HTML/CSS for professional appearance
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
- ✅ **Major Architecture Refactoring** - Clean separation of concerns
- ✅ **Protocol Handler Modernization** - Updated to modern `protocol.handle()` API
- ✅ **Consolidated IPC** - Eliminated all unnecessary IPC, protocol handlers handle everything
- ✅ **Backend Reorganization** - Moved to `src/reticulum/` with clean handler structure
- ✅ **Simplified Renderer** - 50%+ code reduction, just navigation + webview
- ✅ **Fixed Electron Protocol Bug** - Single scheme registration prevents silent overwrites
- ✅ **Direct Imports** - Protocol handlers import dependencies directly, no parameter passing
- ✅ **System Info Consolidation** - Combined version + reticulum status into single command

**Current State:**
MeshBrowser now has a **clean, modern architecture**! The app features:
- **Protocol handlers** that work like real web protocols (`reticulum://`, `about://`)
- **Zero unnecessary IPC** - Everything flows through protocol handlers
- **Clean backend structure** - All Reticulum code in `src/reticulum/`
- **Simplified renderer** - Just navigation logic, protocol handlers do the heavy lifting
- **Modern Electron APIs** - Using latest `protocol.handle()` instead of deprecated methods

## **Next Priority Tasks**

### **Phase 1: Handler Refactoring**
- **Refactor protocol handlers** - Both reticulum and about handlers are quite long and need breaking down
- **Extract reusable components** - Move common logic into separate modules
- **Improve error handling** - Better error pages and edge case handling

### **Phase 2: UI Polish**
- **Clean up index.html** - Improve structure and organization
- **Modernize styles** - Clean, professional CSS with good responsive design
- **Improve accessibility** - Better semantic HTML and ARIA labels
