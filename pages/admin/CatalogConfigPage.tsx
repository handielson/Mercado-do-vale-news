import React, { useState, useEffect } from 'react';
import { Settings, Eye, Palette, Search, Share2, Save, Loader2, Layers, ArrowLeft } from 'lucide-react';
import { catalogConfigService } from '@/services/catalogConfigService';
import type { CatalogSettings } from '@/types/catalogSettings';
import { DEFAULT_CATALOG_SETTINGS } from '@/types/catalogSettings';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { SectionsTab } from '@/components/admin/SectionsTab';

type TabType = 'display' | 'categories' | 'appearance' | 'seo' | 'sharing' | 'sections';

export default function CatalogConfigPage() {
    const { user } = useSupabaseAuth();
    const [activeTab, setActiveTab] = useState<TabType>('display');
    const [settings, setSettings] = useState<CatalogSettings>(DEFAULT_CATALOG_SETTINGS as CatalogSettings);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    // Carregar configurações
    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            setLoading(true);
            const data = await catalogConfigService.getSettings();
            setSettings(data);
        } catch (error) {
            console.error('Erro ao carregar configurações:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            await catalogConfigService.saveSettings(settings);
            setHasChanges(false);
            alert('✅ Configurações salvas com sucesso!');
        } catch (error) {
            console.error('Erro ao salvar:', error);
            alert('❌ Erro ao salvar configurações');
        } finally {
            setSaving(false);
        }
    };

    const updateSetting = <K extends keyof CatalogSettings>(
        key: K,
        value: CatalogSettings[K]
    ) => {
        setSettings(prev => ({ ...prev, [key]: value }));
        setHasChanges(true);
    };

    const tabs = [
        { id: 'display' as TabType, label: 'Regras de Exibição', icon: Eye },
        { id: 'categories' as TabType, label: 'Categorias', icon: Settings },
        { id: 'sections' as TabType, label: 'Seções', icon: Layers },
        { id: 'appearance' as TabType, label: 'Aparência', icon: Palette },
        { id: 'seo' as TabType, label: 'SEO', icon: Search },
        { id: 'sharing' as TabType, label: 'Compartilhamento', icon: Share2 },
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => window.location.href = '/admin'}
                                className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                                title="Voltar para Admin"
                            >
                                <ArrowLeft className="w-5 h-5" />
                                <span className="font-medium">Voltar</span>
                            </button>
                            <div className="h-8 w-px bg-gray-300"></div>
                            <h1 className="text-2xl font-bold text-gray-900">
                                Configuração do Catálogo
                            </h1>
                        </div>
                        <button
                            onClick={handleSave}
                            disabled={!hasChanges || saving}
                            className={`
                                flex items-center gap-2 px-4 py-2 rounded-lg font-medium
                                transition-colors
                                ${hasChanges
                                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                }
                            `}
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Salvando...
                                </>
                            ) : (
                                <>
                                    <Save className="w-5 h-5" />
                                    Salvar Alterações
                                </>
                            )}
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1 -mb-px">
                        {tabs.map(tab => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`
                                        flex items-center gap-2 px-4 py-3 border-b-2 font-medium
                                        transition-colors
                                        ${activeTab === tab.id
                                            ? 'border-blue-600 text-blue-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                        }
                                    `}
                                >
                                    <Icon className="w-5 h-5" />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                {/* 🎯 ATALHO: Configuração de Badges */}
                <div className="bg-gradient-to-r from-purple-50 via-pink-50 to-purple-50 border-2 border-purple-300 rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="p-2 bg-purple-600 rounded-lg">
                                    <Settings className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-purple-900">Configuração de Badges</h3>
                                    <p className="text-sm text-purple-600">Personalize os badges que aparecem nos produtos</p>
                                </div>
                            </div>
                            <p className="text-purple-700 mb-4 leading-relaxed">
                                Configure quais badges (📡 NFC, 📶 5G, 📱 Dual SIM, etc.) aparecem nos cards de produtos para cada categoria.
                                Adicione, remova ou personalize cores e ícones facilmente.
                            </p>
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                                <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full font-medium">
                                    📡 NFC
                                </span>
                                <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full font-medium">
                                    📶 5G
                                </span>
                                <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full font-medium">
                                    📱 Dual SIM
                                </span>
                                <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full font-medium">
                                    ⚡ Carregamento Sem Fio
                                </span>
                                <span className="text-purple-500">+ mais...</span>
                            </div>
                        </div>
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => {
                                    const filePath = 'config/category-badges.ts';
                                    const absolutePath = 'c:\\Users\\Nitro\\SynologyDrive\\SynologyDrive\\Programas\\Mercado do Vale New\\mercado-do-vale\\config\\category-badges.ts';

                                    // Tentar abrir no VS Code
                                    window.open(`vscode://file/${absolutePath}`, '_blank');

                                    // Também copiar para clipboard como fallback
                                    navigator.clipboard.writeText(filePath).then(() => {
                                        alert('✅ Arquivo aberto no VS Code!\n\n📋 Caminho também copiado:\n' + filePath);
                                    }).catch(() => {
                                        alert('📂 Abra o arquivo:\n' + filePath);
                                    });
                                }}
                                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all font-semibold shadow-md hover:shadow-lg flex items-center gap-2 whitespace-nowrap"
                            >
                                <Settings className="w-5 h-5" />
                                Editar Badges
                            </button>
                            <p className="text-xs text-purple-600 text-center">
                                config/category-badges.ts
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    {activeTab === 'display' && (
                        <DisplayRulesTab settings={settings} updateSetting={updateSetting} />
                    )}
                    {activeTab === 'categories' && (
                        <CategoriesTab settings={settings} updateSetting={updateSetting} />
                    )}
                    {activeTab === 'sections' && (
                        <SectionsTab />
                    )}
                    {activeTab === 'appearance' && (
                        <AppearanceTab settings={settings} updateSetting={updateSetting} />
                    )}
                    {activeTab === 'seo' && (
                        <SEOTab settings={settings} updateSetting={updateSetting} />
                    )}
                    {activeTab === 'sharing' && (
                        <SharingTab settings={settings} updateSetting={updateSetting} />
                    )}
                </div>
            </div>
        </div>
    );
}

