import React, { useState, useEffect } from 'react';
import { Settings, Eye, Palette, Search, Share2, Save, Loader2, Layers, ArrowLeft, FileText } from 'lucide-react';
import { catalogConfigService } from '@/services/catalogConfigService';
import type { CatalogSettings } from '@/types/catalogSettings';
import { DEFAULT_CATALOG_SETTINGS } from '@/types/catalogSettings';
import { useVpsAuth } from '@/hooks/useVpsAuth';
import { SectionsTab } from '@/components/admin/SectionsTab';
import { PdpSectionHeadersPanel } from '@/components/settings/PdpSectionHeadersPanel';
import { categoryService } from '@/services/categories';
import { getEnabledCatalogCollections } from '@/pages/catalog/catalogCollections.js';

type TabType = 'display' | 'categories' | 'appearance' | 'seo' | 'sharing' | 'sections' | 'description';

function sanitizeCatalogSettingsForSave(settings: CatalogSettings): Partial<CatalogSettings> {
    const sanitized = { ...settings } as Record<string, unknown>;
    // Campos legados que podem existir no estado, mas nao existem em catalog_settings
    delete sanitized.catalog_footer_text;
    return sanitized as Partial<CatalogSettings>;
}

export default function CatalogConfigPage() {
    const { user } = useVpsAuth();
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
            // Mesclar com defaults para garantir que todos os campos existem
            const merged = { ...DEFAULT_CATALOG_SETTINGS, ...data } as CatalogSettings;
            setSettings(merged);
        } catch (error) {
            console.error('Erro ao carregar configurações:', error);
            // Usar defaults como fallback
            setSettings(DEFAULT_CATALOG_SETTINGS as CatalogSettings);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            // Validar que settings tem todos os campos necessários
            if (!user) {
                throw new Error('Usuário não autenticado');
            }
            const sanitized = sanitizeCatalogSettingsForSave(settings);
            await catalogConfigService.saveSettings(sanitized);
            setHasChanges(false);
            alert('✅ Configurações salvas com sucesso!');
        } catch (error: any) {
            console.error('❌ Erro detalhado ao salvar:', error);
            const errorMsg = error?.message || 'Erro desconhecido ao salvar configurações. Verifique o console.';
            alert(errorMsg);
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
        { id: 'description' as TabType, label: 'Descrição', icon: FileText },
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
        <div className="min-h-screen bg-gray-50 pb-12">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-10 mb-8 shadow-sm">
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
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col md:flex-row gap-8 items-start">
                    {/* Menu Lateral */}
                    <div className="w-full md:w-64 flex-shrink-0 bg-white border border-gray-200 rounded-2xl p-3 shadow-sm sticky top-24">
                        <nav className="flex flex-col gap-1.5">
                            {tabs.map(tab => {
                                const Icon = tab.icon;
                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${isActive
                                                ? 'bg-blue-50 text-blue-800 shadow-sm border border-blue-200/60'
                                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                                            {tab.label}
                                        </div>
                                        {isActive && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                                    </button>
                                );
                            })}
                        </nav>
                    </div>

                    {/* Conteúdo Principal */}
                    <div className="flex-1 min-w-0 space-y-6">
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

                        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
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
                            {activeTab === 'description' && (
                                <PdpSectionHeadersPanel />
                            )}
                            {activeTab === 'sharing' && (
                                <SharingTab settings={settings} updateSetting={updateSetting} />
                            )}
                        </div>
                    </div>
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
    const [categories, setCategories] = useState<{ id: string; name: string; sort_order: number }[]>([]);
    const [loadingCats, setLoadingCats] = useState(true);
    const [savingOrder, setSavingOrder] = useState(false);
    const [orderChanged, setOrderChanged] = useState(false);

    useEffect(() => {
        loadCategories();
    }, []);

    const loadCategories = async () => {
        try {
            setLoadingCats(true);
            const cats = await categoryService.list();
            const sorted = [...cats]
                .map((c, i) => ({ id: c.id, name: c.name, sort_order: (c as any).sort_order ?? i }))
                .sort((a, b) => a.sort_order - b.sort_order);
            setCategories(sorted);
        } catch (err) {
            console.error('Erro ao carregar categorias:', err);
        } finally {
            setLoadingCats(false);
        }
    };

    const moveUp = (index: number) => {
        if (index === 0) return;
        const updated = [...categories];
        [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
        setCategories(updated);
        setOrderChanged(true);
    };

    const moveDown = (index: number) => {
        if (index === categories.length - 1) return;
        const updated = [...categories];
        [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
        setCategories(updated);
        setOrderChanged(true);
    };

    const saveOrder = async () => {
        try {
            setSavingOrder(true);
            const orders = categories.map((cat, i) => ({ id: cat.id, sort_order: i }));
            await categoryService.updateSortOrder(orders);
            setOrderChanged(false);
            alert('✅ Ordem das categorias salva com sucesso!');
        } catch (err) {
            console.error('Erro ao salvar ordem:', err);
            alert('❌ Erro ao salvar ordem das categorias');
        } finally {
            setSavingOrder(false);
        }
    };

    return (
        <div className="space-y-8">
            {/* Ordenação de Categorias */}
            <Section title="Ordem de Exibição das Categorias">
                <p className="text-sm text-gray-500 mb-4">
                    Defina a ordem em que as categorias aparecem na barra de navegação do catálogo.
                    Use os botões ▲▼ para reordenar.
                </p>

                {loadingCats ? (
                    <div className="flex items-center gap-2 py-4 text-gray-500">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Carregando categorias...</span>
                    </div>
                ) : categories.length === 0 ? (
                    <p className="text-sm text-gray-400 py-4">Nenhuma categoria encontrada.</p>
                ) : (
                    <div className="space-y-2">
                        {categories.map((cat, index) => (
                            <div
                                key={cat.id}
                                className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                                <span className="w-6 text-center text-xs font-bold text-gray-400 select-none">
                                    {index + 1}
                                </span>
                                <span className="flex-1 text-sm font-medium text-gray-800">
                                    {cat.name}
                                </span>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => moveUp(index)}
                                        disabled={index === 0}
                                        className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                        title="Mover para cima"
                                    >
                                        ▲
                                    </button>
                                    <button
                                        onClick={() => moveDown(index)}
                                        disabled={index === categories.length - 1}
                                        className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                        title="Mover para baixo"
                                    >
                                        ▼
                                    </button>
                                </div>
                            </div>
                        ))}

                        <div className="pt-3">
                            <button
                                onClick={saveOrder}
                                disabled={!orderChanged || savingOrder}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${orderChanged
                                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    }`}
                            >
                                {savingOrder ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
                                ) : (
                                    <><Save className="w-4 h-4" /> Salvar Ordem</>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </Section>

            {/* Estilo de Exibição */}
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
        </div>
    );
}


// ==================== APPEARANCE TAB ====================
function AppearanceTab({ settings, updateSetting }: TabProps) {
    const [defaultState, setDefaultState] = React.useState<Partial<CatalogSettings> | null>(null);
    const [lastSaveTime, setLastSaveTime] = React.useState<string | null>(null);

    // Carregar estado padrão salvo do localStorage
    React.useEffect(() => {
        const saved = localStorage.getItem('catalog_appearance_default');
        const saveTime = localStorage.getItem('catalog_appearance_default_time');
        if (saved) {
            try {
                setDefaultState(JSON.parse(saved));
                setLastSaveTime(saveTime);
            } catch (e) {
                console.warn('Erro ao carregar estado padrão:', e);
            }
        }
    }, []);

    // 💾 Salvar estado atual como padrão
    const handleSaveAsDefault = async () => {
        try {
            const appearanceSettings = {
                theme_mode: settings.theme_mode,
                primary_color: settings.primary_color,
                secondary_color: settings.secondary_color,
                accent_color: settings.accent_color,
                background_color: settings.background_color,
                card_background: settings.card_background,
                text_primary: settings.text_primary,
                text_secondary: settings.text_secondary,
                layout_mode: settings.layout_mode,
                card_style: settings.card_style,
                grid_columns_mobile: settings.grid_columns_mobile,
                grid_columns_tablet: settings.grid_columns_tablet,
                grid_columns_desktop: settings.grid_columns_desktop,
            };

            localStorage.setItem('catalog_appearance_default', JSON.stringify(appearanceSettings));
            const now = new Date().toLocaleString('pt-BR');
            localStorage.setItem('catalog_appearance_default_time', now);
            setDefaultState(appearanceSettings);
            setLastSaveTime(now);
            alert('✅ Ponto de Restauração Salvo com Sucesso!');
        } catch (error) {
            console.error('Erro ao salvar padrão:', error);
            alert('❌ Erro ao salvar ponto de restauração');
        }
    };

    // ♻️ Restaurar para o estado padrão
    const handleRestoreDefault = () => {
        if (!defaultState) {
            alert('⚠️ Nenhum ponto de restauração disponível. Salve um primeiro!');
            return;
        }

        if (confirm('🔄 Deseja restaurar para o estado padrão salvo?')) {
            Object.entries(defaultState).forEach(([key, value]) => {
                updateSetting(key as keyof CatalogSettings, value as any);
            });
            alert('✅ Restaurado para o ponto salvo!');
        }
    };

    // 🎨 Presets Premium de Paletas
    const colorPresets = [
        {
            name: '🔥 Dark + Laranja',
            theme_mode: 'dark',
            primary_color: '#ff6b35',
            secondary_color: '#f7931e',
            accent_color: '#4ade80',
            background_color: '#0f1117',
            card_background: '#1a1f2e',
            text_primary: '#ffffff',
            text_secondary: '#a0aec0',
        },
        {
            name: '💼 Light + Azul',
            theme_mode: 'light',
            primary_color: '#1d4ed8',
            secondary_color: '#2563eb',
            accent_color: '#059669',
            background_color: '#f8fafc',
            card_background: '#ffffff',
            text_primary: '#1e293b',
            text_secondary: '#64748b',
        },
        {
            name: '✨ Dark + Roxo',
            theme_mode: 'dark',
            primary_color: '#8b5cf6',
            secondary_color: '#a855f7',
            accent_color: '#10b981',
            background_color: '#1a1a2e',
            card_background: '#16213e',
            text_primary: '#ffffff',
            text_secondary: '#cbd5e1',
        },
        {
            name: '🌿 Light + Verde',
            theme_mode: 'light',
            primary_color: '#059669',
            secondary_color: '#10b981',
            accent_color: '#1d4ed8',
            background_color: '#f0fdf4',
            card_background: '#ffffff',
            text_primary: '#064e3b',
            text_secondary: '#6b7280',
        },
        {
            name: '👑 Premium Dark',
            theme_mode: 'dark',
            primary_color: '#d4af37',
            secondary_color: '#fbbf24',
            accent_color: '#60a5fa',
            background_color: '#111827',
            card_background: '#1f2937',
            text_primary: '#f3f4f6',
            text_secondary: '#9ca3af',
        },
        {
            name: '🌅 Gradient Sunset',
            theme_mode: 'dark',
            primary_color: '#ff6e40',
            secondary_color: '#ff9100',
            accent_color: '#00bcd4',
            background_color: '#1a0033',
            card_background: '#2d1b4e',
            text_primary: '#ffd7b5',
            text_secondary: '#b39ddb',
        },
        {
            name: '🏙️ Urban Night',
            theme_mode: 'dark',
            primary_color: '#00d4ff',
            secondary_color: '#0099cc',
            accent_color: '#ff4081',
            background_color: '#0a0e27',
            card_background: '#151932',
            text_primary: '#e0f2f1',
            text_secondary: '#80deea',
        },
        {
            name: '🌳 Nature Fresh',
            theme_mode: 'light',
            primary_color: '#2e7d32',
            secondary_color: '#558b2f',
            accent_color: '#ff6f00',
            background_color: '#f1f8e9',
            card_background: '#ffffff',
            text_primary: '#1b5e20',
            text_secondary: '#558b2f',
        },
    ];

    const applyPreset = (preset: any) => {
        Object.entries(preset).forEach(([key, value]) => {
            updateSetting(key as keyof CatalogSettings, value as any);
        });
    };

    // Calcular contraste de cores simples
    const getContrastRatio = (color1: string, color2: string) => {
        const hex2rgb = (hex: string) => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result 
                ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
                : [0, 0, 0];
        };
        const getLuminance = (rgb: number[]) => {
            const [r, g, b] = rgb.map(x => x / 255);
            return 0.299 * r + 0.587 * g + 0.114 * b;
        };
        const rgb1 = hex2rgb(color1);
        const rgb2 = hex2rgb(color2);
        const l1 = getLuminance(rgb1);
        const l2 = getLuminance(rgb2);
        return l1 > l2 ? ((l1 + 0.05) / (l2 + 0.05)) : ((l2 + 0.05) / (l1 + 0.05));
    };

    const contrastRatio = getContrastRatio(settings.text_primary, settings.background_color);
    const isAccessible = contrastRatio >= 4.5;

    return (
        <div className="space-y-8">
            {/* 💾 PONTOS DE RESTAURAÇÃO */}
            <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 border-3 border-emerald-400 rounded-2xl p-8 shadow-xl">
                <h3 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-3">
                    <Save className="w-7 h-7 text-emerald-600" />
                    💾 Pontos de Restauração
                </h3>
                <p className="text-sm text-gray-600 mb-6">Salve o estado atual como padrão para restaurar depois</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    {/* Botão Salvar como Padrão */}
                    <button
                        onClick={handleSaveAsDefault}
                        className="group relative py-4 px-6 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold transition-all transform hover:scale-105 hover:shadow-2xl shadow-lg flex items-center justify-center gap-3"
                    >
                        <Save className="w-5 h-5" />
                        💾 Salvar Como Padrão
                    </button>

                    {/* Botão Restaurar Padrão */}
                    <button
                        onClick={handleRestoreDefault}
                        disabled={!defaultState}
                        className={`group relative py-4 px-6 rounded-xl font-bold transition-all transform ${
                            defaultState
                                ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:scale-105 hover:shadow-2xl shadow-lg'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        } flex items-center justify-center gap-3`}
                    >
                        ♻️ Restaurar Padrão
                    </button>
                </div>

                {/* Info sobre o último save */}
                {defaultState && lastSaveTime ? (
                    <div className="p-3 bg-white/80 backdrop-blur rounded-lg border border-emerald-300">
                        <p className="text-xs text-gray-600">
                            <span className="font-bold text-emerald-700">✅ Último ponto salvo:</span> {lastSaveTime}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                            Contém: Cores, Tema, Layout e Grid responsivo
                        </p>
                    </div>
                ) : (
                    <div className="p-3 bg-amber-50 rounded-lg border border-amber-300">
                        <p className="text-xs text-amber-700">
                            <span className="font-bold">⚠️ Nenhum ponto salvo.</span> Clique em "Salvar Como Padrão" para criar um!
                        </p>
                    </div>
                )}
            </div>

            {/* 🎨 PALETAS RÁPIDAS */}
            <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 border-3 border-purple-300 rounded-2xl p-8 shadow-lg">
                <h3 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-3">
                    <Palette className="w-7 h-7 text-purple-600" />
                    🎨 Paletas Premium
                </h3>
                <p className="text-sm text-gray-600 mb-6">Clique para aplicar instantaneamente toques profissionais</p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {colorPresets.map((preset, idx) => (
                        <button
                            key={idx}
                            onClick={() => applyPreset(preset)}
                            className="group relative overflow-hidden rounded-xl shadow-md hover:shadow-2xl transition-all transform hover:scale-105"
                            title={preset.name}
                        >
                            <div className="h-20 bg-gradient-to-br" style={{
                                backgroundImage: `linear-gradient(135deg, ${preset.primary_color} 0%, ${preset.secondary_color} 50%, ${preset.accent_color} 100%)`
                            }}>
                                <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors" />
                            </div>
                            <div className="p-2 bg-white/95 backdrop-blur">
                                <p className="text-xs font-bold text-gray-800 truncate">{preset.name}</p>
                                <div className="flex gap-1 mt-1">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: preset.primary_color }} />
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: preset.secondary_color }} />
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: preset.accent_color }} />
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* MODE */}
            <Section title="⚙️ Modo de Tema">
                <Select
                    label="Modo do tema"
                    description="Tema claro, escuro ou automático baseado nas preferências do usuário"
                    value={settings.theme_mode}
                    onChange={(value) => updateSetting('theme_mode', value as any)}
                    options={[
                        { value: 'light', label: '☀️ Claro' },
                        { value: 'dark', label: '🌙 Escuro' },
                        { value: 'auto', label: '🔄 Automático (segue sistema)' },
                    ]}
                />
            </Section>

            {/* CORES PRINCIPAIS */}
            <Section title="🎯 Cores Principais">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <ColorInput
                            label="Cor Primária ⭐"
                            description="Elemento principal (categorias, ícones ativos, CTAs)"
                            value={settings.primary_color}
                            onChange={(value) => updateSetting('primary_color', value)}
                        />
                    </div>
                    <div>
                        <ColorInput
                            label="Cor Secundária 🔷"
                            description="Elementos complementares (botões, links)"
                            value={settings.secondary_color}
                            onChange={(value) => updateSetting('secondary_color', value)}
                        />
                    </div>
                    <div>
                        <ColorInput
                            label="Cor de Destaque ✅"
                            description="Confirmação, sucesso, estoque disponível"
                            value={settings.accent_color}
                            onChange={(value) => updateSetting('accent_color', value)}
                        />
                    </div>
                </div>
            </Section>

            {/* CORES DE FUNDO E TEXTO */}
            <Section title="🖼️ Cores de Fundo e Tipografia">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <ColorInput
                            label="Fundo da Página 📄"
                            description="Cor de fundo geral do catálogo"
                            value={settings.background_color}
                            onChange={(value) => updateSetting('background_color', value)}
                        />
                    </div>
                    <div>
                        <ColorInput
                            label="Fundo dos Cards 📦"
                            description="Cards de produtos, seções, elementos"
                            value={settings.card_background}
                            onChange={(value) => updateSetting('card_background', value)}
                        />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <ColorInput
                            label="Texto Primário 📝"
                            description="Títulos, textos principais"
                            value={settings.text_primary}
                            onChange={(value) => updateSetting('text_primary', value)}
                        />
                    </div>
                    <div>
                        <ColorInput
                            label="Texto Secundário 💬"
                            description="Descrições, textos pequenos"
                            value={settings.text_secondary}
                            onChange={(value) => updateSetting('text_secondary', value)}
                        />
                    </div>
                </div>
            </Section>

            {/* ACESSIBILIDADE - CONTRASTE */}
            <div className={`border-2 rounded-xl p-6 ${isAccessible ? 'bg-green-50 border-green-300' : 'bg-amber-50 border-amber-300'}`}>
                <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                    {isAccessible ? '✅' : '⚠️'} Contraste de Acessibilidade
                </h3>
                <p className="text-sm mb-2">
                    Razão de contraste: <span className="font-bold">{contrastRatio.toFixed(2)}:1</span>
                </p>
                <p className={`text-sm ${isAccessible ? 'text-green-700' : 'text-amber-700'}`}>
                    {isAccessible 
                        ? '✅ Contraste suficiente para WCAG AA (≥4.5:1)'
                        : '⚠️ Contraste baixo - considere ajustar as cores para melhor acessibilidade'}
                </p>
            </div>

            {/* PREVIEW INTERATIVO */}
            <div className="bg-white border-3 border-gray-300 rounded-2xl p-8 shadow-2xl">
                <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                    ✨ Preview em Tempo Real
                </h3>
                
                {/* Fundo */}
                <div className="rounded-2xl p-8" style={{ backgroundColor: settings.background_color || '#f8fafc' }}>
                    {/* Header */}
                    <div className="mb-6 pb-4 border-b-2" style={{ borderColor: settings.primary_color }}>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: settings.primary_color }} />
                            <span className="font-bold text-lg" style={{ color: settings.text_primary }}>Meu Catálogo</span>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-6">
                        <span
                            className="px-3 py-1.5 rounded-full border text-xs font-semibold"
                            style={{
                                backgroundColor: settings.primary_color,
                                borderColor: settings.primary_color,
                                color: '#ffffff',
                            }}
                        >
                            Todos os Produtos
                        </span>
                        {getEnabledCatalogCollections().map(collection => (
                            <span
                                key={collection.key}
                                className="px-3 py-1.5 rounded-full border text-xs font-semibold"
                                style={{
                                    backgroundColor: settings.card_background || '#ffffff',
                                    borderColor: settings.primary_color + '40',
                                    color: settings.text_primary,
                                }}
                            >
                                {collection.label}
                            </span>
                        ))}
                    </div>

                    {/* Cards de Produto */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        {[1, 2, 3].map((i) => (
                            <div 
                                key={i}
                                className="rounded-xl p-4 border-2 transition-transform hover:scale-105" 
                                style={{ 
                                    backgroundColor: settings.card_background || '#ffffff',
                                    borderColor: settings.primary_color + '30'
                                }}
                            >
                                <div className="h-32 rounded-lg mb-3" style={{ backgroundColor: settings.primary_color + '20' }} />
                                <h4 className="font-bold mb-1" style={{ color: settings.text_primary }}>Produto {i}</h4>
                                <p className="text-sm mb-3" style={{ color: settings.text_secondary }}>Descrição breve do produto</p>
                                
                                <div className="flex gap-2">
                                    <button 
                                        className="flex-1 py-2 rounded-lg text-white font-semibold text-sm transition-opacity hover:opacity-90" 
                                        style={{ backgroundColor: settings.primary_color }}
                                    >
                                        Comprar
                                    </button>
                                    <button 
                                        className="px-3 py-2 rounded-lg text-white font-semibold text-sm transition-opacity hover:opacity-90" 
                                        style={{ backgroundColor: settings.secondary_color }}
                                    >
                                        ❤️
                                    </button>
                                </div>
                                
                                <div className="mt-3 px-2 py-1 rounded-lg text-white text-xs font-bold text-center" style={{ backgroundColor: settings.accent_color }}>
                                    EM ESTOQUE
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* CTA Principal */}
                    <div className="flex gap-3">
                        <button 
                            className="flex-1 py-4 rounded-xl text-white font-bold text-lg transition-opacity hover:opacity-90"
                            style={{ 
                                backgroundColor: settings.primary_color,
                                boxShadow: `0 4px 15px ${settings.primary_color}40`
                            }}
                        >
                            Ver Todos os Produtos
                        </button>
                        <button 
                            className="px-6 py-4 rounded-xl border-2 font-bold transition-opacity"
                            style={{ 
                                borderColor: settings.primary_color,
                                color: settings.primary_color
                            }}
                        >
                            Filtros
                        </button>
                    </div>
                </div>
            </div>

            {/* LAYOUT */}
            <Section title="📊 Configurações de Layout">
                <Select
                    label="Modo de exibição"
                    description="Como os produtos serão organizados"
                    value={settings.layout_mode}
                    onChange={(value) => updateSetting('layout_mode', value as any)}
                    options={[
                        { value: 'grid', label: '📦 Grade (recomendado)' },
                        { value: 'list', label: '📋 Lista' },
                        { value: 'both', label: '🔄 Ambos (usuário escolhe)' },
                    ]}
                />
                <Select
                    label="Estilo dos cards"
                    description="Aparência visual dos cards de produtos"
                    value={settings.card_style}
                    onChange={(value) => updateSetting('card_style', value as any)}
                    options={[
                        { value: 'modern', label: '🚀 Moderno (elevado, sombra)' },
                        { value: 'classic', label: '📌 Clássico (bordas)' },
                        { value: 'minimal', label: '✨ Minimalista (clean)' },
                    ]}
                />
            </Section>

            {/* GRADE RESPONSIVA */}
            <Section title="📱 Grade Responsiva (Quantas colunas?)">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                    <p className="text-sm text-blue-700">💡 Ajuste quantos cards aparecem em cada resolução</p>
                </div>
                <NumberInput
                    label="Mobile (até 640px) 📱"
                    description="Celulares em portrait"
                    value={settings.grid_columns_mobile}
                    onChange={(value) => updateSetting('grid_columns_mobile', value)}
                    min={1}
                    max={2}
                />
                <NumberInput
                    label="Tablet (até 1024px) 📲"
                    description="Tablets e telas médias"
                    value={settings.grid_columns_tablet}
                    onChange={(value) => updateSetting('grid_columns_tablet', value)}
                    min={1}
                    max={4}
                />
                <NumberInput
                    label="Desktop (1024px+) 🖥️"
                    description="Computadores e telas grandes"
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
