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

Top level is split by **process**, because that is the boundary that decides
what can run at all: `@reticulum/node` uses `node:net`, so everything under
`main/` is unavailable to a renderer. Feature folders live one level down.

```
src/
├── main/                        # Electron main process (Node)
│   ├── main.ts                 # App entry, lifecycle, shutdown ordering
│   ├── config.ts               # Tunable settings (future config-file home)
│   ├── theme.ts                # Content-view colours mirroring theme.css
│   ├── lifecycle.ts            # Startable / Stoppable / Lifecycle contracts
│   ├── paths.ts                # Renderer URLs, preload + icon paths (environment-derived)
│   ├── windows.ts              # Window/view creation, IPC handlers, view events
│   ├── protocols/               # Protocol layer: schemes, clients, handlers
│   │   ├── protocols.ts        # Three lifecycle phases; owns the clients
│   │   └── rweb.ts             # rweb:// scheme, handler factory, error page
│   └── reticulum/               # Reticulum networking
│       ├── client.ts           # Stack lifecycle + fetch orchestration
│       ├── destination-pool.ts # Per-destination path discovery, Destination, link pool
│       ├── rserver.ts          # The rserver request/response wire protocol
│       ├── url.ts              # rweb:// URL parsing (pure)
│       ├── response.ts         # HTTP-like response parsing (pure)
│       ├── bz2.ts              # bz2 codec injected into links
│       └── async.ts            # Semaphore, deadline helpers (no RNS dependency)
├── preload/
│   └── preload.ts              # Context bridge for renderer ↔ main IPC (built as CJS)
├── renderer/                    # Browser chrome only - NOT the browsed page
│   ├── navigation/             # Address bar + nav buttons
│   ├── status/                 # Status indicators
│   ├── shared/                 # Common styles, assets
│   └── types/
│       └── window.d.ts         # BrowserAPI type declarations
├── shared/
│   └── ipc.ts                  # main ↔ renderer message contract (types only)
└── types/
    └── seek-bzip.d.ts          # Ambient types for seek-bzip, which ships none
```

The view that renders `rweb://` content has no preload and no IPC channel - it
is remote mesh HTML and gets no more privilege than a normal web page.

**config.ts vs paths.ts**: `config.ts` holds numbers someone could reasonably
want different (timeouts, pool size, limits) and is shaped as one object so a
config file later means merging overrides into defaults. `paths.ts` holds
values derived from how the app was launched, which nobody configures;
environment detection is private to it. Protocol invariants - a destination
hash is 16 bytes, HTTP headers end with a blank line - stay beside the code
that depends on them, where changing one reads as the bug it would be.


# Key Architectural Patterns

## 1. In-Process Networking

`rweb://` requests call `reticulumClient.fetch()` directly - there is no IPC,
no HTTP bridge, and no serialization hop. Resource data arrives as a
`Uint8Array` and is handed straight to `Response`.

## 2. Protocol Handler Pattern

Files are named for what they hold - there are deliberately no `index.ts`
barrels, since a tree full of identically-named tabs is hard to navigate.

```typescript
// rweb://hash/path → ReticulumClient → RNS Link → rnsd → mesh
protocol.handle('rweb', async (request) => {
  const target = parseRwebUrl(new URL(request.url))
  const { body, headers, statusCode } = await reticulumClient.fetch(target)
  return new Response(body, { status: statusCode, headers })
})
```

The remote server's status code and headers pass straight through, so an
rserver 404 renders as a real 404. `parseResponse` keeps the whole header set
(minus framing headers like `Transfer-Encoding`, which no longer apply once the
body is in memory) and fills in a `Content-Type` from the path when the server
sent none. Only transport failures produce the local error page.

Protocol handlers enable seamless web-like browsing - all embedded resources (images, CSS, JS) automatically load via the same protocol.

## 3. Link Pooling

**Critical**: the rserver protocol carries no request identifiers, so a
response cannot be matched to a request. Two requests must never be in flight
on one link.

`destination-pool.ts` owns one pool per destination (`MAX_LINKS_PER_DESTINATION`)
with a semaphore bounding concurrency. Callers borrow a link through
`withLink(use)` and cannot hold it past the callback, so the one-request-per-link
invariant does not depend on caller discipline. Idle links are reused and closed
after `LINK_IDLE_TIMEOUT`; a pool that goes fully quiet drops itself from the
client's map.

Path discovery is deduplicated per destination - twenty subresources broadcast
one `requestPath`, not twenty - and waits on transport's `announce` event rather
than polling `hasPath`. Transport writes the routing-table entry immediately
before dispatching that event, so `hasPath()` is already true when it fires. A
failed discovery is remembered for `PATH_FAILURE_TTL` so that every subresource
of an unreachable host does not serially pay the full timeout.

## 4. Protocol Lifecycle

`protocols/protocols.ts` owns the protocol clients and exposes three phases,
because Electron dictates the split: `registerProtocolSchemes()` must run
*before* app-ready, `setupProtocols()` only *after* it, and
`teardownProtocols()` on quit. `main.ts` sequences those and does nothing else
protocol-specific.

