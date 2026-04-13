# MeshBrowser

A desktop browser for decentralized mesh networks. Browse websites over Reticulum using the `rweb://` protocol - no internet required.

## What is MeshBrowser?

MeshBrowser lets you browse web content over mesh networks like Reticulum. It works like a regular web browser, but instead of connecting to the internet, it uses decentralized mesh networking protocols.

**Key Features:**

- Familiar browser interface with address bar and navigation
- Native `rweb://` protocol support for Reticulum mesh networking
- Automatic server discovery on your network
- Full support for HTML, CSS, JavaScript, and images
- No configuration needed - just install and browse

## Prerequisites

You'll need to install the following software before running MeshBrowser:

### 1. Python (3.12 or higher)

Download and install Python from [python.org](https://www.python.org/downloads/)

### 2. Reticulum Network Stack

Install via pip:

```bash
pip install rns
```

MeshBrowser might have trouble finding the Reticulum libraries if they aren't installed in the system Python. If you run into this and feel brave, you can run this instead:

```bash
pip install rns --break-system-packages
```

I've found it doesn't actually break anything. But, do it at your own risk.

If you have a good solution to this problem, feel free to open and issue to discuss or send a PR.

### 3. Node.js (22 or higher)

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

The browser window will open automatically. The Python backend starts in the background and connects to the Reticulum network.

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

Here are a couple of sites to get you started:

- `rweb://8976c1b2ae6b60fd1a09a83a6e64ff93/` - Home of RETNET, MeshBrowser, and RServer on Reticulum
- `rweb://a5ce2b0dd7e4ecb7057936890feefbbe/` - A community site on the network

Note that there isn't much content on the network yet — it's early days! But you can host some content and help with that. Check out [RServer](https://github.com/guyroyse/rserver) - a web server for Reticulum.

Check the Reticulum documentation for setting up network interfaces and discovering servers.

## Troubleshooting

### "Failed to start Reticulum backend"

- Verify Python 3.12+ is installed
- Verify RNS is installed: `pip show rns`
- Check that no other process is using the Reticulum configuration

### "Cannot connect to backend"

- Ensure the Python backend started successfully (check console output)
- Wait a few seconds after launch for the backend to initialize

### Pages don't load

- Verify your Reticulum network interface is configured and active
- Check that the destination hash is correct (32 hex characters)
- Ensure you have network connectivity to the destination

## Development

To work on MeshBrowser development:

1. Read `CLAUDE.md` for architecture and development context
2. The codebase uses Electron + electron-vite + TypeScript (frontend) and Python (backend)
3. Make changes and test with `npm run dev`

## More Information

- **Reticulum**: [reticulum.network](https://reticulum.network)
- **RNS Documentation**: [markqvist.github.io/Reticulum](https://markqvist.github.io/Reticulum/manual/)
- **RServer**: [github.com/guyroyse/rserver](https://github.com/guyroyse/rserver)
