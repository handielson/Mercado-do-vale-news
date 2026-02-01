import React from 'react';
import { Loader2, X, Upload } from 'lucide-react';

interface ProductImagesProps {
    imagePreviews: string[];
    isCompressing: boolean;
    handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    removeImage: (index: number) => void;
}

const MAX_IMAGES = 5;

export function ProductImages({
    imagePreviews,
    isCompressing,
    handleImageUpload,
    removeImage
}: ProductImagesProps) {
    const canAddMore = imagePreviews.length < MAX_IMAGES;
    const remainingSlots = MAX_IMAGES - imagePreviews.length;

    return (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-800">Imagens do Produto</h3>
                <span className="text-sm text-slate-600">
                    {imagePreviews.length} / {MAX_IMAGES} imagens
                </span>
            </div>

            {!canAddMore && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                    ⚠️ Limite de {MAX_IMAGES} imagens atingido. Remova uma imagem para adicionar outra.
                </div>
            )}

            <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
                {imagePreviews.map((src, index) => (
                    <div key={index} className="relative aspect-square group">
                        <img
                            src={src}
                            alt={`Imagem ${index + 1}`}
                            className="w-full h-full object-cover rounded-lg border border-slate-200"
                        />
                        <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                            title="Remover imagem"
                        >
                            <X size={12} />
                        </button>
                        <div className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
                            {index + 1}
                        </div>
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
