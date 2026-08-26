// Rubber Panel — Node.js Server Starter
const http = require('http');
const port = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'online',
    message: 'Hello from Rubber Panel Node.js Server!',
    server: "Production Node.js API Service",
    nodeVersion: process.version,
    timestamp: new Date().toISOString(),
    port: port
  }, null, 2));
});

server.listen(port, '0.0.0.0', () => {
  console.log(`[Node.js] Server listening and active on port ${port}`);
});
