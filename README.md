# MeshBrowser

A desktop browser for decentralized mesh networks. Browse websites over Reticulum using the `rweb://` protocol - no internet required.

## What is MeshBrowser?

MeshBrowser lets you browse web content over mesh networks like Reticulum. It works like a regular web browser, but instead of connecting to the internet, it uses decentralized mesh networking protocols.

**Key Features:**

- Familiar browser interface with address bar and navigation
- Native `rweb://` protocol support for Reticulum mesh networking
- Automatic server discovery on your network
- Full support for HTML, CSS, JavaScript, and images
- No per-site configuration - point it at a destination hash and browse

## Prerequisites

You'll need the following before running MeshBrowser:

### 1. A running Reticulum daemon (`rnsd`)

MeshBrowser speaks Reticulum from inside the app itself, but it needs a local
Reticulum daemon to own the actual network interfaces (radios, TCP links, and
so on). Install Reticulum and start the daemon:

```bash
pipx install rns    # or: pip install rns
rnsd
```

Make sure `share_instance` is enabled in `~/.reticulum/config` — it is on by
default:

```
[reticulum]
  share_instance = Yes
```

MeshBrowser attaches to that shared instance over a local socket, so whatever
interfaces you have configured — LoRa, TCP, I2P — work automatically.

### 2. Node.js (22 or higher)

Download and install Node.js from [nodejs.org](https://nodejs.org/)

## Installation

1. **Clone or download this repository**

2. **Install Node.js dependencies:**
   ```bash
   npm install
   ```

## Running MeshBrowser

Start the application in development mode:

```bash
npm run dev
```

The browser window will open automatically and connect to your running `rnsd`.

## Using MeshBrowser

### Browsing rweb:// URLs

Enter a Reticulum address in the address bar:

```
rweb://abc123def456789.../index.html
```

The format is: `rweb://[32-character-hash]/path/to/file`

### Navigation

- **Go button** - Navigate to the entered URL
- **Back/Forward** - Standard browser navigation
- **Status bar** - Shows network connectivity and request status

### Finding Content

To browse content on the Reticulum network, you'll need:

- **RServer addresses** - Reticulum servers hosting web content
- **Network connectivity** - Active Reticulum network interface

Here are a few sites to get you started:

- **CORE** — `rweb://8976c1b2ae6b60fd1a09a83a6e64ff93/`
- **Digital Freedom** — `rweb://a5ce2b0dd7e4ecb7057936890feefbbe/`
- **Digital Sovereignty** — `rweb://ffc8d3472451090677fd446837e384ff/`

These are personal sites belonging to people on the network — listing them here
isn't an endorsement of what's on them. The exception is CORE, which I run for a
radio meetup.

Note that there isn't much content on the network yet — it's early days! But you can host some content and help with that. Check out [RServer](https://github.com/guyroyse/rserver) - a web server for Reticulum.

Check the Reticulum documentation for setting up network interfaces and discovering servers.

## Troubleshooting

### "Could not reach a Reticulum shared instance"

- Verify `rnsd` is running: `rnsd` in another terminal, or check `pgrep rnsd`
- Verify `share_instance = Yes` in `~/.reticulum/config`
- If you run multiple shared instances, check that `instance_name` matches

### "Could not recall server identity"

The destination hasn't announced itself on the network yet, so its identity
isn't known locally. Wait for an announce and try again.

### Pages don't load

- Verify your Reticulum network interface is configured and active
- Check that the destination hash is correct (32 hex characters)
- Ensure you have network connectivity to the destination

## Development

To work on MeshBrowser development:

1. Read `CLAUDE.md` for architecture and development context
2. The codebase is entirely Electron + electron-vite + TypeScript
3. Make changes and test with `npm run dev`

## More Information

- **Reticulum**: [reticulum.network](https://reticulum.network)
- **RNS Documentation**: [markqvist.github.io/Reticulum](https://markqvist.github.io/Reticulum/manual/)
- **RServer**: [github.com/guyroyse/rserver](https://github.com/guyroyse/rserver)
