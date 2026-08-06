require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const { exec } = require('child_process');
const os = require('os');
const path = require('path');
const chatRouter = require('./routes/chat');
const errorHandler = require('./middleware/errorHandler');
const { runCognitivePipeline } = require('./nlp_ner/cognitiveArchitecture');
const { getOpenRouterCompletion } = require('./services/openrouter');

const app = express();
let PORT = parseInt(process.env.PORT || '2134', 10);

app.use(cors());
app.use(express.json());

// Serve static Flutter Web frontend assets
app.use(express.static(path.join(__dirname, 'public')));

// Mount API routes
app.use('/api', chatRouter);

// Fallback to index.html for SPA routing
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  const indexPath = path.join(__dirname, 'public', 'index.html');
  if (require('fs').existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  next();
});

// Global Error Handler
app.use(errorHandler);

// Create HTTP Server & WebSocket Server
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Set of connected clients
const clients = new Set();

// Function to broadcast message to all connected Flutter apps & WebSocket clients
const broadcastTerminalLog = (logData) => {
  const payload = JSON.stringify(logData);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
};

app.set('broadcastTerminalLog', broadcastTerminalLog);

// Store original process.stdout.write and process.stderr.write
const originalStdoutWrite = process.stdout.write.bind(process.stdout);
const originalStderrWrite = process.stderr.write.bind(process.stderr);

// Override process.stdout.write to broadcast backend terminal prints
process.stdout.write = function (chunk, encoding, callback) {
  originalStdoutWrite(chunk, encoding, callback);
  const text = chunk.toString();
  if (text.trim()) {
    broadcastTerminalLog({
      type: 'TERMINAL_LOG',
      source: 'stdout',
      text: text,
      timestamp: new Date().toISOString(),
    });
  }
  return true;
};

// Override process.stderr.write to broadcast errors
process.stderr.write = function (chunk, encoding, callback) {
  originalStderrWrite(chunk, encoding, callback);
  const text = chunk.toString();
  if (text.trim()) {
    broadcastTerminalLog({
      type: 'TERMINAL_LOG',
      source: 'stderr',
      text: text,
      timestamp: new Date().toISOString(),
    });
  }
  return true;
};

