import React from 'react';
import { Pencil, Trash2, GripVertical, Eye, EyeOff, Copy, MousePointerClick } from 'lucide-react';
import type { CatalogBanner } from '@/types/catalog';

// ─── Constants ───────────────────────────────────────────────────────────────

const AUDIENCE_PILLS: Record<string, { label: string; className: string }> = {
    varejo: { label: '🛒 Varejo', className: 'bg-blue-100 text-blue-700' },
    revenda: { label: '🤝 Revenda', className: 'bg-green-100 text-green-700' },
    atacado: { label: '📦 Atacado', className: 'bg-orange-100 text-orange-700' },
};

const LINK_LABELS: Record<string, string> = {
    category: '📁 Categoria',
    product: '📦 Produto',
    external: '🔗 Link Externo',
    none: '⊘ Sem Link',
};

// ─── Props ───────────────────────────────────────────────────────────────────

interface BannerCardProps {
    banner: CatalogBanner;
    onEdit: (banner: CatalogBanner) => void;
    onDelete: (id: string) => void;
    onToggleActive: (id: string, isActive: boolean) => void;
    onDuplicate: (id: string) => void;
    isDragging?: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const BannerCard: React.FC<BannerCardProps> = ({
    banner,
    onEdit,
    onDelete,
    onToggleActive,
    onDuplicate,
    isDragging = false,
}) => {
    const isExpired = banner.end_date && new Date(banner.end_date) < new Date();

    return (
        <div
            className={`
                bg-white rounded-lg border-2 transition-all duration-200
                ${isDragging ? 'border-blue-400 shadow-lg scale-[1.02]' : 'border-gray-200 hover:border-gray-300'}
                ${!banner.is_active ? 'opacity-60' : ''}
            `}
        >
            <div className="p-4">
                <div className="flex items-start gap-3">

                    {/* Drag Handle */}
                    <div className="flex-shrink-0 cursor-grab active:cursor-grabbing pt-2">
                        <GripVertical className="w-5 h-5 text-gray-400" />
                    </div>

                    {/* Thumbnail */}
                    <div className="flex-shrink-0">
                        <div className="w-32 h-20 rounded-lg overflow-hidden bg-gray-100 relative">
                            {banner.image_url ? (
                                <img
                                    src={banner.image_url}
                                    alt={banner.title ?? 'Banner'}
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
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                    <EyeOff className="w-5 h-5 text-white" />
                                </div>
                            )}
                            {isExpired && banner.is_active && (
                                <div className="absolute bottom-0 left-0 right-0 bg-red-600/80 text-white text-[10px] text-center py-0.5">
                                    Expirado
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 space-y-2">
                        {/* Title + status */}
                        <div className="flex items-start justify-between gap-2">
                            <div>
                                <h3 className="font-semibold text-gray-900 truncate">
                                    {banner.title || 'Sem título'}
                                </h3>
                                {banner.subtitle && (
                                    <p className="text-xs text-gray-500 truncate">{banner.subtitle}</p>
                                )}
                            </div>
                            <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${banner.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                }`}>
                                {banner.is_active ? 'Ativo' : 'Inativo'}
                            </span>
                        </div>

                        {/* Target audience pills */}
                        <div className="flex flex-wrap gap-1">
                            {(!banner.target_audience || banner.target_audience.length === 0) ? (
                                <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">
                                    👥 Todos
                                </span>
                            ) : (
                                banner.target_audience.map(aud => {
                                    const pill = AUDIENCE_PILLS[aud];
                                    return pill ? (
                                        <span key={aud} className={`px-2 py-0.5 rounded-full text-xs font-medium ${pill.className}`}>
                                            {pill.label}
                                        </span>
                                    ) : null;
                                })
                            )}
                        </div>

                        {/* Link + dates */}
                        <div className="space-y-0.5 text-xs text-gray-500">
                            <div className="flex items-center gap-1">
                                <span className="font-medium text-gray-600">
                                    {LINK_LABELS[banner.link_type] || '⊘ Sem Link'}
                                </span>
                                {banner.link_target && (
                                    <span className="truncate max-w-[160px]">→ {banner.link_target}</span>
                                )}
                            </div>
                            {(banner.start_date || banner.end_date) && (
                                <div className="flex items-center gap-1">
                                    📅
                                    {banner.start_date && (
                                        <span>De: {new Date(banner.start_date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                    )}
                                    {banner.end_date && (
                                        <span>{banner.start_date ? ' | ' : ''}Até: {new Date(banner.end_date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Stats */}
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                            <span className="flex items-center gap-1">
                                <MousePointerClick className="w-3 h-3" />
                                {banner.clicks_count ?? 0} cliques
                            </span>
                            <span className="flex items-center gap-1">
                                <Eye className="w-3 h-3" />
                                {banner.views_count ?? 0} views
                            </span>
                            <span>Ordem: {banner.display_order}</span>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                        <button
                            onClick={() => onToggleActive(banner.id, !banner.is_active)}
                            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title={banner.is_active ? 'Desativar' : 'Ativar'}
                        >
                            {banner.is_active
                                ? <Eye className="w-4 h-4" />
                                : <EyeOff className="w-4 h-4" />
                            }
                        </button>
                        <button
                            onClick={() => onEdit(banner)}
                            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar"
                        >
                            <Pencil className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => onDuplicate(banner.id)}
                            className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                            title="Duplicar"
                        >
                            <Copy className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => {
                                if (confirm('Tem certeza que deseja excluir este banner?')) {
                                    onDelete(banner.id);
                                }
                            }}
                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