// ==================== DISPLAY RULES TAB ====================
interface TabProps {
    settings: CatalogSettings;
    updateSetting: <K extends keyof CatalogSettings>(key: K, value: CatalogSettings[K]) => void;
}

function DisplayRulesTab({ settings, updateSetting }: TabProps) {
    return (
        <div className="space-y-8">
            <Section title="Produtos">
                <Toggle
                    label="Ocultar produtos sem estoque"
                    description="Produtos com estoque zero não serão exibidos no catálogo"
                    checked={settings.hide_out_of_stock}
                    onChange={(checked) => updateSetting('hide_out_of_stock', checked)}
                />
                <Toggle
                    label="Ocultar produtos com preço zero"
                    description="Produtos sem preço definido não serão exibidos"
                    checked={settings.hide_zero_price}
                    onChange={(checked) => updateSetting('hide_zero_price', checked)}
                />
                <Toggle
                    label="Ocultar produtos inativos"
                    description="Produtos marcados como inativos não serão exibidos"
                    checked={settings.hide_inactive}
                    onChange={(checked) => updateSetting('hide_inactive', checked)}
                />
                <NumberInput
                    label="Estoque mínimo para exibir"
                    description="Produtos com estoque abaixo deste valor não serão exibidos"
                    value={settings.min_stock_to_show}
                    onChange={(value) => updateSetting('min_stock_to_show', value)}
                    min={0}
                />
            </Section>

            <Section title="Categorias">
                <Toggle
                    label="Ocultar categorias vazias"
                    description="Categorias sem produtos não serão exibidas"
                    checked={settings.hide_empty_categories}
                    onChange={(checked) => updateSetting('hide_empty_categories', checked)}
                />
                <Toggle
                    label="Ocultar categorias sem estoque"
                    description="Categorias onde todos os produtos estão sem estoque não serão exibidas"
                    checked={settings.hide_categories_no_stock}
                    onChange={(checked) => updateSetting('hide_categories_no_stock', checked)}
                />
                <Toggle
                    label="Mostrar contador de produtos"
                    description="Exibir quantidade de produtos em cada categoria"
                    checked={settings.show_product_count}
                    onChange={(checked) => updateSetting('show_product_count', checked)}
                />
            </Section>

            <Section title="Preços">
                <Toggle
                    label="Mostrar preços"
                    description="Exibir preços dos produtos"
                    checked={settings.show_prices}
                    onChange={(checked) => updateSetting('show_prices', checked)}
                />
                <Toggle
                    label="Mostrar preço antigo"
                    description="Exibir preço anterior quando houver promoção"
                    checked={settings.show_old_price}
                    onChange={(checked) => updateSetting('show_old_price', checked)}
                />
                <Toggle
                    label="Mostrar badge de desconto"
                    description="Exibir porcentagem de desconto em produtos promocionais"
                    checked={settings.show_discount_badge}
                    onChange={(checked) => updateSetting('show_discount_badge', checked)}
                />
            </Section>

            <Section title="Estoque">
                <Toggle
                    label="Mostrar informação de estoque"
                    description="Exibir se o produto está disponível"
                    checked={settings.show_stock}
                    onChange={(checked) => updateSetting('show_stock', checked)}
                />
                <Toggle
                    label="Mostrar quantidade exata"
                    description="Exibir quantidade disponível em estoque"
                    checked={settings.show_stock_quantity}
                    onChange={(checked) => updateSetting('show_stock_quantity', checked)}
                />
                <Toggle
                    label="Avisar estoque baixo"
                    description="Exibir aviso quando estoque estiver baixo"
                    checked={settings.show_low_stock_warning}
                    onChange={(checked) => updateSetting('show_low_stock_warning', checked)}
                />
                <NumberInput
                    label="Limite para estoque baixo"
                    description="Quantidade considerada como estoque baixo"
                    value={settings.low_stock_threshold}
                    onChange={(value) => updateSetting('low_stock_threshold', value)}
                    min={1}
                />
            </Section>
        </div>
    );
}

