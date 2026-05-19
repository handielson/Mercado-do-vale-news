const CODE_FENCE_RE = /```(?:json)?/gi;

const normalizeText = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const isPlainObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

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

const mergeTemplateObject = (target, source, resolveFieldKey) => {
    if (!isPlainObject(source)) return;

    Object.entries(source).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return;
        target[resolveFieldKey(key)] = value;
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
    const templateValues = {};

    const name = payload.name || payload.nome || payload.modelo || payload.model;
    const brandId = payload.brand_id || findByIdOrName(brands, payload.brand || payload.marca || payload.brand_name);
    const categoryId = payload.category_id || findByIdOrName(categories, payload.category || payload.categoria || payload.category_name);
    const description = payload.description || payload.descricao || payload['descrição'] || payload.default_description;
    const eans = Array.isArray(payload.eans)
        ? payload.eans.map(String).map((ean) => ean.trim()).filter(Boolean)
        : payload.ean
            ? [String(payload.ean).trim()].filter(Boolean)
            : undefined;

    mergeTemplateObject(templateValues, payload.template_values, resolveFieldKey);
    mergeTemplateObject(templateValues, payload.specs, resolveFieldKey);
    mergeTemplateObject(templateValues, payload.especificacoes, resolveFieldKey);
    mergeTemplateObject(templateValues, payload['especificações'], resolveFieldKey);
    mergeTemplateObject(templateValues, payload.custom_fields, resolveFieldKey);
    mergeTemplateObject(templateValues, payload.campos, resolveFieldKey);
    mergeTemplateObject(templateValues, payload.extra_fields, resolveFieldKey);

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
        const directValue = payload[field.key];
        const labelValue = payload[field.label];
        const value = directValue ?? labelValue;
        if (value !== undefined && value !== null && value !== '') {
            templateValues[field.key] = value;
        }
    });

    Object.entries(templateValues).forEach(([key, value]) => {
        const choices = choiceOptions[key] || [];
        if (Array.isArray(value)) {
            templateValues[key] = value.map((item) => normalizeChoice(item, choices));
        } else {
            templateValues[key] = normalizeChoice(value, choices);
        }
    });

    return {
        name: name ? String(name).trim() : '',
        brandId: brandId || '',
        categoryId: categoryId || '',
        active: typeof payload.active === 'boolean'
            ? payload.active
            : typeof payload.ativo === 'boolean'
                ? payload.ativo
                : undefined,
        description: description ? String(description) : '',
        eans,
        templateValues,
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

export function buildModelImportPrompt({ name, brand, category, customFields = [], choiceOptions = {} }) {
    const fieldLines = customFields
        .map((field) => {
            const type = field.field_type ? `, tipo ${field.field_type}` : '';
            return `- "${field.key}" (${field.label || field.key})${type}.${describeChoices(field, choiceOptions[field.key])}`;
        })
        .join('\n');

    return `Atue como especialista em cadastro de smartphones para e-commerce. Gere um JSON completo para criar/preencher um modelo de smartphone no painel do Mercado do Vale.

Regras:
1. Retorne APENAS um objeto JSON valido. Sem markdown, sem explicacoes.
2. Use "template_values" para todos os campos tecnicos atuais e futuros.
3. Se algum campo novo fizer sentido e nao estiver listado, inclua dentro de "template_values" usando uma chave clara em snake_case.
4. Nao inclua IMEI, serial, cor unica de aparelho ou quantidade de estoque. Esses dados pertencem ao produto, nao ao modelo.
5. Em textos, evite aspas duplas internas; use aspas simples se precisar.
6. Para campos de escolha, use exatamente uma das opcoes validas listadas. Nao invente RAM, armazenamento, versao, saude de bateria ou qualquer valor de dropdown.

Contexto atual:
- Nome do modelo: ${name || '[preencher]'}
- Marca: ${brand || '[preencher]'}
- Categoria: ${category || 'Smartphones'}

Campos tecnicos disponiveis hoje:
${fieldLines || '- Nenhum campo tecnico carregado. Ainda assim use template_values para os campos do aparelho.'}

Formato esperado:
{
  "name": "Redmi A7 Pro",
  "brand": "Xiaomi",
  "category": "Smartphones",
  "description": "Descricao comercial completa do modelo, sem variacao de cor ou IMEI.",
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
  "template_values": {
    "ram": "4GB",
    "storage": "128GB",
    "version": "Global",
    "battery_health": "100%",
    "screen_size": "6.88 polegadas",
    "processor": "Octa-core",
    "camera": "50MP",
    "battery": "5160mAh"
  }
}`;
}
