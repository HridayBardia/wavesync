const http = require('http');
const httpProxy = require('http-proxy');

const proxy = httpProxy.createProxyServer({});

// Handle errors
proxy.on('error', function (err, req, res) {
  console.error('[Proxy Error]', err);
  if (res.writeHead) {
    res.writeHead(500, {
      'Content-Type': 'text/plain'
    });
    res.end('Proxy error occurred.');
  }
});

const server = http.createServer(function (req, res) {
  const url = req.url || '';
  
  // Route backend paths to 8080, everything else to 3000
  if (url.startsWith('/ws') || url.startsWith('/search') || url.startsWith('/stream')) {
    proxy.web(req, res, { target: 'http://localhost:8080' });
  } else {
    proxy.web(req, res, { target: 'http://localhost:3000' });
  }
});

// Proxy WebSocket connections
server.on('upgrade', function (req, socket, head) {
  const url = req.url || '';
  
  if (url.startsWith('/ws') || url.startsWith('/search') || url.startsWith('/stream')) {
    proxy.ws(req, socket, head, { target: 'ws://localhost:8080' });
  } else {
    proxy.ws(req, socket, head, { target: 'ws://localhost:3000' });
  }
});

const PORT = 8000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Reverse Proxy running on http://localhost:${PORT}`);
  console.log(`👉 Routes /ws, /search, /stream to Backend (8080)`);
  console.log(`👉 Routes everything else to Next.js Frontend (3000)`);
});
