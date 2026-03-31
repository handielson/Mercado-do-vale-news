const fs = require('fs');
const lines = fs.readFileSync('server.js', 'utf8').split('\n');
lines.forEach((line, i) => {
  if (line.includes("fastify.delete('/products/:id'")) {
    console.log(`${i + 1}: ${line}`);
  }
});
