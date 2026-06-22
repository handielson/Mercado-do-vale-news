import React, { useState, useEffect, useRef } from 'react';
import { X, FileText, Settings, Search, ExternalLink, Tags, Braces } from 'lucide-react';
import { toast } from 'sonner';
import { Model, type ModelInput } from '../../types/model';
import { type Brand } from '../../types/brand';
import { type Category } from '../../types/category';
import { modelService } from '../../services/models';
import { brandService } from '../../services/brands';
import { categoryService } from '../../services/categories';
import { customFieldsService, type CustomField } from '../../services/custom-fields';
import { crossSellTagsService, type CrossSellTag } from '../../services/cross-sell-tags';
import { vpsApiService } from '../../services/vpsApiService';
import { blingService } from '../../services/blingService';
import { applyFieldFormat, getFieldDefinition } from '../../config/field-dictionary';
import { UNIQUE_FIELDS } from '../../config/product-fields';
import { CurrencyInput } from '../ui/CurrencyInput';
import { tableDataService, type TableOption } from '../../services/table-data';
import { CategorySelect } from '../products/CategorySelect';
import { ColorImageManager } from './ColorImageManager';
import { buildModelImportPrompt, isModelUnitFieldKey, normalizeModelImportPayload, parseModelImportJson } from './modelJsonImport.js';
import { generateModelJsonWithAi } from '../../services/modelAiService';
import { ModelListFieldInput } from './ModelListFieldInput';
import { ModelListOptionModal } from './ModelListOptionModal';
import { saveModelListOption, type ModelListOptionDraft } from '../../services/modelListOptions';
import { resolveMissingListChoices } from './modelListOptionCore.js';
import {
    normalizeShopeeAttributes,
    buildShopeeAttributeDefaultsPayload,
    summarizeShopeeAttributes,
    normalizeLookupText,
} from '../../pages/admin/settings/shopeeAttributeResolver.js';
import {
    buildCategoryTree,
    getCategoryPathLabel,
    searchShopeeCategories,
} from '../../pages/admin/settings/shopeeCategoryHelpers.js';
import { shopeeTemplateService } from '../../services/shopeeTemplateService';
import {
    renderShopeeAttributeDefaultValue,
    resolveUniversalShopeeAttributeDefaults,
} from '../../services/shopeeTemplateEngine';

// Atributo de categoria Shopee normalizado (mesmo formato retornado por
// normalizeShopeeAttributes em shopeeAttributeResolver.js). Declarado localmente
// porque o helper e .js (sem .d.ts) — mantemos em sync manualmente.
type ShopeeAttributeField = {
    attribute_id: number;
    label: string;
    mandatory: boolean;
    input_kind: 'select' | 'multiselect' | 'text' | 'searchable';
    attribute_value_list: Array<{ value_id: number; label: string; raw_name: string; original_value_name: string }>;
    raw_input_type?: string | number;
    support_search_value?: boolean;
};

type ShopeeAttributeProductContext = Record<string, any>;

function firstTextValue(...values: unknown[]): string {
    for (const value of values) {
        const text = String(value || '').trim();
        if (text) return text;
    }
    return '';
}

function cleanBlingContextText(value: unknown): string {
    return String(value || '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

function buildModelAiBlingSourceContext(products: any[]): string {
    const entries = (products || [])
        .map((product: any) => {
            const description = cleanBlingContextText(firstTextValue(
                product?.description,
                product?.descricaoComplementar,
                product?.descricao,
                product?.descricaoCurta,
            ));
            if (!description) return '';
            const label = firstTextValue(product?.sku, product?.name, product?.id);
            return `${label ? `Produto ${label}: ` : ''}${description}`;
        })
        .filter(Boolean);

    return [...new Set(entries)].slice(0, 3).join('\n\n').slice(0, 6000);
}

function alignShopeeDefaultValuesToOptions(
    fields: ShopeeAttributeField[],
    defaults: Record<string, any>
): Record<string, any> {
    const aligned = { ...defaults };
    for (const field of fields || []) {
        const key = String(field.attribute_id);
        const value = aligned[key];
        if (value === undefined || value === null || Array.isArray(value)) continue;
        if (!Array.isArray(field.attribute_value_list) || field.attribute_value_list.length === 0) continue;

        const normalizedValue = normalizeLookupText(value);
        const matchingOption = field.attribute_value_list.find((option) =>
            normalizeLookupText(option.label) === normalizedValue ||
            normalizeLookupText(option.raw_name) === normalizedValue ||
            normalizeLookupText(option.original_value_name) === normalizedValue
        );
        if (matchingOption?.label) {
            aligned[key] = matchingOption.label;
        }
    }
    return aligned;
}

interface ModelModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void | Promise<void>;
    model?: Model | null;
}

type TabType = 'basic' | 'json' | 'template' | 'seo' | 'photos' | 'tags' | 'shopee';

const TRUSTED_SOURCE_LINKS_STORAGE_KEY = 'mdv.modelAi.trustedSourceLinks';

const DEFAULT_TRUSTED_SOURCE_LINKS = [
    'https://www.gsmarena.com/',
    'https://www.kimovil.com/',
    'https://www.tudocelular.com/',
].join('\n');

const SMARTPHONE_DEFAULT_GIFTS = [
    '1 capa protetora',
    '1 capa extra',
    '1 pelicula 3D aplicada',
].join('\n');

const normalizeChoiceOptions = (options: TableOption[]): TableOption[] => [...new Map(
    options.map((option) => [String(option.value), option])
).values()]
    .sort((left, right) => left.label.localeCompare(right.label));

const parseTrustedSourceLinks = (value: string) => value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);

const normalizeAutocompleteText = (value: string) => value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const normalizeTemplateFieldAlias = (value: string) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^specs[._-]?/, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const MODEL_VARIATION_FIELD_ALIASES = new Set([
    'color',
    'cor',
    'colour',
    'ram',
    'memoria_ram',
    'memory_ram',
    'storage',
    'armazenamento',
    'memoria',
    'capacity',
    'capacidade',
]);

const isModelVariationFieldKey = (value: string) => MODEL_VARIATION_FIELD_ALIASES.has(normalizeTemplateFieldAlias(value));

const formatModelNameToken = (part: string) => {
    if (/^\d+[a-z]+$/i.test(part)) {
        return part.replace(/[a-z]+$/i, (suffix) => suffix.toUpperCase());
    }
    if (/^(nfc|usb|gps|wifi|wi-fi|lcd|led|oled|amoled|ips|hd|fullhd|uhd|ram|rom|se)$/i.test(part)) {
        return part.toUpperCase();
    }
    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
};

