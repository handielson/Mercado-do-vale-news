import React, { useState, useRef } from 'react';
import { X, Upload, Users, Eye, EyeOff } from 'lucide-react';
import type { CatalogBanner } from '@/types/catalog';
import { uploadService } from '@/services/uploadService';

// ─── Constants ───────────────────────────────────────────────────────────────

const AUDIENCE_OPTIONS = [
    { value: 'varejo', label: '🛒 Varejo', color: 'border-blue-400 bg-blue-50 text-blue-700' },
    { value: 'revenda', label: '🤝 Revenda', color: 'border-green-400 bg-green-50 text-green-700' },
    { value: 'atacado', label: '📦 Atacado', color: 'border-orange-400 bg-orange-50 text-orange-700' },
] as const;

const LINK_OPTIONS = [
    { value: 'none', label: '⊘ Sem Link' },
    { value: 'category', label: '📁 Categoria' },
    { value: 'product', label: '📦 Produto' },
    { value: 'external', label: '🔗 URL Externa' },
] as const;

// ─── Types ───────────────────────────────────────────────────────────────────

interface BannerFormProps {
    banner?: CatalogBanner;
    onSave: (data: Partial<CatalogBanner>) => Promise<void>;
    onClose: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const BannerForm: React.FC<BannerFormProps> = ({ banner, onSave, onClose }) => {
    // Bug fix: start_date e end_date armazenados como string diretamente
    // (sem dupla conversão via new Date())
    const [formData, setFormData] = useState({
        title: banner?.title ?? '',
        subtitle: banner?.subtitle ?? '',
        image_url: banner?.image_url ?? '',
        background_color: banner?.background_color ?? '#020617',
        link_type: (banner?.link_type ?? 'none') as 'none' | 'product' | 'category' | 'external',
        // Bug fix: unificar link_target e link_value (campo canônico = link_target)
        link_target: banner?.link_target ?? banner?.link_value ?? '',
        is_active: banner?.is_active ?? true,
        display_order: banner?.display_order ?? 0,
        target_audience: banner?.target_audience ?? ([] as string[]),
        // Bug fix: valor direto do datetime-local — sem conversão no input
        start_date: banner?.start_date
            ? new Date(banner.start_date).toISOString().slice(0, 16)
            : '',
        end_date: banner?.end_date
            ? new Date(banner.end_date).toISOString().slice(0, 16)
            : '',
    });

    const [imagePreview, setImagePreview] = useState(banner?.image_url ?? '');
    const [isUploading, setIsUploading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── Upload ──────────────────────────────────────────────────────────────

    const handleImageUpload = async (file: File) => {
        const validation = uploadService.validateImageFile(file);
        if (!validation.valid) { alert(validation.error); return; }

        setIsUploading(true);
        try {
            // Preview instantâneo via FileReader
            const reader = new FileReader();
            reader.onloadend = () => setImagePreview(reader.result as string);
            reader.readAsDataURL(file);

            const imageUrl = await uploadService.uploadBannerImage(file);
            setFormData(p => ({ ...p, image_url: imageUrl }));
            setImagePreview(imageUrl);
        } catch (error: any) {
            alert(error.message || 'Erro ao fazer upload da imagem');
            setImagePreview('');
            setFormData(p => ({ ...p, image_url: '' }));
        } finally {
            setIsUploading(false);
        }
    };

    const toggleAudience = (value: string) => {
        setFormData(p => ({
            ...p,
            target_audience: p.target_audience.includes(value)
                ? p.target_audience.filter(a => a !== value)
                : [...p.target_audience, value],
        }));
    };

    // ── Submit ──────────────────────────────────────────────────────────────

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.title.trim()) { alert('Por favor, preencha o título'); return; }
        if (!formData.image_url.trim()) { alert('Por favor, adicione uma imagem'); return; }

        setIsSaving(true);
        try {
            // Bug fix: strings vazias → undefined (VPS espera null/undefined, não '')
            const payload: Partial<CatalogBanner> = {
                title: formData.title.trim(),
                subtitle: formData.subtitle.trim() || undefined,
                image_url: formData.image_url,
                background_color: formData.background_color,
                link_type: formData.link_type,
                link_target: formData.link_target.trim() || undefined,
                is_active: formData.is_active,
                display_order: formData.display_order,
                target_audience: formData.target_audience,
                start_date: formData.start_date ? new Date(formData.start_date) : undefined,
                end_date: formData.end_date ? new Date(formData.end_date) : undefined,
            };
            await onSave(payload);
            onClose();
        } catch (error) {
            console.error('Erro ao salvar banner:', error);
            alert('Erro ao salvar banner');
        } finally {
            setIsSaving(false);
        }
    };

