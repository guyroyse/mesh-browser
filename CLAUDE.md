# CLAUDE.md

AI assistant context for MeshBrowser development.

# Project Overview

MeshBrowser is an Electron-based desktop browser for decentralized protocols, currently supporting Reticulum mesh networking via the `rweb://` protocol scheme. Future protocols include IPFS and Hypercore.

**Key Goals:**
- Web-like browsing experience over mesh networks
- Familiar browser interface (address bar, navigation, status indicators)
- No configuration needed - auto-discovery and mesh routing
- Extensible architecture for multiple decentralized protocols

# Architecture

## High-Level Design

**Electron Frontend** ↔ **HTTP API** ↔ **Python Backend (Reticulum)**

- **Frontend**: Electron with custom protocol handlers for `rweb://` URLs
- **Communication**: HTTP for data requests, stdio for process lifecycle
- **Backend**: Python process with ThreadingHTTPServer + Reticulum networking

## File Structure

```
src/
├── main.js                      # Electron app entry, window/view management
├── protocol-handlers/
│   ├── protocol-schemes.js     # Protocol registration (rweb://)
│   └── rweb-handler.js         # Protocol handler implementation
├── views/                       # Multi-view UI (navigation, content, status)
│   ├── navigation/             # Address bar + nav buttons
│   ├── status/                 # Status indicators
│   └── shared/                 # Preload scripts, common styles
├── http-process/               # Backend process lifecycle management
│   ├── manager.js              # HttpProcessManager
│   ├── starter.js              # Process startup
│   ├── stopper.js              # Process shutdown
│   └── message-handler.js      # Lifecycle event monitoring
├── ipc-handlers.js             # IPC communication between views
└── python/                     # Python backend
    ├── main.py                 # Entry point
    ├── console/                # Process lifecycle (STARTUP signals, structured logging)
    ├── http_api/               # HTTP server
    │   ├── server.py           # ThreadingHTTPServer wrapper
    │   └── handler.py          # Request handlers
    └── reticulum/              # Reticulum networking (6 modules)
        ├── client.py           # ReticulumClient coordinator
        ├── url.py              # URL parsing
        ├── link.py             # RNS link management
        ├── fetch.py            # Content fetching
        ├── response.py         # Response parsing
        └── status.py           # Network status
```

# Key Architectural Patterns

## 1. Communication Architecture

**HTTP for Data Flow:**
- Protocol handlers use HTTP to request content: `POST /proxy/reticulum`
- Status queries: `GET /api/status`
- Parallel request handling via ThreadingHTTPServer

**stdio for Process Lifecycle:**
- Python backend sends structured messages (STARTUP, ERROR, WARNING, INFO)
- Electron monitors process health via stdout/stderr
- Clean shutdown on EOF

## 2. Protocol Handler Pattern

```javascript
// rweb://hash/path → HTTP request → Python backend → Reticulum network
protocol.handle('rweb', async (request) => {
  const response = await fetch('http://localhost:PORT/proxy/reticulum', {
    method: 'POST',
    body: JSON.stringify({ url, method: 'GET' })
  })
  return new Response(content, { headers, status })
})
```

Protocol handlers enable seamless web-like browsing - all embedded resources (images, CSS, JS) automatically load via the same protocol.

## 3. Shared Reticulum Instance Pattern

**Critical**: Reticulum requires a single instance per program (signal handlers, threading constraints).

Python backend creates one `RNS.Reticulum()` instance in the main thread, then shares it across HTTP handler threads via factory pattern:

```python
# main.py
reticulum_client = Reticulum.Client()  # Main thread
http_server = HTTP.Server(reticulum_client)  # Pass to server
```

## 4. Multi-View UI Architecture

Three separate WebContentsView instances:
- `navigationView`: Address bar + navigation controls
- `webContentsView`: Main content area (renders rweb:// pages)
- `statusView`: Network status indicators

Views communicate via IPC. Protocol handling is transparent to views.

# Important Implementation Details

## Error Handling

**Backend vs Content Errors:**
- Backend errors (Python crashes, network failures) → `X-Backend-Error` header → custom error page
- Reticulum content errors (404, 500) → pass through actual server response

## Binary Content

All content transferred as base64 in JSON responses to avoid encoding issues. Protocol handler decodes before returning to Electron.

## Process Management

Backend lifecycle:
1. `pythonManager.start()` → spawns Python process
2. Wait for `STARTUP` message on stdout
3. HTTP server becomes available on random port
4. `pythonManager.stop()` → sends EOF to stdin → clean shutdown

# Development Commands

```bash
npm start              # Launch app with backend
```

**Prerequisites:**
- Node.js 24.7.0+, npm 11.5.1+
- Python 3.13.7+
- RNS (Reticulum Network Stack) installed at runtime

# Next Phase Priorities

**Phase 2: Enhanced UX**
- Server discovery panel (show available RServers on network)
- Network topology visualization
- Bookmarks and history persistence
