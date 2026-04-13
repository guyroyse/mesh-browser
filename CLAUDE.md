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

- **Frontend**: Electron with electron-vite and TypeScript, custom protocol handlers for `rweb://` URLs
- **Communication**: HTTP for data requests, stdio for process lifecycle
- **Backend**: Python process with ThreadingHTTPServer + Reticulum networking

## File Structure

```
src/
├── main/                        # Electron main process
│   ├── main.ts                 # App entry, lifecycle management
│   ├── config.ts               # Environment detection, paths
│   ├── windows.ts              # Window/view creation, IPC handlers, view events
│   └── processes.ts            # Python backend process instance
├── preload/
│   └── preload.ts              # Context bridge for renderer ↔ main IPC
├── protocol-handlers/
│   ├── protocol-schemes.ts     # Protocol registration (rweb://)
│   └── rweb-handler.ts         # Protocol handler implementation
├── renderer/                    # Multi-view UI (navigation, content, status)
│   ├── navigation/             # Address bar + nav buttons
│   │   ├── index.html
│   │   ├── navigation.ts
│   │   └── navigation.css
│   ├── status/                 # Status indicators
│   │   ├── index.html
│   │   ├── status.ts
│   │   └── status.css
│   ├── shared/                 # Common styles, assets
│   │   ├── common.css
│   │   └── assets/
│   └── types/
│       └── window.d.ts         # BrowserAPI type declarations
├── http-process/               # Backend process lifecycle management
│   ├── manager.ts              # HttpProcessManager
│   ├── starter.ts              # Process startup
│   ├── stopper.ts              # Process shutdown
│   └── message-handler.ts      # Lifecycle event monitoring
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

```typescript
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

Three separate WebContentsView instances managed in `windows.ts`:
- `navigationView`: Address bar + navigation controls
- `webContentsView`: Main content area (renders rweb:// pages)
- `statusView`: Network status indicators

Views communicate via IPC. IPC handlers and view event wiring are colocated in `windows.ts` since they operate directly on the view references. Protocol handling is transparent to views.

## 5. Build Configuration

electron-vite with three build targets configured in `electron.vite.config.ts`:
- **main**: Bundles `src/main/main.ts`, uses `@main`, `@http-process`, and `@protocol-handlers` path aliases
- **preload**: Bundles `src/preload/preload.ts` as CJS
- **renderer**: Multiple HTML entry points (`navigation/index.html`, `status/index.html`), Vite handles `.ts` script references in HTML

`ELECTRON_RENDERER_URL` is the Vite dev server base URL; each view appends its path (e.g. `/navigation/index.html`).

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

Python path resolution is handled in `config.ts`:
- **Dev**: `app.getAppPath()` + `src/python/main.py`
- **Prod**: `process.resourcesPath` + `python/main.py` (via `extraResources`)

# Development Commands

```bash
npm run dev            # Launch app in development mode with hot reload
npm run build          # Build for production
```

**Prerequisites:**
- Node.js 22+
- Python 3.12+
- RNS (Reticulum Network Stack) installed in system Python

# Next Phase Priorities

**Phase 2: Enhanced UX**
- Server discovery panel (show available RServers on network)
- Network topology visualization
- Bookmarks and history persistence