// WebSocket Connection Manager
wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  clients.add(ws);
  
  console.log(`[WS] 🔌 Client connected from ${clientIp}. Total connected: ${clients.size}`);

  // Send initial welcome & system specs to connected Flutter app
  ws.send(JSON.stringify({
    type: 'WELCOME',
    message: '🚀 Connected to Node.js Backend Terminal Server',
    system: {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      freeMemory: `${Math.round(os.freemem() / 1024 / 1024)}MB`,
      totalMemory: `${Math.round(os.totalmem() / 1024 / 1024)}MB`,
      nodeVersion: process.version,
    },
    timestamp: new Date().toISOString()
  }));

  // Handle incoming messages from Flutter app
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      if (data.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
        return;
      }

      if (data.type === 'SHUTDOWN_SERVER') {
        console.log(`\n🛑 [SHUTDOWN] Stop server request received from Flutter App UI! Terminating server...`);
        broadcastTerminalLog({
          type: 'TERMINAL_LOG',
          source: 'stderr',
          text: '🛑 Backend server process stopped by UI request.',
          timestamp: new Date().toISOString(),
        });
        setTimeout(() => {
          server.close(() => {
            process.exit(0);
          });
          setTimeout(() => process.exit(0), 500);
        }, 300);
        return;
      }

      if (data.type === 'EXEC_COMMAND') {
        const rawCmd = (data.command || '').trim();
        if (!rawCmd) return;

        console.log(`\n$ ${rawCmd}`);

        if (rawCmd.toLowerCase() === 'stop-server' || rawCmd.toLowerCase() === 'exit') {
          console.log(`\n🛑 [SHUTDOWN] Stop server command ($ ${rawCmd}) executed! Terminating server...`);
          broadcastTerminalLog({
            type: 'TERMINAL_LOG',
            source: 'stderr',
            text: '🛑 Backend server process stopped by UI command.',
            timestamp: new Date().toISOString(),
          });
          setTimeout(() => {
            server.close(() => {
              process.exit(0);
            });
            setTimeout(() => process.exit(0), 500);
          }, 300);
          return;
        }

        // Custom built-in quick commands
        if (rawCmd.toLowerCase() === 'system-info') {
          console.log(`[SYSTEM] Host: ${os.hostname()} | OS: ${os.type()} ${os.release()} | CPU: ${os.cpus()[0].model} (${os.cpus().length} cores) | Uptime: ${Math.floor(os.uptime() / 60)} mins`);
          return;
        }

        if (rawCmd.toLowerCase() === 'clear-screen' || rawCmd.toLowerCase() === 'clear') {
          ws.send(JSON.stringify({ type: 'CLEAR_SCREEN' }));
          console.log(`[SERVER] Terminal screen clear signal sent to client.`);
          return;
        }

        if (rawCmd.toLowerCase() === 'test-print') {
          console.log(`\x1b[32m[SUCCESS]\x1b[0m Periodic backend terminal check: OK! Server running smoothly on Node.js ${process.version}`);
          console.log(`\x1b[36m[INFO]\x1b[0m Active client connections: ${clients.size}`);
          console.log(`\x1b[33m[WARN]\x1b[0m System Free Memory: ${Math.round(os.freemem() / 1024 / 1024)}MB / ${Math.round(os.totalmem() / 1024 / 1024)}MB`);
          return;
        }

        // Check for AI Prompt execution commands: ask <text>, prompt <text>, chat <text>, ai <text>, or test-prompt
        const lowerCmd = rawCmd.toLowerCase();
        let userPrompt = null;

        if (lowerCmd.startsWith('ask ')) userPrompt = rawCmd.substring(4).trim();
        else if (lowerCmd.startsWith('prompt ')) userPrompt = rawCmd.substring(7).trim();
        else if (lowerCmd.startsWith('chat ')) userPrompt = rawCmd.substring(5).trim();
        else if (lowerCmd.startsWith('ai ')) userPrompt = rawCmd.substring(3).trim();
        else if (lowerCmd === 'test-prompt' || lowerCmd === 'demo') userPrompt = 'Write a Python function for Fibonacci search algorithm';

        if (userPrompt) {
          (async () => {
            const { nlpResult, reply } = await runCognitivePipeline({
              promptText: userPrompt,
              history: [],
              broadcastFn: broadcastTerminalLog,
              getCompletionFn: ({ targetModel }) => {
                if (process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY !== 'your_openrouter_api_key_here') {
                  return getOpenRouterCompletion({
                    message: userPrompt,
                    targetModel,
                  });
                } else {
                  return { reply: 'Configure OPENROUTER_API_KEY in server .env file for live AI responses.' };
                }
              },
            });
            console.log(`\x1b[32m[AI RESPONSE]\x1b[0m:\n${reply}\n`);
          })();
          return;
        }

        // Execute shell command in backend terminal
        exec(rawCmd, { cwd: __dirname }, (error, stdout, stderr) => {
          if (stdout) {
            console.log(stdout.trimEnd());
          }
          if (stderr) {
            console.error(stderr.trimEnd());
          }
          if (error) {
            console.error(`❌ Command exit code ${error.code}: ${error.message}`);
          }
        });
      }

      if (data.type === 'PRINT_CUSTOM') {
        console.log(`[FLUTTER_APP_2] ${data.text || ''}`);
      }

    } catch (e) {
      console.error(`[WS ERROR] Invalid message format: ${e.message}`);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`[WS] ❌ Client disconnected. Total active: ${clients.size}`);
  });
});

// Handle WebSocket server errors gracefully
wss.on('error', (err) => {
  if (err.code !== 'EADDRINUSE') {
    console.error('[WS SERVER ERROR]', err);
  }
});



const startServer = (port) => {
  server.listen(port, () => {
    console.log(`\n🚀 OpenRouter Backend & Terminal WebSocket Server listening on port ${port}`);
    console.log(`📌 Default Enforced Model: ${process.env.DEFAULT_MODEL || 'openai/gpt-4o-mini'}`);
    console.log(`🔑 OpenRouter API Key Configured: ${process.env.OPENROUTER_API_KEY ? 'Yes' : 'No'}`);
    console.log(`📡 WebSocket Terminal Stream ready at ws://localhost:${port}\n`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`⚠️ Port ${port} is occupied. Trying port ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('❌ Server error:', err);
    }
  });
};

startServer(PORT);

