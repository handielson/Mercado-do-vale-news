import React from 'react';
import { Pencil, Trash2, GripVertical, Eye, EyeOff } from 'lucide-react';
import type { CatalogBanner } from '@/types/catalog';

interface BannerCardProps {
    banner: CatalogBanner;
    onEdit: (banner: CatalogBanner) => void;
    onDelete: (id: string) => void;
    onToggleActive: (id: string, isActive: boolean) => void;
    isDragging?: boolean;
}

export const BannerCard: React.FC<BannerCardProps> = ({
    banner,
    onEdit,
    onDelete,
    onToggleActive,
    isDragging = false
}) => {
    const getLinkTypeLabel = () => {
        switch (banner.link_type) {
            case 'category':
                return '📁 Categoria';
            case 'product':
                return '📦 Produto';
            case 'external':
                return '🔗 Link Externo';
            default:
                return '⊘ Sem Link';
        }
    };

    return (
        <div
            className={`
        bg-white rounded-lg border-2 transition-all duration-200
        ${isDragging ? 'border-blue-400 shadow-lg scale-105' : 'border-gray-200 hover:border-gray-300'}
        ${!banner.is_active ? 'opacity-60' : ''}
      `}
        >
            <div className="p-4">
                <div className="flex items-start gap-4">
                    {/* Drag Handle */}
                    <div className="flex-shrink-0 cursor-grab active:cursor-grabbing pt-2">
                        <GripVertical className="w-5 h-5 text-gray-400" />
                    </div>

                    {/* Banner Preview */}
                    <div className="flex-shrink-0">
                        <div className="w-32 h-20 rounded-lg overflow-hidden bg-gray-100 relative">
                            {banner.image_url ? (
                                <img
                                    src={banner.image_url}
                                    alt={banner.title || 'Banner'}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        e.currentTarget.src = 'https://via.placeholder.com/320x200/E5E7EB/9CA3AF?text=Sem+Imagem';
                                    }}
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                                    Sem Imagem
                                </div>
                            )}
                            {!banner.is_active && (
                                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                                    <EyeOff className="w-6 h-6 text-white" />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Banner Info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-2">
                            <h3 className="font-semibold text-gray-900 truncate">
                                {banner.title || 'Sem título'}
                            </h3>
                            <div className="flex items-center gap-1 flex-shrink-0">
                                <span className={`
                  px-2 py-1 rounded-full text-xs font-medium
                  ${banner.is_active
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-gray-100 text-gray-600'}
                `}>
                                    {banner.is_active ? 'Ativo' : 'Inativo'}
                                </span>
                            </div>
                        </div>

                        <div className="space-y-1 text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                                <span className="font-medium">{getLinkTypeLabel()}</span>
                                {banner.link_target && (
                                    <span className="text-gray-500">→ {banner.link_target}</span>
                                )}
                            </div>
                            {(banner.start_date || banner.end_date) && (
                                <div className="text-xs text-gray-500 flex items-center gap-1">
                                    📅
                                    {banner.start_date && (
                                        <span>
                                            De: {new Date(banner.start_date).toLocaleDateString('pt-BR', {
                                                day: '2-digit',
                                                month: '2-digit',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </span>
                                    )}
                                    {banner.end_date && (
                                        <span>
                                            {banner.start_date && ' | '}
                                            Até: {new Date(banner.end_date).toLocaleDateString('pt-BR', {
                                                day: '2-digit',
                                                month: '2-digit',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </span>
                                    )}
                                </div>
                            )}
                            <div className="text-xs text-gray-500">
                                Ordem: {banner.display_order}
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 flex-shrink-0">
                        <button
                            onClick={() => onToggleActive(banner.id, !banner.is_active)}
                            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title={banner.is_active ? 'Desativar' : 'Ativar'}
                        >
                            {banner.is_active ? (
                                <Eye className="w-4 h-4" />
                            ) : (
                                <EyeOff className="w-4 h-4" />
                            )}
                        </button>
                        <button
                            onClick={() => onEdit(banner)}
                            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar"
                        >
                            <Pencil className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => {
                                if (confirm('Tem certeza que deseja excluir este banner?')) {
                                    onDelete(banner.id);
                                }
                            }}
                            className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Excluir"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
