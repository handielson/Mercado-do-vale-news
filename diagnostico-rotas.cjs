const fs = require('fs');

const verify = (file) => {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  console.log(`\n=== Analyzing ${file} ===`);
  lines.forEach((line, i) => {
    if (line.includes('fastify.delete') || line.includes('fastify.put') || line.includes('fastify.post') || line.includes('fastify.get') || line.includes('fastify.patch')) {
      if (line.includes('/products/:id') || line.includes('/combos')) {
        console.log(`${i+1}: ${line.trim()}`);
      }
    }
  });
};

verify('server.js');
verify('vps_server.js');
