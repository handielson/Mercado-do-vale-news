import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../deploy-vps-server-only.cjs', import.meta.url), 'utf8');

assert.match(source, /META_GRAPH_API_VERSION:[\s\S]*'v25\.0'/, 'A versão oficial selecionada da Graph API deve possuir fallback seguro.');
assert.match(source, /META_OAUTH_REDIRECT_URI:[\s\S]*https:\/\/api\.xiaomipetrolina\.com\.br\/integrations\/meta\/oauth\/callback/, 'O callback OAuth público deve permanecer configurado.');
assert.match(source, /META_TOKEN_ENCRYPTION_KEY:[\s\S]*crypto\.randomBytes\(32\)/, 'A chave de tokens deve ser gerada com entropia criptográfica.');
assert.match(source, /readEnvValue\(current, 'META_TOKEN_ENCRYPTION_KEY'\)/, 'A chave remota existente deve ser preservada.');
assert.match(source, /if \(process\.env\.META_APP_ID\)/, 'App ID vazio não pode apagar o valor remoto.');
assert.match(source, /if \(process\.env\.META_APP_SECRET\)/, 'App Secret vazio não pode apagar o valor remoto.');
assert.match(source, /requiredMetaKeys\.filter\(\(key\) => !readEnvValue\(next, key\)\)/, 'O deploy deve verificar apenas a presença das credenciais, sem imprimir valores.');

console.log('meta-vps-env-static: ok');
