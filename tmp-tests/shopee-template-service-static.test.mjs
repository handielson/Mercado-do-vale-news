import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync('services/shopeeTemplateService.ts', 'utf8');

assert.doesNotMatch(service, /from ['"]\.\/supabase['"]|supabase\.from|createClient/, 'service must not restore a Supabase dependency');
assert.match(service, /vpsClient/, 'service should use the VPS client');
assert.match(service, /\/table-data\/shopee_templates/, 'service should persist templates through the VPS table-data endpoint');
assert.match(service, /shopee_templates_cache_v1/, 'service should include a local fallback cache key');
assert.match(service, /async function list\(\)/, 'service should expose list implementation');
assert.match(service, /async function create\(/, 'service should expose create implementation');
assert.match(service, /async function update\(/, 'service should expose update implementation');
assert.match(service, /async function remove\(/, 'service should expose remove implementation');
assert.match(service, /seedDefaultsIfEmpty/, 'service should seed useful defaults');
assert.match(service, /Capa compativel com \{modelo\} Cor:\{cor\}/, 'default template should use safe title wording');

console.log('shopee template service static checks passed');
