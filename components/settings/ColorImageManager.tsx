/**
 * Color Image Manager Component
 * Manages images for ALL color variations of a model simultaneously
 */

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { modelColorImagesService } from '../../services/model-color-images';
import { colorService } from '../../services/colors';
import { compressImage } from '../../utils/image-compression';
import type { Color } from '../../types/color';

interface ColorImageManagerProps {
    modelId: string;
}

interface ColorWithImages {
    color: Color;
    images: string[];
    loading: boolean;
    uploading: boolean;
}

export const ColorImageManager: React.FC<ColorImageManagerProps> = ({ modelId }) => {
    const [colorData, setColorData] = useState<ColorWithImages[]>([]);
    const [expandedColors, setExpandedColors] = useState<Set<string>>(new Set());
    const [initialLoading, setInitialLoading] = useState(true);

    useEffect(() => {
        loadAllColors();
    }, [modelId]);

    const loadAllColors = async () => {
        setInitialLoading(true);
        try {
            const colors = await colorService.list();

            // Load images for all colors in parallel
            const colorDataPromises = colors.map(async (color) => {
                try {
                    const data = await modelColorImagesService.get(modelId, color.id);
                    return {
                        color,
                        images: data?.images || [],
                        loading: false,
                        uploading: false
                    };
                } catch (error) {
                    console.error(`Error loading images for ${color.name}:`, error);
                    return {
                        color,
                        images: [],
                        loading: false,
                        uploading: false
                    };
                }
            });

            const loadedData = await Promise.all(colorDataPromises);
            setColorData(loadedData);

            // Auto-expand colors that have images
            const hasImages = new Set(
                loadedData
                    .filter(cd => cd.images.length > 0)
                    .map(cd => cd.color.id)
            );
            setExpandedColors(hasImages);
        } catch (error) {
            console.error('Error loading colors:', error);
            toast.error('Erro ao carregar cores');
        } finally {
            setInitialLoading(false);
        }
    };

    const toggleColor = (colorId: string) => {
        setExpandedColors(prev => {
            const newSet = new Set(prev);
            if (newSet.has(colorId)) {
                newSet.delete(colorId);
            } else {
                newSet.add(colorId);
            }
            return newSet;
        });
    };

    const handleImageUpload = async (colorId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        // Update uploading state
        setColorData(prev => prev.map(cd =>
            cd.color.id === colorId ? { ...cd, uploading: true } : cd
        ));

        try {
            const uploadedImages: string[] = [];

            for (const file of Array.from(files)) {
                const compressed = await compressImage(file);
                const reader = new FileReader();
                const base64Promise = new Promise<string>((resolve, reject) => {
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(compressed);
                });

                const base64String = await base64Promise;
                uploadedImages.push(base64String);
            }

            // Get current images for this color
            const currentData = colorData.find(cd => cd.color.id === colorId);
            const newImages = [...(currentData?.images || []), ...uploadedImages];

            // Save to database
            await modelColorImagesService.upsert({
                model_id: modelId,
                color_id: colorId,
                images: newImages
            });

            // Update state
            setColorData(prev => prev.map(cd =>
                cd.color.id === colorId
                    ? { ...cd, images: newImages, uploading: false }
                    : cd
            ));

            const colorName = colorData.find(cd => cd.color.id === colorId)?.color.name || 'esta cor';
            toast.success(`✅ ${uploadedImages.length} foto(s) adicionada(s) para ${colorName}!`);
        } catch (error) {
            console.error('Error uploading images:', error);
            toast.error('❌ Erro ao fazer upload das imagens');

            // Reset uploading state
            setColorData(prev => prev.map(cd =>
                cd.color.id === colorId ? { ...cd, uploading: false } : cd
            ));
        }
    };

    const handleRemoveImage = async (colorId: string, imageIndex: number) => {
        const currentData = colorData.find(cd => cd.color.id === colorId);
        if (!currentData) return;

        const newImages = currentData.images.filter((_, i) => i !== imageIndex);

        try {
            await modelColorImagesService.upsert({
                model_id: modelId,
                color_id: colorId,
                images: newImages
            });

            setColorData(prev => prev.map(cd =>
                cd.color.id === colorId ? { ...cd, images: newImages } : cd
            ));

            toast.success('Foto removida com sucesso');
        } catch (error) {
            console.error('Error removing image:', error);
            toast.error('Erro ao remover imagem');
        }
    };

    const handleReorderImage = async (colorId: string, fromIndex: number, toIndex: number) => {
        const currentData = colorData.find(cd => cd.color.id === colorId);
        if (!currentData) return;

        const newImages = [...currentData.images];
        const [removed] = newImages.splice(fromIndex, 1);
        newImages.splice(toIndex, 0, removed);

        try {
            await modelColorImagesService.upsert({
                model_id: modelId,
                color_id: colorId,
                images: newImages
            });

            setColorData(prev => prev.map(cd =>
                cd.color.id === colorId ? { ...cd, images: newImages } : cd
            ));
        } catch (error) {
            console.error('Error reordering images:', error);
            toast.error('Erro ao reordenar imagens');
        }
    };

    if (initialLoading) {
        return (
            <div className="text-center py-8 text-slate-500">
                Carregando cores...
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {colorData.map((cd) => {
                const isExpanded = expandedColors.has(cd.color.id);
                const hasImages = cd.images.length > 0;

                return (
                    <div
                        key={cd.color.id}
                        className={`border rounded-lg overflow-hidden transition-all ${hasImages ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white'
                            }`}
                    >
                        {/* Color Header */}
                        <button
                            onClick={() => toggleColor(cd.color.id)}
                            className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-6 h-6 rounded border-2 border-slate-300"
                                    style={{ backgroundColor: cd.color.hex || '#ccc' }}
                                />
                                <span className="font-medium text-slate-800">{cd.color.name}</span>
                                {hasImages && (
                                    <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">
                                        {cd.images.length} {cd.images.length === 1 ? 'foto' : 'fotos'}
                                    </span>
                                )}
                            </div>
                            <span className="text-slate-400">
                                {isExpanded ? '▼' : '▶'}
                            </span>
                        </button>

                        {/* Images Grid (Expanded) */}
                        {isExpanded && (
                            <div className="p-4 border-t border-slate-200">
                                <div className="grid grid-cols-5 gap-3">
                                    {/* Existing Images */}
                                    {cd.images.map((url, index) => (
                                        <div key={index} className="relative group aspect-square">
                                            <img
                                                src={url}
                                                alt={`${cd.color.name} - Foto ${index + 1}`}
                                                className="w-full h-full object-cover rounded-lg border-2 border-slate-200"
                                            />
                                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all rounded-lg flex items-center justify-center gap-1">
                                                {index > 0 && (
                                                    <button
                                                        onClick={() => handleReorderImage(cd.color.id, index, index - 1)}
                                                        className="opacity-0 group-hover:opacity-100 bg-white text-slate-700 p-1.5 rounded hover:bg-slate-100 transition-all text-xs"
                                                        title="Mover para esquerda"
                                                    >
                                                        ←
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleRemoveImage(cd.color.id, index)}
                                                    className="opacity-0 group-hover:opacity-100 bg-red-500 text-white p-1.5 rounded hover:bg-red-600 transition-all text-xs"
                                                    title="Remover"
                                                >
                                                    🗑️
                                                </button>
                                                {index < cd.images.length - 1 && (
                                                    <button
                                                        onClick={() => handleReorderImage(cd.color.id, index, index + 1)}
                                                        className="opacity-0 group-hover:opacity-100 bg-white text-slate-700 p-1.5 rounded hover:bg-slate-100 transition-all text-xs"
                                                        title="Mover para direita"
                                                    >
                                                        →
                                                    </button>
                                                )}
                                            </div>
                                            <div className="absolute top-1 left-1 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded">
                                                {index + 1}
                                            </div>
                                        </div>
                                    ))}

                                    {/* Upload Button */}
                                    <label className="aspect-square border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            onChange={(e) => handleImageUpload(cd.color.id, e)}
                                            disabled={cd.uploading}
                                            className="hidden"
                                        />
                                        {cd.uploading ? (
                                            <div className="text-center">
                                                <div className="animate-spin text-xl mb-1">⏳</div>
                                                <span className="text-xs text-slate-500">Enviando...</span>
                                            </div>
                                        ) : (
                                            <div className="text-center">
                                                <div className="text-2xl mb-1">+</div>
                                                <span className="text-xs text-slate-500">Adicionar</span>
                                            </div>
                                        )}
                                    </label>
                                </div>

                                {cd.images.length === 0 && (
                                    <div className="text-center py-6 text-slate-400 text-sm">
                                        Nenhuma foto cadastrada para esta cor.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
