import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, Link as LinkIcon, QrCode, Eye, EyeOff, Palette, Settings as SettingsIcon, Edit } from 'lucide-react';

interface CatalogSettings {
    catalog_name: string;
    catalog_description: string;
    products_per_page: number;
    default_sort: 'recent' | 'price_asc' | 'price_desc' | 'name';
    show_filters: boolean;
    show_prices: boolean;
    show_stock: boolean;
    theme_primary_color: string;
    theme_secondary_color: string;
    meta_title: string;
    meta_description: string;
    meta_keywords: string;
}

export const CatalogSettingsPage: React.FC = () => {
    const navigate = useNavigate();
    const [settings, setSettings] = useState<CatalogSettings>({
        catalog_name: 'Catálogo de Produtos',
        catalog_description: 'Confira nossos produtos disponíveis',
        products_per_page: 12,
        default_sort: 'recent',
        show_filters: true,
        show_prices: true,
        show_stock: true,
        theme_primary_color: '#3B82F6',
        theme_secondary_color: '#1E40AF',
        meta_title: 'Catálogo de Produtos - Mercado do Vale',
        meta_description: 'Confira nosso catálogo completo de produtos',
        meta_keywords: 'produtos, catálogo, loja'
    });

    const [saving, setSaving] = useState(false);
    const [showQR, setShowQR] = useState(false);

    const catalogUrl = `${window.location.origin}/catalog`;

    const handleSave = async () => {
        setSaving(true);
        try {
            // TODO: Salvar no Supabase
            await new Promise(resolve => setTimeout(resolve, 1000));
            alert('Configurações salvas com sucesso!');
        } catch (error) {
            console.error('Erro ao salvar:', error);
            alert('Erro ao salvar configurações');
        } finally {
            setSaving(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert('Link copiado para a área de transferência!');
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Configurações do Catálogo</h1>
                    <p className="text-gray-600 mt-1">Personalize a aparência e comportamento do seu catálogo</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/admin/catalog-editor')}
                        className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                        <Edit className="w-5 h-5" />
                        Editar Catálogo
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                        <Save className="w-5 h-5" />
                        {saving ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                </div>
            </div>

            {/* 🎯 ATALHO: Configuração de Badges */}
            <div className="bg-gradient-to-r from-purple-50 via-pink-50 to-purple-50 border-2 border-purple-300 rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-purple-600 rounded-lg">
                                <SettingsIcon className="w-6 h-6 text-white" />
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
                                navigator.clipboard.writeText(filePath);
                                alert('📋 Caminho copiado! Abra no VS Code: ' + filePath);
                            }}
                            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all font-semibold shadow-md hover:shadow-lg flex items-center gap-2 whitespace-nowrap"
                        >
                            <Edit className="w-5 h-5" />
                            Editar Badges
                        </button>
                        <p className="text-xs text-purple-600 text-center">
                            config/category-badges.ts
                        </p>
                    </div>
                </div>
            </div>

            {/* Informações Gerais */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                    <SettingsIcon className="w-5 h-5 text-blue-600" />
                    <h2 className="text-xl font-semibold text-gray-900">Informações Gerais</h2>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Nome do Catálogo
                        </label>
                        <input
                            type="text"
                            value={settings.catalog_name}
                            onChange={(e) => setSettings({ ...settings, catalog_name: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Descrição
                        </label>
                        <textarea
                            value={settings.catalog_description}
                            onChange={(e) => setSettings({ ...settings, catalog_description: e.target.value })}
                            rows={3}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                </div>
            </div>

            {/* Configurações de Exibição */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Eye className="w-5 h-5 text-blue-600" />
                    <h2 className="text-xl font-semibold text-gray-900">Configurações de Exibição</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Produtos por Página
                        </label>
                        <select
                            value={settings.products_per_page}
                            onChange={(e) => setSettings({ ...settings, products_per_page: Number(e.target.value) })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value={6}>6 produtos</option>
                            <option value={12}>12 produtos</option>
                            <option value={24}>24 produtos</option>
                            <option value={48}>48 produtos</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Ordenação Padrão
                        </label>
                        <select
                            value={settings.default_sort}
                            onChange={(e) => setSettings({ ...settings, default_sort: e.target.value as any })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="recent">Mais Recentes</option>
                            <option value="name">Nome (A-Z)</option>
                            <option value="price_asc">Menor Preço</option>
                            <option value="price_desc">Maior Preço</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            id="show_filters"
                            checked={settings.show_filters}
                            onChange={(e) => setSettings({ ...settings, show_filters: e.target.checked })}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="show_filters" className="text-sm font-medium text-gray-700">
                            Mostrar Filtros
                        </label>
                    </div>

                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            id="show_prices"
                            checked={settings.show_prices}
                            onChange={(e) => setSettings({ ...settings, show_prices: e.target.checked })}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="show_prices" className="text-sm font-medium text-gray-700">
                            Mostrar Preços
                        </label>
                    </div>

                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            id="show_stock"
                            checked={settings.show_stock}
                            onChange={(e) => setSettings({ ...settings, show_stock: e.target.checked })}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="show_stock" className="text-sm font-medium text-gray-700">
                            Mostrar Estoque
                        </label>
                    </div>
                </div>
            </div>

            {/* Tema e Cores */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Palette className="w-5 h-5 text-blue-600" />
                    <h2 className="text-xl font-semibold text-gray-900">Tema e Cores</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Cor Primária
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="color"
                                value={settings.theme_primary_color}
                                onChange={(e) => setSettings({ ...settings, theme_primary_color: e.target.value })}
                                className="w-16 h-10 rounded border border-gray-300 cursor-pointer"
                            />
                            <input
                                type="text"
                                value={settings.theme_primary_color}
                                onChange={(e) => setSettings({ ...settings, theme_primary_color: e.target.value })}
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Cor Secundária
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="color"
                                value={settings.theme_secondary_color}
                                onChange={(e) => setSettings({ ...settings, theme_secondary_color: e.target.value })}
                                className="w-16 h-10 rounded border border-gray-300 cursor-pointer"
                            />
                            <input
                                type="text"
                                value={settings.theme_secondary_color}
                                onChange={(e) => setSettings({ ...settings, theme_secondary_color: e.target.value })}
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Compartilhamento */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                    <LinkIcon className="w-5 h-5 text-blue-600" />
                    <h2 className="text-xl font-semibold text-gray-900">Compartilhamento</h2>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Link Público do Catálogo
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={catalogUrl}
                                readOnly
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                            />
                            <button
                                onClick={() => copyToClipboard(catalogUrl)}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                Copiar
                            </button>
                            <button
                                onClick={() => setShowQR(!showQR)}
                                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
                            >
                                <QrCode className="w-4 h-4" />
                                QR Code
                            </button>
                        </div>
                    </div>

                    {showQR && (
                        <div className="p-4 bg-gray-50 rounded-lg text-center">
                            <p className="text-sm text-gray-600 mb-2">QR Code do Catálogo</p>
                            <div className="inline-block p-4 bg-white rounded-lg">
                                <img
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(catalogUrl)}`}
                                    alt="QR Code"
                                    className="w-48 h-48"
                                />
                            </div>
                            <p className="text-xs text-gray-500 mt-2">Escaneie para acessar o catálogo</p>
                        </div>
                    )}
                </div>
            </div>

            {/* SEO */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                    <SettingsIcon className="w-5 h-5 text-blue-600" />
                    <h2 className="text-xl font-semibold text-gray-900">SEO (Otimização para Buscadores)</h2>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Meta Título
                        </label>
                        <input
                            type="text"
                            value={settings.meta_title}
                            onChange={(e) => setSettings({ ...settings, meta_title: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            maxLength={60}
                        />
                        <p className="text-xs text-gray-500 mt-1">{settings.meta_title.length}/60 caracteres</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Meta Descrição
                        </label>
                        <textarea
                            value={settings.meta_description}
                            onChange={(e) => setSettings({ ...settings, meta_description: e.target.value })}
                            rows={3}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            maxLength={160}
                        />
                        <p className="text-xs text-gray-500 mt-1">{settings.meta_description.length}/160 caracteres</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Palavras-chave (separadas por vírgula)
                        </label>
                        <input
                            type="text"
                            value={settings.meta_keywords}
                            onChange={(e) => setSettings({ ...settings, meta_keywords: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="produtos, catálogo, loja"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CatalogSettingsPage;
