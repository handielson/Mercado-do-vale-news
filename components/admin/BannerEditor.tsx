import React, { useState } from 'react';
import { Upload, Trash2, GripVertical, Link as LinkIcon, X } from 'lucide-react';
import type { CatalogBanner } from '@/types/catalog';

interface BannerEditorProps {
    banners: CatalogBanner[];
    onChange: (banners: CatalogBanner[]) => void;
}

/**
 * Editor de Banners com Upload, Reordenação e Exclusão
 * Permite gerenciar banners do catálogo com drag-and-drop
 */
export function BannerEditor({ banners, onChange }: BannerEditorProps) {
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [editingBanner, setEditingBanner] = useState<string | null>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        // TODO: Upload para Supabase Storage
        // Por enquanto, criar banners placeholder
        const newBanners: CatalogBanner[] = Array.from(files).map((file, index) => ({
            id: `temp-${Date.now()}-${index}`,
            image_url: URL.createObjectURL(file),
            title: file.name,
            is_active: true,
            display_order: banners.length + index,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }));

        onChange([...banners, ...newBanners]);
    };

    const handleDelete = (bannerId: string) => {
        if (!confirm('Remover este banner?')) return;
        onChange(banners.filter(b => b.id !== bannerId));
    };

    const handleDragStart = (index: number) => {
        setDraggedIndex(index);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === index) return;

        const newBanners = [...banners];
        const draggedBanner = newBanners[draggedIndex];
        newBanners.splice(draggedIndex, 1);
        newBanners.splice(index, 0, draggedBanner);

        // Atualizar display_order
        const updatedBanners = newBanners.map((banner, idx) => ({
            ...banner,
            display_order: idx
        }));

        onChange(updatedBanners);
        setDraggedIndex(index);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
    };

    const handleLinkChange = (bannerId: string, field: keyof CatalogBanner, value: any) => {
        onChange(banners.map(b =>
            b.id === bannerId ? { ...b, [field]: value } : b
        ));
    };

    return (
        <div className="space-y-4">
            {/* Upload Area */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors">
                <input
                    type="file"
                    id="banner-upload"
                    multiple
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                />
                <label
                    htmlFor="banner-upload"
                    className="cursor-pointer flex flex-col items-center gap-2"
                >
                    <Upload className="w-8 h-8 text-gray-400" />
                    <div>
                        <p className="text-sm font-medium text-gray-700">
                            Clique para fazer upload de banners
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                            PNG, JPG até 5MB
                        </p>
                    </div>
                </label>
            </div>

            {/* Banners List */}
            {banners.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                    Nenhum banner adicionado ainda
                </div>
            ) : (
                <div className="space-y-3">
                    {banners.map((banner, index) => (
                        <div
                            key={banner.id}
                            draggable
                            onDragStart={() => handleDragStart(index)}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDragEnd={handleDragEnd}
                            className={`bg-white border rounded-lg p-4 transition-all ${draggedIndex === index
                                    ? 'opacity-50 scale-95'
                                    : 'opacity-100 scale-100'
                                } hover:shadow-md cursor-move`}
                        >
                            <div className="flex items-start gap-4">
                                {/* Drag Handle */}
                                <div className="flex-shrink-0 pt-2">
                                    <GripVertical className="w-5 h-5 text-gray-400" />
                                </div>

                                {/* Banner Preview */}
                                <div className="flex-shrink-0">
                                    <img
                                        src={banner.image_url}
                                        alt={banner.title || 'Banner'}
                                        className="w-32 h-20 object-cover rounded border border-gray-200"
                                    />
                                </div>

                                {/* Banner Info */}
                                <div className="flex-1 space-y-3">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                            Título (opcional)
                                        </label>
                                        <input
                                            type="text"
                                            value={banner.title || ''}
                                            onChange={(e) => handleLinkChange(banner.id, 'title', e.target.value)}
                                            placeholder="Título do banner"
                                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>

                                    {/* Link Configuration */}
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setEditingBanner(editingBanner === banner.id ? null : banner.id)}
                                            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                                        >
                                            <LinkIcon className="w-3 h-3" />
                                            {banner.link_url || banner.link_product_id || banner.link_category_id
                                                ? 'Editar Link'
                                                : 'Adicionar Link'}
                                        </button>
                                        {(banner.link_url || banner.link_product_id || banner.link_category_id) && (
                                            <span className="text-xs text-gray-500">
                                                Link configurado
                                            </span>
                                        )}
                                    </div>

                                    {/* Link Editor */}
                                    {editingBanner === banner.id && (
                                        <div className="bg-gray-50 rounded p-3 space-y-2">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-medium text-gray-700">
                                                    Configurar Link
                                                </span>
                                                <button
                                                    onClick={() => setEditingBanner(null)}
                                                    className="text-gray-400 hover:text-gray-600"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-600 mb-1">
                                                    URL Externa
                                                </label>
                                                <input
                                                    type="url"
                                                    value={banner.link_url || ''}
                                                    onChange={(e) => handleLinkChange(banner.id, 'link_url', e.target.value)}
                                                    placeholder="https://exemplo.com"
                                                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                                />
                                            </div>
                                            <p className="text-xs text-gray-500 italic">
                                                Ou configure produto/categoria no futuro
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Delete Button */}
                                <div className="flex-shrink-0">
                                    <button
                                        onClick={() => handleDelete(banner.id)}
                                        className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                                        title="Remover banner"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Info */}
            {banners.length > 0 && (
                <div className="text-xs text-gray-500 text-center">
                    💡 Arraste os banners para reordenar
                </div>
            )}
        </div>
    );
}
