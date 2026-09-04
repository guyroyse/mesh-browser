# Changelog

All notable changes to MeshBrowser are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-09-04

### Added

- NomadNet page browsing, over a new `nomadnet://` scheme. Links between NomadNet and RWeb pages resolve and render in both directions.
- A renderer for micron, the markup NomadNet pages are written in. Pages render monospace on a character grid, the way their authors drew them, and cannot run scripts. The styling follows what other NomadNet clients draw — light text on a dark ground, section headings as bars — so a page looks the way its author laid it out.
- Micron links resolve to full URLs, including links to a page on another node and links out to the web. A link the browser cannot follow — an LXMF address, say — is shown struck through rather than left to fail.

### Changed

- A destination hash typed on its own now opens as `nomadnet://` rather than `rweb://`. Both schemes use identically shaped 32-character hashes, so a bare one is ambiguous — but outside this browser a bare hash already means a NomadNet node, which is how they are shared. Reaching an RWeb server by hash alone now needs `rweb://` typed in front of it.

### Fixed

- Connections to a node that is slow or unreachable are now closed when they time out. They were left open instead, tying up resources here and on the far end until that node gave up on its own.

### Known limitations

- Downloading files from NomadNet nodes is not supported, and says so.
- Micron form fields are shown but cannot be filled in or submitted.
- Browsing is anonymous, so pages a node operator has restricted will refuse to load.

## [1.2.1] - 2026-09-02

### Fixed

- The browser chrome lost its padding and background colour in packaged builds. `common.css` and each view's own stylesheet both defined `body` at the same specificity, and while the dev server serves them in source order — the view's sheet last — Vite bundles the shared CSS into a chunk it emits *after* the per-view one, reversing the cascade. The status bar's indicator sat flush against the left edge, the hovered URL flush against the right, and both bars took the wrong background. The defaults in `common.css` are now scoped with `:where()`, giving them zero specificity so a view's own rule always wins regardless of bundle order. Present since 1.1.0 and visible only in a built app, which is why it survived dev testing.

## [1.2.0] - 2026-09-02

### Added

- Hovering a link in a mesh page now shows its URL in the status bar, right-aligned and truncated so a long `rweb://` address cannot displace the status text.
- The window title reads `MeshBrowser - <page title>`, falling back to `MeshBrowser` before anything has loaded.
- An application icon, replacing Electron's default. The mark is an orrery — nodes held at tiers of remove on concentric orbits — in the amber and near-black already used by the browser chrome.
- Icon wiring: `build/icon.png` is derived by electron-builder into the Windows `.ico`, macOS `.icns`, and Linux icon set, and staged into the packaged resources so Linux can read it at runtime. `build/icons/` carries per-size renders, using a reduced form of the mark at 32px and below where the full one cannot resolve. That reduction currently reaches Linux only; Windows and macOS still downscale the full mark.

### Changed

- The status bar loading indicator is amber rather than blue, which was close to illegible at its 8px size, and the bar has a wider gutter so the indicator no longer crowds the window edge.
- The window title no longer reports the npm package name (`mesh-browser`).
- The build workflow is now `release.yml` and refuses to run when the version in `package.json` already has a release or tag, rather than uploading over the existing draft.

## [1.1.1] - 2026-08-30

### Fixed

- Large file downloads, which failed in two separate ways. Python RNS splits anything over roughly 1 MiB into multiple Resources; only the first was read, silently truncating large images. Separately, reticulum-js's resource-bomb limit was passed to the bz2 decoder as an exact output size rather than an upper bound, so any body that did not decode to precisely that many bytes threw instead of decompressing.

## [1.1.0] - 2026-08-30

### Changed

- Reticulum is now spoken directly from the Electron main process via reticulum-js, replacing the Python sidecar. There is no longer a separate process, an HTTP bridge, or a venv to manage; `rweb://` requests call the client in-process and attach to a running `rnsd` shared instance.
- The source tree is split by process (`main/`, `preload/`, `renderer/`, `shared/`), with protocol handling, link pooling, and path discovery separated into their own modules.
- Browser chrome colours moved into shared design tokens, with the content view's native background mirroring them so a mesh page does not flash white before it paints.

### Added

- Per-platform build scripts and electron-builder packaging for Linux (AppImage, deb), Windows (NSIS), and macOS (dmg).
- Response headers from the remote server now pass through in full, so a page is served with the content type the server sent. Where a server sends none, it is inferred from the path.

### Fixed

- The status bar never displayed errors: the loading state was tested first, so the error branch could not be reached. It was also driven by two competing IPC channels, one of which immediately overwrote the other.

## [1.0.0] - 2026-08-08

Version assigned retroactively. This release was never tagged, and describes the
original Python-backed architecture that 1.1.0 replaced in full.

### Added

- Electron browser shell for the `rweb://` scheme, with an address bar, navigation controls, and a status bar.
- Reticulum networking through a Python backend, communicating with the main process over a hybrid HTTP and stdio channel.
- Native protocol handler registration, so embedded resources in a mesh page — images, stylesheets, scripts — load over the same scheme as the page itself.
- WebContentsView-based UI with the browser chrome and the browsed page in separate views.
- TypeScript throughout, converted from the original JavaScript.

### Fixed

- Large file and binary content handling.
- An IPC race condition during handler registration.
- An RNS threading error, resolved with a shared client.
- Python interpreter discovery where the executable is named `python` rather than `python3`.
- Development path resolution on Windows.
