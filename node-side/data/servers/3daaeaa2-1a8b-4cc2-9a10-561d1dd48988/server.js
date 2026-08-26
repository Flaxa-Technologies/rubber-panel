
    const http = require('http');
    const server = http.createServer((req, res) => {
      res.end('Hello from secure Node.js server!');
    });
    server.listen(process.env.PORT || 3000);
  