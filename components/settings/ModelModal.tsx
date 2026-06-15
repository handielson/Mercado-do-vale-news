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
import { applyFieldFormat, getFieldDefinition } from '../../config/field-dictionary';
import { UNIQUE_FIELDS } from '../../config/product-fields';
import { CurrencyInput } from '../ui/CurrencyInput';
import { tableDataService, type TableOption } from '../../services/table-data';
import { CategorySelect } from '../products/CategorySelect';
import { ColorImageManager } from './ColorImageManager';
import { buildModelImportPrompt, isModelUnitFieldKey, normalizeModelImportPayload, parseModelImportJson } from './modelJsonImport.js';
import { generateModelJsonWithAi } from '../../services/modelAiService';

interface ModelModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void | Promise<void>;
    model?: Model | null;
}

type TabType = 'basic' | 'json' | 'template' | 'seo' | 'photos' | 'tags';

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
    const [options, setOptions] = useState<TableOption[]>([]);
    const [loading, setLoading] = useState(false);


    useEffect(() => {
        if (field.field_type === 'table_relation' && field.table_config) {
            loadTableOptions();
        }
    }, [field]);

    const loadTableOptions = async () => {
        if (!field.table_config) return;

        setLoading(true);
        try {
            const data = await tableDataService.loadOptions(
                field.table_config.table_name,
                field.table_config.value_column,
                field.table_config.label_column,
                field.table_config.order_by
            );
            setOptions(data);
        } catch (error) {
            console.error(`Error loading options for ${field.key}: `, error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
                {field.label} <span className="text-slate-400 font-mono">({field.key})</span>
            </label>
            {field.field_type === 'table_relation' ? (
                // Dropdown from database table
                <select
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={loading}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                    <option value="">Selecione...</option>
                    {options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
            ) : field.field_type === 'select' && field.options ? (
                // Dropdown from manual options
                <select
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="">Selecione...</option>
                    {field.options.map((opt) => (
                        <option key={opt} value={opt}>
                            {opt}
                        </option>
                    ))}
                </select>
            ) : (
                // Text or number input
                <input
                    type={field.field_type === 'number' ? 'number' : 'text'}
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={field.placeholder || ''}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            )}
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
    const [fieldChoiceOptions, setFieldChoiceOptions] = useState<Record<string, Array<{ value: string; label: string }>>>({});

    // UI State
    const [saving, setSaving] = useState(false);
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
        Object.entries(values).filter(([key]) => !isHiddenSpecKey(key) && !isModelUnitFieldKey(key) && !isModelVariationFieldKey(key))
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

    const applyNormalizedModelPayload = (normalized: any) => {
        const visibleTemplateValues = Object.fromEntries(
            Object.entries(normalized.templateValues || {}).filter(([key]) => !isHiddenSpecKey(key) && !isModelUnitFieldKey(key) && !isModelVariationFieldKey(key))
        );
        const translatedTemplateValues = translateTemplateValuesToPortuguese(visibleTemplateValues);
        const appliedFields: string[] = [];

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

        if (normalized.missingChoices?.length) {
            const missingList = normalized.missingChoices
                .map((item: any) => `${item.fieldLabel}: "${item.value}"`)
                .join('; ');
            toast.warning('Cadastre novas opcoes antes de salvar', {
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

    const handleApplyModelJson = () => {
        try {
            if (loading) {
                toast.error('Aguarde marcas, categorias e campos carregarem antes de aplicar o JSON.');
                return;
            }

            const data = parseModelImportJson(modelJsonInput);
            const normalized = normalizeModelImportPayload(data, {
                brands,
                categories,
                customFields: visibleSpecFields,
                choiceOptions: fieldChoiceOptions,
            });
            const appliedFields = applyNormalizedModelPayload(normalized);
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
        }
    };

    const handleGenerateModelJson = async () => {
        if (loading) {
            toast.error('Aguarde marcas, categorias e campos carregarem antes de gerar o JSON.');
            return;
        }

        setGeneratingModelJson(true);
        try {
            const result = await generateModelJsonWithAi({
                prompt: modelImportPrompt,
                name,
                brand: brandObj?.name || '',
                category: categoryObj?.name || 'Smartphones',
                trustedSourceLinks: parseTrustedSourceLinks(trustedSourceLinksText),
            });
            setModelJsonInput(result.text);
            const data = parseModelImportJson(result.text);
            const normalized = normalizeModelImportPayload(data, {
                brands,
                categories,
                customFields: visibleSpecFields,
                choiceOptions: fieldChoiceOptions,
            });
            const appliedFields = applyNormalizedModelPayload(normalized);
            warnUnresolvedModelPayload(data, normalized);
            toast.success(appliedFields.length > 0 ? 'Modelo preenchido pela IA.' : 'JSON gerado pela IA. Revise antes de salvar.');
        } catch (err) {
            console.error('Erro ao gerar JSON do modelo com IA', err);
            toast.error(err instanceof Error ? err.message : 'Nao foi possivel gerar o JSON com IA.');
        } finally {
            setGeneratingModelJson(false);
        }
    };

    const handleApplyJson = () => {
        try {
            if (!jsonInput.trim()) {
                toast.error('Cole o JSON gerado pela IA primeiro.');
                return;
            }

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
                const appliedFields = applyNormalizedModelPayload(normalized);
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
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        const loadFieldChoiceOptions = async () => {
            const nextOptions: Record<string, Array<{ value: string; label: string }>> = {};

            customFields.forEach((field) => {
                if (field.field_type === 'select' && Array.isArray(field.options)) {
                    nextOptions[field.key] = field.options
                        .filter(Boolean)
                        .map((option) => ({ value: option, label: option }));
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
                    nextOptions[field.key] = options.map((option) => ({
                        value: String(option.value),
                        label: String(option.label),
                    }));
                } catch (error) {
                    console.error(`Error loading choices for ${field.key}:`, error);
                }
            }));

            setFieldChoiceOptions(nextOptions);
        };

        loadFieldChoiceOptions();
    }, [customFields]);

    useEffect(() => {
        if (model) {
            setName(formatModelNameTitleCase(model.name));
            setBrandId(model.brand_id);
            setBrandSearch(brands.find((brand) => brand.id === model.brand_id)?.name || '');
            setActive(model.active);
            setCategoryId(model.category_id || '');
            setDescription(model.description || '');
            setTemplateValues(model.template_values || {});
            setEans(model.eans || []);
        } else {
            setName('');
            setBrandId('');
            setBrandSearch('');
            setActive(true);
            setCategoryId('');
            setDescription('');
            setTemplateValues({});
            setEans([]);
        }
        setError('');
        setActiveTab('basic');
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
                brandService.list(),
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

    const handleAddEan = (value?: string) => {
        const nextEan = (value ?? eanInputRef.current?.value ?? '').trim();
        if (!nextEan || eans.includes(nextEan)) return;

        setEans(prev => [...prev, nextEan]);
        if (eanInputRef.current) eanInputRef.current.value = '';
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

            const input: ModelInput = {
                name: formatModelNameTitleCase(name).trim(),
                brand_id: brandId,
                active,
                category_id: categoryId || undefined,
                description: description || undefined,
                template_values: Object.keys(getSanitizedTemplateValues(templateValues)).length > 0 ? getSanitizedTemplateValues(templateValues) : undefined,
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
                </div>

                {/* Body */}
                <div className="p-6 space-y-4 flex-1 overflow-y-auto bg-slate-50/50">
                    {/* Basic Tab */}
                    {activeTab === 'basic' && (
                        <>
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
                                            disabled={generatingModelJson || loading}
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
                                        disabled={!modelJsonInput.trim()}
                                        className="mt-3 w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Preencher modelo pelo JSON
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
                                        {visibleSpecFields.map((field) => (
                                                <TemplateFieldInput
                                                    key={field.id}
                                                    field={field}
                                                    value={templateValues[field.key]}
                                                    onChange={(value) => handleTemplateValueChange(field.key, value)}
                                                />
                                            ))}
                                    </div>
                                    {categoryId && categoryConfig && visibleSpecFields.length === 0 && (
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
                                    {visibleSpecFields.map((field) => (
                                        <TemplateFieldInput
                                            key={field.id}
                                            field={field}
                                            value={templateValues[field.key]}
                                            onChange={(value) => handleTemplateValueChange(field.key, value)}
                                        />
                                    ))}
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
                                            className="self-end px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-colors shadow-md"
                                        >
                                            Preencher Campos Automaticamente ✨
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
        </div>
    );
};
