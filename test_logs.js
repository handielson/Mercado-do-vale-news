import https from 'https';

https.get('https://xiaomipetrolina.com.br/api/bling?resource=webhook-logs', (resp) => {
  let data = '';
  resp.on('data', (chunk) => { data += chunk; });
  resp.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      console.log(JSON.stringify(parsed, null, 2));
    } catch (e) {
      console.log('Failed to parse JSON. Raw data preview:');
      console.log(data.substring(0, 500));
    }
  });
}).on("error", (err) => {
  console.log("Error: " + err.message);
});