// ==================== CATEGORIES TAB ====================
function CategoriesTab({ settings, updateSetting }: TabProps) {
    return (
        <div className="space-y-8">
            <Section title="Estilo de Exibição">
                <Select
                    label="Estilo das categorias"
                    description="Como as categorias serão exibidas"
                    value={settings.category_display_style}
                    onChange={(value) => updateSetting('category_display_style', value as any)}
                    options={[
                        { value: 'icons', label: 'Ícones' },
                        { value: 'images', label: 'Imagens' },
                        { value: 'text', label: 'Apenas texto' },
                    ]}
                />
                <Select
                    label="Tamanho dos ícones"
                    description="Tamanho dos ícones de categoria"
                    value={settings.category_icon_size}
                    onChange={(value) => updateSetting('category_icon_size', value as any)}
                    options={[
                        { value: 'small', label: 'Pequeno' },
                        { value: 'medium', label: 'Médio' },
                        { value: 'large', label: 'Grande' },
                    ]}
                />
                <Select
                    label="Layout das categorias"
                    description="Como as categorias serão organizadas"
                    value={settings.category_layout}
                    onChange={(value) => updateSetting('category_layout', value as any)}
                    options={[
                        { value: 'horizontal', label: 'Horizontal (scroll)' },
                        { value: 'grid', label: 'Grade' },
                        { value: 'sidebar', label: 'Barra lateral' },
                    ]}
                />
            </Section>

            <Section title="Visibilidade">
                <Toggle
                    label="Mostrar ícones de categorias"
                    description="Exibir ícones nas categorias"
                    checked={settings.show_category_icons}
                    onChange={(checked) => updateSetting('show_category_icons', checked)}
                />
                <Toggle
                    label="Mostrar imagens de categorias"
                    description="Exibir imagens personalizadas nas categorias"
                    checked={settings.show_category_images}
                    onChange={(checked) => updateSetting('show_category_images', checked)}
                />
            </Section>

            <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                    💡 <strong>Dica:</strong> Para configurar ícones específicos de cada categoria,
                    use a página de edição de categorias.
                </p>
            </div>
        </div>
    );
}

