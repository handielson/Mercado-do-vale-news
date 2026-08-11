const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, 'n8n-add-first-contact-cordiality.cjs'), 'utf8');
assert.match(source, /firstConversationGreetingV227[\s\S]*latestOutboundAtV160 === 0/);
assert.match(source, /6 \* 60 \* 60 \* 1000/);
assert.match(source, /saudacaoDetectada:[^\n]+firstConversationGreetingV227/);
assert.match(source, /cordialCatalogIntroV227[\s\S]*Só um momento!/);
assert.match(source, /quoteBrandGroupV227/);
assert.match(source, /label: 'Xiaomi \/ Redmi'/);
assert.match(source, /label: 'POCO'/);
assert.match(source, /label: 'Realme'/);
assert.match(source, /chunkLines\.push\('🏷️ \*'/);
assert.match(source, /Escreva com suas proprias palavras/);
assert.match(source, /Prefira duas mensagens curtas/);
console.log('n8n first-contact brand greeting static checks passed');
