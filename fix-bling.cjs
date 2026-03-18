const fs = require('fs');

const apiFile = 'api/bling.ts';
if (fs.existsSync(apiFile)) {
    let content = fs.readFileSync(apiFile, 'utf8');
    const count = (content.match(/www\.bling\.com\.br/g) || []).length;
    console.log(`Found ${count} in api/bling.ts`);
    fs.writeFileSync(apiFile, content.replace(/www\.bling\.com\.br/g, 'api.bling.com.br'));
}

const srvFile = 'services/blingService.ts';
if (fs.existsSync(srvFile)) {
    let content = fs.readFileSync(srvFile, 'utf8');
    const count = (content.match(/www\.bling\.com\.br/g) || []).length;
    console.log(`Found ${count} in services/blingService.ts`);
    fs.writeFileSync(srvFile, content.replace(/www\.bling\.com\.br/g, 'api.bling.com.br'));
}
