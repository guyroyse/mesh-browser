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

### Technology Stack: Electron + Python Backend
```
MeshBrowser Desktop App
├── Electron Frontend (UI)
│   ├── Custom browser chrome
│   ├── Address bar with reticulum:// support
│   ├── Embedded Chromium widget (renders HTML)
│   └── Network status/discovery panels
└── Python Backend (Networking)
    ├── Reticulum client
    ├── Protocol handlers
    └── Local proxy server
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
// Electron main process
protocol.registerSchemesAsPrivileged([{
  scheme: 'reticulum',
  privileges: { supportFetchAPI: true }
}]);

// Intercept reticulum:// URLs
protocol.registerHttpProtocol('reticulum', (request, callback) => {
  // Send to Python backend via IPC
  // Python handles Reticulum networking
  // Return response to Chromium
});
```

### Python Backend Architecture
```python
# Clean separation of concerns with modular design

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

# Handler Classes (Extensible)
class SystemHandler:             # ping, version commands
class ReticulariumHandler:       # fetch-page, network commands (TODO)
class IPFSHandler:               # Future IPFS support
```

## Development Phases

### Phase 1: Reticulum Browser
- ✅ Electron app with embedded Chromium
- ✅ Clean Python backend architecture (ConsoleServer + CommandRouter)
- ✅ JSON IPC communication over stdin/stdout/stderr
- ✅ Extensible handler pattern for commands
- 🔄 Reticulum HTTP client integration (next: add ReticulariumHandler)
- 🔄 Basic reticulum:// URL handling
- 🔄 Server discovery and connection

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
