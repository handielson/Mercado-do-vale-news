import React, { useState, useEffect } from 'react';
import { Image as ImageIcon, Loader2, X, GripVertical } from 'lucide-react';
import { modelColorImageService, ModelColorImage } from '../../../services/modelColorImages';
import { compressImage } from '../../../utils/image-compression';

interface ImageGallerySharedProps {
    modelId: string;
    colorId: string;
    modelName: string;
    colorName: string;
}

/**
 * ImageGalleryShared Component
 * Shared image gallery for NEW products (Model+Color)
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Images shared across all products with same Model+Color
 * - Drag & drop reordering
 * - First image is always the cover
 * - Maximum 5 images
 */
export function ImageGalleryShared({
    modelId,
    colorId,
    modelName,
    colorName
}: ImageGallerySharedProps) {
    const [images, setImages] = useState<ModelColorImage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

    const MAX_IMAGES = 5;

    // Load images on mount
    useEffect(() => {
        loadImages();
    }, [modelId, colorId]);

    const loadImages = async () => {
        try {
            setIsLoading(true);
            const data = await modelColorImageService.getByModelAndColor(modelId, colorId);
            setImages(data);
        } catch (error) {
            console.error('Error loading images:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;

        const remainingSlots = MAX_IMAGES - images.length;
        if (remainingSlots <= 0) {
            alert(`Limite de ${MAX_IMAGES} imagens atingido.`);
            return;
        }

        setIsUploading(true);
        const files = Array.from(e.target.files).slice(0, remainingSlots);

        try {
            for (const file of files) {
                // Compress image
                const compressed = await compressImage(file);

                // Convert to base64
                const reader = new FileReader();
                const base64Promise = new Promise<string>((resolve, reject) => {
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(compressed);
                });

                const base64String = await base64Promise;

                // Save to database
                await modelColorImageService.create({
                    model_id: modelId,
                    color_id: colorId,
                    image_url: base64String
                });
            }

            // Reload images
            await loadImages();
        } catch (error) {
            console.error('Error uploading images:', error);
            alert('Erro ao fazer upload das imagens');
        } finally {
            setIsUploading(false);
            e.target.value = '';
        }
    };

    const handleRemoveImage = async (imageId: string) => {
        if (!confirm('Remover esta imagem? Isso afetará todos os produtos com este modelo e cor.')) {
            return;
        }

        try {
            await modelColorImageService.delete(imageId);
            await loadImages();
        } catch (error) {
            console.error('Error removing image:', error);
            alert('Erro ao remover imagem');
        }
    };

    const handleDragStart = (index: number) => {
        setDraggedIndex(index);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === index) return;

        // Reorder array
        const newImages = [...images];
        const draggedItem = newImages[draggedIndex];
        newImages.splice(draggedIndex, 1);
        newImages.splice(index, 0, draggedItem);

        setImages(newImages);
        setDraggedIndex(index);
    };

    const handleDragEnd = async () => {
        if (draggedIndex === null) return;

        try {
            // Save new order to database
            const imageIds = images.map(img => img.id);
            await modelColorImageService.reorderAll(modelId, colorId, imageIds);
        } catch (error) {
            console.error('Error saving order:', error);
            alert('Erro ao salvar ordem das imagens');
            await loadImages(); // Reload to restore original order
        } finally {
            setDraggedIndex(null);
        }
    };

    if (isLoading) {
        return (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="animate-spin text-blue-500" size={24} />
                    <span className="ml-2 text-slate-600">Carregando imagens...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                    <ImageIcon size={18} className="text-blue-600" />
                    Galeria Compartilhada (Modelo + Cor)
                </h3>
                <span className="text-sm text-slate-600">
                    {images.length} / {MAX_IMAGES} imagens
                </span>
            </div>

            {/* Info banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                <strong>🔍 {modelName} + {colorName}</strong>
                <p className="mt-1 text-xs">
                    Estas imagens são compartilhadas com TODOS os produtos desta combinação.
                    Arraste para reordenar. A primeira imagem é a capa.
                </p>
            </div>

            {/* Image grid */}
            <div className="grid grid-cols-5 gap-4">
                {images.map((image, index) => (
                    <div
                        key={image.id}
                        draggable
                        onDragStart={() => handleDragStart(index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragEnd={handleDragEnd}
                        className="relative aspect-square group cursor-move"
                    >
                        <img
                            src={image.image_url}
                            alt={`Imagem ${index + 1}`}
                            className="w-full h-full object-cover rounded-lg border-2 border-slate-200"
                        />

                        {/* Cover indicator */}
                        {index === 0 && (
                            <div className="absolute top-1 left-1 bg-blue-500 text-white text-xs px-2 py-0.5 rounded">
                                ⭐ CAPA
                            </div>
                        )}

                        {/* Order number */}
                        <div className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
                            {index + 1}
                        </div>

                        {/* Drag handle */}
                        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <GripVertical size={16} className="text-white drop-shadow" />
                        </div>

                        {/* Remove button */}
                        <button
                            type="button"
                            onClick={() => handleRemoveImage(image.id)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                        >
                            <X size={12} />
                        </button>
                    </div>
                ))}

                {/* Upload button */}
                {images.length < MAX_IMAGES && (
                    <label className="flex flex-col items-center justify-center aspect-square rounded-lg border-2 border-dashed border-slate-300 cursor-pointer hover:bg-slate-50 hover:border-blue-400 transition-colors">
                        {isUploading ? (
                            <>
                                <Loader2 className="animate-spin text-blue-500 mb-1" size={20} />
                                <span className="text-xs text-slate-500">Enviando...</span>
                            </>
                        ) : (
                            <>
                                <ImageIcon className="text-slate-400 mb-1" size={20} />
                                <span className="text-xs text-slate-500">Adicionar</span>
                            </>
                        )}
                        <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={handleImageUpload}
                            disabled={isUploading}
                        />
                    </label>
                )}
            </div>

            {images.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4">
                    Nenhuma imagem cadastrada. Adicione imagens para este modelo e cor.
                </p>
            )}
        </div>
    );
}