const formatModelNameTitleCase = (value: string) => value.replace(
    /[A-Za-zÀ-ÖØ-öø-ÿ0-9]+(?:[-'][A-Za-zÀ-ÖØ-öø-ÿ0-9]+)*/g,
    (word) => word
        .split(/([-'])/)
        .map((part) => (
            part === '-' || part === "'"
                ? part
                : formatModelNameToken(part)
        ))
        .join('')
);

const NON_TEMPLATE_CATEGORY_KEYS = new Set([
    'auto_name_enabled',
    'auto_name_fields',
    'auto_name_template',
    'auto_name_separator',
    'brand',
    'brindes',
    'category_id',
    'custom_fields',
    'description',
    'ean_autofill_config',
    'images',
    'keywords',
    'meta_description',
    'meta_title',
    'model',
    'name',
    'slug',
    'tags_venda',
    'unique_fields',
    'weight_kg',
    'dimensions.width_cm',
    'dimensions.height_cm',
    'dimensions.depth_cm',
    'imei1',
    'imei2',
    'serial',
    'color',
    'ram',
    'sku',
    'storage',
    'specs.imei1',
    'specs.imei2',
    'specs.serial',
    'specs.color',
    'specs.ram',
    'specs.sku',
    'specs.storage',
]);

const GLOBAL_SPEC_FIELD_BLOCKLIST = new Set([
    'battery_health',
    'specs.battery_health',
]);

const CATEGORY_FIELD_LABELS: Record<string, string> = {
    antutu: 'Antutu',
    audio: 'Audio',
    battery_health: 'Saude da Bateria',
    battery_mah: 'Bateria (mAh)',
    cam_principal_mpx: 'Camera Principal (MP)',
    cam_selfie_mpx: 'Camera Selfie (MP)',
    carregamento: 'Carregamento',
    celular_biometria: 'Biometria',
    celular_fps_display: 'FPS do Display',
    celular_slot_para_cartao: 'Slot para Cartao',
    celular_tipo_de_protecao_de_tela: 'Protecao de Tela',
    chipset: 'Chipset',
    display: 'Display',
    entrada_fone_de_ouvido: 'Entrada para Fone',
    gpu: 'GPU',
    keyboard_support: 'Suporte a Teclado',
    materials: 'Materiais',
    nfc: 'NFC',
    irda: 'IrDA',
    iks: 'IKS',
    peso_g: 'Peso (g)',
    pontuacao_dxomak: 'Pontuacao DXOMARK',
    processador: 'Processador',
    rede_operadora: 'Rede Operadora',
    resistencia: 'Resistencia',
    sks: 'SKS',
    stylus_support: 'Suporte a Caneta',
    tipo: 'Tipo',
    tipo_de_display: 'Tipo de Display',
    tipo_de_tela: 'Tipo de Tela',
    versao: 'Versao',
    weight: 'Peso',
    dimensions: 'Dimensoes',
};

const TEMPLATE_VALUE_EXACT_TRANSLATIONS: Record<string, string> = {
    'yes': 'Sim',
    'no': 'Nao',
    'yes (magnetic)': 'Sim (magnetico)',
    'yes (magnetic pins)': 'Sim (pinos magneticos)',
};

const TEMPLATE_VALUE_TRANSLATIONS: Array<[RegExp, string]> = [
    [/Stereo speakers/gi, 'Alto-falantes estereo'],
    [/Hi-Res Audio/gi, 'Audio Hi-Res'],
    [/Glass front/gi, 'Frente de vidro'],
    [/aluminum frame/gi, 'estrutura de aluminio'],
    [/aluminum back/gi, 'traseira de aluminio'],
    [/magnetic pins/gi, 'pinos magneticos'],
    [/magnetic/gi, 'magnetico'],
    [/\bYes\b/gi, 'Sim'],
    [/\bNo\b/gi, 'Nao'],
];

const translateTemplateValueToPortuguese = (value: any) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    const exact = TEMPLATE_VALUE_EXACT_TRANSLATIONS[trimmed.toLowerCase()];
    if (exact) return exact;

    return TEMPLATE_VALUE_TRANSLATIONS.reduce(
        (translated, [pattern, replacement]) => translated.replace(pattern, replacement),
        value
    );
};

const translateTemplateValuesToPortuguese = (values: Record<string, any>) => Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, translateTemplateValueToPortuguese(value)])
);

const CATEGORY_FIELD_FALLBACKS: Record<string, Partial<CustomField>> = {
    antutu: {
        field_type: 'number',
    },
    battery_mah: {
        field_type: 'number',
    },
    cam_principal_mpx: {
        field_type: 'number',
    },
    cam_selfie_mpx: {
        field_type: 'number',
    },
    celular_fps_display: {
        field_type: 'number',
    },
    celular_slot_para_cartao: {
        field_type: 'select',
        options: ['Sim', 'Não', 'Consulte'],
    },
    display: {
        field_type: 'number',
    },
    entrada_fone_de_ouvido: {
        field_type: 'select',
        options: ['Sim', 'Não', 'Consulte'],
    },
    iks: {
        field_type: 'select',
        options: ['Sim', 'Não', 'Consulte'],
    },
    nfc: {
        field_type: 'select',
        options: ['Sim', 'Não', 'Consulte'],
    },
    peso_g: {
        field_type: 'number',
    },
    sks: {
        field_type: 'select',
        options: ['Sim', 'Não', 'Consulte'],
    },
    irda: {
        field_type: 'select',
        options: ['Sim', 'Não', 'Consulte'],
    },
    battery_health: {
        field_type: 'table_relation',
        table_config: {
            table_name: 'battery_healths',
            value_column: 'id',
            label_column: 'name',
            order_by: 'name ASC',
        },
    },
    color: {
        field_type: 'table_relation',
        table_config: {
            table_name: 'colors',
            value_column: 'id',
            label_column: 'name',
            order_by: 'name ASC',
        },
    },
    ram: {
        field_type: 'table_relation',
        table_config: {
            table_name: 'rams',
            value_column: 'id',
            label_column: 'name',
            order_by: 'name ASC',
        },
    },
    storage: {
        field_type: 'table_relation',
        table_config: {
            table_name: 'storages',
            value_column: 'id',
            label_column: 'name',
            order_by: 'name ASC',
        },
    },
    versao: {
        field_type: 'table_relation',
        table_config: {
            table_name: 'versions',
            value_column: 'id',
            label_column: 'name',
            order_by: 'name ASC',
        },
    },
    version: {
        field_type: 'table_relation',
        table_config: {
            table_name: 'versions',
            value_column: 'id',
            label_column: 'name',
            order_by: 'name ASC',
        },
    },
};

const formatCategoryFieldLabel = (key: string) => {
    const dictionaryLabel = getFieldDefinition(key)?.label;
    if (dictionaryLabel) return dictionaryLabel;
    if (CATEGORY_FIELD_LABELS[key]) return CATEGORY_FIELD_LABELS[key];
    return key
        .replace(/^specs\./, '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const shouldCreateTemplateFieldFromCategoryConfig = (key: string, value: unknown) => {
    if (NON_TEMPLATE_CATEGORY_KEYS.has(key)) return false;
    if (GLOBAL_SPEC_FIELD_BLOCKLIST.has(key)) return false;
    if (isModelUnitFieldKey(key)) return false;
    if (isModelVariationFieldKey(key)) return false;
    if (value === 'off' || value === 'hidden') return false;
    return value !== undefined && value !== null;
};

const buildCategoryFallbackFields = (
    categoryConfig: any,
    existingFields: CustomField[],
    templateValues: Record<string, any> = {}
): CustomField[] => {
    if ((!categoryConfig || typeof categoryConfig !== 'object') && !templateValues) return [];
    const existingKeys = new Set(existingFields.map(field => field.key));
    const candidateEntries = [
        ...Object.entries(categoryConfig || {}),
        ...Object.keys(templateValues || {}).map((key) => [key, 'template_value'] as const),
    ];
    const uniqueEntries = Array.from(new Map(candidateEntries).entries());

    return uniqueEntries
        .filter(([key, value]) => shouldCreateTemplateFieldFromCategoryConfig(key, value) && !existingKeys.has(key))
        .map(([key], index) => {
            const fallback = CATEGORY_FIELD_FALLBACKS[key] || {};
            return ({
            id: `category-fallback-${key}`,
            company_id: '',
            key,
            label: formatCategoryFieldLabel(key),
            category: 'spec',
            field_type: fallback.field_type || 'text',
            options: fallback.options || [],
            validation: {},
            placeholder: '',
            help_text: '',
            table_config: fallback.table_config,
            is_system: true,
            display_order: 1000 + index,
            created_at: '',
            updated_at: '',
            } as CustomField);
        });
};

/**
 * TemplateFieldInput Component
 * Renders appropriate input based on field type
 */
interface TemplateFieldInputProps {
    field: CustomField;
    value: any;
    onChange: (value: any) => void;
}

const TemplateFieldInput: React.FC<TemplateFieldInputProps> = ({ field, value, onChange }) => {
    return (
        <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
                {field.label} <span className="text-slate-400 font-mono">({field.key})</span>
            </label>
            <input
                type={field.field_type === 'number' ? 'number' : 'text'}
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                placeholder={field.placeholder || ''}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
        </div>
    );
};

/**
 * Model Modal Component with Template Support
 * Add/Edit model with brand association and template configuration
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Tab-based interface (Basic + Template)
 * - Template tab allows configuring default values
 * - Integrates with custom_fields for dynamic fields
 */
export const ModelModal: React.FC<ModelModalProps> = ({ isOpen, onClose, onSave, model }) => {
    const [activeTab, setActiveTab] = useState<TabType>('basic');

    // Basic fields
    const [name, setName] = useState('');
    const [brandId, setBrandId] = useState('');
    const [brandSearch, setBrandSearch] = useState('');
    const [brandDropdownOpen, setBrandDropdownOpen] = useState(false);
    const [active, setActive] = useState(true);
    const [blingSkuInput, setBlingSkuInput] = useState('');
    const [fetchingBlingData, setFetchingBlingData] = useState(false);

    // Template fields
    const [categoryId, setCategoryId] = useState('');
    const [description, setDescription] = useState('');
    const [templateValues, setTemplateValues] = useState<Record<string, any>>({});
    const [eans, setEans] = useState<string[]>([]);

    // Data
    const [brands, setBrands] = useState<Brand[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [customFields, setCustomFields] = useState<CustomField[]>([]);
    const [officialTags, setOfficialTags] = useState<CrossSellTag[]>([]);
    const [categoryConfig, setCategoryConfig] = useState<any>(null);
    const [fieldChoiceOptions, setFieldChoiceOptions] = useState<Record<string, TableOption[]>>({});
    const fieldChoiceOptionsGenerationRef = useRef(0);

    // Shopee fields (stored inside template_values with shopee_ prefix)
    const [shopeeAutoPublishEnabled, setShopeeAutoPublishEnabled] = useState(false);
    const [shopeeCategoryId, setShopeeCategoryId] = useState<number | null>(null);
    const [shopeeCategoryName, setShopeeCategoryName] = useState('');
    const [shopeeAttributeDefaults, setShopeeAttributeDefaults] = useState<Record<string, any>>({});
    const [shopeeAttributeDefaultsText, setShopeeAttributeDefaultsText] = useState('');
    const [shopeeAttributeDefaultsError, setShopeeAttributeDefaultsError] = useState('');
    // Shopee category search UI state
    const [shopeeSimilarSearch, setShopeeSimilarSearch] = useState('');
    const [shopeeSimilarResults, setShopeeSimilarResults] = useState<any[]>([]);
    const [shopeeSimilarLoading, setShopeeSimilarLoading] = useState(false);
    const [shopeeCategorySearch, setShopeeCategorySearch] = useState('');
    const [shopeeCategoryTree, setShopeeCategoryTree] = useState<any[]>([]);
    const [shopeeCategoryResults, setShopeeCategoryResults] = useState<any[]>([]);
    const [shopeeCategoriesLoading, setShopeeCategoriesLoading] = useState(false);
    const [shopeeCategoriesLoaded, setShopeeCategoriesLoaded] = useState(false);
    const [shopeeCategoriesError, setShopeeCategoriesError] = useState('');
    // Shopee attribute auto-loading state (busca atributos da categoria + sugestoes)
    const [shopeeAttributeFields, setShopeeAttributeFields] = useState<ShopeeAttributeField[]>([]);
    const [shopeeAttributesLoading, setShopeeAttributesLoading] = useState(false);
    const [shopeeAttributesError, setShopeeAttributesError] = useState('');
    // Ref para evitar race: descarta respostas de categorias antigas.
    const shopeeAttributesRequestRef = useRef(0);

    // UI State
    const [saving, setSaving] = useState(false);
    const [listEditor, setListEditor] = useState<{
        field: CustomField;
        current: TableOption | null;
    } | null>(null);
    const [savingListOption, setSavingListOption] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const eanInputRef = useRef<HTMLInputElement>(null);

    // AI Generation State
    const [aiPrompt, setAiPrompt] = useState('');
    const [promptCopied, setPromptCopied] = useState(false);
    const [jsonInput, setJsonInput] = useState('');
    const [modelJsonInput, setModelJsonInput] = useState('');
    const [modelPromptCopied, setModelPromptCopied] = useState(false);
    const [showModelPrompt, setShowModelPrompt] = useState(false);
    const [generatingModelJson, setGeneratingModelJson] = useState(false);
    const [applyingModelPayload, setApplyingModelPayload] = useState(false);
    const applyingModelPayloadRef = useRef(false);
    const [trustedSourceLinksText, setTrustedSourceLinksText] = useState(() => {
        if (typeof window === 'undefined') return DEFAULT_TRUSTED_SOURCE_LINKS;
        return window.localStorage.getItem(TRUSTED_SOURCE_LINKS_STORAGE_KEY) || DEFAULT_TRUSTED_SOURCE_LINKS;
    });
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Update AI Prompt automatically when model data changes
    useEffect(() => {
        const brandObj = brands.find(b => b.id === brandId);
        const categoryObj = categories.find(c => c.id === categoryId);

        const defaultPrompt = `Gere conteúdo SEO otimizado para o seguinte produto:

Nome: ${name || '[Nome do Modelo]'}
Marca: ${brandObj?.name || '[Marca]'}
Categoria: ${categoryObj?.name || '[Categoria]'}

Retorne APENAS um JSON válido no seguinte formato (sem markdown, sem explicações):
{
    "description": "descrição detalhada do modelo com mínimo 300 palavras, destacando benefícios, especificações técnicas e diferenciais",
    "slug": "url-amigavel-sem-acentos-minusculas",
    "meta_title": "título SEO com máximo 60 caracteres incluindo nome da loja",
    "meta_description": "meta descrição persuasiva com máximo 160 caracteres destacando benefícios",
    "keywords": ["palavra1", "palavra2", "palavra3", "palavra4", "palavra5"]
}`;
        setAiPrompt(defaultPrompt);
    }, [name, brandId, categoryId, brands, categories]);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    const handleCopyPrompt = async () => {
        try {
            await navigator.clipboard.writeText(aiPrompt);
            setPromptCopied(true);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => {
                setPromptCopied(false);
                timeoutRef.current = null;
            }, 2000);
        } catch (err) {
            console.error('Erro ao copiar prompt:', err);
        }
    };

    const brandObj = brands.find(b => b.id === brandId);
    const categoryObj = categories.find(c => c.id === categoryId);
    const findBrandByName = (value: string) => {
        const normalized = normalizeAutocompleteText(value);
        if (!normalized) return undefined;
        return brands.find((brand) => normalizeAutocompleteText(brand.name) === normalized);
    };
    const filteredBrands = brands
        .filter((brand) => {
            const search = normalizeAutocompleteText(brandSearch);
            if (!search) return true;
            return normalizeAutocompleteText(brand.name).includes(search);
        })
        .slice(0, 30);
    const handleBrandSearchChange = (value: string) => {
        setBrandSearch(value);
        setBrandId(findBrandByName(value)?.id || '');
        setBrandDropdownOpen(true);
    };
    const handleSelectBrand = (brand: Brand) => {
        setBrandId(brand.id);
        setBrandSearch(brand.name);
        setBrandDropdownOpen(false);
    };
    const handleBrandSearchBlur = () => {
        setTimeout(() => setBrandDropdownOpen(false), 120);
        if (!brandSearch.trim()) {
            setBrandId('');
            return;
        }
        const matchedBrand = findBrandByName(brandSearch);
        if (matchedBrand) {
            setBrandId(matchedBrand.id);
            setBrandSearch(matchedBrand.name);
        }
    };
    const normalizeFieldAlias = (value: string) => value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, '_')
        .trim();
    const isFieldEnabledForCategory = (field: CustomField) => {
        if (!categoryId || !categoryConfig) return true;
        const customFieldConfig = Array.isArray(categoryConfig.custom_fields)
            ? categoryConfig.custom_fields.find((configuredField: any) => (
                configuredField.field_id === field.id ||
                configuredField.id === field.id ||
                normalizeFieldAlias(configuredField.key || '') === normalizeFieldAlias(field.key) ||
                normalizeFieldAlias(configuredField.name || configuredField.label || '') === normalizeFieldAlias(field.label)
            ))
            : null;

        const requirement = customFieldConfig?.requirement ?? categoryConfig[field.key];
        if (requirement === undefined || requirement === null) return false;
        return requirement !== 'off' && requirement !== 'hidden';
    };
    const isSmartphoneCategory = (category?: Category) => {
        const categoryName = normalizeFieldAlias(category?.name || '');
        const categorySlug = normalizeFieldAlias(category?.slug || '');
        return ['smartphone', 'smartphones', 'celular', 'celulares', 'iphone', 'iphones']
            .some(term => categoryName.includes(term) || categorySlug.includes(term));
    };
    const isFieldBlockedForCategory = (field: CustomField) => {
        if (!isSmartphoneCategory(categoryObj)) return false;

        const fieldKey = normalizeFieldAlias(field.key);
        const fieldLabel = normalizeFieldAlias(field.label);
        return fieldKey === 'tipo' || fieldLabel.includes('receptor');
    };
    const templateFields = [
        ...customFields,
        ...buildCategoryFallbackFields(categoryConfig, customFields, templateValues),
    ];
    const hasCanonicalVersionField = templateFields.some(field => (
        normalizeFieldAlias(field.key) === 'versao' ||
        normalizeFieldAlias(field.label) === 'versao'
    ));
    const isDuplicateTemplateField = (field: CustomField) => {
        if (!hasCanonicalVersionField) return false;

        const fieldKey = normalizeFieldAlias(field.key);
        const fieldLabel = normalizeFieldAlias(field.label);
        return fieldKey === 'version' || fieldLabel === 'version';
    };
    const visibleSpecFields = templateFields
        .filter(f => f.category === 'spec')
        .filter(field => !GLOBAL_SPEC_FIELD_BLOCKLIST.has(field.key) && !GLOBAL_SPEC_FIELD_BLOCKLIST.has(`specs.${field.key}`))
        .filter(field => !isModelUnitFieldKey(field.key) && !isModelUnitFieldKey(field.label))
        .filter(field => !isModelVariationFieldKey(field.key) && !isModelVariationFieldKey(field.label))
        .filter(isFieldEnabledForCategory)
        .filter(field => !isFieldBlockedForCategory(field))
        .filter(field => !isDuplicateTemplateField(field));
    const hiddenSpecFields = templateFields
        .filter(f => f.category === 'spec')
        .filter(field => !isFieldEnabledForCategory(field) || isFieldBlockedForCategory(field) || isDuplicateTemplateField(field));
    const hiddenSpecAliases = hiddenSpecFields.flatMap(field => [field.key, field.label]);
    const isHiddenSpecKey = (key: string) => hiddenSpecAliases.some(alias => {
        return normalizeFieldAlias(alias) === normalizeFieldAlias(key);
    });
    const getSanitizedTemplateValues = (values: Record<string, any>) => Object.fromEntries(
        Object.entries(values).filter(([key]) => !GLOBAL_SPEC_FIELD_BLOCKLIST.has(key) && !isHiddenSpecKey(key) && !isModelUnitFieldKey(key) && !isModelVariationFieldKey(key))
    );
    const modelImportPrompt = buildModelImportPrompt({
        name,
        brand: brandObj?.name || '',
        category: categoryObj?.name || 'Smartphones',
        customFields: visibleSpecFields,
        choiceOptions: fieldChoiceOptions,
    });

    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(TRUSTED_SOURCE_LINKS_STORAGE_KEY, trustedSourceLinksText);
    }, [trustedSourceLinksText]);

    const handleFetchBlingDataBySku = async () => {
        const sku = blingSkuInput.trim();
        if (!sku) return;

        setFetchingBlingData(true);
        try {
            const product = await blingService.findBlingProductByExactSku(sku);
            if (!product) {
                toast.error(`Produto com o SKU "${sku}" não foi encontrado no Bling.`);
                return;
            }

            // Descrição
            const fetchedDesc = firstTextValue(
                product.descricaoCurta,
                product.descricaoComplementar,
                product.nome
            );
            if (fetchedDesc) {
                // Remove tags HTML se houver
                const cleanDesc = cleanBlingContextText(fetchedDesc);
                setDescription(cleanDesc);
            }

            // EAN/GTIN
            if (product.gtin) {
                const cleanedGtin = String(product.gtin).trim();
                if (cleanedGtin && !eans.includes(cleanedGtin)) {
                    setEans((prev) => [...prev, cleanedGtin]);
                }
            }

            // Dimensões & Peso
            const newTemplateValues = { ...templateValues };
            let hasDimensions = false;

            if (product.pesoBruto && !isNaN(Number(product.pesoBruto))) {
                newTemplateValues['weight_kg'] = Number(product.pesoBruto);
                hasDimensions = true;
            }
            if (product.largura && !isNaN(Number(product.largura))) {
                newTemplateValues['dimensions.width_cm'] = Number(product.largura);
                hasDimensions = true;
            }
            if (product.altura && !isNaN(Number(product.altura))) {
                newTemplateValues['dimensions.height_cm'] = Number(product.altura);
                hasDimensions = true;
            }
            if (product.profundidade && !isNaN(Number(product.profundidade))) {
                newTemplateValues['dimensions.depth_cm'] = Number(product.profundidade);
                hasDimensions = true;
            }

            if (hasDimensions) {
                setTemplateValues(newTemplateValues);
            }

            toast.success(`Informações do SKU "${sku}" importadas com sucesso!`);
        } catch (err) {
            console.error('Erro ao buscar dados do Bling por SKU:', err);
            toast.error(err instanceof Error ? err.message : 'Falha ao buscar dados do Bling.');
        } finally {
            setFetchingBlingData(false);
        }
    };

    const handleCopyModelPrompt = async () => {
        try {
            await navigator.clipboard.writeText(modelImportPrompt);
            setModelPromptCopied(true);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => {
                setModelPromptCopied(false);
                timeoutRef.current = null;
            }, 2000);
        } catch (err) {
            console.error('Erro ao copiar prompt do modelo:', err);
        }
    };

    const applyNormalizedModelPayload = async (normalized: any) => {
        const visibleTemplateValues = Object.fromEntries(
            Object.entries(normalized.templateValues || {}).filter(([key]) => !isHiddenSpecKey(key) && !isModelUnitFieldKey(key) && !isModelVariationFieldKey(key))
        );
        const choiceResolution = await resolveMissingListChoices({
            missingChoices: normalized.missingChoices || [],
            fields: visibleSpecFields,
            choiceOptions: fieldChoiceOptions,
            createOption: async ({ field, options, value }: any) => saveModelListOption({
                field,
                options,
                draft: { label: value },
            }),
        });
        const translatedTemplateValues = {
            ...translateTemplateValuesToPortuguese(visibleTemplateValues),
            ...choiceResolution.resolvedValues,
        };
        const appliedFields: string[] = [];

        if (choiceResolution.created.length > 0) {
            fieldChoiceOptionsGenerationRef.current += 1;
            setFieldChoiceOptions((currentOptions) => {
                const nextOptions = { ...currentOptions };
                choiceResolution.created.forEach((created: any) => {
                    nextOptions[created.fieldKey] = normalizeChoiceOptions([
                        ...(nextOptions[created.fieldKey] || []),
                        created.persisted.option,
                    ]);
                });
                return nextOptions;
            });
            const createdFieldsById = new Map<string, CustomField>();
            choiceResolution.created.forEach((created: any) => {
                if (created.persisted.field.field_type === 'select') {
                    createdFieldsById.set(created.persisted.field.id, created.persisted.field);
                }
            });
            setCustomFields((fields) => fields.map(
                (field) => createdFieldsById.get(field.id) || field
            ));

            const firstCreated = choiceResolution.created[0];
            toast.success(
                choiceResolution.created.length === 1
                    ? 'Opcao criada automaticamente pela IA.'
                    : `${choiceResolution.created.length} opcoes criadas automaticamente pela IA.`,
                {
                    action: {
                        label: 'Editar',
                        onClick: () => setListEditor({ field: firstCreated.persisted.field, current: firstCreated.persisted.option }),
                    },
                }
            );
        }

        if (normalized.name) {
            setName(formatModelNameTitleCase(normalized.name));
            appliedFields.push('nome');
        }
        if (normalized.brandId) {
            setBrandId(normalized.brandId);
            appliedFields.push('marca');
        }
        if (normalized.categoryId) {
            setCategoryId(normalized.categoryId);
            appliedFields.push('categoria');
        }
        if (typeof normalized.active === 'boolean') {
            setActive(normalized.active);
            appliedFields.push('status');
        }
        if (normalized.description) {
            setDescription(normalized.description);
            appliedFields.push('descricao');
        }
        if (normalized.eans?.length) {
            setEans(normalized.eans);
            appliedFields.push('EANs');
        }
        if (Object.keys(translatedTemplateValues).length > 0) {
            setTemplateValues(prev => ({
                ...prev,
                ...translatedTemplateValues
            }));
            appliedFields.push(`${Object.keys(translatedTemplateValues).length} campo(s) do template`);
        }

        if (choiceResolution.rejected.length || choiceResolution.failed.length) {
            const unresolvedChoices = [
                ...choiceResolution.rejected,
                ...choiceResolution.failed.map((item: any) => item.choice),
            ];
            const missingList = unresolvedChoices
                .map((item: any) => `${item.fieldLabel}: "${item.value}"`)
                .join('; ');
            toast.warning('Algumas opcoes da IA nao foram criadas', {
                description: missingList,
                duration: 10000,
            });
        }

        const requiredEmptyFields = (normalized.emptyFields || []).filter((item: any) => item.importance === 'required');
        if (requiredEmptyFields.length) {
            const emptyNames = requiredEmptyFields.map((item: any) => item.fieldLabel || item.fieldKey);
            const visibleNames = emptyNames.slice(0, 8).join('; ');
            const remaining = emptyNames.length > 8 ? `; +${emptyNames.length - 8} campo(s)` : '';

            toast.error('Campos tecnicos basicos vieram sem dados reais', {
                description: `${visibleNames}${remaining}. Confira a ficha tecnica e preencha antes de salvar.`,
                duration: 12000,
            });
        }

        return appliedFields;
    };

    const warnUnresolvedModelPayload = (data: any, normalized: any) => {
        const missing: string[] = [];
        if ((data.brand || data.marca || data.brand_name) && !normalized.brandId) {
            missing.push(`marca "${data.brand || data.marca || data.brand_name}"`);
        }
        if ((data.category || data.categoria || data.category_name) && !normalized.categoryId) {
            missing.push(`categoria "${data.category || data.categoria || data.category_name}"`);
        }

        if (missing.length > 0) {
            toast.error('Alguns dados do JSON nao existem no cadastro', {
                description: `Cadastre ou ajuste: ${missing.join(', ')}.`,
                duration: 10000,
            });
        }
    };

    const handleApplyModelJson = async () => {
        if (applyingModelPayloadRef.current) return;
        if (loading) {
            toast.error('Aguarde marcas, categorias e campos carregarem antes de aplicar o JSON.');
            return;
        }

        applyingModelPayloadRef.current = true;
        setApplyingModelPayload(true);
        try {
            const data = parseModelImportJson(modelJsonInput);
            const normalized = normalizeModelImportPayload(data, {
                brands,
                categories,
                customFields: visibleSpecFields,
                choiceOptions: fieldChoiceOptions,
            });
            const appliedFields = await applyNormalizedModelPayload(normalized);
            warnUnresolvedModelPayload(data, normalized);

            if (appliedFields.length === 0) {
                toast.error('Nenhum campo foi preenchido pelo JSON.', {
                    description: 'Verifique se os nomes dos campos, marca e categoria existem no cadastro.',
                    duration: 10000,
                });
                return;
            }

            setModelJsonInput('');
            toast.success('Modelo preenchido com sucesso pelo JSON.', {
                description: `Aplicado: ${appliedFields.join(', ')}.`,
            });
        } catch (err) {
            console.error('Erro no parser do JSON do modelo', err);
            toast.error(err instanceof Error ? err.message : 'O formato JSON Ã© invÃ¡lido.');
        } finally {
            applyingModelPayloadRef.current = false;
            setApplyingModelPayload(false);
        }
    };

    const handleGenerateModelJson = async () => {
        if (applyingModelPayloadRef.current) return;
        if (loading) {
            toast.error('Aguarde marcas, categorias e campos carregarem antes de gerar o JSON.');
            return;
        }

        applyingModelPayloadRef.current = true;
        setApplyingModelPayload(true);
        setGeneratingModelJson(true);
        try {
            const linkedProducts = model?.id
                ? await vpsApiService.getProducts({
                    model_id: model.id,
                    status: 'all',
                    limit: 20,
                    noCache: true,
                }).catch((err) => {
                    console.warn('[ModelModal] Nao foi possivel buscar descricao do Bling para IA', err);
                    return null;
                })
                : null;
            const sourceContext = buildModelAiBlingSourceContext(linkedProducts || []);
            const result = await generateModelJsonWithAi({
                prompt: modelImportPrompt,
                name,
                brand: brandObj?.name || '',
                category: categoryObj?.name || 'Smartphones',
                trustedSourceLinks: parseTrustedSourceLinks(trustedSourceLinksText),
                sourceContext,
            });
            setModelJsonInput(result.text);
            const data = parseModelImportJson(result.text);
            const normalized = normalizeModelImportPayload(data, {
                brands,
                categories,
                customFields: visibleSpecFields,
                choiceOptions: fieldChoiceOptions,
            });
            const appliedFields = await applyNormalizedModelPayload(normalized);
            warnUnresolvedModelPayload(data, normalized);
            toast.success(appliedFields.length > 0 ? 'Modelo preenchido pela IA.' : 'JSON gerado pela IA. Revise antes de salvar.');
        } catch (err) {
            console.error('Erro ao gerar JSON do modelo com IA', err);
            toast.error(err instanceof Error ? err.message : 'Nao foi possivel gerar o JSON com IA.');
        } finally {
            setGeneratingModelJson(false);
            applyingModelPayloadRef.current = false;
            setApplyingModelPayload(false);
        }
    };

    const handleApplyJson = async () => {
        if (applyingModelPayloadRef.current) return;
        if (!jsonInput.trim()) {
            toast.error('Cole o JSON gerado pela IA primeiro.');
            return;
        }

        applyingModelPayloadRef.current = true;
        setApplyingModelPayload(true);
        try {
            let jsonText = jsonInput.replace(/```json\n?/g, '').replace(/```/g, '').trim();
            const start = jsonText.indexOf('{');
            const end = jsonText.lastIndexOf('}') + 1;
            if (start !== -1 && end !== 0) {
                jsonText = jsonText.substring(start, end);
            }

            const data = JSON.parse(jsonText);

            if (data.name || data.brand || data.category || data.template_values || data.logistics || data.seo) {
                const normalized = normalizeModelImportPayload(data, {
                    brands,
                    categories,
                    customFields: visibleSpecFields,
                    choiceOptions: fieldChoiceOptions,
                });
                const appliedFields = await applyNormalizedModelPayload(normalized);
                warnUnresolvedModelPayload(data, normalized);

                if (appliedFields.length === 0) {
                    toast.error('Nenhum campo foi preenchido pelo JSON.', {
                        description: 'Verifique se os nomes dos campos, marca e categoria existem no cadastro.',
                        duration: 10000,
                    });
                    return;
                }
            } else {
                const seo = data.seo || {};
                const slug = data.slug || seo.slug;
                const metaTitle = data.meta_title || data.metaTitle || seo.meta_title || seo.metaTitle;
                const metaDescription = data.meta_description || data.metaDescription || seo.meta_description || seo.metaDescription;
                const keywords = data.keywords || seo.keywords;
                const appliedFields: string[] = [];

                if (data.description) {
                    setDescription(data.description);
                    appliedFields.push('descricao');
                }
                if (slug) {
                    handleTemplateValueChange('slug', slug);
                    appliedFields.push('slug');
                }
                if (metaTitle) {
                    handleTemplateValueChange('meta_title', metaTitle);
                    appliedFields.push('titulo SEO');
                }
                if (metaDescription) {
                    handleTemplateValueChange('meta_description', metaDescription);
                    appliedFields.push('meta descricao');
                }
                if (keywords && Array.isArray(keywords)) {
                    handleTemplateValueChange('keywords', keywords);
                    appliedFields.push('keywords');
                }

                if (appliedFields.length === 0) {
                    toast.error('Nenhum campo SEO foi preenchido pelo JSON.', {
                        description: 'Use description, slug, meta_title, meta_description ou keywords.',
                        duration: 10000,
                    });
                    return;
                }
            }

            setJsonInput('');
            toast.success('Campos SEO preenchidos com sucesso pela Inteligência Artificial!');
        } catch (err) {
            console.error('Erro no parser do JSON', err);
            toast.error('O formato JSON é inválido. Tente novamente ou cole apenas o código da resposta.');
        } finally {
            applyingModelPayloadRef.current = false;
            setApplyingModelPayload(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            loadData();
        }
    }, [isOpen]);

    useEffect(() => {
        let cancelled = false;
        const requestId = ++fieldChoiceOptionsGenerationRef.current;

        const loadFieldChoiceOptions = async () => {
            const nextOptions: Record<string, TableOption[]> = {};

            customFields.forEach((field) => {
                if (field.field_type === 'select' && Array.isArray(field.options)) {
                    nextOptions[field.key] = normalizeChoiceOptions(field.options
                        .filter(Boolean)
                        .map((option) => ({ value: option, label: option })));
                }
            });

            const relationFields = customFields.filter(field => field.field_type === 'table_relation' && field.table_config);
            await Promise.all(relationFields.map(async (field) => {
                try {
                    const options = await tableDataService.loadOptions(
                        field.table_config!.table_name,
                        field.table_config!.value_column,
                        field.table_config!.label_column,
                        field.table_config!.order_by
                    );
                    nextOptions[field.key] = normalizeChoiceOptions(options.map((option) => ({
                        value: String(option.value),
                        label: String(option.label),
                        meta: option.meta,
                    })));
                } catch (error) {
                    console.error(`Error loading choices for ${field.key}:`, error);
                }
            }));

            if (!cancelled && requestId === fieldChoiceOptionsGenerationRef.current) {
                setFieldChoiceOptions(nextOptions);
            }
        };

        loadFieldChoiceOptions();

        return () => {
            cancelled = true;
        };
    }, [customFields]);

    useEffect(() => {
        if (model) {
            setName(formatModelNameTitleCase(model.name));
            setBrandId(model.brand_id);
            setBrandSearch(brands.find((brand) => brand.id === model.brand_id)?.name || '');
            setActive(model.active);
            setCategoryId(model.category_id || '');
            setDescription(model.description || '');
            let tv = model.template_values || {};
            if (typeof tv === 'string') {
                try {
                    tv = JSON.parse(tv);
                } catch (e) {
                    tv = {};
                }
            }
            setTemplateValues(tv);
            setEans(model.eans || []);
            // Load Shopee fields from template_values
            setShopeeAutoPublishEnabled(Boolean(tv['shopee_auto_publish_enabled']));
            setShopeeCategoryId(tv['shopee_category_id'] ? Number(tv['shopee_category_id']) : null);
            setShopeeCategoryName(tv['shopee_category_name'] || '');
            const attrDefaults = tv['shopee_attribute_defaults'] || {};
            setShopeeAttributeDefaults(typeof attrDefaults === 'object' && !Array.isArray(attrDefaults) ? attrDefaults : {});
            setShopeeAttributeDefaultsText(Object.keys(attrDefaults).length > 0 ? JSON.stringify(attrDefaults, null, 2) : '');
            setShopeeAttributeDefaultsError('');
        } else {
            setName('');
            setBrandId('');
            setBrandSearch('');
            setActive(true);
            setCategoryId('');
            setDescription('');
            setTemplateValues({});
            setEans([]);
            setShopeeAutoPublishEnabled(false);
            setShopeeCategoryId(null);
            setShopeeCategoryName('');
            setShopeeAttributeDefaults({});
            setShopeeAttributeDefaultsText('');
            setShopeeAttributeDefaultsError('');
        }
        setError('');
        setActiveTab('basic');
        setShopeeSimilarSearch('');
        setShopeeSimilarResults([]);
    }, [model, isOpen]);

    useEffect(() => {
        if (!brandId) return;
        const selectedBrand = brands.find((brand) => brand.id === brandId);
        if (selectedBrand && brandSearch !== selectedBrand.name) {
            setBrandSearch(selectedBrand.name);
        }
    }, [brandId, brands, brandSearch]);

    const loadData = async () => {
        try {
            setLoading(true);
            customFieldsService.clearCache();
            const [brandsResult, categoriesResult, fieldsResult, tagsResult] = await Promise.allSettled([
                brandService.list({ noCache: true }),
                categoryService.list(),
                customFieldsService.list(),
                crossSellTagsService.list()
            ]);

            if (brandsResult.status === 'fulfilled') {
                setBrands(brandsResult.value);
            } else {
                console.error('Error loading model brands:', brandsResult.reason);
            }

            if (categoriesResult.status === 'fulfilled') {
                setCategories(categoriesResult.value);
            } else {
                console.error('Error loading model categories:', categoriesResult.reason);
            }

            if (fieldsResult.status === 'fulfilled') {
                setCustomFields(fieldsResult.value);
            } else {
                console.error('Error loading model custom fields:', fieldsResult.reason);
            }

            if (tagsResult.status === 'fulfilled') {
                setOfficialTags(tagsResult.value);
            } else {
                console.error('Error loading model cross-sell tags:', tagsResult.reason);
            }
        } finally {
            setLoading(false);
        }
    };

    // Load category configuration when category changes
    useEffect(() => {
        const loadCategoryConfig = async () => {
            if (!categoryId) {
                setCategoryConfig(null);
                return;
            }
            try {
                const category = await categoryService.getById(categoryId);
                if (category) {
                    setCategoryConfig(category.config);
                }
            } catch (error) {
                console.error('Error loading category config:', error);
                setCategoryConfig(null);
            }
        };
        loadCategoryConfig();
    }, [categoryId]);

    const handleTemplateValueChange = (key: string, value: any) => {
        setTemplateValues(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const handleOpenListOptionEditor = (field: CustomField, current: TableOption | null = null) => {
        setListEditor({ field, current });
    };

    const handleSaveListOption = async (draft: ModelListOptionDraft) => {
        if (!listEditor) return;

        setSavingListOption(true);
        try {
            const persisted = await saveModelListOption({
                field: listEditor.field,
                options: fieldChoiceOptions[listEditor.field.key] || [],
                draft,
                current: listEditor.current,
            });

            if (listEditor.field.field_type === 'select') {
                setCustomFields((fields) => fields.map((field) => field.id === persisted.field.id ? persisted.field : field));
            }

            fieldChoiceOptionsGenerationRef.current += 1;
            setFieldChoiceOptions((currentOptions) => {
                const previous = currentOptions[listEditor.field.key] || [];
                const withoutEdited = listEditor.current
                    ? previous.filter((option) => String(option.value) !== String(listEditor.current?.value))
                    : previous;
                const sorted = normalizeChoiceOptions([...withoutEdited, persisted.option]);

                return {
                    ...currentOptions,
                    [listEditor.field.key]: sorted,
                };
            });

            handleTemplateValueChange(listEditor.field.key, String(persisted.option.value));
            toast.success(listEditor.current ? 'Opcao atualizada com sucesso.' : 'Opcao adicionada com sucesso.');
            setListEditor(null);
        } catch (saveError) {
            const message = saveError instanceof Error ? saveError.message : 'Erro ao salvar opcao.';
            toast.error(message);
        } finally {
            setSavingListOption(false);
        }
    };

    const renderTemplateField = (field: CustomField) => (
        (field.field_type === 'select' || field.field_type === 'table_relation') ? (
            <div key={field.id}>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                    {field.label} <span className="text-slate-400 font-mono">({field.key})</span>
                </label>
                <ModelListFieldInput
                    field={field}
                    options={fieldChoiceOptions[field.key] || []}
                    value={String(templateValues[field.key] ?? '')}
                    saving={savingListOption}
                    onChange={(value) => handleTemplateValueChange(field.key, value)}
                    onAdd={() => handleOpenListOptionEditor(field)}
                    onEdit={(option) => handleOpenListOptionEditor(field, option)}
                />
            </div>
        ) : (
            <TemplateFieldInput
                key={field.id}
                field={field}
                value={templateValues[field.key]}
                onChange={(value) => handleTemplateValueChange(field.key, value)}
            />
        )
    );

    const handleShopeeAttributeDefaultFieldChange = (attributeId: string, value: string) => {
        setShopeeAttributeDefaults((previous) => {
            const next = { ...previous };
            if (value.trim()) {
                next[attributeId] = value;
            } else {
                delete next[attributeId];
            }
            setShopeeAttributeDefaultsText(Object.keys(next).length > 0 ? JSON.stringify(next, null, 2) : '');
            setShopeeAttributeDefaultsError('');
            return next;
        });
    };

    const renderShopeeAttributeField = (attr: ShopeeAttributeField) => {
        const attrId = String(attr.attribute_id);
        const value = String(shopeeAttributeDefaults[attrId] ?? '');
        const label = attr.label || `Atributo ${attrId}`;
        const hasOptions = attr.attribute_value_list.length > 0;
        const commonClassName = 'w-full px-3 py-2 border border-orange-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400';

        return (
            <div key={`shopee-attribute-${attrId}`}>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                    {label} {attr.mandatory && <span className="text-orange-600">*</span>} <span className="text-slate-400 font-mono">(shopee:{attrId})</span>
                </label>
                {hasOptions && attr.input_kind !== 'multiselect' ? (
                    <select
                        value={value}
                        onChange={(event) => handleShopeeAttributeDefaultFieldChange(attrId, event.target.value)}
                        className={commonClassName}
                    >
                        <option value="">Selecione</option>
                        {attr.attribute_value_list.map((option) => (
                            <option key={`${attrId}-${option.value_id}-${option.label}`} value={option.label}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                ) : (
                    <input
                        value={value}
                        onChange={(event) => handleShopeeAttributeDefaultFieldChange(attrId, event.target.value)}
                        className={commonClassName}
                        placeholder={hasOptions ? 'Digite uma ou mais opcoes da Shopee' : 'Valor padrao do atributo'}
                    />
                )}
            </div>
        );
    };
    const handleAddEan = (value?: string) => {
        const nextEan = (value ?? eanInputRef.current?.value ?? '').trim();
        if (!nextEan || eans.includes(nextEan)) return;

        setEans(prev => [...prev, nextEan]);
        if (eanInputRef.current) eanInputRef.current.value = '';
    };

    // Merge Shopee fields into templateValues before saving
    const buildFinalTemplateValues = () => {
        const merged = { ...templateValues };
        merged['shopee_auto_publish_enabled'] = shopeeAutoPublishEnabled;
        if (shopeeCategoryId) {
            merged['shopee_category_id'] = shopeeCategoryId;
            merged['shopee_category_name'] = shopeeCategoryName || '';
        } else {
            delete merged['shopee_category_id'];
            delete merged['shopee_category_name'];
        }
        if (Object.keys(shopeeAttributeDefaults).length > 0) {
            merged['shopee_attribute_defaults'] = shopeeAttributeDefaults;
            const labels = Object.fromEntries(shopeeAttributeFields.map((attr) => [String(attr.attribute_id), attr.label || `Atributo ${attr.attribute_id}`]));
            const required = Object.fromEntries(shopeeAttributeFields.map((attr) => [String(attr.attribute_id), Boolean(attr.mandatory)]));
            if (Object.keys(labels).length > 0) merged['shopee_attribute_labels'] = labels;
            if (Object.keys(required).length > 0) merged['shopee_attribute_required'] = required;
        } else {
            delete merged['shopee_attribute_defaults'];
            delete merged['shopee_attribute_labels'];
            delete merged['shopee_attribute_required'];
        }
        return merged;
    };

    const handleShopeeAttributeDefaultsChange = (text: string) => {
        setShopeeAttributeDefaultsText(text);
        if (!text.trim()) {
            setShopeeAttributeDefaults({});
            setShopeeAttributeDefaultsError('');
            return;
        }
        try {
            const parsed = JSON.parse(text);
            if (typeof parsed === 'object' && !Array.isArray(parsed)) {
                setShopeeAttributeDefaults(parsed);
                setShopeeAttributeDefaultsError('');
            } else {
                setShopeeAttributeDefaultsError('Deve ser um objeto JSON { "id": "valor" }');
            }
        } catch {
            setShopeeAttributeDefaultsError('JSON inválido');
        }
    };

    // ─── Auto-load Shopee attributes when category is set ─────────────────────
    // Derive brand name from the brands list for suggestions.
    const shopeeBrandName = brands.find(b => b.id === brandId)?.name || '';

    const buildShopeeAttributeProductContext = async (): Promise<ShopeeAttributeProductContext> => {
        const context: ShopeeAttributeProductContext = { name, brand: shopeeBrandName };

        if (model?.id) {
            try {
                const products = await vpsApiService.getProducts({
                    model_id: model.id,
                    status: 'all',
                    limit: 20,
                    noCache: true,
                });
                const productWithSku = (products || []).find((product: any) => firstTextValue(product?.sku, product?.specs?.sku));
                if (productWithSku) {
                    context.sku = firstTextValue(productWithSku.sku, productWithSku.specs?.sku);
                    context.price_retail = productWithSku.price_retail;
                    context.price = productWithSku.price;
                    context.stock_quantity = productWithSku.stock_quantity;
                    context.stock = productWithSku.stock;
                }
            } catch (err) {
                console.warn('[ModelModal] Nao foi possivel buscar produto do modelo para defaults Shopee', err);
            }
        }

        return {
            ...context,
            package_length: templateValues['package_length'] ?? templateValues['dimensions.length_cm'] ?? templateValues['dimensions.depth_cm'],
            package_width: templateValues['package_width'] ?? templateValues['dimensions.width_cm'],
            package_height: templateValues['package_height'] ?? templateValues['dimensions.height_cm'],
        };
    };

    const loadShopeeAttributes = async (categoryId: number) => {
        const requestId = ++shopeeAttributesRequestRef.current;
        setShopeeAttributesLoading(true);
        setShopeeAttributesError('');
        setShopeeAttributeFields([]);
        try {
            const res = await fetch(`/api/shopee-catalog?action=attributes&category_id=${categoryId}`);
            const data = await res.json();
            if (requestId !== shopeeAttributesRequestRef.current) return; // discarded

            if (data?.error && !Array.isArray(data?.response)) {
                setShopeeAttributesError(data.message || data.error || 'Erro ao buscar atributos.');
                return;
            }

            const fields = normalizeShopeeAttributes(data);
            setShopeeAttributeFields(fields);

            // Build suggestions: brand + model name + template defaults.
            // For dynamic defaults like {sku}, use the first real product linked to this model.
            const productRef = await buildShopeeAttributeProductContext();
            const payload = buildShopeeAttributeDefaultsPayload(fields, productRef);
            const shopeeTemplates = await shopeeTemplateService.list();
            const universalTemplateValues = resolveUniversalShopeeAttributeDefaults(shopeeTemplates);
            const renderedUniversalDefaults = Object.fromEntries(
                Object.entries(universalTemplateValues)
                    .map(([attributeId, value]) => [attributeId, renderShopeeAttributeDefaultValue(value as any, productRef)])
                    .filter(([, value]) => Array.isArray(value) ? value.some((entry) => String(entry || '').trim()) : String(value || '').trim())
            );

            const nextDefaults = alignShopeeDefaultValuesToOptions(fields, {
                ...renderedUniversalDefaults,
                ...payload,
                ...shopeeAttributeDefaults,
            });
            setShopeeAttributeDefaults(nextDefaults);
            setShopeeAttributeDefaultsText(Object.keys(nextDefaults).length > 0 ? JSON.stringify(nextDefaults, null, 2) : '');
            setShopeeAttributeDefaultsError('');

            const summary = summarizeShopeeAttributes(fields, nextDefaults);
            if (summary.total > 0) {
                toast.success(`Shopee: ${summary.total} atributos carregados, ${summary.filled} pré-preenchidos`, { id: 'shopee-attrs' });
            }
        } catch (err: any) {
            if (requestId !== shopeeAttributesRequestRef.current) return;
            setShopeeAttributesError(err?.message || 'Erro de conexão ao buscar atributos da Shopee.');
        } finally {
            if (requestId === shopeeAttributesRequestRef.current) {
                setShopeeAttributesLoading(false);
            }
        }
    };

    // React to shopeeCategoryId changes: auto-load attributes.
    useEffect(() => {
        if (!shopeeCategoryId) {
            setShopeeAttributeFields([]);
            setShopeeAttributesError('');
            return;
        }
        loadShopeeAttributes(shopeeCategoryId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shopeeCategoryId]);

    const handleReloadShopeeAttributes = () => {
        if (shopeeCategoryId) loadShopeeAttributes(shopeeCategoryId);
    };

    const loadShopeeCategories = async () => {
        if (shopeeCategoriesLoaded || shopeeCategoriesLoading) return;

        setShopeeCategoriesLoading(true);
        setShopeeCategoriesError('');
        try {
            const res = await fetch('/api/shopee-catalog?action=categories');
            const data = await res.json();
            if (data?.error) {
                throw new Error(data.message || data.error);
            }
            const tree = buildCategoryTree(data.response?.category_list || []);
            setShopeeCategoryTree(tree);
            setShopeeCategoriesLoaded(true);
        } catch (err: any) {
            setShopeeCategoriesError(err?.message || 'Erro ao carregar categorias da Shopee.');
        } finally {
            setShopeeCategoriesLoading(false);
        }
    };

    const handleShopeeCategorySearchChange = (value: string) => {
        setShopeeCategorySearch(value);
        if (!value.trim()) {
            setShopeeCategoryResults([]);
            return;
        }
        if (shopeeCategoryTree.length === 0) {
            loadShopeeCategories();
            return;
        }
        setShopeeCategoryResults(searchShopeeCategories(shopeeCategoryTree, value, 8));
    };

    useEffect(() => {
        if (!shopeeCategorySearch.trim() || shopeeCategoryTree.length === 0) return;
        setShopeeCategoryResults(searchShopeeCategories(shopeeCategoryTree, shopeeCategorySearch, 8));
    }, [shopeeCategorySearch, shopeeCategoryTree]);

    const selectShopeeCategoryByName = (category: any) => {
        setShopeeCategoryId(Number(category.category_id));
        setShopeeCategoryName(category.__pathLabel || getCategoryPathLabel(category) || category.display_category_name || category.original_category_name || '');
        setShopeeCategorySearch('');
        setShopeeCategoryResults([]);
        toast.success('Categoria Shopee selecionada: ' + (category.display_category_name || category.category_id));
    };

    const handleSearchShopeeSimilar = async () => {
        const query = shopeeSimilarSearch.trim() || name.trim();
        if (!query) return;
        setShopeeSimilarLoading(true);
        setShopeeSimilarResults([]);
        try {
            const res = await fetch('/api/shopee-actions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'search_synced_products', query, limit: 8 }),
            });
            const data = await res.json();
            const results = Array.isArray(data?.results) ? data.results : [];
            setShopeeSimilarResults(results);
        } catch (err) {
            toast.error('Erro ao buscar produtos similares na Shopee.');
        } finally {
            setShopeeSimilarLoading(false);
        }
    };

    const handleCopyCategoryFromSimilar = (product: any) => {
        const catId = product.shopee_category_id ? Number(product.shopee_category_id) : null;
        const catName = product.shopee_category_name || '';
        setShopeeCategoryId(catId);
        setShopeeCategoryName(catName);
        toast.success(`Categoria copiada: ${catName || catId}`);
    };

    const handleSave = async () => {
        // Validation
        if (!name.trim()) {
            setError('Nome do modelo é obrigatório');
            setActiveTab('basic');
            return;
        }

        if (!brandId) {
            setError('Marca é obrigatória');
            setActiveTab('basic');
            return;
        }

        if (name.trim().length < 2) {
            setError('Nome deve ter pelo menos 2 caracteres');
            setActiveTab('basic');
            return;
        }

        setSaving(true);
        setError('');

        try {
            // Capture any pending EAN value in the input before saving
            const pendingEan = eanInputRef.current?.value.trim();
            const finalEans = pendingEan && !eans.includes(pendingEan)
                ? [...eans, pendingEan]
                : eans;
            if (pendingEan && eanInputRef.current) {
                eanInputRef.current.value = '';
            }

            const finalTemplateValues = buildFinalTemplateValues();
            const sanitized = getSanitizedTemplateValues(finalTemplateValues);
            const input: ModelInput = {
                name: formatModelNameTitleCase(name).trim(),
                brand_id: brandId,
                active,
                category_id: categoryId || undefined,
                description: description || undefined,
                template_values: Object.keys(sanitized).length > 0 ? sanitized : undefined,
                eans: finalEans.length > 0 ? finalEans : undefined
            };

            const saved = model
                ? await modelService.update(model.id, input)
                : await modelService.create(input);

            await onSave();
            toast.success(`Modelo "${saved.name}" salvo com sucesso.`);
            onClose();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Erro ao salvar modelo';
            setError(message);
            toast.error(message);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 sm:p-6 overflow-hidden">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl h-full flex flex-col animate-in fade-in zoom-in-95 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200">
                    <h2 className="text-xl font-bold text-slate-800">
                        {model ? 'Editar Modelo' : 'Novo Modelo'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200">
                    <button
                        onClick={() => setActiveTab('basic')}
                        className={`flex-1 px-6 py-3 font-medium transition-colors ${activeTab === 'basic'
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-slate-600 hover:text-slate-800'
                            }`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <Settings size={18} />
                            Básico
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('json')}
                        className={`flex-1 px-6 py-3 font-medium transition-colors ${activeTab === 'json'
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-slate-600 hover:text-slate-800'
                            }`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <Braces size={18} />
                            JSON / IA
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('template')}
                        className={`flex-1 px-6 py-3 font-medium transition-colors ${activeTab === 'template'
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-slate-600 hover:text-slate-800'
                            }`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <FileText size={18} />
                            Template
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('seo')}
                        className={`flex-1 px-6 py-3 font-medium transition-colors ${activeTab === 'seo'
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-slate-600 hover:text-slate-800'
                            }`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <Search size={18} />
                            SEO
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('photos')}
                        className={`flex-1 px-6 py-3 font-medium transition-colors ${activeTab === 'photos'
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-slate-600 hover:text-slate-800'
                            }`}
                        disabled={!model}
                        title={!model ? 'Salve o modelo primeiro para gerenciar fotos' : ''}
                    >
                        <div className="flex items-center justify-center gap-2">
                            📸 Fotos por Cor
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('tags')}
                        className={`flex-1 px-6 py-3 font-medium transition-colors ${activeTab === 'tags'
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-slate-600 hover:text-slate-800'
                            }`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            🏷️ Cross-Sell
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('shopee')}
                        className={`flex-1 px-6 py-3 font-medium transition-colors ${activeTab === 'shopee'
                            ? 'text-orange-600 border-b-2 border-orange-500'
                            : 'text-slate-600 hover:text-slate-800'
                            }`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            🛒 Shopee
                            {shopeeCategoryId && (
                                <span className="inline-flex items-center px-1.5 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full font-semibold">
                                    ✓
                                </span>
                            )}
                        </div>
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4 flex-1 overflow-y-auto bg-slate-50/50">
                    {/* Basic Tab */}
                    {activeTab === 'basic' && (
                        <>
                            {/* Buscar do Bling por SKU */}
                            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-4">
                                <label className="block text-sm font-semibold text-blue-900 mb-2">
                                    Preencher Dados via Bling (Opcional)
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Digite o SKU do Bling (Ex: 12345)"
                                        value={blingSkuInput}
                                        onChange={(e) => setBlingSkuInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleFetchBlingDataBySku();
                                            }
                                        }}
                                        className="flex-1 px-3 py-2 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleFetchBlingDataBySku}
                                        disabled={fetchingBlingData || !blingSkuInput.trim()}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                                    >
                                        {fetchingBlingData ? 'Buscando...' : 'Preencher'}
                                    </button>
                                </div>
                                <p className="text-xs text-blue-700 mt-1">
                                    Pesquisa o SKU no Bling e preenche automaticamente a Descrição, Dimensões, Peso e código GTIN/EAN.
                                </p>
                            </div>

                            {/* Brand Select */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Marca <span className="text-red-500">*</span> <span className="text-slate-400 font-mono text-xs">(models.brand_id)</span>
                                </label>
                                {loading ? (
                                    <div className="text-sm text-slate-500">Carregando marcas...</div>
                                ) : (
                                    <>
                                    <div className="relative">
                                        <input
                                            value={brandSearch}
                                            onChange={(e) => handleBrandSearchChange(e.target.value)}
                                            onFocus={() => setBrandDropdownOpen(true)}
                                            onBlur={handleBrandSearchBlur}
                                            placeholder="Digite para buscar a marca"
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                        {brandDropdownOpen && (
                                            <div className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                                                {filteredBrands.length > 0 ? (
                                                    filteredBrands.map((brand) => (
                                                        <button
                                                            key={brand.id}
                                                            type="button"
                                                            onMouseDown={() => handleSelectBrand(brand)}
                                                            className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                                                        >
                                                            {brand.name}
                                                        </button>
                                                    ))
                                                ) : (
                                                    <div className="px-3 py-2 text-sm text-slate-500">
                                                        Nenhuma marca encontrada
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    {brandSearch && !brandId && (
                                        <p className="mt-1 text-xs text-amber-600">
                                            Selecione uma marca cadastrada da lista.
                                        </p>
                                    )}
                                    </>
                                )}
                            </div>

                            {/* Name Input */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Nome do Modelo <span className="text-red-500">*</span> <span className="text-slate-400 font-mono text-xs">(models.name)</span>
                                </label>
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={name}
                                    onChange={(e) => {
                                        const cursorPosition = e.target.selectionStart || 0;
                                        const rawValue = e.target.value;
                                        const formatted = formatModelNameTitleCase(rawValue);
                                        setName(formatted);
                                        setTimeout(() => {
                                            if (inputRef.current) {
                                                inputRef.current.setSelectionRange(cursorPosition, cursorPosition);
                                            }
                                        }, 0);
                                    }}
                                    placeholder="Ex: iPhone 14 Pro Max"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    autoFocus
                                />
                            </div>

                            {/* Categoria Padrao */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Categoria Padrão <span className="text-slate-400 font-mono text-xs">(models.category_id)</span>
                                </label>
                                <CategorySelect
                                    value={categoryId}
                                    onChange={setCategoryId}
                                />
                            </div>

                            {/* Categoria Shopee */}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Categoria Shopee
                                </label>
                                {shopeeCategoryId && (
                                    <div className="flex items-center justify-between gap-3 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg">
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-slate-800 truncate">{shopeeCategoryName || 'Categoria selecionada'}</p>
                                            <p className="text-xs text-slate-500">ID interno: {shopeeCategoryId}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => { setShopeeCategoryId(null); setShopeeCategoryName(''); }}
                                            className="shrink-0 text-xs text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 px-2 py-1 rounded transition-colors"
                                        >
                                            Remover
                                        </button>
                                    </div>
                                )}
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Buscar categoria Shopee pelo nome"
                                        value={shopeeCategorySearch}
                                        onFocus={loadShopeeCategories}
                                        onChange={(e) => handleShopeeCategorySearchChange(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                                    />
                                    {shopeeCategoriesLoading && (
                                        <p className="text-xs text-orange-600 mt-1">Carregando categorias da Shopee...</p>
                                    )}
                                    {shopeeCategoriesError && (
                                        <p className="text-xs text-red-600 mt-1">{shopeeCategoriesError}</p>
                                    )}
                                    {shopeeCategoryResults.length > 0 && (
                                        <div className="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-orange-200 bg-white shadow-lg">
                                            {shopeeCategoryResults.map((category: any) => (
                                                <button
                                                    key={category.category_id}
                                                    type="button"
                                                    onClick={() => selectShopeeCategoryByName(category)}
                                                    className="w-full text-left px-3 py-2 hover:bg-orange-50 border-b border-slate-100 last:border-b-0 transition-colors"
                                                >
                                                    <span className="block text-sm font-medium text-slate-800">{category.display_category_name || category.original_category_name}</span>
                                                    <span className="block text-xs text-slate-500">{category.__pathLabel || category.category_id}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* EAN Codes */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Códigos EAN/GTIN (Referência) <span className="text-slate-400 font-mono text-xs">(models.eans)</span>
                                </label>
                                <div className="space-y-2">
                                    <div className="flex gap-2">
                                        <input
                                            ref={eanInputRef}
                                            type="text"
                                            placeholder="Digite um EAN e pressione Enter"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    handleAddEan(e.currentTarget.value);
                                                }
                                            }}
                                            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleAddEan()}
                                            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold"
                                            title="Adicionar EAN"
                                        >+</button>
                                    </div>
                                    {eans.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {eans.map((ean, index) => (
                                                <span
                                                    key={index}
                                                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm"
                                                >
                                                    {ean}
                                                    <button
                                                        type="button"
                                                        onClick={() => setEans(eans.filter((_, i) => i !== index))}
                                                        className="hover:text-blue-900"
                                                    >
                                                        ×
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    <p className="text-xs text-slate-500">
                                        📷 EANs de referência para identificação rápida via scanner. Cada produto terá seu próprio EAN único.
                                    </p>
                                </div>
                            </div>

                            {/* Active Checkbox */}
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="model-active"
                                    checked={active}
                                    onChange={(e) => setActive(e.target.checked)}
                                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                                />
                                <label htmlFor="model-active" className="text-sm text-slate-700 cursor-pointer">
                                    Modelo Ativo (visível no cadastro de produtos)
                                </label>
                            </div>

                            {/* Has Video Checkbox */}
                            <div className="flex items-center gap-2 mt-4 bg-purple-50 p-3 rounded-lg border border-purple-100">
                                <input
                                    type="checkbox"
                                    id="model-has-video"
                                    checked={templateValues['has_video'] === true}
                                    onChange={(e) => handleTemplateValueChange('has_video', e.target.checked)}
                                    className="w-4 h-4 text-purple-600 border-purple-300 rounded focus:ring-purple-500"
                                />
                                <label htmlFor="model-has-video" className="text-sm text-purple-900 cursor-pointer font-medium">
                                    🎥 Este modelo possui vídeo de demonstração (via SKU) no Synology
                                </label>
                            </div>
                        </>
                    )}

                    {/* JSON Tab */}
                    {activeTab === 'json' && (
                        <div className="space-y-5">
                            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                                <h3 className="font-semibold text-indigo-950 mb-2 flex items-center gap-2">
                                    <Braces size={18} />
                                    Cadastro por JSON
                                </h3>
                                <p className="text-sm text-indigo-800">
                                    Copie o prompt, gere o JSON na IA e cole a resposta para preencher o modelo, SEO, logistica, EANs e campos tecnicos.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                <div className="bg-white border border-slate-200 rounded-lg p-4">
                                    <label className="block text-sm font-semibold text-slate-800 mb-2">
                                        Sites confiaveis para pesquisa
                                    </label>
                                    <textarea
                                        value={trustedSourceLinksText}
                                        onChange={(e) => setTrustedSourceLinksText(e.target.value)}
                                        rows={4}
                                        className="w-full px-3 py-2 text-xs font-mono border border-indigo-200 rounded-lg bg-indigo-50/40 text-slate-800 resize-y focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="Um link por linha. Ex: https://www.gsmarena.com/"
                                    />
                                    <p className="text-xs text-slate-500 mt-1 mb-4">
                                        Coloque um link por linha. A IA pesquisa primeiro nesses sites; se nao encontrar dados reais suficientes, usa pesquisa externa.
                                    </p>

                                    <div className="flex items-center justify-between gap-3 mb-2">
                                        <label className="text-sm font-semibold text-slate-800">
                                            Prompt de cadastro completo
                                        </label>
                                        <button
                                            type="button"
                                            onClick={handleCopyModelPrompt}
                                            className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-xs font-bold"
                                        >
                                            {modelPromptCopied ? 'Copiado!' : 'Copiar prompt'}
                                        </button>
                                    </div>
                                    <textarea
                                        readOnly
                                        value={modelImportPrompt}
                                        rows={18}
                                        className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg bg-slate-50 text-slate-700 resize-none"
                                    />
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={handleGenerateModelJson}
                                            disabled={generatingModelJson || applyingModelPayload || loading}
                                            className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-700 text-white rounded-lg hover:bg-indigo-800 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {generatingModelJson ? 'Pesquisando...' : 'Pesquisar e preencher pelo sistema'}
                                        </button>
                                        <a href="https://gemini.google.com/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm">
                                            <ExternalLink size={15} /> Gemini
                                        </a>
                                        <a href="https://chat.openai.com/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm">
                                            <ExternalLink size={15} /> ChatGPT
                                        </a>
                                    </div>
                                </div>

                                <div className="bg-white border border-slate-200 rounded-lg p-4">
                                    <label className="block text-sm font-semibold text-slate-800 mb-2">
                                        Colar JSON retornado
                                    </label>
                                    <textarea
                                        value={modelJsonInput}
                                        onChange={(e) => setModelJsonInput(e.target.value)}
                                        rows={18}
                                        className="w-full px-3 py-2 text-xs font-mono border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white resize-none"
                                        placeholder='{"name":"Redmi A7 Pro","brand":"Xiaomi","category":"Smartphones","template_values":{"versao":"Global","battery_mah":5000}}'
                                    />
                                    <button
                                        type="button"
                                        onClick={handleApplyModelJson}
                                        disabled={!modelJsonInput.trim() || applyingModelPayload || generatingModelJson}
                                        className="mt-3 w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {applyingModelPayload ? 'Aplicando...' : 'Preencher modelo pelo JSON'}
                                    </button>
                                    <p className="text-xs text-slate-500 mt-2">
                                        Campos desconhecidos dentro de template_values, specs, custom_fields ou campos serao preservados como valores padrao do modelo.
                                    </p>
                                </div>
                            </div>

                            <div className="bg-white border border-slate-200 rounded-lg p-4">
                                <div className="flex items-center justify-between gap-3 mb-4">
                                    <div>
                                        <h4 className="font-semibold text-slate-900">Revisar e editar antes de salvar</h4>
                                        <p className="text-xs text-slate-500">
                                            Tudo abaixo pode ser ajustado manualmente depois de aplicar o JSON.
                                        </p>
                                    </div>
                                    <span className="text-xs px-2 py-1 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                                        {eans.length} EAN{eans.length === 1 ? '' : 's'}
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">
                                            Marca
                                        </label>
                                        <div className="relative">
                                            <input
                                                value={brandSearch}
                                                onChange={(e) => handleBrandSearchChange(e.target.value)}
                                                onFocus={() => setBrandDropdownOpen(true)}
                                                onBlur={handleBrandSearchBlur}
                                                placeholder="Digite para buscar a marca"
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                            {brandDropdownOpen && (
                                                <div className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                                                    {filteredBrands.length > 0 ? (
                                                        filteredBrands.map((brand) => (
                                                            <button
                                                                key={brand.id}
                                                                type="button"
                                                                onMouseDown={() => handleSelectBrand(brand)}
                                                                className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
                                                            >
                                                                {brand.name}
                                                            </button>
                                                        ))
                                                    ) : (
                                                        <div className="px-3 py-2 text-sm text-slate-500">
                                                            Nenhuma marca encontrada
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        {brandSearch && !brandId && (
                                            <p className="mt-1 text-xs text-amber-600">
                                                Selecione uma marca cadastrada da lista.
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">
                                            Nome do Modelo
                                        </label>
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(formatModelNameTitleCase(e.target.value))}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            placeholder="Ex: Redmi A7 Pro"
                                        />
                                    </div>

                                    <div className="lg:col-span-2">
                                        <label className="block text-xs font-medium text-slate-600 mb-1">
                                            Categoria Padrao
                                        </label>
                                        <CategorySelect
                                            value={categoryId}
                                            onChange={setCategoryId}
                                        />
                                    </div>

                                    <div className="lg:col-span-2 space-y-2">
                                        <label className="block text-xs font-medium text-slate-600 mb-1">
                                            Categoria Shopee
                                        </label>
                                        {shopeeCategoryId && (
                                            <div className="flex items-center justify-between gap-3 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-slate-800 truncate">{shopeeCategoryName || 'Categoria selecionada'}</p>
                                                    <p className="text-xs text-slate-500">ID interno: {shopeeCategoryId}</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => { setShopeeCategoryId(null); setShopeeCategoryName(''); }}
                                                    className="shrink-0 text-xs text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 px-2 py-1 rounded transition-colors"
                                                >
                                                    Remover
                                                </button>
                                            </div>
                                        )}
                                        <div className="relative">
                                            <input
                                                type="text"
                                                placeholder="Buscar categoria Shopee pelo nome"
                                                value={shopeeCategorySearch}
                                                onFocus={loadShopeeCategories}
                                                onChange={(e) => handleShopeeCategorySearchChange(e.target.value)}
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                                            />
                                            {shopeeCategoriesLoading && (
                                                <p className="text-xs text-orange-600 mt-1">Carregando categorias da Shopee...</p>
                                            )}
                                            {shopeeCategoriesError && (
                                                <p className="text-xs text-red-600 mt-1">{shopeeCategoriesError}</p>
                                            )}
                                            {shopeeCategoryResults.length > 0 && (
                                                <div className="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-orange-200 bg-white shadow-lg">
                                                    {shopeeCategoryResults.map((category: any) => (
                                                        <button
                                                            key={category.category_id}
                                                            type="button"
                                                            onClick={() => selectShopeeCategoryByName(category)}
                                                            className="w-full text-left px-3 py-2 hover:bg-orange-50 border-b border-slate-100 last:border-b-0 transition-colors"
                                                        >
                                                            <span className="block text-sm font-medium text-slate-800">{category.display_category_name || category.original_category_name}</span>
                                                            <span className="block text-xs text-slate-500">{category.__pathLabel || category.category_id}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="lg:col-span-2">
                                        <label className="block text-xs font-medium text-slate-600 mb-1">
                                            EANs de referencia
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                ref={eanInputRef}
                                                type="text"
                                                placeholder="Digite um EAN e pressione Enter"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        handleAddEan(e.currentTarget.value);
                                                    }
                                                }}
                                                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleAddEan()}
                                                className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-bold"
                                                title="Adicionar EAN"
                                            >
                                                +
                                            </button>
                                        </div>
                                        {eans.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {eans.map((ean, index) => (
                                                    <span
                                                        key={`${ean}-${index}`}
                                                        className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-sm border border-indigo-100"
                                                    >
                                                        {ean}
                                                        <button
                                                            type="button"
                                                            onClick={() => setEans(eans.filter((_, i) => i !== index))}
                                                            className="hover:text-indigo-950"
                                                        >
                                                            x
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="lg:col-span-2">
                                        <label className="block text-xs font-medium text-slate-600 mb-1">
                                            Descricao Padrao
                                        </label>
                                        <textarea
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            rows={4}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                                            placeholder="Descricao comercial do modelo"
                                        />
                                    </div>

                                    <div className="lg:col-span-2">
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                            <label className="block text-xs font-medium text-slate-600">
                                                Brindes
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => handleTemplateValueChange('brindes', SMARTPHONE_DEFAULT_GIFTS)}
                                                className="text-xs px-2 py-1 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100"
                                            >
                                                Usar lista padrão
                                            </button>
                                        </div>
                                        <textarea
                                            value={templateValues['brindes'] || ''}
                                            onChange={(e) => handleTemplateValueChange('brindes', e.target.value)}
                                            rows={3}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                                            placeholder={SMARTPHONE_DEFAULT_GIFTS}
                                        />
                                        <p className="mt-1 text-xs text-slate-500">
                                            Um item por linha. Aparece na pagina publica como lista.
                                        </p>
                                    </div>
                                </div>

                                <div className="border-t border-slate-200 pt-4 mt-4">
                                    <h5 className="text-sm font-semibold text-slate-800 mb-3">Campos tecnicos editaveis</h5>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {visibleSpecFields.map((field) => renderTemplateField(field))}
                                        {shopeeAttributeFields.map((attr) => renderShopeeAttributeField(attr))}
                                    </div>
                                    {shopeeAttributesLoading && (
                                        <p className="mt-3 text-xs text-orange-700">Buscando atributos da categoria Shopee...</p>
                                    )}
                                    {shopeeAttributesError && (
                                        <p className="mt-3 text-xs text-red-600">{shopeeAttributesError}</p>
                                    )}
                                    {categoryId && categoryConfig && visibleSpecFields.length === 0 && shopeeAttributeFields.length === 0 && (
                                        <div className="text-center py-6 text-slate-500">
                                            <p className="text-sm">Nenhum campo tecnico configurado para esta categoria</p>
                                        </div>
                                    )}
                                </div>

                                <div className="border-t border-slate-200 pt-4 mt-4">
                                    <h5 className="text-sm font-semibold text-slate-800 mb-3">Logistica editavel</h5>
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 mb-1">Peso (kg)</label>
                                            <input
                                                type="number"
                                                step="0.001"
                                                value={templateValues['weight_kg'] || ''}
                                                onChange={(e) => handleTemplateValueChange('weight_kg', e.target.value ? parseFloat(e.target.value) : undefined)}
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 mb-1">Largura (cm)</label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={templateValues['dimensions.width_cm'] || ''}
                                                onChange={(e) => handleTemplateValueChange('dimensions.width_cm', e.target.value ? parseFloat(e.target.value) : undefined)}
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 mb-1">Altura (cm)</label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={templateValues['dimensions.height_cm'] || ''}
                                                onChange={(e) => handleTemplateValueChange('dimensions.height_cm', e.target.value ? parseFloat(e.target.value) : undefined)}
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 mb-1">Profundidade (cm)</label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={templateValues['dimensions.depth_cm'] || ''}
                                                onChange={(e) => handleTemplateValueChange('dimensions.depth_cm', e.target.value ? parseFloat(e.target.value) : undefined)}
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Template Tab */}
                    {activeTab === 'template' && (
                        <>
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                                <p className="text-sm text-blue-900">
                                    📋 <strong>Template de Modelo</strong> <span className="text-slate-500 font-mono text-xs">(models.template_values)</span>: Configure valores padrão que serão preenchidos automaticamente ao cadastrar produtos deste modelo.
                                </p>
                                <p className="text-xs text-blue-700 mt-1">
                                    Campos únicos (Cor, IMEI, Serial, EAN, SKU) não são preenchidos automaticamente.
                                </p>
                            </div>

                            {/* Category */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Categoria Padrão
                                </label>
                                <CategorySelect
                                    value={categoryId}
                                    onChange={setCategoryId}
                                />
                            </div>

                            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <h4 className="font-semibold text-indigo-950">Prompt dinamico para IA</h4>
                                        <p className="text-xs text-indigo-700 mt-1">
                                            Gerado com a marca, categoria e apenas os campos ativos deste template.
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowModelPrompt(prev => !prev)}
                                            className="px-3 py-1.5 bg-white text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors text-xs font-bold"
                                        >
                                            {showModelPrompt ? 'Ocultar prompt' : 'Ver prompt'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleCopyModelPrompt}
                                            className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-xs font-bold"
                                        >
                                            {modelPromptCopied ? 'Copiado!' : 'Copiar para IA'}
                                        </button>
                                    </div>
                                </div>
                                {showModelPrompt && (
                                    <textarea
                                        readOnly
                                        value={modelImportPrompt}
                                        rows={10}
                                        className="mt-3 w-full px-3 py-2 text-xs font-mono border border-indigo-200 rounded-lg bg-white text-slate-700 resize-y"
                                    />
                                )}
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Descrição Padrão
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(e) => {
                                        setDescription(e.target.value);
                                        e.target.style.height = 'auto';
                                        e.target.style.height = `${e.target.scrollHeight}px`;
                                    }}
                                    onFocus={(e) => {
                                        e.target.style.height = 'auto';
                                        e.target.style.height = `${e.target.scrollHeight}px`;
                                    }}
                                    placeholder="Ex: Smartphone Apple com tela de 6.1 polegadas..."
                                    rows={3}
                                    style={{ minHeight: '80px' }}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 overflow-hidden resize-none"
                                />
                            </div>

                            <div>
                                <div className="flex items-center justify-between gap-2 mb-2">
                                    <label className="block text-sm font-medium text-slate-700">
                                        Brindes
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => handleTemplateValueChange('brindes', SMARTPHONE_DEFAULT_GIFTS)}
                                        className="text-xs px-2 py-1 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100"
                                    >
                                        Usar lista padrão
                                    </button>
                                </div>
                                <textarea
                                    value={templateValues['brindes'] || ''}
                                    onChange={(e) => handleTemplateValueChange('brindes', e.target.value)}
                                    rows={3}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                                    placeholder={SMARTPHONE_DEFAULT_GIFTS}
                                />
                                <p className="text-xs text-slate-500 mt-1">
                                    Salvo em models.template_values.brindes e exibido como lista na pagina do produto.
                                </p>
                            </div>

                            {/* Dynamic Fields */}
                            <div className="border-t border-slate-200 pt-4">
                                <h4 className="font-medium text-slate-800 mb-3">Valores Padrão</h4>

                                {/* Category Info */}
                                {categoryId && categoryConfig && (
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                                        <p className="text-xs text-blue-800">
                                            📋 Mostrando apenas campos configurados para a categoria selecionada
                                        </p>
                                    </div>
                                )}

                                {/* Spec Fields */}
                                <div className="grid grid-cols-2 gap-4">
                                    {visibleSpecFields.map((field) => renderTemplateField(field))}
                                </div>

                                {/* No fields message */}
                                {categoryId && categoryConfig && visibleSpecFields.length === 0 && (
                                        <div className="text-center py-8 text-slate-500">
                                            <p className="text-sm">Nenhum campo de especificação configurado para esta categoria</p>
                                        </div>
                                    )}
                            </div>

                            {/* Logistics Fields */}
                            <div className="border-t border-slate-200 pt-4 mt-4">
                                <h4 className="font-medium text-slate-800 mb-3">Logística Padrão</h4>

                                {/* Info box with postal limits */}
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm mb-4">
                                    <p className="font-medium text-blue-900 mb-1">📦 Limites dos Correios</p>
                                    <p className="text-blue-700 text-xs">
                                        Peso: até 30kg • Dimensões: 16-105cm (C), até 105cm (L+A), até 200cm (C+L+A)
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">
                                            Peso (kg)
                                        </label>
                                        <input
                                            type="number"
                                            step="0.001"
                                            value={templateValues['weight_kg'] || ''}
                                            onChange={(e) => handleTemplateValueChange('weight_kg', e.target.value ? parseFloat(e.target.value) : undefined)}
                                            placeholder="0.000"
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                        <p className="text-xs text-slate-500 mt-1">
                                            Ex: 0.250 (250g)
                                        </p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">
                                            Largura (cm)
                                        </label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={templateValues['dimensions.width_cm'] || ''}
                                            onChange={(e) => handleTemplateValueChange('dimensions.width_cm', e.target.value ? parseFloat(e.target.value) : undefined)}
                                            placeholder="0.0"
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">
                                            Altura (cm)
                                        </label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={templateValues['dimensions.height_cm'] || ''}
                                            onChange={(e) => handleTemplateValueChange('dimensions.height_cm', e.target.value ? parseFloat(e.target.value) : undefined)}
                                            placeholder="0.0"
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">
                                            Profundidade (cm)
                                        </label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={templateValues['dimensions.depth_cm'] || ''}
                                            onChange={(e) => handleTemplateValueChange('dimensions.depth_cm', e.target.value ? parseFloat(e.target.value) : undefined)}
                                            placeholder="0.0"
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* SEO Tab */}
                    {activeTab === 'seo' && (
                        <div className="space-y-4">
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                                <p className="text-sm text-blue-900">
                                    🔍 <strong>SEO (Otimização de Buscas)</strong>: Configure as tags padrão para todos os produtos deste modelo.
                                </p>
                            </div>

                            {/* Seção de Ajuda com Links para IAs */}
                            <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-lg p-4 mb-6">
                                <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                                    <ExternalLink size={18} />
                                    💡 Gerar Conteúdo SEO com IA
                                </h4>
                                <p className="text-sm text-blue-700 mb-3">
                                    Use uma das ferramentas abaixo para gerar conteúdo SEO otimizado. Copie o prompt e cole na IA escolhida.
                                </p>

                                {/* Campo de Prompt Editável */}
                                <div className="mb-3">
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="text-xs font-medium text-blue-900">
                                            Prompt para IA (editável)
                                        </label>
                                        <button
                                            type="button"
                                            onClick={handleCopyPrompt}
                                            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-1"
                                        >
                                            {promptCopied ? '✓ Copiado!' : '📋 Copiar Prompt'}
                                        </button>
                                    </div>
                                    <textarea
                                        value={aiPrompt}
                                        onChange={(e) => setAiPrompt(e.target.value)}
                                        rows={12}
                                        className="w-full px-3 py-2 text-xs font-mono border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-white"
                                        placeholder="Edite o prompt conforme necessário..."
                                    />
                                    <p className="text-xs text-blue-600 mt-1">
                                        💡 Dica: O prompt é atualizado automaticamente quando você preenche Nome, Marca e Categoria.
                                    </p>
                                </div>

                                {/* Botões de Links para IAs */}
                                <div className="flex flex-wrap gap-2">
                                    <a
                                        href="https://gemini.google.com/"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                                    >
                                        <ExternalLink size={16} /> Abrir Gemini
                                    </a>
                                    <a
                                        href="https://www.perplexity.ai/"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium text-sm"
                                    >
                                        <ExternalLink size={16} /> Abrir Perplexity
                                    </a>
                                    <a
                                        href="https://x.com/i/grok"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors font-medium text-sm"
                                    >
                                        <ExternalLink size={16} /> Abrir Grok
                                    </a>
                                    <a
                                        href="https://chat.openai.com/"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm"
                                    >
                                        <ExternalLink size={16} /> Abrir ChatGPT
                                    </a>
                                </div>

                                {/* Campo de Cola do JSON */}
                                <div className="mt-4 pt-4 border-t border-blue-200">
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-sm font-semibold text-blue-900">
                                            Colar Resposta da IA (JSON)
                                        </label>
                                    </div>
                                    <div className="flex flex-col gap-2 relative">
                                        <textarea
                                            value={jsonInput}
                                            onChange={(e) => setJsonInput(e.target.value)}
                                            rows={4}
                                            className="w-full px-3 py-2 text-xs font-mono border-2 border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white"
                                            placeholder='Ex: { "description": "...", "slug": "...", "meta_title": "..." }'
                                        />
                                        <button
                                            type="button"
                                            onClick={handleApplyJson}
                                            disabled={!jsonInput.trim() || applyingModelPayload}
                                            className="self-end px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-colors shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            {applyingModelPayload ? 'Aplicando...' : 'Preencher Campos Automaticamente ✨'}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    URL Amigável Padrão (Slug)
                                </label>
                                <input
                                    type="text"
                                    value={templateValues['slug'] || ''}
                                    onChange={(e) => handleTemplateValueChange('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Ex: iphone-14-pro"
                                />
                                <p className="text-xs text-slate-500 mt-1">Os produtos herdarão esse slug. Dica: deixe vazio para o Auto-Gerador criar único por variação.</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Título SEO
                                </label>
                                <input
                                    type="text"
                                    value={templateValues['meta_title'] || ''}
                                    onChange={(e) => handleTemplateValueChange('meta_title', e.target.value)}
                                    maxLength={60}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Máx 60 caracteres"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Meta Descrição
                                </label>
                                <textarea
                                    value={templateValues['meta_description'] || ''}
                                    onChange={(e) => handleTemplateValueChange('meta_description', e.target.value)}
                                    maxLength={160}
                                    rows={3}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                    placeholder="Descrição curta (Máx 160 caracteres)"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Palavras-chave (Keywords)
                                </label>
                                <input
                                    type="text"
                                    value={templateValues['keywords'] ? templateValues['keywords'].join(', ') : ''}
                                    onChange={(e) => {
                                        const values = e.target.value.split(',').map(k => k.trim()).filter(k => k);
                                        handleTemplateValueChange('keywords', values);
                                    }}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="palavra1, palavra2, smartphone..."
                                />
                            </div>
                        </div>
                    )}

                    {/* Photos Tab */}
                    {activeTab === 'photos' && model && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                            <div className="flex items-center gap-2 mb-2">
                                <p className="text-sm text-blue-900 font-medium">
                                    📸 <strong>Fotos por Cor</strong>
                                </p>
                                <span className="text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded font-mono">
                                    {model.name}
                                </span>
                            </div>
                            <p className="text-xs text-blue-700 mb-2">
                                • Estas fotos serão usadas automaticamente em todos os produtos novos<br />
                                • Produtos usados podem ter fotos customizadas
                            </p>
                            <div className="bg-green-50 border border-green-300 rounded p-2 mt-2">
                                <p className="text-xs text-green-800">
                                    ✅ <strong>As fotos são salvas automaticamente!</strong> Você pode cadastrar várias cores sem fechar este modal. Basta selecionar outra cor no dropdown e fazer upload.
                                </p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'photos' && model && (
                        <ColorImageManager modelId={model.id} />
                    )}

                    {/* Tags Tab */}
                    {activeTab === 'tags' && (
                        <div className="space-y-4">
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                                <p className="text-sm text-blue-900">
                                    🏷️ <strong>Tags de Venda Cruzada (Cross-Sell)</strong> <span className="text-slate-500 font-mono text-xs">(tags_venda)</span>.<br/>
                                    Estas tags forçam o sistema a conectar produtos de categorias diferentes na vitrine "Aproveite e leve junto".
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Adicionar Novas Tags
                                </label>
                                <div className="space-y-2">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder="Ex: Gamer, Type-C, Viagem (pressione Enter)"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    const input = e.currentTarget;
                                                    const value = input.value.trim();
                                                    if (value) {
                                                        const currentTags = templateValues['tags_venda'] || [];
                                                        if (!currentTags.includes(value)) {
                                                            handleTemplateValueChange('tags_venda', [...currentTags, value]);
                                                        }
                                                        input.value = '';
                                                    }
                                                }
                                            }}
                                            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <p className="text-xs text-slate-500">
                                        Digite uma tag e pressione Enter para adicionar.
                                    </p>
                                </div>
                            </div>

                            <div className="pt-2">
                                <h4 className="text-sm font-medium text-slate-700 mb-2">Tags Ativas no Modelo:</h4>
                                <div className="flex flex-wrap gap-2 min-h-[40px] p-4 bg-slate-50 rounded-lg border border-slate-200">
                                    {!(templateValues['tags_venda']?.length > 0) && (
                                        <span className="text-sm text-slate-400 italic">Nenhuma tag cadastrada.</span>
                                    )}
                                    {templateValues['tags_venda']?.map((tag: string, index: number) => (
                                        <span
                                            key={index}
                                            className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium"
                                        >
                                            {tag}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const newTags = templateValues['tags_venda'].filter((_: any, i: number) => i !== index);
                                                    handleTemplateValueChange('tags_venda', newTags);
                                                }}
                                                className="hover:text-blue-900 ml-1"
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {officialTags?.length > 0 && (
                                <div className="pt-4 border-t border-slate-200">
                                    <h4 className="text-sm font-medium text-indigo-800 mb-2 mt-2 flex items-center gap-2">
                                        <Tags size={16}/> Tags Oficiais Dicionário:
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                        {officialTags
                                            .filter(tag => !(templateValues['tags_venda'] || []).includes(tag.name))
                                            .map((tag) => (
                                            <button
                                                key={tag.id}
                                                type="button"
                                                className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium transition-colors border border-indigo-200"
                                                onClick={() => {
                                                    const currentTags = templateValues['tags_venda'] || [];
                                                    handleTemplateValueChange('tags_venda', [...currentTags, tag.name]);
                                                }}
                                                title="Adicionar esta Tag Oficial de Cross-Sell"
                                            >
                                                + {tag.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="pt-4 border-t border-slate-200">
                                <h4 className="text-sm font-medium text-slate-700 mb-2 mt-2">Sugestões Dinâmicas (Ficha Técnica):</h4>
                                <div className="space-y-3">
                                    {/* Sugestões do Sistema Fixo */}
                                    <div className="flex flex-col gap-1">
                                        <span className="text-xs text-slate-500 font-semibold uppercase">Dados Básicos</span>
                                        <div className="flex flex-wrap gap-2">
                                            {name && (
                                                <>
                                                    <button type="button" onClick={() => handleTemplateValueChange('tags_venda', [...(templateValues['tags_venda'] || []), name])} className={`px-2 py-1 text-xs font-medium rounded border ${ (templateValues['tags_venda'] || []).includes(name) ? 'bg-slate-200 text-slate-400 border-slate-200 opacity-50 cursor-not-allowed' : 'bg-white text-slate-600 border-slate-300 hover:border-blue-500 hover:text-blue-600' }`} disabled={(templateValues['tags_venda'] || []).includes(name)}>+ {name}</button>
                                                    <button type="button" onClick={() => handleTemplateValueChange('tags_venda', [...(templateValues['tags_venda'] || []), `Modelo: ${name}`])} className={`px-2 py-1 text-xs font-medium rounded border ${ (templateValues['tags_venda'] || []).includes(`Modelo: ${name}`) ? 'bg-slate-200 text-slate-400 border-slate-200 opacity-50 cursor-not-allowed' : 'bg-white text-slate-600 border-slate-300 hover:border-blue-500 hover:text-blue-600' }`} disabled={(templateValues['tags_venda'] || []).includes(`Modelo: ${name}`)}>+ Modelo: {name}</button>
                                                </>
                                            )}
                                            {brandId && brands.find(b => b.id === brandId) && (
                                                <>
                                                    <button type="button" onClick={() => handleTemplateValueChange('tags_venda', [...(templateValues['tags_venda'] || []), brands.find(b => b.id === brandId)!.name])} className={`px-2 py-1 text-xs font-medium rounded border ${ (templateValues['tags_venda'] || []).includes(brands.find(b => b.id === brandId)!.name) ? 'bg-slate-200 text-slate-400 border-slate-200 opacity-50 cursor-not-allowed' : 'bg-white text-slate-600 border-slate-300 hover:border-blue-500 hover:text-blue-600' }`} disabled={(templateValues['tags_venda'] || []).includes(brands.find(b => b.id === brandId)!.name)}>+ {brands.find(b => b.id === brandId)!.name}</button>
                                                    <button type="button" onClick={() => handleTemplateValueChange('tags_venda', [...(templateValues['tags_venda'] || []), `Marca: ${brands.find(b => b.id === brandId)!.name}`])} className={`px-2 py-1 text-xs font-medium rounded border ${ (templateValues['tags_venda'] || []).includes(`Marca: ${brands.find(b => b.id === brandId)!.name}`) ? 'bg-slate-200 text-slate-400 border-slate-200 opacity-50 cursor-not-allowed' : 'bg-white text-slate-600 border-slate-300 hover:border-blue-500 hover:text-blue-600' }`} disabled={(templateValues['tags_venda'] || []).includes(`Marca: ${brands.find(b => b.id === brandId)!.name}`)}>+ Marca: {brands.find(b => b.id === brandId)!.name}</button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Sugestões de Campos Customizados */}
                                    {customFields.filter(field => !isModelUnitFieldKey(field.key) && !isModelUnitFieldKey(field.label)).map(field => {
                                        const rawValue = templateValues[field.key];
                                        if (rawValue === undefined || rawValue === null || rawValue === '') return null;
                                        const values = Array.isArray(rawValue) ? rawValue : [String(rawValue)];

                                        return (
                                            <div key={field.key} className="flex flex-col gap-1">
                                                <span className="text-xs text-slate-500 font-semibold uppercase">{field.label}</span>
                                                <div className="flex flex-wrap gap-2">
                                                    {values.map(val => {
                                                        const cleanVal = String(val).trim();
                                                        if (cleanVal.length === 0) return null;
                                                        const formattedVal = `${field.label}: ${cleanVal}`;
                                                        const activeTags = templateValues['tags_venda'] || [];

                                                        return (
                                                            <React.Fragment key={cleanVal}>
                                                                <button
                                                                    type="button"
                                                                    disabled={activeTags.includes(cleanVal)}
                                                                    onClick={() => handleTemplateValueChange('tags_venda', [...activeTags, cleanVal])}
                                                                    className={`px-2 py-1 text-xs font-medium rounded border ${
                                                                        activeTags.includes(cleanVal)
                                                                            ? 'bg-slate-200 text-slate-400 border-slate-200 opacity-50 cursor-not-allowed'
                                                                            : 'bg-white text-slate-600 border-slate-300 hover:border-blue-500 hover:text-blue-600'
                                                                    }`}
                                                                >
                                                                    + {cleanVal}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    disabled={activeTags.includes(formattedVal)}
                                                                    onClick={() => {
                                                                        const latestTags = templateValues['tags_venda'] || [];
                                                                        handleTemplateValueChange('tags_venda', [...latestTags, formattedVal]);
                                                                    }}
                                                                    className={`px-2 py-1 text-xs font-medium rounded border ${
                                                                        activeTags.includes(formattedVal)
                                                                            ? 'bg-slate-200 text-slate-400 border-slate-200 opacity-50 cursor-not-allowed'
                                                                            : 'bg-white text-slate-600 border-slate-300 hover:border-blue-500 hover:text-blue-600'
                                                                    }`}
                                                                >
                                                                    + {formattedVal}
                                                                </button>
                                                            </React.Fragment>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Shopee Tab */}
                    {activeTab === 'shopee' && (
                        <div className="space-y-6">
                            {/* Info Banner */}
                            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                                <p className="text-sm text-orange-900">
                                    🛒 <strong>Configuração Shopee do Modelo</strong><br />
                                    Defina a categoria da Shopee e os atributos padrão. Esses dados serão usados no envio automático em lote de todas as variações deste modelo.
                                </p>
                            </div>

                            {/* Auto Publish Lock Toggle */}
                            <div className="bg-white border border-slate-200 rounded-lg p-5">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <h4 className="text-sm font-semibold text-slate-800">🔒 Trava de Envio Automático em Lote</h4>
                                        <p className="text-xs text-slate-500 mt-1">
                                            Quando <strong>ativado</strong>, as variações deste modelo ficam liberadas para o envio automático em lote para a Shopee.
                                            Quando <strong>desativado</strong>, as variações são sempre classificadas como <em>"Precisam de revisão"</em>.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShopeeAutoPublishEnabled(prev => !prev)}
                                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-400 ${
                                            shopeeAutoPublishEnabled ? 'bg-orange-500' : 'bg-slate-300'
                                        }`}
                                        title={shopeeAutoPublishEnabled ? 'Desativar envio automático' : 'Ativar envio automático'}
                                    >
                                        <span
                                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                                                shopeeAutoPublishEnabled ? 'translate-x-6' : 'translate-x-1'
                                            }`}
                                        />
                                    </button>
                                </div>
                                <p className={`mt-2 text-xs font-medium ${shopeeAutoPublishEnabled ? 'text-orange-600' : 'text-slate-400'}`}>
                                    {shopeeAutoPublishEnabled
                                        ? '✅ Envio automático ATIVADO para este modelo'
                                        : '⛔ Envio automático DESATIVADO – variações serão marcadas para revisão'}
                                </p>
                            </div>

                            {/* Category Section */}
                            <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
                                <h4 className="text-sm font-semibold text-slate-800">📂 Categoria Shopee</h4>

                                {shopeeCategoryId ? (
                                    <div className="flex items-center justify-between gap-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                                        <div>
                                            <span className="text-xs text-orange-500 font-semibold uppercase">Categoria Atual</span>
                                            <p className="text-sm font-medium text-slate-800">{shopeeCategoryName || `ID: ${shopeeCategoryId}`}</p>
                                            <p className="text-xs text-slate-500">ID: {shopeeCategoryId}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => { setShopeeCategoryId(null); setShopeeCategoryName(''); }}
                                            className="text-xs text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 px-2 py-1 rounded transition-colors"
                                        >
                                            Remover
                                        </button>
                                    </div>
                                ) : (
                                    <div className="p-3 bg-slate-50 border border-dashed border-slate-300 rounded-lg text-sm text-slate-500 text-center">
                                        Nenhuma categoria Shopee definida
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Buscar Categoria Shopee pelo nome</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="Ex: Fontes, Cabos USB, Capas de Celular"
                                            value={shopeeCategorySearch}
                                            onFocus={loadShopeeCategories}
                                            onChange={(e) => handleShopeeCategorySearchChange(e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                                        />
                                        {shopeeCategoryResults.length > 0 && (
                                            <div className="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-orange-200 bg-white shadow-lg">
                                                {shopeeCategoryResults.map((category: any) => (
                                                    <button
                                                        key={'shopee-tab-' + category.category_id}
                                                        type="button"
                                                        onClick={() => selectShopeeCategoryByName(category)}
                                                        className="w-full text-left px-3 py-2 hover:bg-orange-50 border-b border-slate-100 last:border-b-0 transition-colors"
                                                    >
                                                        <span className="block text-sm font-medium text-slate-800">{category.display_category_name || category.original_category_name}</span>
                                                        <span className="block text-xs text-slate-500">{category.__pathLabel || category.category_id}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    {shopeeCategoriesLoading && <p className="text-xs text-orange-600">Carregando categorias da Shopee...</p>}
                                    {shopeeCategoriesError && <p className="text-xs text-red-600">{shopeeCategoriesError}</p>}
                                </div>

                                <div className="border-t border-slate-100 pt-4">
                                    <p className="text-xs font-semibold text-slate-600 mb-2">🔍 Copiar Categoria de Produto Similar (já sincronizado)</p>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder={name || 'Buscar produto similar na Shopee...'}
                                            value={shopeeSimilarSearch}
                                            onChange={(e) => setShopeeSimilarSearch(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearchShopeeSimilar(); } }}
                                            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleSearchShopeeSimilar}
                                            disabled={shopeeSimilarLoading}
                                            className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-60"
                                        >
                                            {shopeeSimilarLoading ? 'Buscando...' : 'Buscar'}
                                        </button>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1">Busca produtos locais já enviados à Shopee para copiar a categoria correta.</p>

                                    {shopeeSimilarResults.length > 0 && (
                                        <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
                                            {shopeeSimilarResults.map((product: any, idx: number) => (
                                                <div
                                                    key={product.id || idx}
                                                    className="flex items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg hover:border-orange-300 transition-colors"
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-slate-800 truncate">{product.name || product.sku || `Produto ${idx + 1}`}</p>
                                                        <p className="text-xs text-slate-500">
                                                            {product.shopee_category_name || 'Categoria desconhecida'}
                                                            {product.shopee_category_id && ` (ID: ${product.shopee_category_id})`}
                                                        </p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopyCategoryFromSimilar(product)}
                                                        disabled={!product.shopee_category_id}
                                                        className="shrink-0 px-3 py-1.5 bg-orange-100 text-orange-700 hover:bg-orange-200 text-xs font-medium rounded-lg transition-colors disabled:opacity-40"
                                                    >
                                                        Copiar Categoria
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {shopeeSimilarResults.length === 0 && !shopeeSimilarLoading && shopeeSimilarSearch && (
                                        <p className="text-xs text-slate-400 mt-2 italic">Nenhum produto similar com categoria Shopee encontrado.</p>
                                    )}
                                </div>
                            </div>

                            {/* Attribute Defaults */}
                            <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="text-sm font-semibold text-slate-800">⚙️ Atributos Padrão da Categoria</h4>
                                        <p className="text-xs text-slate-500 mt-1">
                                            JSON com os atributos obrigatórios da categoria Shopee. Formato: <code className="bg-slate-100 px-1 rounded">{'{"attribute_id": "valor"}'}</code>.
                                            Esses valores serão usados no envio do produto.
                                        </p>
                                    </div>
                                    {shopeeCategoryId && (
                                        <button
                                            type="button"
                                            onClick={handleReloadShopeeAttributes}
                                            disabled={shopeeAttributesLoading}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 disabled:opacity-50 transition-colors"
                                            title="Recarregar atributos da categoria"
                                        >
                                            {shopeeAttributesLoading ? (
                                                <>
                                                    <span className="animate-spin">⏳</span> Buscando...
                                                </>
                                            ) : (
                                                <>🔄 Recarregar</>
                                            )}
                                        </button>
                                    )}
                                </div>

                                {/* Loading state */}
                                {shopeeAttributesLoading && (
                                    <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                        <span className="animate-spin text-blue-500">⏳</span>
                                        <span className="text-xs text-blue-700 font-medium">Buscando atributos da categoria {shopeeCategoryId}...</span>
                                    </div>
                                )}

                                {/* Error from API */}
                                {shopeeAttributesError && (
                                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                        <p className="text-xs text-red-700 font-medium">Erro ao buscar atributos</p>
                                        <p className="text-xs text-red-600 mt-0.5">{shopeeAttributesError}</p>
                                    </div>
                                )}

                                {/* Attribute summary badges */}
                                {shopeeAttributeFields.length > 0 && !shopeeAttributesLoading && (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-3 text-xs">
                                            <span className="text-slate-500">{shopeeAttributeFields.length} atributos na categoria</span>
                                            {shopeeAttributeFields.filter(a => a.mandatory).length > 0 && (
                                                <span className="text-orange-600 font-semibold">
                                                    {shopeeAttributeFields.filter(a => a.mandatory).length} obrigatórios
                                                </span>
                                            )}
                                            {Object.keys(shopeeAttributeDefaults).length > 0 && (
                                                <span className="text-green-600 font-semibold">
                                                    {Object.entries(shopeeAttributeDefaults).filter(([, v]) => String(v).trim()).length} preenchidos
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {shopeeAttributeFields.map((attr) => {
                                                const attrId = String(attr.attribute_id);
                                                const val = shopeeAttributeDefaults[attrId];
                                                const hasVal = typeof val === 'string' && val.trim().length > 0;
                                                const mandatory = attr.mandatory;
                                                const bgClass = mandatory
                                                    ? hasVal ? 'bg-green-50 border-green-200 text-green-700' : 'bg-orange-50 border-orange-200 text-orange-700'
                                                    : hasVal ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-500';
                                                return (
                                                    <span key={attrId} className={`inline-flex items-center gap-1 px-2 py-0.5 border text-xs rounded-full ${bgClass}`}>
                                                        {mandatory && <span title="Obrigatório">*</span>}
                                                        <span className="font-medium">{attr.label || attrId}</span>
                                                        {hasVal && <span className="font-mono opacity-80">: {val}</span>}
                                                        {!hasVal && mandatory && <span className="italic opacity-60">vazio</span>}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                <textarea
                                    rows={8}
                                    placeholder={'{\n  "100121": "3 Months",\n  "100134": "TPU"\n}'}
                                    value={shopeeAttributeDefaultsText}
                                    onChange={(e) => handleShopeeAttributeDefaultsChange(e.target.value)}
                                    className={`w-full px-3 py-2 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-400 ${
                                        shopeeAttributeDefaultsError ? 'border-red-400 bg-red-50' : 'border-slate-200'
                                    }`}
                                />
                                {shopeeAttributeDefaultsError && (
                                    <p className="text-xs text-red-600">{shopeeAttributeDefaultsError}</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                            {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 bg-slate-50">
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || loading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? 'Salvando...' : 'Salvar'}
                    </button>
                </div>
            </div>
            <ModelListOptionModal
                key={`${listEditor?.field.id || 'closed'}:${listEditor?.current?.value || 'new'}:${listEditor?.current ? 'edit' : 'create'}`}
                isOpen={!!listEditor}
                field={listEditor?.field || null}
                current={listEditor?.current || null}
                saving={savingListOption}
                onClose={() => {
                    if (!savingListOption) setListEditor(null);
                }}
                onSave={handleSaveListOption}
            />
        </div>
    );
};
