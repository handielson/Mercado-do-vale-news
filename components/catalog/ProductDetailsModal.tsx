import { useState, useEffect } from 'react';
import { X, Package } from 'lucide-react';
import type { CatalogProduct } from '@/types/catalog';
import { formatPrice, calculateInstallments } from '@/services/installmentCalculator';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { getEffectivePrice, useEffectiveCustomerType } from '@/hooks/useEffectiveCustomerType';
import { supabase } from '@/services/supabase';
import { customFieldsService, CustomField } from '@/services/custom-fields';

interface ProductDetailsModalProps {
    product: CatalogProduct;
    isOpen: boolean;
    onClose: () => void;
    onQuote: () => void;
}

/** Maps technical field keys to Portuguese display labels */
const SPEC_LABELS: Record<string, string> = {
    // Connectivity
    nfc: 'NFC',
    network: 'Rede',
    wifi: 'Wi-Fi',
    bluetooth: 'Bluetooth',
    usb: 'USB',
    // Performance
    chipset: 'Chipset',
    processor: 'Processador',
    antutu: 'AnTuTu',
    gpu: 'GPU',
    // Memory
    ram: 'Memória RAM',
    storage: 'Armazenamento',
    // Display
    display: 'Display (pol)',
    resolution: 'Resolução',
    refresh_rate: 'Taxa de Atualização',
    // Camera
    main_camera_mpx: 'Cam Principal Mpx',
    selfie_camera_mpx: 'Cam Selfie Mpx',
    camera: 'Câmera',
    // Battery
    battery_mah: 'Bateria (mAh)',
    battery_health: 'Saúde da Bateria',
    charging: 'Carregamento',
    // Physical
    resistencia: 'Resistência',
    weight: 'Peso',
    dimensions: 'Dimensões',
    color: 'Cor',
    material: 'Material',
    // Dimensions (nested keys like "Dimensions.Depth")
    'dimensions.depth': 'Profundidade',
    'dimensions.width': 'Largura',
    'dimensions.height': 'Altura',
    'dimensions.weight': 'Peso',
    depth: 'Profundidade',
    width: 'Largura',
    height: 'Altura',
    length: 'Comprimento',
    // Software
    version: 'Versão',
    os: 'Sistema Operacional',
    android: 'Android',
    // Other
    sim: 'SIM Card',
    sensors: 'Sensores',
    audio: 'Áudio',
    gps: 'GPS',
    // Accessories / General
    compatibility: 'Compatibilidade',
    max_load: 'Carga Máxima',
    installation: 'Instalação',
    warranty: 'Garantia',
    quantity: 'Quantidade',
    type: 'Tipo',
    brand: 'Marca',
    model: 'Modelo',
    // Dimensions with _cm suffix
    depth_cm: 'Profundidade (cm)',
    height_cm: 'Altura (cm)',
    width_cm: 'Largura (cm)',
    length_cm: 'Comprimento (cm)',
    weight_kg: 'Peso (kg)',
    weight_g: 'Peso (g)',
    peso_g: 'Peso (g)',
    peso_kg: 'Peso (kg)',
    // Other common fields
    voltage: 'Voltagem',
    power_w: 'Potência (W)',
    frequency: 'Frequência',
    capacity: 'Capacidade',
    speed: 'Velocidade',
    interface: 'Interface',
    connector: 'Conector',
    cable_length: 'Comprimento do Cabo',
    color_name: 'Cor',
    finish: 'Acabamento',
    origin: 'Origem',
    certification: 'Certificação',
};

