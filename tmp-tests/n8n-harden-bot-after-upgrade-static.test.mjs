import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./n8n-harden-bot-after-upgrade.cjs', import.meta.url), 'utf8');

assert.match(source, /n8n-nodes-base\.errorTrigger/, 'deve criar workflow com Error Trigger');
assert.match(source, /availableInMCP:\s*false/, 'deve remover acesso MCP dos workflows');
assert.match(source, /errorWorkflow:\s*ERROR_WORKFLOW_ID/, 'deve associar o workflow de erro ao bot principal');
assert.match(source, /n8n-bot\/global-control/, 'deve consultar a fonte oficial de administradores');
assert.match(source, /adminNumbers/, 'deve avisar somente administradores cadastrados');
assert.match(source, /customerSendRetryChanged:\s*false/, 'nao deve ativar retry cego no envio ao cliente');
assert.match(source, /CONFIRM_N8N_HARDEN/, 'aplicacao deve exigir confirmacao explicita');
assert.match(source, /pg_dump/, 'aplicacao deve criar backup do Postgres');
assert.match(source, /export:workflow --all/, 'aplicacao deve exportar os workflows antes da mudanca');
assert.match(source, /validateImportInIsolatedContainer/, 'deve validar a importacao em banco isolado antes da publicacao');
assert.doesNotMatch(source, /\b(?:55)?\d{10,11}\b/, 'nao deve gravar telefone de administrador no script');
assert.doesNotMatch(source, /EVOLUTION_API_KEY\s*=\s*['"][^'"]+/, 'nao deve gravar segredo da Evolution no script');

console.log('n8n bot hardening static checks passed');
