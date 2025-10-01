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

### 3. Node.js

Download and install a recent version of Node.js from [nodejs.org](https://nodejs.org/)

## Installation

1. **Clone or download this repository**

2. **Install Node.js dependencies:**
   ```bash
   npm install
   ```

That's it! You're ready to run MeshBrowser.

## Running MeshBrowser

Start the application:
```bash
npm start
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

Check the Reticulum documentation for setting up network interfaces and discovering servers.

**Want to host your own content?** Check out [RServer](https://github.com/guyroyse/rserver) - a web server for Reticulum.

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
2. The codebase uses Electron (frontend) + Python (backend)
3. Make changes and test with `npm start`

## More Information

- **Reticulum**: [reticulum.network](https://reticulum.network)
- **RNS Documentation**: [markqvist.github.io/Reticulum](https://markqvist.github.io/Reticulum/manual/)
- **RServer**: [github.com/guyroyse/rserver](https://github.com/guyroyse/rserver)