Clients are warmed up **fire-and-forget**, never awaited. A client that cannot
reach its daemon just means that network is unavailable on this machine, which
is not an app error - it surfaces on that protocol's error page if the user
asks for it. `fetch()` starts the stack on first use anyway, so the warm-up is
an optimisation (open the connection early, start collecting announces), not a
precondition.

Clients implement `Lifecycle` (`main/lifecycle.ts`), so a client whose
`start`/`stop` signatures drift fails to compile. `warmUp` and `shutDown` take
the narrower `Startable` / `Stoppable` halves, so neither can do the other's
job. `src/types/` is deliberately reserved for ambient shims of untyped
third-party packages; domain contracts like this live beside their domain.

Adding a protocol is a file beside `rweb.ts` exporting a scheme descriptor and
a handler factory, plus two lines in `protocols.ts`.

## 5. Multi-View UI Architecture

Three separate WebContentsView instances managed in `windows.ts`:
- `navigationView`: Address bar + navigation controls
- `webContentsView`: Main content area (renders rweb:// pages)
- `statusView`: Network status indicators

Views communicate via IPC. IPC handlers and view event wiring are colocated in `windows.ts` since they operate directly on the view references. Protocol handling is transparent to views.

## 6. Build Configuration

electron-vite with three build targets configured in `electron.vite.config.ts`:
- **main**: Bundles `src/main/main.ts`. No path aliases - everything main-only lives under `src/main/`, so relative imports stay short and there is no alias list to keep in sync between `electron.vite.config.ts` and `tsconfig.json`. `externalizeDepsPlugin()` keeps `@reticulum/*` resolved from `node_modules` rather than inlined - both to avoid bundling ESM with `node:` builtins, and to keep the EUPL-licensed dependency a separate component (see `NOTICE`)
- **preload**: Bundles `src/preload/preload.ts` as CJS
- **renderer**: Multiple HTML entry points (`navigation/index.html`, `status/index.html`). Script tags **must** carry `type="module"` - Vite silently refuses to bundle a classic script, emitting no JS at all while the built HTML still points at the `.ts` file

`tsconfig.json` keeps only the `@reticulum/core/src/*` and `@reticulum/node/src/*`
mappings, which point at the types reticulum-js ships outside its package root.

`ELECTRON_RENDERER_URL` is the Vite dev server base URL; each view appends its path (e.g. `/navigation/index.html`).

# Important Implementation Details

## Error Handling

**Transport vs Content Errors:**
- Transport errors (no path, no identity, timeout, `rnsd` unreachable) → thrown → custom error page, HTTP 500
- Reticulum content errors (404, 500) → pass through as the actual server response

`fetch()` starts the stack if it is not up, so a launch that failed because
`rnsd` was not yet running recovers on the next navigation instead of leaving
the app dead until restart. Concurrent calls share one attempt. The error page
therefore reports a live connection failure rather than a remembered one.

## Binary Content

Resource data is a `Uint8Array` and goes straight into `Response` - no base64,
no copying. reticulum-js types it as `ArrayBufferLike`, which `BodyInit`
rejects, so `response.ts` narrows it once at the parse boundary.

## bz2 Resources

Python RNS bz2-compresses Resources and reticulum-js ships no codec by design.
`link.bz2` **must** be set immediately after `createLink()`, before any
advertisement arrives, or every fetch fails in `Resource.assemble`. This is
invisible in JS-to-JS testing - only a real Python peer exercises it.
`configureLink()` in `destination-pool.ts` is the one place this happens.

`seek-bzip` decodes only. Any future upload/POST that *sends* a Resource will
need an encoder such as `compressjs`.

## Shutdown Ordering

Electron does not await `before-quit` listeners, so `main.ts` calls
`event.preventDefault()`, tears down behind a guard timeout, then `app.exit()`.
Links must be torn down **before** `rns.stop()`: `teardown()` sends LINKCLOSE
and needs the interface still up, and an ACTIVE link's 1-second watchdog is not
cancelled by `stop()`. Getting this wrong hangs the quit rather than failing
loudly.

## Application Icon

`build/icon.png` is source, not build output - it is electron-builder's
`buildResources`, so it does not belong in `.gitignore` beside `out/` and
`dist/`.

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

# Branching and Delivery

Gitflow. `main` is the current release, `develop` is the integration branch,
features branch off `develop` and PR back into it. Nothing but a
`develop` -> `main` release merge ever touches `main`.

`.github/workflows/release.yml` is the only workflow, and it is delivery rather
than CI: it runs on push to `main` and produces the installers that *are* the
shipped application. A `guard` job fails the run if `v{package.json version}`
already has a release or tag - drafts included, since a draft carries no tag -
so **bump the version on `develop` before merging to `main`**. The matrix then
typechecks, builds, and packages all three platforms serially into one draft
release; publishing that draft by hand is what creates the git tag.

There is deliberately no per-push CI on `develop` or feature branches yet.
Tests and pre-merge checks are future work; until they exist, `main` is the
first place anything is verified.

# Next Phase Priorities

**Phase 2: Enhanced UX**
- Server discovery panel (show available RServers on network)
- Network topology visualization
- Bookmarks and history persistence
