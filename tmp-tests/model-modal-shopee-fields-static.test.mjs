// model-modal-shopee-fields-static.test.mjs
// Protecao contra regressao: aba Shopee no ModelModal deve existir e os
// campos shopee_* devem ser armazenados/carregados do template_values.
// Se este teste falhar, algum dos campos Shopee foi removido do componente.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');
const src = readFileSync(resolve(root, 'components/settings/ModelModal.tsx'), 'utf8');

// 1. TabType deve incluir 'shopee'
assert.match(
    src,
    /'shopee'/,
    'TabType deve conter o valor shopee'
);

// 2. Estado de categoria
assert.match(src, /shopeeCategoryId/, 'Estado shopeeCategoryId deve existir');
assert.match(src, /shopeeCategoryName/, 'Estado shopeeCategoryName deve existir');

// 3. Trava de auto-publicacao
assert.match(src, /shopeeAutoPublishEnabled/, 'Estado shopeeAutoPublishEnabled deve existir');

// 4. Atributos padrao
assert.match(src, /shopeeAttributeDefaults/, 'Estado shopeeAttributeDefaults deve existir');

// 5. Busca de produto similar
assert.match(src, /shopeeSimilarSearch/, 'Estado shopeeSimilarSearch deve existir');

// 6. buildFinalTemplateValues deve incluir as chaves shopee_*
assert.match(
    src,
    /buildFinalTemplateValues/,
    'Funcao buildFinalTemplateValues deve existir'
);
assert.match(
    src,
    /shopee_auto_publish_enabled/,
    "Chave shopee_auto_publish_enabled deve ser gravada no template_values"
);
assert.match(
    src,
    /shopee_category_id/,
    "Chave shopee_category_id deve ser gravada no template_values"
);
assert.match(
    src,
    /shopee_attribute_defaults/,
    "Chave shopee_attribute_defaults deve ser gravada no template_values"
);

// 7. Carga do useEffect: deve ler shopee_category_id do template_values
assert.match(
    src,
    /tv\['shopee_category_id'\]/,
    'useEffect deve carregar shopeeCategoryId do template_values'
);

// 8. Botao da aba shopee deve ser renderizado
assert.match(
    src,
    /setActiveTab\('shopee'\)/,
    'Botao da aba Shopee deve chamar setActiveTab shopee'
);

// 9. Conteudo da aba deve ser renderizado condicionalmente
assert.match(
    src,
    /activeTab === 'shopee'/,
    "Conteudo da aba Shopee deve ser renderizado quando activeTab === 'shopee'"
);

console.log('✅ model-modal-shopee-fields-static: todos os checks passaram');
