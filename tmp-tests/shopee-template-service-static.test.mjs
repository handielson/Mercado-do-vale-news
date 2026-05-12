import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync('services/shopeeTemplateService.ts', 'utf8');
const sql = readFileSync('supabase/add_shopee_templates.sql', 'utf8');

assert.match(service, /from\('shopee_templates'\)/, 'service should persist templates in shopee_templates');
assert.match(service, /shopee_templates_cache_v1/, 'service should include a local fallback cache key');
assert.match(service, /async function list\(\)/, 'service should expose list implementation');
assert.match(service, /async function create\(/, 'service should expose create implementation');
assert.match(service, /async function update\(/, 'service should expose update implementation');
assert.match(service, /async function remove\(/, 'service should expose remove implementation');
assert.match(service, /seedDefaultsIfEmpty/, 'service should seed useful defaults');
assert.match(service, /Capa compativel com \{modelo\} Cor:\{cor\}/, 'default template should use safe title wording');

assert.match(sql, /create table if not exists public\.shopee_templates/i, 'SQL should create shopee_templates table');
assert.match(sql, /dangerous_terms jsonb/i, 'SQL should store dangerous term rules');
assert.match(sql, /attribute_defaults jsonb/i, 'SQL should store attribute defaults');
assert.match(sql, /create index if not exists shopee_templates_company_id_idx/i, 'SQL should index company_id');

console.log('shopee template service static checks passed');
