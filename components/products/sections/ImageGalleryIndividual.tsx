import React, { useState } from 'react';
import { Image as ImageIcon, Loader2, X, GripVertical } from 'lucide-react';
import { compressImage } from '../../../utils/image-compression';

interface ImageGalleryIndividualProps {
    images: string[];
    onChange: (images: string[]) => void;
}

/**
 * ImageGalleryIndividual Component
 * Individual image gallery for USED products
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Images unique to this product
 * - Drag & drop reordering
 * - First image is always the cover
 * - Maximum 5 images
 */
export function ImageGalleryIndividual({
    images,
    onChange
}: ImageGalleryIndividualProps) {
    const [isUploading, setIsUploading] = useState(false);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

    const MAX_IMAGES = 5;

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
            const processedImages: string[] = [];
            for (const file of files) {
                const compressed = await compressImage(file);

                // Convert to base64
                const reader = new FileReader();
                const base64Promise = new Promise<string>((resolve, reject) => {
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(compressed);
                });

                const base64String = await base64Promise;
                processedImages.push(base64String);
            }

            onChange([...images, ...processedImages]);
        } catch (error) {
            console.error('Error uploading images:', error);
            alert('Erro ao fazer upload das imagens');
        } finally {
            setIsUploading(false);
            e.target.value = '';
        }
    };

    const handleRemoveImage = (index: number) => {
        const newImages = images.filter((_, i) => i !== index);
        onChange(newImages);
    };

    const handleDragStart = (index: number) => {
        setDraggedIndex(index);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === index) return;

        const newImages = [...images];
        const draggedItem = newImages[draggedIndex];
        newImages.splice(draggedIndex, 1);
        newImages.splice(index, 0, draggedItem);

        onChange(newImages);
        setDraggedIndex(index);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
    };

    return (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                    <ImageIcon size={18} className="text-amber-600" />
                    Galeria Individual (Produto Usado)
                </h3>
                <span className="text-sm text-slate-600">
                    {images.length} / {MAX_IMAGES} imagens
                </span>
            </div>

            {/* Warning banner */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                <strong>⚠️ PRODUTO USADO - Imagens Individuais</strong>
                <p className="mt-1 text-xs">
                    Adicione fotos do estado REAL deste produto. Mostre arranhões, desgaste, etc.
                    Arraste para reordenar. A primeira imagem é a capa.
                </p>
            </div>

            {/* Image grid */}
            <div className="grid grid-cols-5 gap-4">
                {images.map((imageUrl, index) => (
                    <div
                        key={index}
                        draggable
                        onDragStart={() => handleDragStart(index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragEnd={handleDragEnd}
                        className="relative aspect-square group cursor-move"
                    >
                        <img
                            src={imageUrl}
                            alt={`Imagem ${index + 1}`}
                            className="w-full h-full object-cover rounded-lg border-2 border-slate-200"
                        />

                        {/* Cover indicator */}
                        {index === 0 && (
                            <div className="absolute top-1 left-1 bg-amber-500 text-white text-xs px-2 py-0.5 rounded">
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
                            onClick={() => handleRemoveImage(index)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                        >
                            <X size={12} />
                        </button>
                    </div>
                ))}

                {/* Upload button */}
                {images.length < MAX_IMAGES && (
                    <label className="flex flex-col items-center justify-center aspect-square rounded-lg border-2 border-dashed border-amber-300 cursor-pointer hover:bg-amber-50 hover:border-amber-400 transition-colors">
                        {isUploading ? (
                            <>
                                <Loader2 className="animate-spin text-amber-500 mb-1" size={20} />
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
                    Nenhuma imagem adicionada. Adicione fotos do estado real deste produto usado.
                </p>
            )}
        </div>
    );
}
