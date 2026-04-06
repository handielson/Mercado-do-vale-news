import React, { useState } from 'react';
import { Loader2, X, Upload, GripVertical } from 'lucide-react';
import { getCacheBustedUrl } from '../../../utils/cache-buster';

interface ProductImagesProps {
    imagePreviews: string[];
    isCompressing: boolean;
    handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    removeImage: (index: number) => void;
    onReorder?: (newImages: string[]) => void;
    useCustomImages?: boolean;
    onToggleCustomImages?: (value: boolean) => void;
    hasDefaultImages?: boolean;
    updatedAt?: string | Date | null;
}

const MAX_IMAGES = 5;

export function ProductImages({
    imagePreviews,
    isCompressing,
    handleImageUpload,
    removeImage,
    onReorder,
    useCustomImages = false,
    onToggleCustomImages,
    hasDefaultImages = false,
    updatedAt
}: ProductImagesProps) {
    const canAddMore = imagePreviews.length < MAX_IMAGES;
    const remainingSlots = MAX_IMAGES - imagePreviews.length;
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    const handleDragStart = (index: number) => {
        setDraggedIndex(index);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === index) return;
        setDragOverIndex(index);
    };

    const handleDrop = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === index || !onReorder) return;

        const newImages = [...imagePreviews];
        const draggedItem = newImages[draggedIndex];
        newImages.splice(draggedIndex, 1);
        newImages.splice(index, 0, draggedItem);

        onReorder(newImages);
        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    return (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-800">Imagens do Produto</h3>
                <span className="text-sm text-slate-600">
                    {imagePreviews.length} / {MAX_IMAGES} imagens
                </span>
            </div>

            {onReorder && imagePreviews.length > 1 && (
                <p className="text-xs text-slate-400 flex items-center gap-1">
                    <GripVertical size={12} /> Arraste as imagens para reordenar. A primeira é a capa.
                </p>
            )}

            {/* Toggle for custom images (used products) */}
            {hasDefaultImages && onToggleCustomImages && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={useCustomImages}
                            onChange={(e) => onToggleCustomImages(e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        />
                        <div>
                            <span className="text-sm font-medium text-blue-900">
                                📸 Produto usado - usar fotos customizadas
                            </span>
                            <p className="text-xs text-blue-700 mt-0.5">
                                {useCustomImages
                                    ? 'Você pode fazer upload de fotos específicas deste produto'
                                    : 'Usando fotos padrão do modelo. Marque para produtos usados com fotos próprias.'}
                            </p>
                        </div>
                    </label>
                </div>
            )}

            {!canAddMore && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                    ⚠️ Limite de {MAX_IMAGES} imagens atingido. Remova uma imagem para adicionar outra.
                </div>
            )}

            <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
                {imagePreviews.map((src, index) => (
                    <div
                        key={index}
                        draggable={!!onReorder}
                        onDragStart={() => handleDragStart(index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDrop={(e) => handleDrop(e, index)}
                        onDragEnd={handleDragEnd}
                        className={[
                            'relative aspect-square group transition-all',
                            draggedIndex === index ? 'opacity-40 scale-95' : '',
                            dragOverIndex === index && draggedIndex !== index
                                ? 'ring-2 ring-blue-500 ring-offset-1 rounded-lg'
                                : '',
                            onReorder ? 'cursor-move' : '',
                        ].join(' ')}
                    >
                        <img
                            src={getCacheBustedUrl(src, updatedAt)}
                            alt={`Imagem ${index + 1}`}
                            className="w-full h-full object-cover rounded-lg border border-slate-200"
                        />

                        {/* Badge CAPA na primeira imagem */}
                        {index === 0 && (
                            <div className="absolute top-1 left-1 bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded font-semibold">
                                CAPA
                            </div>
                        )}

                        {/* Botão remover */}
                        <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                            title="Remover imagem"
                        >
                            <X size={12} />
                        </button>

                        {/* Número da posição */}
                        <div className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
                            {index + 1}
                        </div>

                        {/* Ícone de arraste */}
                        {onReorder && (
                            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <GripVertical size={14} className="text-white drop-shadow" />
                            </div>
                        )}
                    </div>
                ))}

                {canAddMore && (
                    <label
                        className={`flex flex-col items-center justify-center aspect-square rounded-lg border-2 border-dashed border-slate-300 cursor-pointer hover:bg-slate-50 hover:border-blue-400 transition-colors ${isCompressing ? 'opacity-50 cursor-wait' : ''}`}
                        title={`Adicionar imagem (${remainingSlots} ${remainingSlots === 1 ? 'restante' : 'restantes'})`}
                    >
                        {isCompressing ? (
                            <>
                                <Loader2 className="animate-spin text-blue-500 mb-1" size={20} />
                                <span className="text-xs text-slate-500">Processando...</span>
                            </>
                        ) : (
                            <>
                                <Upload className="text-slate-400 mb-1" size={20} />
                                <span className="text-xs text-slate-500">Adicionar</span>
                                <span className="text-xs text-slate-400">({remainingSlots})</span>
                            </>
                        )}
                        <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={handleImageUpload}
                            disabled={isCompressing || !canAddMore}
                        />
                    </label>
                )}
            </div>

            {imagePreviews.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4">
                    Nenhuma imagem adicionada. Clique no botão acima para fazer upload.
                </p>
            )}
        </div>
    );
}
