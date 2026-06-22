const CODE_FENCE_RE = /```(?:json)?/gi;

const normalizeText = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const isPlainObject = (value) => value && typeof value === 'object' && !Array.isArray(value);
const MODEL_UNIT_FIELD_KEYS = new Set(['imei1', 'imei2', 'serial', 'color', 'ram', 'sku', 'storage']);
const REQUIRED_SMARTPHONE_FIELD_KEYS = new Set([
    'battery_mah',
    'cam_principal_mpx',
    'cam_selfie_mpx',
    'carregamento',
    'celular_biometria',
    'celular_fps_display',
    'celular_slot_para_cartao',
    'chipset',
    'display',
    'entrada_fone_de_ouvido',
    'nfc',
    'processador',
    'rede_operadora',
    'resistencia',
    'tipo_de_display',
]);

export function parseModelImportJson(input) {
    if (!input || !String(input).trim()) {
        throw new Error('Cole o JSON gerado pela IA primeiro.');
    }

    let jsonText = String(input).replace(CODE_FENCE_RE, '').trim();
    const start = jsonText.indexOf('{');
    const end = jsonText.lastIndexOf('}');

    if (start >= 0 && end > start) {
        jsonText = jsonText.slice(start, end + 1);
    }

    return JSON.parse(jsonText);
}

const findByIdOrName = (items, value) => {
    if (!value) return '';
    const raw = String(value);
    const normalized = normalizeText(raw);
    const item = items.find((entry) => (
        entry.id === raw ||
        normalizeText(entry.name) === normalized ||
        normalizeText(entry.slug) === normalized
    ));
    return item?.id || '';
};

const findExistingId = (items, value) => {
    if (!value) return '';
    const raw = String(value);
    return items.some((entry) => entry.id === raw) ? raw : '';
};

export const isModelUnitFieldKey = (key) => MODEL_UNIT_FIELD_KEYS.has(
    normalizeText(key).replace(/^specs[._-]?/, '').replace(/\s+/g, '_')
);

const normalizeKeywords = (value) => {
    if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
    if (typeof value === 'string') {
        return value.split(',').map((item) => item.trim()).filter(Boolean);
    }
    return undefined;
};

const numberOrValue = (value) => {
    if (value === '' || value === null || value === undefined) return undefined;
    const normalized = typeof value === 'string' ? value.replace(',', '.') : value;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : value;
};

const DESCRIPTION_ATTRIBUTE_ONLY_SENTENCE_RE = /\b(garantia\s+(?:comercial|do\s+fornecedor|do\s+vendedor)|verificar\s+vendedor|condi[cç][aã]o\s+(?:do\s+produto|novo|usado)|produto\s+personalizado|quantidade\s+por\s+pacote)\b/i;

const sanitizeModelDescription = (value) => {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text) return '';

    return text
        .split(/(?<=[.!?])\s+/)
        .map((sentence) => sentence.trim())
        .filter((sentence) => sentence && !DESCRIPTION_ATTRIBUTE_ONLY_SENTENCE_RE.test(sentence))
        .join(' ')
        .trim();
};

const normalizeChoice = (value, choices = []) => {
    if (value === undefined || value === null || value === '') return value;
    if (!choices.length) return value;

    const normalized = normalizeText(value);
    const found = choices.find((choice) => (
        normalizeText(choice.value) === normalized ||
        normalizeText(choice.label) === normalized
    ));

    return found ? found.value : value;
};

const getChoiceMatch = (value, choices = []) => {
    if (value === undefined || value === null || value === '') return { value, missing: false };
    if (!choices.length) return { value, missing: false };

    const normalized = normalizeText(value);
    const found = choices.find((choice) => (
        normalizeText(choice.value) === normalized ||
        normalizeText(choice.label) === normalized
    ));

    return found
        ? { value: found.value, missing: false }
        : { value, missing: true };
};

const createFieldKeyResolver = (customFields = []) => {
    const entries = customFields.flatMap((field) => [
        [field.key, field.key],
        [field.label, field.key],
        [field.name, field.key],
    ]).filter(([alias]) => alias);

    return (key) => {
        const normalized = normalizeText(key).replace(/\s+/g, '_');
        const found = entries.find(([alias]) => (
            normalizeText(alias).replace(/\s+/g, '_') === normalized
        ));
        return found?.[1] || key;
    };
};

const mergeTemplateObject = (target, source, resolveFieldKey, emptyFields = [], fieldByKey = new Map()) => {
    if (!isPlainObject(source)) return;

    Object.entries(source).forEach(([key, value]) => {
        const fieldKey = resolveFieldKey(key);
        if (isModelUnitFieldKey(fieldKey) || isModelUnitFieldKey(key)) return;
        if (value === undefined || value === null || value === '') {
            const field = fieldByKey.get(fieldKey);
            if (field) {
                emptyFields.push({
                    fieldKey,
                    fieldLabel: field.label || fieldKey,
                    importance: REQUIRED_SMARTPHONE_FIELD_KEYS.has(fieldKey) ? 'required' : 'optional',
                });
            }
            return;
        }
        target[fieldKey] = value;
    });
};

export function normalizeModelImportPayload(data, context = {}) {
    const payload = isPlainObject(data?.model) ? data.model : data;
    if (!isPlainObject(payload)) {
        throw new Error('O JSON precisa ser um objeto.');
    }

    const brands = context.brands || [];
    const categories = context.categories || [];
    const customFields = context.customFields || [];
    const choiceOptions = context.choiceOptions || {};
    const resolveFieldKey = createFieldKeyResolver(customFields);
    const fieldByKey = new Map(customFields.map((field) => [field.key, field]));
    const templateValues = {};
    const missingChoices = [];
    const emptyFields = [];

    const name = payload.name || payload.nome || payload.modelo || payload.model;
    const brandId = findExistingId(brands, payload.brand_id) || findByIdOrName(brands, payload.brand || payload.marca || payload.brand_name);
    const categoryId = findExistingId(categories, payload.category_id) || findByIdOrName(categories, payload.category || payload.categoria || payload.category_name);
    const description = sanitizeModelDescription(payload.description || payload.descricao || payload['descrição'] || payload.default_description);
    const eans = Array.isArray(payload.eans)
        ? payload.eans.map(String).map((ean) => ean.trim()).filter(Boolean)
        : payload.ean
            ? [String(payload.ean).trim()].filter(Boolean)
            : undefined;

    mergeTemplateObject(templateValues, payload.template_values, resolveFieldKey, emptyFields, fieldByKey);
    mergeTemplateObject(templateValues, payload.specs, resolveFieldKey, emptyFields, fieldByKey);
    mergeTemplateObject(templateValues, payload.especificacoes, resolveFieldKey, emptyFields, fieldByKey);
    mergeTemplateObject(templateValues, payload['especificações'], resolveFieldKey, emptyFields, fieldByKey);
    mergeTemplateObject(templateValues, payload.custom_fields, resolveFieldKey, emptyFields, fieldByKey);
    mergeTemplateObject(templateValues, payload.campos, resolveFieldKey, emptyFields, fieldByKey);
    mergeTemplateObject(templateValues, payload.extra_fields, resolveFieldKey, emptyFields, fieldByKey);

    const gifts = payload.brindes || payload.gifts || payload.bonus_items;
    if (Array.isArray(gifts)) {
        templateValues.brindes = gifts.map(String).map((item) => item.trim()).filter(Boolean).join('\n');
    } else if (typeof gifts === 'string' && gifts.trim()) {
        templateValues.brindes = gifts.trim();
    }

    const seo = payload.seo || {};
    const slug = payload.slug || seo.slug;
    const metaTitle = payload.meta_title || payload.metaTitle || seo.meta_title || seo.metaTitle;
    const metaDescription = payload.meta_description || payload.metaDescription || seo.meta_description || seo.metaDescription;
    const keywords = normalizeKeywords(payload.keywords || seo.keywords);

    if (slug) templateValues.slug = slug;
    if (metaTitle) templateValues.meta_title = metaTitle;
    if (metaDescription) templateValues.meta_description = metaDescription;
    if (keywords?.length) templateValues.keywords = keywords;

    const logistics = payload.logistics || payload.logistica || payload['logística'] || {};
    const dimensions = payload.dimensions || payload.dimensoes || payload['dimensões'] || logistics.dimensions || logistics.dimensoes || {};

    const weight = payload.weight_kg || payload.peso_kg || payload.weight || logistics.weight_kg || logistics.peso_kg;
    const width = payload['dimensions.width_cm'] || payload.width_cm || payload.largura_cm || dimensions.width_cm || dimensions.largura_cm || dimensions.width || dimensions.largura;
    const height = payload['dimensions.height_cm'] || payload.height_cm || payload.altura_cm || dimensions.height_cm || dimensions.altura_cm || dimensions.height || dimensions.altura;
    const depth = payload['dimensions.depth_cm'] || payload.depth_cm || payload.profundidade_cm || dimensions.depth_cm || dimensions.profundidade_cm || dimensions.depth || dimensions.profundidade;

    if (weight !== undefined) templateValues.weight_kg = numberOrValue(weight);
    if (width !== undefined) templateValues['dimensions.width_cm'] = numberOrValue(width);
    if (height !== undefined) templateValues['dimensions.height_cm'] = numberOrValue(height);
    if (depth !== undefined) templateValues['dimensions.depth_cm'] = numberOrValue(depth);

    customFields.forEach((field) => {
        if (isModelUnitFieldKey(field.key) || isModelUnitFieldKey(field.label)) return;
        const directValue = payload[field.key];
        const labelValue = payload[field.label];
        const value = directValue ?? labelValue;
        if (value !== undefined && value !== null && value !== '') {
            templateValues[field.key] = value;
        }
    });

    Object.entries(templateValues).forEach(([key, value]) => {
        const choices = choiceOptions[key] || [];
        const field = fieldByKey.get(key);
        const shouldWarnMissingChoice = field?.field_type === 'select' || field?.field_type === 'table_relation';

        if (Array.isArray(value)) {
            const normalizedItems = [];
            let hasMissingChoice = false;
            value.forEach((item, arrayIndex) => {
                const result = getChoiceMatch(item, choices);
                if (result.missing && shouldWarnMissingChoice) {
                    hasMissingChoice = true;
                    missingChoices.push({
                        fieldKey: key,
                        fieldLabel: field?.label || key,
                        value: String(item),
                        options: choices.map((choice) => choice.label || choice.value),
                        originalValues: [...value],
                        arrayIndex,
                    });
                    return;
                }
                normalizedItems.push(result.value);
            });
            if (hasMissingChoice) {
                delete templateValues[key];
            } else {
                templateValues[key] = normalizedItems;
            }
        } else {
            const result = getChoiceMatch(value, choices);
            if (result.missing && shouldWarnMissingChoice) {
                missingChoices.push({
                    fieldKey: key,
                    fieldLabel: field?.label || key,
                    value: String(value),
                    options: choices.map((choice) => choice.label || choice.value),
                });
                delete templateValues[key];
            } else {
                templateValues[key] = normalizeChoice(value, choices);
            }
        }
    });

    const shopeeAttributeDefaults = {};
    const rawShopeeDefaults = payload.shopee_attribute_defaults || payload.shopeeAttributeDefaults || payload.shopee_attributes || {};
    if (isPlainObject(rawShopeeDefaults)) {
        Object.entries(rawShopeeDefaults).forEach(([key, val]) => {
            const cleanKey = key.replace(/^shopee:/, '').trim();
            if (cleanKey && val !== undefined && val !== null && val !== '') {
                shopeeAttributeDefaults[cleanKey] = val;
            }
        });
    }

    return {
        name: name ? String(name).trim() : '',
        brandId: brandId || '',
        categoryId: categoryId || '',
        active: typeof payload.active === 'boolean'
            ? payload.active
            : typeof payload.ativo === 'boolean'
                ? payload.ativo
                : undefined,
        description,
        eans,
        templateValues,
        shopeeAttributeDefaults,
        missingChoices,
        emptyFields,
    };
}

const describeChoices = (field, choices = []) => {
    if (choices.length > 0) {
        return ` Opcoes validas: ${choices.map((choice) => choice.label || choice.value).join(', ')}.`;
    }

    if (field.field_type === 'select' && Array.isArray(field.options) && field.options.length > 0) {
        return ` Opcoes validas: ${field.options.join(', ')}.`;
    }

    if (field.field_type === 'table_relation') {
        return ' Campo de escolha por tabela: use exatamente uma opcao existente no sistema.';
    }

    if (field.field_type === 'checkbox') {
        return ' Valor esperado: true ou false.';
    }

    return '';
};

export function buildModelImportPrompt({ name, brand, category, customFields = [], choiceOptions = {}, shopeeFields = [] }) {
    const fieldLines = customFields
        .filter((field) => !isModelUnitFieldKey(field.key) && !isModelUnitFieldKey(field.label))
        .map((field) => {
            const type = field.field_type ? `, tipo ${field.field_type}` : '';
            return `- "${field.key}" (${field.label || field.key})${type}.${describeChoices(field, choiceOptions[field.key])}`;
        })
        .join('\n');

    const shopeeLines = shopeeFields
        .map((field) => {
            const req = field.mandatory ? ' (OBRIGATÓRIO)' : '';
            const opts = field.attribute_value_list.length > 0
                ? ` Opções válidas: ${field.attribute_value_list.slice(0, 15).map(o => `"${o.label}"`).join(', ')}${field.attribute_value_list.length > 15 ? '...' : ''}.`
                : '';
            return `- shopee:${field.attribute_id} ("${field.label}")${req}.${opts}`;
        })
        .join('\n');

    return `Atue como especialista em cadastro de modelos e produtos para e-commerce. Gere um JSON completo para criar/preencher um modelo no painel do Mercado do Vale.