/** Converts an unknown field key to a human-readable Portuguese label */
const formatFieldKey = (key: string, fields: CustomField[] = []): string => {
    const lower = key.toLowerCase();

    // 1. Check custom fields first
    const field = fields.find(f => f.key === lower);
    if (field?.label) return field.label;

    // 2. Check full key in SPEC_LABELS
    if (SPEC_LABELS[lower]) return SPEC_LABELS[lower];

    // 3. Handle dotted keys like "Dimensions.Depth"
    if (lower.includes('.')) {
        const parts = lower.split('.');
        const lastPart = parts[parts.length - 1];
        if (SPEC_LABELS[lastPart]) return SPEC_LABELS[lastPart];
        return lastPart.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }

    // 4. Default
    return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

export function ProductDetailsModal({
    product,
    isOpen,
    onClose,
    onQuote
}: ProductDetailsModalProps) {
    // Get customer context for pricing
    const { customer } = useSupabaseAuth();
    const effectivePrice = getEffectivePrice(product, customer);
    const effectiveCustomerType = useEffectiveCustomerType();
    const isWholesale = effectiveCustomerType === 'wholesale';

    // State for model template values
    const [templateValues, setTemplateValues] = useState<Record<string, any> | null>(null);
    const [loadingTemplate, setLoadingTemplate] = useState(false);
    const [installment12x, setInstallment12x] = useState<string>('');
    const [warrantyDays, setWarrantyDays] = useState<number | null>(null);
    // UUID → name map for version resolution
    const [versionsMap, setVersionsMap] = useState<Map<string, string>>(new Map());
    const [customFields, setCustomFields] = useState<CustomField[]>([]);

    useEffect(() => {
        if (isOpen) {
            customFieldsService.list().then(setCustomFields).catch(console.error);
        }
    }, [isOpen]);

    // Calculate 12x installment when modal opens (not for wholesale)
    useEffect(() => {
        if (!isOpen || !effectivePrice || isWholesale) {
            setInstallment12x('');
            return;
        }
        calculateInstallments(effectivePrice, 12).then(plans => {
            const plan = plans.find(p => p.installments === 12);
            if (plan) setInstallment12x(formatPrice(plan.value));
        });
    }, [isOpen, effectivePrice, isWholesale]);

    // Fetch model template_values when modal opens
    useEffect(() => {
        if (!isOpen) {
            return;
        }

        console.log('[ProductDetailsModal] Product:', {
            id: product.id,
            name: product.name,
            model_id: product.model_id
        });

        if (!product.model_id) {
            console.warn('[ProductDetailsModal] No model_id found for product');
            setTemplateValues(null);
            setLoadingTemplate(false);
            return;
        }

        let cancelled = false;

        const fetchModelTemplate = async () => {
            try {
                setLoadingTemplate(true);

                const [{ data, error }, { data: versionsData }] = await Promise.all([
                    supabase.from('models').select('template_values').eq('id', product.model_id).single(),
                    supabase.from('versions').select('id, name')
                ]);

                if (cancelled) return;

                if (!error && data?.template_values) {
                    setTemplateValues(data.template_values);
                } else {
                    setTemplateValues(null);
                }

                if (versionsData) {
                    setVersionsMap(new Map(versionsData.map((v: any) => [v.id, v.name])));
                }
            } catch (error) {
                if (!cancelled) setTemplateValues(null);
            } finally {
                if (!cancelled) setLoadingTemplate(false);
            }
        };

        fetchModelTemplate();

        return () => {
            cancelled = true;
        };
    }, [isOpen, product.model_id]);

    // Fetch warranty days from brand, category or custom template
    useEffect(() => {
        if (!isOpen) return;
        setWarrantyDays(null);

        const fetchWarranty = async () => {
            try {
                const p = product as any;
                const warrantyType = p.warranty_type;

                if (warrantyType === 'brand') {
                    // Busca warranty_days da marca pelo nome (product.brand)
                    const brandName = p.brand;
                    if (brandName) {
                        const { data } = await supabase
                            .from('brands').select('warranty_days').eq('name', brandName).single();
                        if (data?.warranty_days) setWarrantyDays(data.warranty_days);
                    }
                } else if (warrantyType === 'category') {
                    let categoryId = p.category_id;
                    if (!categoryId && p.id) {
                        const { data: prod } = await supabase
                            .from('products').select('category_id').eq('id', p.id).single();
                        categoryId = prod?.category_id;
                    }
                    if (categoryId) {
                        const { data } = await supabase
                            .from('categories').select('warranty_days').eq('id', categoryId).single();
                        if (data?.warranty_days) setWarrantyDays(data.warranty_days);
                    }
                } else if (warrantyType === 'custom') {
                    let templateId = p.warranty_template_id;
                    if (!templateId && p.id) {
                        const { data: prod } = await supabase
                            .from('products').select('warranty_template_id').eq('id', p.id).single();
                        templateId = prod?.warranty_template_id;
                    }
                    if (templateId) {
                        const { data } = await supabase
                            .from('warranty_templates').select('duration_days').eq('id', templateId).single();
                        if (data?.duration_days) setWarrantyDays(data.duration_days);
                    }
                }
            } catch (err) {
                console.error('[ProductDetailsModal] Error fetching warranty:', err);
            }
        };

        fetchWarranty();
    }, [isOpen, product]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative min-h-screen flex items-center justify-center p-4">
                <div className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 z-10 p-2 bg-white rounded-full shadow-lg hover:bg-slate-100 transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-600" />
                    </button>

                    {/* Content */}
                    <div className="p-6 space-y-6">
                        {/* Header */}
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900">{product.name}</h2>
                            {product.brand && (
                                <p className="text-sm text-slate-600 mt-1">{product.brand}</p>
                            )}
                        </div>

                        {/* Image Gallery */}
                        {product.images && product.images.length > 0 && (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {product.images.map((imageUrl, index) => (
                                    <img
                                        key={index}
                                        src={imageUrl}
                                        alt={`${product.name} - ${index + 1}`}
                                        className="w-full h-48 object-contain rounded-lg border border-slate-200 bg-slate-50"
                                    />
                                ))}
                            </div>
                        )}

                        {/* Description */}
                        {product.description && (
                            <div>
                                <h3 className="text-lg font-semibold text-slate-900 mb-2">Descrição</h3>
                                <div
                                    className="text-slate-700 prose prose-sm max-w-none"
                                    dangerouslySetInnerHTML={{ __html: product.description }}
                                />
                            </div>
                        )}

                        {/* Specifications from Model Template */}
                        {loadingTemplate ? (
                            <div className="text-center py-8">
                                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                <p className="text-sm text-slate-600 mt-2">Carregando especificações...</p>
                            </div>
                        ) : templateValues && Object.keys(templateValues).length > 0 ? (
                            (() => {
                                const entries = Object.entries(templateValues)
                                    .filter(([key]) => !['imei1', 'imei2', 'serial', 'id', 'created_at', 'updated_at'].includes(key.toLowerCase()))
                                    .sort(([a], [b]) => {
                                        const keys = Object.keys(SPEC_LABELS);
                                        const idxA = keys.indexOf(a.toLowerCase());
                                        const idxB = keys.indexOf(b.toLowerCase());
                                        if (idxA === -1 && idxB === -1) return a.localeCompare(b);
                                        if (idxA === -1) return 1;
                                        if (idxB === -1) return -1;
                                        return idxA - idxB;
                                    })
                                    .filter(([key], index, self) => {
                                        const label = formatFieldKey(key, customFields);
                                        return self.findIndex(([k]) => formatFieldKey(k, customFields) === label) === index;
                                    });

                                const logisticsLabels = [
                                    'Peso (kg)',
                                    'Profundidade (cm)', 'Altura (cm)', 'Largura (cm)',
                                    'Profundidade', 'Altura', 'Largura'
                                ];

                                const logisticsEntries = entries.filter(([key]) => logisticsLabels.includes(formatFieldKey(key, customFields)));
                                const specEntries = entries.filter(([key]) => !logisticsLabels.includes(formatFieldKey(key, customFields)));

                                const renderEntry = ([key, value]: [string, any]) => {
                                    const isVersionField = key.toLowerCase() === 'versao' || key.toLowerCase() === 'version';
                                    const displayValue = isVersionField && typeof value === 'string' && versionsMap.has(value)
                                        ? versionsMap.get(value)!
                                        : String(value);
                                    return (
                                        <div key={key} className="flex justify-between p-3 bg-slate-50 rounded-lg">
                                            <span className="text-sm font-medium text-slate-600">
                                                {formatFieldKey(key, customFields)}:
                                            </span>
                                            <span className="text-sm text-slate-900 font-semibold">
                                                {displayValue}
                                            </span>
                                        </div>
                                    );
                                };

                                return (
                                    <>
                                        {specEntries.length > 0 && (
                                            <div className="mb-6">
                                                <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                                    <Package className="w-5 h-5" />
                                                    Especificações Técnicas
                                                </h3>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    {specEntries.map(renderEntry)}
                                                </div>
                                            </div>
                                        )}

                                        {logisticsEntries.length > 0 && (
                                            <div>
                                                <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                                    <Package className="w-5 h-5 text-slate-500" />
                                                    Informações Logísticas
                                                </h3>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    {logisticsEntries.map(renderEntry)}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                );
                            })()
                        ) : (
                            <div className="text-center py-8 bg-slate-50 rounded-lg">
                                <Package className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                                <p className="text-sm text-slate-600">Especificações técnicas não disponíveis</p>
                            </div>
                        )}

                        {/* Warranty */}
                        {(() => {
                            const warrantyType = (product as any).warranty_type as string | undefined;
                            const warrantyLabel = warrantyType === 'brand' ? 'Garantia da Marca'
                                : warrantyType === 'category' ? 'Garantia da Categoria'
                                    : warrantyType === 'custom' ? 'Garantia Diferenciada'
                                        : null;
                            if (!warrantyLabel) return null;
                            return (
                                <div className="border-t border-slate-200 pt-6">
                                    <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                        🛡️ Garantia
                                    </h3>
                                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-4">
                                        <div className="text-3xl">🛡️</div>
                                        <div>
                                            <p className="font-semibold text-green-800">{warrantyLabel}</p>
                                            {warrantyDays !== null && (
                                                <p className="text-sm text-green-700 mt-0.5">
                                                    Período: <strong>{warrantyDays} dias</strong>
                                                    {warrantyDays >= 365 && (
                                                        <span className="ml-1 text-green-600">({Math.round(warrantyDays / 30)} meses)</span>
                                                    )}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Water Resistance Legend */}
                        {(() => {
                            if (!templateValues) return null;
                            const resKey = Object.keys(templateValues).find(key => key.toLowerCase() === 'resistencia');
                            if (!resKey) return null;

                            const resValue = templateValues[resKey];
                            if (!resValue || typeof resValue !== 'string') return null;

                            const normalizedRes = resValue.toUpperCase().replace(/\s/g, '');

                            const ipDescriptions: Record<string, string> = {
                                'IP52': 'Aparelho resistente a poeira (sem proteção total) e a pequenas gotas de água caindo verticalmente. Não é adequado para chuva ou mergulho.',
                                'IP53': 'Aparelho inclui proteção contra poeira e resistência a borrifos de água em ângulos de até 60º. Ideal para chuva leve ou respingos acidentais.',
                                'IP54': 'Proteção comprovada contra poeira (quantidade não prejudicial) e respingos de água vindos de qualquer direção limitados a 10 litros por minuto (5 min).',
                                'IP64': 'Vedação total contra entrada de poeira e proteção contra respingos de água de todas as direções. Nenhuma proteção contra jatos ou imersão.',
                                'IP65': 'Proteção total contra poeira e resistente a jatos de água de baixa pressão (bocal de 6,3 mm) de qualquer direção.',
                                'IP67': 'Proteção total contra poeira. O aparelho pode ser submerso em até 1 metro de água doce estática por no máximo 30 minutos.',
                                'IP68': 'Proteção total contra poeira e capaz de suportar imersão contínua em água doce (geralmente até 1,5 metros por 30 minutos, dependendo do fabricante).',
                                'IP69': 'Alta vedação térmica. Totalmente protegido contra poeira e suporta jatos severos de água em alta pressão e alta temperatura de perto.',
                                'IP69K': 'Nível máximo industrial. Protegido completamente contra poeira, jatos de água de alta pressão (100 bar) e lavagem com água quente (80°C).'
                            };

                            const matchedIp = Object.keys(ipDescriptions).find(ip => normalizedRes.includes(ip));

                            if (!matchedIp) return null;

                            return (
                                <div className="border-t border-slate-200 pt-6">
                                    <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                        💧 Resistência a Água
                                    </h3>
                                    <div className="p-4 bg-cyan-50 border border-cyan-200 rounded-lg flex flex-col gap-3">
                                        <div className="flex items-center gap-4">
                                            <div className="text-3xl">💧</div>
                                            <div>
                                                <p className="font-semibold text-cyan-800">{matchedIp}</p>
                                                <p className="text-sm text-cyan-700 mt-0.5">
                                                    {ipDescriptions[matchedIp]}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="mt-1 p-2.5 bg-red-50 border border-red-100 rounded-md">
                                            <p className="text-xs text-red-600 font-medium flex items-center gap-1.5">
                                                <span className="text-red-500">⚠️</span>
                                                Atenção: A garantia não cobre danos causados por contato com líquidos.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Drop/Scratch Resistance Legend */}
                        {(() => {
                            if (!templateValues) return null;

                            // Em vez de procurar pela "chave", vamos varrer todos os valores
                            // procurando pelas menções explícitas aos tipos de vidro
                            let matchedGlass: string | null = null;
                            let screenValueFound = '';

                            const glassDescriptions: Record<string, string> = {
                                'GORILLAGLASS3': 'Boa resistência a riscos do dia a dia. Oferece proteção básica contra danos e arranhões.',
                                'GORILLAGLASS4': 'Alta resistência contra quedas. Projetado para suportar impactos de até 1 metro em superfícies ásperas.',
                                'GORILLAGLASS5': 'Resistência extrema a quedas. Pode sobreviver a quedas de até 1,2 metros em superfícies duras (como asfalto).',
                                'GORILLAGLASS6': 'Durabilidade máxima. Suporta múltiplas quedas consecutivas e impactos severos, além de ser altamente resistente a riscos.',
                                'GORILLAGLASSVICTUS': 'Resistência premium a quedas (até 2 metros) e proteção dobrada contra arranhões em comparação ao Gorilla Glass 6.',
                                'GORILLAGLASSVICTUS+': 'Versão aprimorada do Victus. Máxima resistência contra quedas de até 2 metros com proteção contra riscos superior à concorrência.',
                                'GORILLAGLASSVICTUS2': 'Performance extrema de resistência. Otimizado para suportar quedas em concreto (até 1 metro) e asfalto (até 2 metros) em dispositivos mais pesados.',
                                'CERAMICSHIELD': 'Desenvolvido pela Apple e Corning. Incorpora cristais de nano-cerâmica no vidro para um desempenho de queda até 4x maior do que gerações anteriores.'
                            };

                            for (const key in templateValues) {
                                let val = templateValues[key];
                                if (Array.isArray(val)) val = val.join(' ');
                                if (!val || typeof val !== 'string') continue;

                                const normalizedVal = val.toUpperCase().replace(/\s/g, '');

                                const match = Object.keys(glassDescriptions).find(glass => normalizedVal.includes(glass));
                                if (match) {
                                    matchedGlass = match;
                                    screenValueFound = val;
                                    break;
                                }
                            }

                            if (!matchedGlass) return null;

                            // Formatar nome amigável para exibição
                            const displayNames: Record<string, string> = {
                                'GORILLAGLASS3': 'Gorilla Glass 3',
                                'GORILLAGLASS4': 'Gorilla Glass 4',
                                'GORILLAGLASS5': 'Gorilla Glass 5',
                                'GORILLAGLASS6': 'Gorilla Glass 6',
                                'GORILLAGLASSVICTUS': 'Gorilla Glass Victus',
                                'GORILLAGLASSVICTUS+': 'Gorilla Glass Victus+',
                                'GORILLAGLASSVICTUS2': 'Gorilla Glass Victus 2',
                                'CERAMICSHIELD': 'Ceramic Shield (Apple)'
                            };

                            return (
                                <div className="border-t border-slate-200 pt-6">
                                    <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                        📱 Resistência da Tela
                                    </h3>
                                    <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg flex flex-col gap-3">
                                        <div className="flex items-center gap-4">
                                            <div className="text-3xl">📱</div>
                                            <div>
                                                <p className="font-semibold text-orange-800">{displayNames[matchedGlass]}</p>
                                                <p className="text-sm text-orange-700 mt-0.5">
                                                    {glassDescriptions[matchedGlass]}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Pricing */}
                        <div className="border-t border-slate-200 pt-6">
                            <h3 className="text-lg font-semibold text-slate-900 mb-3">Preço</h3>
                            {effectivePrice && (
                                <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg space-y-3">
                                    <div>
                                        <p className="text-sm text-slate-500 mb-1">Preço à Vista (PIX)</p>
                                        <p className="text-3xl font-bold text-blue-700">
                                            {formatPrice(effectivePrice)}
                                        </p>
                                    </div>
                                    {installment12x && (
                                        <div className="border-t border-blue-100 pt-3">
                                            <p className="text-sm text-slate-500 mb-1">No Cartão de Crédito</p>
                                            <p className="text-xl font-bold text-slate-700">
                                                12x de {installment12x}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Action Button */}
                        <button
                            onClick={() => {
                                onClose();
                                onQuote();
                            }}
                            className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl"
                        >
                            Fazer Orçamento
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
