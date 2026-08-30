# CLAUDE.md

AI assistant context for MeshBrowser development.

# Project Overview

MeshBrowser is an Electron-based desktop browser for decentralized protocols, currently supporting Reticulum mesh networking via the `rweb://` protocol scheme. Future protocols include IPFS and Hypercore.

Reticulum is spoken directly from the Electron main process using
[reticulum-js](https://github.com/bergie/reticulum-js) (`@reticulum/core` +
`@reticulum/node`), attached to a locally running `rnsd` shared instance.

**Key Goals:**
- Web-like browsing experience over mesh networks
- Familiar browser interface (address bar, navigation, status indicators)
- No per-site configuration - mesh routing is handled by `rnsd`
- Extensible architecture for multiple decentralized protocols

# Architecture

## High-Level Design

**Electron Main Process (reticulum-js)** ↔ **local socket** ↔ **rnsd**

Single process, no sidecar. The `rweb://` protocol handler calls the Reticulum
client in-process; the client attaches to a running `rnsd` shared instance via
`LocalClientInterface`, which is what actually owns the radios and TCP links.

- **Frontend**: Electron with electron-vite and TypeScript, custom protocol handlers for `rweb://` URLs
- **Networking**: reticulum-js in the main process (`@reticulum/node` uses `node:net`, so it must never be imported from a renderer)
- **Transport**: `rnsd`, which the user runs separately

## File Structure

```
src/
├── main/                        # Electron main process
│   ├── main.ts                 # App entry, lifecycle, shutdown ordering
│   ├── config.ts               # Environment detection, renderer/preload paths
│   ├── windows.ts              # Window/view creation, IPC handlers, view events
│   └── reticulum.ts            # Long-lived ReticulumClient singleton
├── preload/
│   └── preload.ts              # Context bridge for renderer ↔ main IPC
├── protocol-handlers/
│   ├── protocol-schemes.ts     # Protocol registration (rweb://)
│   └── rweb-handler.ts         # Protocol handler implementation
├── reticulum/                   # Reticulum networking (main process only)
│   ├── client.ts               # Stack lifecycle, path discovery, link pool, fetch
│   ├── url.ts                  # rweb:// URL parsing (pure)
│   ├── response.ts             # HTTP-like response parsing (pure)
│   ├── bz2.ts                  # bz2 codec injected into links
│   └── seek-bzip.d.ts          # Types for seek-bzip, which ships none
└── renderer/                    # Multi-view UI (navigation, content, status)
    ├── navigation/             # Address bar + nav buttons
    ├── status/                 # Status indicators
    ├── shared/                 # Common styles, assets
    └── types/
        └── window.d.ts         # BrowserAPI type declarations
```

# Key Architectural Patterns

## 1. In-Process Networking

`rweb://` requests call `reticulumClient.fetch()` directly - there is no IPC,
no HTTP bridge, and no serialization hop. Resource data arrives as a
`Uint8Array` and is handed straight to `Response`.

## 2. Protocol Handler Pattern

```typescript
// rweb://hash/path → ReticulumClient → RNS Link → rnsd → mesh
protocol.handle('rweb', async (request) => {
  const target = parseRwebUrl(new URL(request.url))
  const { body, contentType, statusCode } = await reticulumClient.fetch(target)
  return new Response(body, { status: statusCode, headers: { 'Content-Type': contentType } })
})
```

The remote server's status code passes straight through, so an rserver 404
renders as a real 404. Only transport failures produce the local error page.

Protocol handlers enable seamless web-like browsing - all embedded resources (images, CSS, JS) automatically load via the same protocol.

## 3. Link Pooling

**Critical**: the rserver protocol carries no request identifiers, so a
response cannot be matched to a request. Two requests must never be in flight
on one link.

`client.ts` keeps a per-destination pool (`MAX_LINKS_PER_DESTINATION`) with a
semaphore bounding concurrency. Each link handles one request at a time; idle
links are reused and closed after `LINK_IDLE_TIMEOUT`. A page with many
subresources therefore gets bounded parallelism without response ambiguity.

Path discovery is deduplicated per destination - twenty subresources broadcast
one `requestPath`, not twenty.

## 4. Multi-View UI Architecture

Three separate WebContentsView instances managed in `windows.ts`:
- `navigationView`: Address bar + navigation controls
- `webContentsView`: Main content area (renders rweb:// pages)
- `statusView`: Network status indicators

Views communicate via IPC. IPC handlers and view event wiring are colocated in `windows.ts` since they operate directly on the view references. Protocol handling is transparent to views.

## 5. Build Configuration

electron-vite with three build targets configured in `electron.vite.config.ts`:
- **main**: Bundles `src/main/main.ts`, uses `@main`, `@rns`, and `@protocol-handlers` path aliases. `externalizeDepsPlugin()` keeps `@reticulum/*` resolved from `node_modules` rather than inlined - both to avoid bundling ESM with `node:` builtins, and to keep the EUPL-licensed dependency a separate component (see `NOTICE`)
- **preload**: Bundles `src/preload/preload.ts` as CJS
- **renderer**: Multiple HTML entry points (`navigation/index.html`, `status/index.html`), Vite handles `.ts` script references in HTML

`ELECTRON_RENDERER_URL` is the Vite dev server base URL; each view appends its path (e.g. `/navigation/index.html`).

# Important Implementation Details

## Error Handling

**Transport vs Content Errors:**
- Transport errors (no path, no identity, timeout, `rnsd` unreachable) → thrown → custom error page, HTTP 500
- Reticulum content errors (404, 500) → pass through as the actual server response

A failure to reach `rnsd` at startup is remembered on the client and re-thrown
from `fetch()`, so the error page says *why* rather than "not started".

## Binary Content

Resource data is a `Uint8Array` and goes straight into `Response` - no base64,
no copying. reticulum-js types it as `ArrayBufferLike`, which `BodyInit`
rejects, so `response.ts` narrows it once at the parse boundary.

## bz2 Resources

Python RNS bz2-compresses Resources and reticulum-js ships no codec by design.
`link.bz2` **must** be set immediately after `createLink()`, before any
advertisement arrives, or every fetch fails in `Resource.assemble`. This is
invisible in JS-to-JS testing - only a real Python peer exercises it.

`seek-bzip` decodes only. Any future upload/POST that *sends* a Resource will
need an encoder such as `compressjs`.

## Shutdown Ordering

Electron does not await `before-quit` listeners, so `main.ts` calls
`event.preventDefault()`, tears down behind a guard timeout, then `app.exit()`.
Links must be torn down **before** `rns.stop()`: `teardown()` sends LINKCLOSE
and needs the interface still up, and an ACTIVE link's 1-second watchdog is not
cancelled by `stop()`. Getting this wrong hangs the quit rather than failing
loudly.

# Development Commands

```bash
npm run dev            # Launch app in development mode with hot reload
npm run build          # Build for production
```

**Prerequisites:**
- Node.js 22+
- A running `rnsd` with `share_instance` enabled

Note for agents working in a VS Code integrated terminal: `ELECTRON_RUN_AS_NODE=1`
is inherited from the extension host and makes Electron run as plain Node, so
`electron` resolves to the npm path-string shim and the app fails to start.
Launch with `env -u ELECTRON_RUN_AS_NODE npm run dev`.

# Next Phase Priorities

**Phase 2: Enhanced UX**
- Server discovery panel (show available RServers on network)
- Network topology visualization
- Bookmarks and history persistence
