import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../scripts/shopee-publish-all.ts', import.meta.url), 'utf8');

assert.match(source, /primaryFamilyIdsByItem/);
assert.match(source, /queuedSourceItems/);
assert.match(source, /sourceFamilyHasStock/);
assert.match(source, /isPermanentShopeeValidationError/);
assert.match(source, /validationBlocked \? 'blocked' : 'failed'/);
const oneSource = fs.readFileSync(new URL('../scripts/shopee-publish-one.ts', import.meta.url), 'utf8');

assert.match(source, /--confirm-account G/);
assert.match(source, /familyIds\.some\(\(id\) => targetLinkedIds\.has\(id\)\)/);
assert.match(source, /primaryLinkByProductId\.get\(productId\)/);
assert.match(source, /for \(let index = 0; index < selectedQueue\.length; index \+= 1\)/);
assert.match(source, /await publish\(ctx, prepared\)/);
assert.match(source, /await wait\(options\.delayMs\)/);
assert.match(source, /consecutiveFailures >= options\.maxConsecutiveFailures/);
assert.doesNotMatch(source, /prepared\.blockers\.length\)[\s\S]{0,300}consecutiveFailures \+= 1/);
assert.match(source, /shopee-publish-all-g\.json/);
assert.match(source, /Publicados com sucesso:/);
assert.match(source, /Erros\/bloqueados:/);
assert.match(source, /Ainda faltam:/);
assert.match(source, /Termino estimado:/);
assert.match(source, /Produtos com erros:/);
assert.match(source, /targetLinkByProductId/);
assert.match(source, /record\.status !== 'published' && !currentLink/);
assert.doesNotMatch(source, /Promise\.all\(selectedQueue/);

assert.match(oneSource, /get_item_list&item_status=/);
assert.match(oneSource, /remoteDuplicateIndexes/);
assert.match(oneSource, /rememberRemotePublication/);
assert.doesNotMatch(oneSource, /action=get_full_catalog&item_status=/);

console.log('shopee publish all static checks passed');