// ==================== APPEARANCE TAB ====================
function AppearanceTab({ settings, updateSetting }: TabProps) {
    return (
        <div className="space-y-8">
            <Section title="Tema">
                <Select
                    label="Modo do tema"
                    description="Tema claro, escuro ou automático"
                    value={settings.theme_mode}
                    onChange={(value) => updateSetting('theme_mode', value as any)}
                    options={[
                        { value: 'light', label: 'Claro' },
                        { value: 'dark', label: 'Escuro' },
                        { value: 'auto', label: 'Automático' },
                    ]}
                />
            </Section>

            <Section title="Cores">
                <ColorInput
                    label="Cor primária"
                    description="Cor principal do catálogo (categorias ativas)"
                    value={settings.primary_color}
                    onChange={(value) => updateSetting('primary_color', value)}
                />
                <ColorInput
                    label="Cor secundária"
                    description="Cor secundária (botões, links)"
                    value={settings.secondary_color}
                    onChange={(value) => updateSetting('secondary_color', value)}
                />
                <ColorInput
                    label="Cor de destaque"
                    description="Cor para elementos de sucesso e confirmação"
                    value={settings.accent_color}
                    onChange={(value) => updateSetting('accent_color', value)}
                />
            </Section>

            <Section title="Layout">
                <Select
                    label="Modo de layout"
                    description="Como os produtos serão exibidos"
                    value={settings.layout_mode}
                    onChange={(value) => updateSetting('layout_mode', value as any)}
                    options={[
                        { value: 'grid', label: 'Grade' },
                        { value: 'list', label: 'Lista' },
                        { value: 'both', label: 'Ambos (usuário escolhe)' },
                    ]}
                />
                <Select
                    label="Estilo dos cards"
                    description="Estilo visual dos cards de produto"
                    value={settings.card_style}
                    onChange={(value) => updateSetting('card_style', value as any)}
                    options={[
                        { value: 'modern', label: 'Moderno' },
                        { value: 'classic', label: 'Clássico' },
                        { value: 'minimal', label: 'Minimalista' },
                    ]}
                />
            </Section>

            <Section title="Grade Responsiva">
                <NumberInput
                    label="Colunas (Mobile)"
                    description="Número de colunas em dispositivos móveis"
                    value={settings.grid_columns_mobile}
                    onChange={(value) => updateSetting('grid_columns_mobile', value)}
                    min={1}
                    max={2}
                />
                <NumberInput
                    label="Colunas (Tablet)"
                    description="Número de colunas em tablets"
                    value={settings.grid_columns_tablet}
                    onChange={(value) => updateSetting('grid_columns_tablet', value)}
                    min={1}
                    max={4}
                />
                <NumberInput
                    label="Colunas (Desktop)"
                    description="Número de colunas em desktop"
                    value={settings.grid_columns_desktop}
                    onChange={(value) => updateSetting('grid_columns_desktop', value)}
                    min={2}
                    max={6}
                />
            </Section>
        </div>
    );
}

// ==================== SEO TAB ====================
function SEOTab({ settings, updateSetting }: TabProps) {
    return (
        <div className="space-y-8">
            <Section title="Meta Tags">
                <TextInput
                    label="Título SEO"
                    description="Título que aparece nos resultados de busca"
                    value={settings.meta_title || ''}
                    onChange={(value) => updateSetting('meta_title', value)}
                    placeholder="Catálogo de Produtos - Sua Loja"
                />
                <TextArea
                    label="Descrição SEO"
                    description="Descrição que aparece nos resultados de busca"
                    value={settings.meta_description || ''}
                    onChange={(value) => updateSetting('meta_description', value)}
                    placeholder="Confira nossos produtos com os melhores preços..."
                    rows={3}
                />
                <TextInput
                    label="Palavras-chave"
                    description="Palavras-chave separadas por vírgula"
                    value={settings.meta_keywords || ''}
                    onChange={(value) => updateSetting('meta_keywords', value)}
                    placeholder="celulares, tablets, eletrônicos"
                />
            </Section>

            <Section title="Configurações">
                <Toggle
                    label="URLs amigáveis"
                    description="Usar URLs otimizadas para SEO"
                    checked={settings.enable_seo_friendly_urls}
                    onChange={(checked) => updateSetting('enable_seo_friendly_urls', checked)}
                />
            </Section>
        </div>
    );
}

// ==================== SHARING TAB ====================
function SharingTab({ settings, updateSetting }: TabProps) {
    return (
        <div className="space-y-8">
            <Section title="Compartilhamento">
                <Toggle
                    label="Catálogo público"
                    description="Permitir acesso público ao catálogo"
                    checked={settings.enable_public_catalog}
                    onChange={(checked) => updateSetting('enable_public_catalog', checked)}
                />
                <Toggle
                    label="Exigir login"
                    description="Usuários precisam fazer login para ver o catálogo"
                    checked={settings.require_login}
                    onChange={(checked) => updateSetting('require_login', checked)}
                />
                <Toggle
                    label="Habilitar QR Code"
                    description="Gerar QR Code para compartilhamento"
                    checked={settings.enable_qr_code}
                    onChange={(checked) => updateSetting('enable_qr_code', checked)}
                />
            </Section>

            <Section title="URL Personalizada">
                <TextInput
                    label="Slug do catálogo"
                    description="URL personalizada: /catalog/seu-slug"
                    value={settings.catalog_slug || ''}
                    onChange={(value) => updateSetting('catalog_slug', value)}
                    placeholder="minha-loja"
                />
            </Section>

            <Section title="Analytics">
                <Toggle
                    label="Rastrear visualizações"
                    description="Registrar visualizações de produtos"
                    checked={settings.track_views}
                    onChange={(checked) => updateSetting('track_views', checked)}
                />
                <Toggle
                    label="Rastrear cliques"
                    description="Registrar cliques em produtos"
                    checked={settings.track_clicks}
                    onChange={(checked) => updateSetting('track_clicks', checked)}
                />
                <TextInput
                    label="Google Analytics ID"
                    description="ID de rastreamento do Google Analytics"
                    value={settings.google_analytics_id || ''}
                    onChange={(value) => updateSetting('google_analytics_id', value)}
                    placeholder="G-XXXXXXXXXX"
                />
            </Section>
        </div>
    );
}

