const { spawn } = require('child_process');
const path = require('path');

class PythonManager {
  constructor() {
    this.pythonProcess = null;
    this.isReady = false;
    this.pendingRequests = new Map();
    this.requestIdCounter = 0;
  }

  async start() {
    return new Promise((resolve, reject) => {
      const pythonScript = path.join(__dirname, 'python', 'main.py');

      // Spawn Python process
      this.pythonProcess = spawn('python', [pythonScript], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Handle stdout (responses from Python)
      this.pythonProcess.stdout.on('data', (data) => {
        const lines = data.toString().split('\n');

        for (const line of lines) {
          if (line.trim()) {
            try {
              const message = JSON.parse(line.trim());
              this.handlePythonMessage(message);
            } catch (e) {
              console.error('Failed to parse Python message:', line, e);
            }
          }
        }
      });

      // Handle stderr (Python errors)
      this.pythonProcess.stderr.on('data', (data) => {
        console.error('Python stderr:', data.toString());
      });

      // Handle process exit
      this.pythonProcess.on('close', (code) => {
        console.log(`Python process exited with code ${code}`);
        this.isReady = false;
        this.pythonProcess = null;

        // Reject all pending requests
        for (const [id, { reject }] of this.pendingRequests) {
          reject(new Error('Python process terminated'));
        }
        this.pendingRequests.clear();
      });

      // Handle process errors
      this.pythonProcess.on('error', (error) => {
        console.error('Python process error:', error);
        reject(error);
      });

      // Wait for startup message
      const startupTimeout = setTimeout(() => {
        reject(new Error('Python backend startup timeout'));
      }, 5000);

      const originalHandler = this.handlePythonMessage.bind(this);
      this.handlePythonMessage = (message) => {
        if (message.type === 'startup') {
          clearTimeout(startupTimeout);
          this.isReady = true;
          this.handlePythonMessage = originalHandler;
          resolve();
        }
      };
    });
  }

  handlePythonMessage(message) {
    if (message.type === 'startup' || message.type === 'shutdown' || message.type === 'error') {
      // System messages
      console.log('Python system message:', message);
      return;
    }

    // Response to a specific request
    const requestId = message.id;
    if (this.pendingRequests.has(requestId)) {
      const { resolve, reject } = this.pendingRequests.get(requestId);
      this.pendingRequests.delete(requestId);

      if (message.success) {
        resolve(message.data);
      } else {
        reject(new Error(message.error || 'Unknown Python error'));
      }
    }
  }

  async sendCommand(command, data = {}) {
    if (!this.isReady || !this.pythonProcess) {
      throw new Error('Python backend not ready');
    }

    const requestId = ++this.requestIdCounter;

    return new Promise((resolve, reject) => {
      // Store the promise resolvers
      this.pendingRequests.set(requestId, { resolve, reject });

      // Set timeout for request
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('Request timeout'));
        }
      }, 10000);

      // Send command to Python
      const message = {
        id: requestId,
        command: command,
        ...data
      };

      const jsonMessage = JSON.stringify(message) + '\n';
      this.pythonProcess.stdin.write(jsonMessage);
    });
  }

  async stop() {
    if (this.pythonProcess && this.isReady) {
      try {
        await this.sendCommand('shutdown');
      } catch (e) {
        // Ignore shutdown errors
      }

      // Force kill if still running
      setTimeout(() => {
        if (this.pythonProcess) {
          this.pythonProcess.kill();
        }
      }, 1000);
    }
  }
}

// Singleton instance
const pythonManager = new PythonManager();

module.exports = { pythonManager };