const fs = require('fs');
const lines = fs.readFileSync('server.js', 'utf8').split('\n');
console.log('Searching for "products/:id" and "delete"...');
lines.forEach((line, i) => {
  if (line.includes('products/:id') || line.toLowerCase().includes('delete')) {
    console.log(`${i+1}: ${line.trim()}`);
  }
});
