import assert from 'node:assert/strict';
import fs from 'node:fs';

const cjs = fs.readFileSync('vps_server.cjs', 'utf8');
const js = fs.readFileSync('vps_server.js', 'utf8');
const workflowPatch = fs.readFileSync('tmp-tests/n8n-add-cumulative-sales-preferences-followup.cjs', 'utf8');
const deployScript = fs.readFileSync('deploy-vps-server-only.cjs', 'utf8');
assert.equal(cjs, js, 'vps_server.cjs and vps_server.js must stay identical');

for (const source of [cjs, js]) {
  assert.match(source, /addColumnIfMissing\('n8n_bot_client_controls', 'sales_preferences', 'JSON NULL'\)/);
  assert.match(source, /LIMIT 30`/);
  assert.match(source, /\/n8n-bot\/catalog-preferences\/merge/);
  assert.match(source, /extractCatalogPreferences\(message, current, brands\)/);
  assert.match(source, /n8n_phone_catalog_followups/);
  assert.match(source, /baseline_message_id BIGINT/);
  assert.match(source, /later\.id>jobs\.baseline_message_id/);
  assert.match(source, /jobs\.status='pending'/);
  assert.match(source, /status='claimed'.*claim_token/s);
  assert.match(source, /sourceNode !== 'phone-catalog-followup'/);
  assert.match(source, /status IN \('pending','claimed'\)/);
  assert.match(source, /sendCheck\.status !== 'claimed'/);
  assert.match(source, /sourceNode: 'phone-catalog-followup'/);
  assert.match(source, /startN8nPhoneCatalogFollowupScheduler\(\)/);
  assert.match(source, /human_handoff_active/);
  assert.match(source, /CATALOG_PREFERENCE_HANDOFF_MESSAGE/);
  assert.match(source, /pause_reason = 'human_handoff'/);
  assert.doesNotMatch(source, /idle_followup_sent_at|idle_closed_at|idle-close/);
}

for (const marker of [
  'sales-preferences-merge-v288:start',
  'sales-preference-continuation-v288',
  'structured-sales-filters-v288:start',
  'Vendas - Persistir Preferencias',
  'Envio - Restaurar item aceito',
  'Follow-up Lista - Ultimo bloco?',
  'Follow-up Lista - Agendar 10 min',
]) {
  assert.ok(workflowPatch.includes(marker), `workflow patch must include ${marker}`);
}
assert.match(workflowPatch, /Handoff - Registrar bot enviado.*Envio - Restaurar item aceito/s);
assert.match(workflowPatch, /phoneCatalogFollowupEligible === true/);
assert.match(workflowPatch, /Number\(\$json\.messageIndex\) === Number\(\$json\.totalMessages\)/);
assert.match(workflowPatch, /if \(!apply\)/, 'workflow mutation must require explicit --apply');
assert.match(deployScript, /autoresponderCatalogPreferencesPath = 'services\/autoresponderCatalogPreferences\.cjs'/);
assert.match(deployScript, /upload\(path\.join\(__dirname, autoresponderCatalogPreferencesPath\)/);

console.log('n8n phone catalog follow-up and memory static checks passed');
