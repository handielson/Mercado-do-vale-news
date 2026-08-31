import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const server = readFileSync('server.js', 'utf8');
const migration = readFileSync('migrations/011_meta_marketing_connection.sql', 'utf8');
const panel = readFileSync('pages/admin/settings/marketing/MetaMarketingConnectionPanel.tsx', 'utf8');
const service = readFileSync('services/metaMarketingConnectionService.ts', 'utf8');
const env = readFileSync('.env.vps.example', 'utf8');
const productionApi = readFileSync('services/marketingCampaignApi.cjs', 'utf8');
const deploy = readFileSync('deploy-vps-server-only.cjs', 'utf8');

assert.match(server, /createCipheriv\('aes-256-gcm'/);
assert.match(server, /appsecret_proof/);
assert.match(server, /meta_marketing_oauth_states/);
assert.match(server, /\/integrations\/meta\/oauth\/callback/);
assert.match(server, /\/admin\/marketing\/meta\/audit/);
assert.match(server, /mode: 'read_only'/);
assert.doesNotMatch(service, /token_ciphertext|access_token/);
assert.match(panel, /Auditoria segura/);
assert.match(panel, /não cria, pausa ou edita anúncios/);
assert.match(migration, /token_ciphertext TEXT/);
assert.match(migration, /state_hash CHAR\(64\)/);
assert.match(env, /META_TOKEN_ENCRYPTION_KEY/);
assert.match(productionApi, /createCipheriv\('aes-256-gcm'/);
assert.match(productionApi, /\/integrations\/meta\/oauth\/callback/);
assert.match(productionApi, /\/admin\/marketing\/meta\/audit/);
assert.match(productionApi, /SOCIAL_STORY_REQUIRED_INSTAGRAM_SCOPES/);
assert.match(productionApi, /'instagram_basic'/);
assert.match(productionApi, /'instagram_content_publishing'/);
assert.doesNotMatch(productionApi, /'instagram_content_publish'/);
assert.match(productionApi, /url\.searchParams\.set\('auth_type', 'rerequest'\)/);
assert.match(productionApi, /missingPublishingScopes/);
assert.match(panel, /Corrigir permissões Meta/);
assert.match(deploy, /services\/marketingCampaignApi\.cjs/);

console.log('Meta marketing connection contract: OK');
