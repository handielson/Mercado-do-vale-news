const fetch = require('node-fetch');

async function testFetch() {
  try {
    const slug = 'note-15';
    console.log(`Buscando produto slug=${slug} localmente port 4000...`);
    const res = await fetch(`http://localhost:4000/products/by-slug/${slug}`);
    
    console.log(`Status: ${res.status}`);
    const text = await res.text();
    console.log(`Response: ${text.substring(0, 500)}`);
  } catch (error) {
    console.error('Error:', error);
  }
}

testFetch();