// ==================== REUSABLE COMPONENTS ====================
function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
            <div className="space-y-4">
                {children}
            </div>
        </div>
    );
}

interface ToggleProps {
    label: string;
    description: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}

function Toggle({ label, description, checked, onChange }: ToggleProps) {
    return (
        <div className="flex items-start justify-between py-3 border-b border-gray-100 last:border-0">
            <div className="flex-1">
                <label className="text-sm font-medium text-gray-900">{label}</label>
                <p className="text-sm text-gray-500 mt-1">{description}</p>
            </div>
            <button
                onClick={() => onChange(!checked)}
                className={`
                    relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full
                    transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2
                    focus:ring-blue-600 focus:ring-offset-2
                    ${checked ? 'bg-blue-600' : 'bg-gray-200'}
                `}
            >
                <span
                    className={`
                        inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0
                        transition duration-200 ease-in-out
                        ${checked ? 'translate-x-5' : 'translate-x-0'}
                    `}
                />
            </button>
        </div>
    );
}

interface NumberInputProps {
    label: string;
    description: string;
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
}

function NumberInput({ label, description, value, onChange, min, max }: NumberInputProps) {
    return (
        <div className="py-3 border-b border-gray-100 last:border-0">
            <label className="text-sm font-medium text-gray-900">{label}</label>
            <p className="text-sm text-gray-500 mt-1 mb-2">{description}</p>
            <input
                type="number"
                value={value}
                onChange={(e) => onChange(parseInt(e.target.value) || 0)}
                min={min}
                max={max}
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
        </div>
    );
}

interface TextInputProps {
    label: string;
    description: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

function TextInput({ label, description, value, onChange, placeholder }: TextInputProps) {
    return (
        <div className="py-3 border-b border-gray-100 last:border-0">
            <label className="text-sm font-medium text-gray-900">{label}</label>
            <p className="text-sm text-gray-500 mt-1 mb-2">{description}</p>
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
        </div>
    );
}

interface TextAreaProps extends TextInputProps {
    rows?: number;
}

function TextArea({ label, description, value, onChange, placeholder, rows = 4 }: TextAreaProps) {
    return (
        <div className="py-3 border-b border-gray-100 last:border-0">
            <label className="text-sm font-medium text-gray-900">{label}</label>
            <p className="text-sm text-gray-500 mt-1 mb-2">{description}</p>
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                rows={rows}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
        </div>
    );
}

interface ColorInputProps {
    label: string;
    description: string;
    value: string;
    onChange: (value: string) => void;
}

function ColorInput({ label, description, value, onChange }: ColorInputProps) {
    return (
        <div className="py-3 border-b border-gray-100 last:border-0">
            <label className="text-sm font-medium text-gray-900">{label}</label>
            <p className="text-sm text-gray-500 mt-1 mb-2">{description}</p>
            <div className="flex items-center gap-3">
                <input
                    type="color"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="h-10 w-20 rounded border border-gray-300 cursor-pointer"
                />
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    placeholder="#000000"
                />
            </div>
        </div>
    );
}

interface SelectProps {
    label: string;
    description: string;
    value: string;
    onChange: (value: string) => void;
    options: Array<{ value: string; label: string }>;
}

function Select({ label, description, value, onChange, options }: SelectProps) {
    return (
        <div className="py-3 border-b border-gray-100 last:border-0">
            <label className="text-sm font-medium text-gray-900">{label}</label>
            <p className="text-sm text-gray-500 mt-1 mb-2">{description}</p>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            >
                {options.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>
        </div>
    );
}