Regras:
1. Retorne APENAS um objeto JSON valido. Sem markdown, sem explicacoes.
2. Use "template_values" para todos os campos tecnicos atuais e futuros.
3. Use apenas dados reais do produto, confirmados em ficha tecnica, fabricante ou anuncio confiavel. Nao use dados genericos, aproximados ou inventados.
4. Nao inclua IMEI, serial, cor unica de aparelho, memoria RAM, armazenamento, SKU/codigo ou quantidade de estoque. Esses dados pertencem ao cadastro individual/produto, nao ao modelo.
5. Em textos, evite aspas duplas internas; use aspas simples se precisar.
6. Preencha todas as informacoes tecnicas reais quando existirem em fonte confiavel. Para smartphones, priorize slot para cartao/microSD/SIM, entrada de fone, biometria, rede, NFC, resistencia, tela, chipset, bateria e carregamento. Para outros produtos, priorize tensao, potencia, compatibilidade, dimensoes, material, capacidade e itens inclusos quando aplicavel.
7. Na duvida nao preencha: se nao tiver certeza sobre um dado tecnico, deixe o campo ausente ou null para o painel avisar que faltou dado real. Nao crie nada.
8. Para campos de escolha, use o valor real do produto. Se o valor real nao estiver nas opcoes validas listadas, mantenha o valor real no JSON para o painel avisar que a opcao precisa ser cadastrada. Nao adapte para uma opcao parecida.
9. Em "logistics", preencha peso e dimensoes da caixa/embalagem quando a ficha tecnica/anuncio confiavel informar esses dados. Nao use dimensoes do aparelho nu como dimensoes da embalagem.
10. Em "template_values.itens_que_acompanham", liste um item por linha no formato "1 item". Se a fonte disser que a unidade/regiao acompanha Adaptador de tomada, inclua "1 Adaptador de tomada"; se disser que pode variar por regiao, escreva "1 Adaptador de tomada (pode variar por regiao)".
11. Em "template_values.brindes", liste somente os brindes da loja, um por linha no formato "1 item". Exemplo: capa protetora, capa extra, pelicula 3D aplicada.
12. A "description" deve ser uma descricao comercial completa, em portugues, com 180 a 300 palavras quando houver dados suficientes. Fale de uso, beneficios, compatibilidade e diferenciais reais.
13. Nao coloque na "description" informacoes que pertencem a atributos ou politicas comerciais, como garantia, condicao novo/usado, quantidade por pacote, produto personalizado, SKU, EAN, IMEI, serial, estoque, preco ou frases como "verificar vendedor". Coloque esses dados apenas em "template_values" quando existir campo tecnico correspondente.
14. Em "shopee_attribute_defaults", você DEVE preencher os atributos de integração da Shopee listados abaixo usando o identificador numérico como chave e o respectivo valor. Se o atributo tiver opções válidas listadas abaixo, use EXATAMENTE uma das opções de texto (exemplo: "Bivolt", "12V"). Se for texto livre, encontre o valor correspondente na fonte confiável.

