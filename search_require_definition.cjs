const fs = require('fs');
const text = fs.readFileSync('vps_server.js', 'utf8');
const lines = text.split('\n');
lines.forEach((line, index) => {
  if (line.includes('requireSyncKey') && !line.includes('preHandler:')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
