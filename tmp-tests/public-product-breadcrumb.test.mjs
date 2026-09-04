import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { buildCategoryBreadcrumb } from '../pages/store/categoryBreadcrumb.js';

test('monta todos os niveis da raiz ate a categoria final', () => {
    const categories = [
        { id: 'phones', name: 'Celulares', parent_id: 'electronics' },
        { id: 'xiaomi', name: 'Xiaomi', parent_id: 'phones' },
        { id: 'electronics', name: 'Eletrônicos', parent_id: null },
    ];

    assert.deepEqual(
        buildCategoryBreadcrumb(categories, 'xiaomi').map(category => category.name),
        ['Eletrônicos', 'Celulares', 'Xiaomi']
    );
});

test('mantem a parte conhecida quando o cadastro tem pai ausente', () => {
    const categories = [{ id: 'xiaomi', name: 'Xiaomi', parent_id: 'missing' }];
    assert.deepEqual(buildCategoryBreadcrumb(categories, 'xiaomi'), categories);
});

test('interrompe ciclos sem repetir categorias', () => {
    const categories = [
        { id: 'a', name: 'A', parent_id: 'b' },
        { id: 'b', name: 'B', parent_id: 'a' },
    ];

    const result = buildCategoryBreadcrumb(categories, 'a');
    assert.equal(result.length, 2);
    assert.equal(new Set(result.map(category => category.id)).size, 2);
});

test('pagina publica usa Ficha tecnica e nao exibe o termo interno', async () => {
    const source = await readFile(new URL('../pages/store/PublicProductPage.tsx', import.meta.url), 'utf8');
    assert.match(source, /> Ficha técnica\s*</);
    assert.doesNotMatch(source, /Blueprint do modelo|Blueprint e ficha técnica/);
    assert.match(source, /imageOverlayLabel="Ficha técnica"/);
    assert.doesNotMatch(source, /href=\{blueprintImageUrl\}/);
});

test('novas artes usam o titulo publico', async () => {
    const source = await readFile(new URL('../pages/admin/settings/marketing/ProductBlueprintCard.tsx', import.meta.url), 'utf8');
    assert.match(source, />\/ ficha técnica</);
    assert.doesNotMatch(source, />\/ blueprint oficial</i);
});
