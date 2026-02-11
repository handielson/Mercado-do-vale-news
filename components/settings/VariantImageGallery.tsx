import React, { useState, useEffect } from 'react';
import { X, Upload, Trash2, Star, GripVertical } from 'lucide-react';
import type { ModelVariantWithDetails, ModelVariantImage } from '../../types/model-architecture';
import { modelVariantsService } from '../../services/model-variants';

interface VariantImageGalleryProps {
    isOpen: boolean;
    onClose: () => void;
    variant: ModelVariantWithDetails;
}

export const VariantImageGallery: React.FC<VariantImageGalleryProps> = ({
    isOpen,
    onClose,
    variant
}) => {
    const [images, setImages] = useState<ModelVariantImage[]>([]);
    const [uploading, setUploading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

    useEffect(() => {
        if (isOpen) {
            loadImages();
        }
    }, [isOpen, variant.id]);

    const loadImages = async () => {
        try {
            setLoading(true);
            const imagesData = await modelVariantsService.getImages(variant.id);
            setImages(imagesData);
        } catch (err) {
            setError('Erro ao carregar imagens');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setUploading(true);
        setError('');

        try {
            // Upload cada arquivo
            for (const file of Array.from(files)) {
                // Validar tipo
                if (!file.type.startsWith('image/')) {
                    setError(`${file.name} não é uma imagem válida`);
                    continue;
                }

                // Validar tamanho (max 5MB)
                if (file.size > 5 * 1024 * 1024) {
                    setError(`${file.name} é muito grande (max 5MB)`);
                    continue;
                }

                // Upload
                const result = await modelVariantsService.uploadImage(variant.id, file);

                if (!result.success) {
                    setError(result.error || 'Erro ao fazer upload');
                    continue;
                }

                // Adicionar ao banco
                await modelVariantsService.addImage({
                    variant_id: variant.id,
                    image_url: result.image_url!,
                    display_order: images.length,
                    is_primary: images.length === 0
                });
            }

            // Recarregar imagens
            await loadImages();
        } catch (err) {
            setError('Erro ao fazer upload das imagens');
            console.error(err);
        } finally {
            setUploading(false);
            // Limpar input
            e.target.value = '';
        }
    };

    const handleSetPrimary = async (imageId: string) => {
        try {
            await modelVariantsService.setPrimaryImage(imageId);
            await loadImages();
        } catch (err) {
            setError('Erro ao definir imagem principal');
        }
    };

    const handleRemove = async (imageId: string) => {
        if (!confirm('Remover esta imagem?')) return;

        try {
            await modelVariantsService.removeImage(imageId);
            await loadImages();
        } catch (err) {
            setError('Erro ao remover imagem');
        }
    };

    const handleDragStart = (index: number) => {
        setDraggedIndex(index);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();

        if (draggedIndex === null || draggedIndex === index) return;

        // Reordenar array
        const newImages = [...images];
        const draggedImage = newImages[draggedIndex];
        newImages.splice(draggedIndex, 1);
        newImages.splice(index, 0, draggedImage);

        setImages(newImages);
        setDraggedIndex(index);
    };

    const handleDragEnd = async () => {
        if (draggedIndex === null) return;

        try {
            // Salvar nova ordem
            const imageIds = images.map(img => img.id);
            await modelVariantsService.reorderImages(variant.id, imageIds);
        } catch (err) {
            setError('Erro ao salvar ordem');
            await loadImages(); // Reverter
        } finally {
            setDraggedIndex(null);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Galeria de Imagens</h2>
                        <p className="text-sm text-slate-600">
                            {variant.model?.name} - {variant.version?.name} - {variant.color?.name}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    {/* Upload */}
                    <div>
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <Upload className="w-8 h-8 mb-2 text-slate-400" />
                                <p className="mb-2 text-sm text-slate-600">
                                    <span className="font-semibold">Clique para fazer upload</span> ou arraste imagens
                                </p>
                                <p className="text-xs text-slate-500">PNG, JPG, WEBP (max 5MB cada)</p>
                            </div>
                            <input
                                type="file"
                                className="hidden"
                                multiple
                                accept="image/*"
                                onChange={handleFileSelect}
                                disabled={uploading}
                            />
                        </label>
                    </div>

                    {/* Loading */}
                    {loading && (
                        <div className="text-center py-8 text-slate-500">Carregando imagens...</div>
                    )}

                    {/* Uploading */}
                    {uploading && (
                        <div className="text-center py-4 text-blue-600">Fazendo upload...</div>
                    )}

                    {/* Gallery */}
                    {!loading && images.length === 0 && (
                        <div className="text-center py-8 text-slate-500">
                            Nenhuma imagem adicionada ainda
                        </div>
                    )}

                    {!loading && images.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold text-slate-700 mb-3">
                                Imagens ({images.length}) - Arraste para reordenar
                            </h3>
                            <div className="grid grid-cols-3 gap-4">
                                {images.map((image, index) => (
                                    <div
                                        key={image.id}
                                        draggable
                                        onDragStart={() => handleDragStart(index)}
                                        onDragOver={(e) => handleDragOver(e, index)}
                                        onDragEnd={handleDragEnd}
                                        className={`relative group cursor-move border-2 rounded-lg overflow-hidden ${image.is_primary ? 'border-yellow-400' : 'border-slate-200'
                                            } ${draggedIndex === index ? 'opacity-50' : ''}`}
                                    >
                                        {/* Imagem */}
                                        <img
                                            src={image.image_url}
                                            alt={`Imagem ${index + 1}`}
                                            className="w-full h-48 object-cover"
                                        />

                                        {/* Overlay */}
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                                            {/* Drag Handle */}
                                            <div className="absolute top-2 left-2 p-1 bg-white/90 rounded">
                                                <GripVertical size={16} className="text-slate-600" />
                                            </div>

                                            {/* Primary Star */}
                                            <button
                                                onClick={() => handleSetPrimary(image.id)}
                                                className={`p-2 rounded-lg ${image.is_primary
                                                        ? 'bg-yellow-500 text-white'
                                                        : 'bg-white/90 text-slate-600 hover:bg-yellow-100'
                                                    }`}
                                                title="Definir como principal"
                                            >
                                                <Star size={18} fill={image.is_primary ? 'currentColor' : 'none'} />
                                            </button>

                                            {/* Remove */}
                                            <button
                                                onClick={() => handleRemove(image.id)}
                                                className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                                                title="Remover"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>

                                        {/* Badge de Ordem */}
                                        <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 text-white text-xs rounded">
                                            #{index + 1}
                                        </div>

                                        {/* Badge Principal */}
                                        {image.is_primary && (
                                            <div className="absolute top-2 right-2 px-2 py-1 bg-yellow-500 text-white text-xs rounded flex items-center gap-1">
                                                <Star size={12} fill="currentColor" />
                                                Principal
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                            {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t bg-slate-50 sticky bottom-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Concluído
                    </button>
                </div>
            </div>
        </div>
    );
};
