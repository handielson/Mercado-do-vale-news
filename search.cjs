const fs = require('fs');
const text = fs.readFileSync('server.js', 'utf8');
const lines = text.split('\n');
lines.forEach((line, index) => {
  if (line.toLowerCase().includes('specs')) {
    console.log(`${index + 1}: ${line}`);
  }
});
