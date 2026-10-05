import assert from 'node:assert/strict';
import { parseMercadoLivreItemId, findFamilyListing, validateFamilySelection } from '../components/products/sections/mercadoLivreFamilyLinkCore.js';

assert.equal(parseMercadoLivreItemId('https://produto.mercadolivre.com.br/MLB-123456-suporte-_JM'), 'MLB123456');
assert.throws(() => parseMercadoLivreItemId('OIS063'), /link/);
const children = [{ id: 'white', sku: 'OIS063B' }, { id: 'black', sku: 'OIS063P' }];
const rows = [
    { itemId: 'MLB123456', variationId: '1', variation: 'Branco', existing: [] },
    { itemId: 'MLB123456', variationId: '2', variation: 'Preto', existing: [] },
];
let calls = 0;
assert.deepEqual(await findFamilyListing('MLB123456', async cursor => {
    calls++;
    return { sellerId: 'seller', items: cursor ? rows : [], errors: [], nextCursor: cursor ? null : 'next' };
}), rows);
assert.equal(calls, 2);
const plan = validateFamilySelection(children, rows, { white: 'MLB123456:1', black: 'MLB123456:2' });
assert.equal(plan[0].child.id, 'white');
assert.equal(plan[1].row.variationId, '2');
assert.throws(() => validateFamilySelection(children, rows, { white: 'MLB123456:1', black: 'MLB123456:1' }), /dois filhos/);
assert.throws(() => validateFamilySelection(children, [{ ...rows[0], existing: [{ productId: 'other' }] }], { white: 'MLB123456:1' }), /outro produto/);
assert.throws(() => validateFamilySelection(children, rows, { white: 'MLB999:1' }), /válida/);
await assert.rejects(() => findFamilyListing('MLB123456', async () => ({ sellerId: 'seller', items: [], errors: [], nextCursor: 'repeat' })), /repetiu/);
await assert.rejects(() => findFamilyListing('MLB123456', async () => ({ sellerId: 'seller', items: [], errors: [], nextCursor: null })), /não encontrado/);
console.log('Mercado Livre family linking tests passed');