    // ── Render ──────────────────────────────────────────────────────────────

    return (
        <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full my-8">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <h2 className="text-xl font-bold text-gray-900">
                        {banner ? 'Editar Banner' : 'Novo Banner'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">

                    {/* Live Preview */}
                    {imagePreview && (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-700">Preview do Carrossel</span>
                                <button
                                    type="button"
                                    onClick={() => setShowPreview(p => !p)}
                                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                                >
                                    {showPreview ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                    {showPreview ? 'Ocultar' : 'Ver preview'}
                                </button>
                            </div>
                            {showPreview && (
                                <div
                                    className="relative w-full aspect-[21/9] rounded-xl overflow-hidden"
                                    style={{ backgroundColor: formData.background_color }}
                                >
                                    <img
                                        src={imagePreview}
                                        alt="Preview"
                                        className="w-full h-full object-contain"
                                        style={{ backgroundColor: formData.background_color }}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent">
                                        <div className="absolute bottom-0 left-0 right-0 p-6">
                                            <h2 className="text-white text-2xl font-bold drop-shadow-lg">
                                                {formData.title || 'Título do banner'}
                                            </h2>
                                            {formData.subtitle && (
                                                <p className="text-white/90 text-base drop-shadow-lg mt-1">
                                                    {formData.subtitle}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="absolute top-3 right-3 px-2 py-1 rounded-full bg-black/30 text-white text-xs font-semibold">
                                        1 / 1
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Image Upload */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Imagem *</label>
                        <div className="mb-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <p className="text-xs text-blue-700">
                                📐 Recomendado: 1200×400px (21:9) — PNG, JPG ou WEBP, máx 5MB
                            </p>
                        </div>
                        <div
                            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleImageUpload(f); }}
                            onDragOver={(e) => e.preventDefault()}
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors cursor-pointer"
                        >
                            {isUploading ? (
                                <div className="space-y-2">
                                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto" />
                                    <p className="text-sm text-blue-600 font-medium">Fazendo upload...</p>
                                </div>
                            ) : imagePreview ? (
                                <div className="space-y-3">
                                    <img
                                        src={imagePreview}
                                        alt="Preview"
                                        className="max-h-40 mx-auto rounded-lg"
                                        onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/800x300?text=Imagem+inválida'; }}
                                    />
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setImagePreview(''); setFormData(p => ({ ...p, image_url: '' })); }}
                                        className="text-sm text-red-600 hover:text-red-700 transition-colors"
                                    >
                                        Remover imagem
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <Upload className="w-10 h-10 mx-auto text-gray-400" />
                                    <p className="text-sm text-gray-600">Arraste ou clique para selecionar</p>
                                </div>
                            )}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }}
                            />
                        </div>
                        <div className="mt-3">
                            <label className="block text-xs text-gray-500 mb-1">Ou cole a URL da imagem</label>
                            <input
                                type="url"
                                value={formData.image_url}
                                onChange={(e) => { setFormData(p => ({ ...p, image_url: e.target.value })); setImagePreview(e.target.value); }}
                                placeholder="https://exemplo.com/banner.jpg"
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    {/* Background Color */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Cor do fundo</label>
                        <div className="flex items-center gap-3">
                            <input
                                type="color"
                                value={formData.background_color}
                                onChange={(e) => setFormData(p => ({ ...p, background_color: e.target.value }))}
                                className="h-10 w-14 rounded-lg border border-gray-300 bg-white p-1"
                                aria-label="Cor do fundo do banner"
                            />
                            <input
                                type="text"
                                value={formData.background_color}
                                onChange={(e) => setFormData(p => ({ ...p, background_color: e.target.value }))}
                                className="w-32 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="#020617"
                            />
                            <span className="text-xs text-gray-500">
                                Aparece nas bordas quando a arte não ocupa todo o quadro.
                            </span>
                        </div>
                    </div>

                    {/* Title */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Título *</label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))}
                            placeholder="Ex: Promoção Xiaomi Redmi Note 15"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            required
                        />
                    </div>

                    {/* Subtitle */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Subtítulo <span className="text-gray-400 font-normal">(opcional)</span>
                        </label>
                        <input
                            type="text"
                            value={formData.subtitle}
                            onChange={(e) => setFormData(p => ({ ...p, subtitle: e.target.value }))}
                            placeholder="Ex: Preços especiais por tempo limitado"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    {/* Target Audience */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                            <Users className="w-4 h-4" /> Público-Alvo
                        </label>
                        <p className="text-xs text-gray-500 mb-3">
                            Deixe sem seleção para exibir para <strong>todos</strong> os visitantes
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {AUDIENCE_OPTIONS.map(opt => {
                                const selected = formData.target_audience.includes(opt.value);
                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => toggleAudience(opt.value)}
                                        className={`px-4 py-2 rounded-full border-2 text-sm font-medium transition-all ${selected
                                                ? opt.color
                                                : 'border-gray-200 text-gray-500 hover:border-gray-300'
                                            }`}
                                    >
                                        {opt.label}
                                    </button>
                                );
                            })}
                        </div>
                        {formData.target_audience.length === 0 && (
                            <p className="text-xs text-green-600 mt-2">👥 Visível para todos os visitantes</p>
                        )}
                    </div>

                    {/* Link Type */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Link</label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                            {LINK_OPTIONS.map(opt => (
                                <label
                                    key={opt.value}
                                    className={`flex items-center justify-center px-3 py-2 border-2 rounded-lg cursor-pointer transition-all text-sm font-medium ${formData.link_type === opt.value
                                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                                        }`}
                                >
                                    <input
                                        type="radio"
                                        name="link_type"
                                        value={opt.value}
                                        checked={formData.link_type === opt.value}
                                        onChange={(e) => setFormData(p => ({
                                            ...p,
                                            link_type: e.target.value as typeof formData.link_type,
                                            link_target: '',
                                        }))}
                                        className="sr-only"
                                    />
                                    {opt.label}
                                </label>
                            ))}
                        </div>
                        {formData.link_type !== 'none' && (
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                    {formData.link_type === 'category' ? 'Slug da Categoria (ex: smartphones)' :
                                        formData.link_type === 'product' ? 'Link, ID ou slug do produto' :
                                            'URL Completa'}
                                </label>
                                <input
                                    type={formData.link_type === 'external' ? 'url' : 'text'}
                                    value={formData.link_target}
                                    onChange={(e) => setFormData(p => ({ ...p, link_target: e.target.value }))}
                                    placeholder={
                                        formData.link_type === 'category' ? 'smartphones' :
                                            formData.link_type === 'product' ? 'https://www.mercadodovale.com.br/produto/abc123-uuid...' :
                                                'https://exemplo.com'
                                    }
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                        )}
                    </div>

                    {/* Dates — Bug fix: valor direto, sem conversão no input */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">📅 Data de Início</label>
                            <input
                                type="datetime-local"
                                value={formData.start_date}
                                onChange={(e) => setFormData(p => ({ ...p, start_date: e.target.value }))}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                            <p className="text-xs text-gray-500 mt-1">Vazio = exibe imediatamente</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">📅 Data de Término</label>
                            <input
                                type="datetime-local"
                                value={formData.end_date}
                                onChange={(e) => setFormData(p => ({ ...p, end_date: e.target.value }))}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                            <p className="text-xs text-gray-500 mt-1">Vazio = sem expiração</p>
                        </div>
                    </div>

                    {/* Active Toggle */}
                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            id="is_active"
                            checked={formData.is_active}
                            onChange={(e) => setFormData(p => ({ ...p, is_active: e.target.checked }))}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                            Banner ativo (visível no catálogo)
                        </label>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving || isUploading}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {isSaving ? 'Salvando...' : banner ? 'Salvar Alterações' : 'Criar Banner'}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
};
