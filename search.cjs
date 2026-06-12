const fs = require('fs');
const query = process.argv[2] || 'payment_methods';
const text = fs.readFileSync('vps_server.js', 'utf8');
const lines = text.split('\n');
let count = 0;
lines.forEach((line, index) => {
  if (line.toLowerCase().includes(query.toLowerCase())) {
    console.log(`${index + 1}: ${line.trim()}`);
    count++;
    if (count > 100) {
      console.log('... truncated ...');
      process.exit(0);
    }
  }
});
