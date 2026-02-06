import React, { useState, useRef } from 'react';
import { X, Upload, Link as LinkIcon } from 'lucide-react';
import type { CatalogBanner } from '@/types/catalog';
import { uploadService } from '@/services/uploadService';

interface BannerFormProps {
    banner?: CatalogBanner;
    onSave: (data: Partial<CatalogBanner>) => Promise<void>;
    onClose: () => void;
}

export const BannerForm: React.FC<BannerFormProps> = ({
    banner,
    onSave,
    onClose
}) => {
    const [formData, setFormData] = useState({
        title: banner?.title || '',
        image_url: banner?.image_url || '',
        link_type: banner?.link_type || 'none' as const,
        link_target: banner?.link_target || '',
        is_active: banner?.is_active ?? true,
        display_order: banner?.display_order ?? 0,
        start_date: banner?.start_date || null,
        end_date: banner?.end_date || null
    });

    const [imagePreview, setImagePreview] = useState(banner?.image_url || '');
    const [isUploading, setIsUploading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageUpload = async (file: File) => {
        // Validar arquivo antes de fazer upload
        const validation = uploadService.validateImageFile(file);
        if (!validation.valid) {
            alert(validation.error);
            return;
        }

        setIsUploading(true);
        try {
            // Create preview local primeiro para feedback imediato
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);

            // Fazer upload real para Supabase Storage
            const imageUrl = await uploadService.uploadBannerImage(file);

            // Atualizar com a URL pública do Supabase
            setFormData(prev => ({ ...prev, image_url: imageUrl }));
            setImagePreview(imageUrl);
        } catch (error: any) {
            console.error('Erro ao fazer upload:', error);
            alert(error.message || 'Erro ao fazer upload da imagem');
            // Limpar preview em caso de erro
            setImagePreview('');
            setFormData(prev => ({ ...prev, image_url: '' }));
        } finally {
            setIsUploading(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) handleImageUpload(file);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.title.trim()) {
            alert('Por favor, preencha o título do banner');
            return;
        }

        if (!formData.image_url.trim()) {
            alert('Por favor, adicione uma imagem');
            return;
        }

        setIsSaving(true);
        try {
            await onSave(formData);
            onClose();
        } catch (error) {
            console.error('Erro ao salvar banner:', error);
            alert('Erro ao salvar banner');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <h2 className="text-xl font-semibold text-gray-900">
                        {banner ? 'Editar Banner' : 'Novo Banner'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Image Upload */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Imagem do Banner *
                        </label>
                        <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <p className="text-sm text-blue-800 font-medium mb-1">📐 Tamanho Recomendado:</p>
                            <p className="text-xs text-blue-700">
                                • Desktop: 1200x400px (proporção 3:1)<br />
                                • Mobile: 800x600px (proporção 4:3)<br />
                                • Formato: PNG, JPG ou WEBP
                            </p>
                        </div>
                        <div
                            onDrop={handleDrop}
                            onDragOver={(e) => e.preventDefault()}
                            className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors cursor-pointer"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {isUploading ? (
                                <div className="space-y-3">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                                    <p className="text-blue-600 font-medium">Fazendo upload...</p>
                                    <p className="text-xs text-gray-500">Aguarde enquanto enviamos sua imagem</p>
                                </div>
                            ) : imagePreview ? (
                                <div className="space-y-4">
                                    <img
                                        src={imagePreview}
                                        alt="Preview"
                                        className="max-h-48 mx-auto rounded-lg"
                                        onError={(e) => {
                                            e.currentTarget.src = 'https://via.placeholder.com/800x300/E5E7EB/9CA3AF?text=Erro+ao+Carregar';
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setImagePreview('');
                                            setFormData(prev => ({ ...prev, image_url: '' }));
                                        }}
                                        className="text-sm text-red-600 hover:text-red-700"
                                    >
                                        Remover Imagem
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <Upload className="w-12 h-12 mx-auto text-gray-400" />
                                    <p className="text-gray-600">
                                        Arraste uma imagem ou clique para selecionar
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        PNG, JPG ou WEBP (recomendado: 1200x400px)
                                    </p>
                                </div>
                            )}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleImageUpload(file);
                                }}
                            />
                        </div>

                        {/* URL Input Alternative */}
                        <div className="mt-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Ou cole a URL da imagem
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="url"
                                    value={formData.image_url}
                                    onChange={(e) => {
                                        setFormData(prev => ({ ...prev, image_url: e.target.value }));
                                        setImagePreview(e.target.value);
                                    }}
                                    placeholder="https://exemplo.com/imagem.jpg"
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Title */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Título *
                        </label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                            placeholder="Ex: Promoção Xiaomi Redmi Note 15"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            required
                        />
                    </div>

                    {/* Link Type */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Tipo de Link
                        </label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {[
                                { value: 'none', label: 'Sem Link' },
                                { value: 'category', label: 'Categoria' },
                                { value: 'product', label: 'Produto' },
                                { value: 'external', label: 'URL Externa' }
                            ].map((option) => (
                                <label
                                    key={option.value}
                                    className={`
                    flex items-center justify-center px-4 py-2 border-2 rounded-lg cursor-pointer transition-all
                    ${formData.link_type === option.value
                                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                                            : 'border-gray-300 hover:border-gray-400'}
                  `}
                                >
                                    <input
                                        type="radio"
                                        name="link_type"
                                        value={option.value}
                                        checked={formData.link_type === option.value}
                                        onChange={(e) => setFormData(prev => ({
                                            ...prev,
                                            link_type: e.target.value as any,
                                            link_target: ''
                                        }))}
                                        className="sr-only"
                                    />
                                    <span className="text-sm font-medium">{option.label}</span>
                                </label>
                            ))}
                        </div>
                        <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600">
                            <p className="font-medium mb-1">💡 Como usar os links:</p>
                            <ul className="space-y-1 ml-4">
                                <li>• <strong>Categoria:</strong> Digite o slug da categoria (ex: smartphones, tablets)</li>
                                <li>• <strong>Produto:</strong> Digite o ID do produto para link direto</li>
                                <li>• <strong>URL Externa:</strong> Cole o link completo (ex: https://exemplo.com)</li>
                                <li>• <strong>Sem Link:</strong> Banner apenas visual, sem clique</li>
                            </ul>
                        </div>
                    </div>

                    {/* Link Target */}
                    {formData.link_type !== 'none' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                {formData.link_type === 'category' && 'ID da Categoria'}
                                {formData.link_type === 'product' && 'ID do Produto'}
                                {formData.link_type === 'external' && 'URL'}
                            </label>
                            <input
                                type="text"
                                value={formData.link_target}
                                onChange={(e) => setFormData(prev => ({ ...prev, link_target: e.target.value }))}
                                placeholder={
                                    formData.link_type === 'category' ? 'smartphones' :
                                        formData.link_type === 'product' ? 'abc123' :
                                            'https://exemplo.com'
                                }
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    )}

                    {/* Schedule Dates */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                📅 Data de Início (opcional)
                            </label>
                            <input
                                type="datetime-local"
                                value={formData.start_date ? new Date(formData.start_date).toISOString().slice(0, 16) : ''}
                                onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value || null }))}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Banner será exibido a partir desta data
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                📅 Data de Término (opcional)
                            </label>
                            <input
                                type="datetime-local"
                                value={formData.end_date ? new Date(formData.end_date).toISOString().slice(0, 16) : ''}
                                onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value || null }))}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Banner será ocultado após esta data
                            </p>
                        </div>
                    </div>

                    {/* Active Toggle */}
                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            id="is_active"
                            checked={formData.is_active}
                            onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                            Banner ativo (visível no catálogo)
                        </label>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-4 border-t">
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