Contexto atual:
- Nome do modelo: ${name || '[preencher]'}
- Marca: ${brand || '[preencher]'}
- Categoria: ${category || 'Smartphones'}

Campos tecnicos disponiveis hoje:
${fieldLines || '- Nenhum campo tecnico carregado. Ainda assim use template_values para os campos do aparelho.'}

Atributos obrigatórios e adicionais da Shopee para preencher em "shopee_attribute_defaults" (use as chaves exatas shopee:ID do campo):
${shopeeLines || '- Nenhum atributo do catálogo Shopee carregado no momento.'}

Formato esperado:
{
  "name": "Redmi A7 Pro",
  "brand": "Xiaomi",
  "category": "Smartphones",
  "description": "Descricao comercial completa do modelo, com beneficios e usos reais, sem SKU, garantia, condicao do produto, estoque, preco, cor unica ou IMEI.",
  "eans": [],
  "seo": {
    "slug": "redmi-a7-pro",
    "meta_title": "Redmi A7 Pro no Mercado do Vale",
    "meta_description": "Compre Redmi A7 Pro com garantia, suporte local e entrega facilitada.",
    "keywords": ["redmi a7 pro", "xiaomi", "smartphone"]
  },
  "logistics": {
    "weight_kg": 0.25,
    "dimensions": {
      "width_cm": 8,
      "height_cm": 17,
      "depth_cm": 5
    }
  },
  "shopee_attribute_defaults": {
    "100105": "50W",
    "100323": "Bivolt"
  },
  "template_values": {
    "version": "Global",
    "itens_que_acompanham": "1 aparelho\n1 cabo USB Tipo C\n1 ferramenta de ejeção de SIM\n1 guia de início rápido\n1 Adaptador de tomada (pode variar por região)",
    "brindes": "1 capa protetora\n1 capa extra\n1 pelicula 3D aplicada",
    "battery_health": "100%",
    "screen_size": "6.88 polegadas",
    "processor": null,
    "camera": null,
    "battery": null
  }
}`;
}
