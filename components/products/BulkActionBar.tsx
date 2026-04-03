import React from 'react';
import { FolderOpen, X } from 'lucide-react';

interface BulkActionBarProps {
    selectedCount: number;
    onChangeCategoryClick: () => void;
    onClearSelection: () => void;
}

export const BulkActionBar: React.FC<BulkActionBarProps> = ({
    selectedCount,
    onChangeCategoryClick,
    onClearSelection,
}) => {
    if (selectedCount === 0) return null;

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-slate-900 text-white shadow-2xl rounded-2xl px-5 py-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
            <span className="text-sm font-semibold">
                <span className="bg-blue-500 text-white rounded-full px-2 py-0.5 text-xs font-bold mr-2">{selectedCount}</span>
                produto{selectedCount !== 1 ? 's' : ''} selecionado{selectedCount !== 1 ? 's' : ''}
            </span>

            <div className="w-px h-5 bg-slate-700" />

            <button
                onClick={onChangeCategoryClick}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
                <FolderOpen size={15} />
                Alterar Categoria
            </button>

            <button
                onClick={onClearSelection}
                className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
                title="Limpar seleção"
            >
                <X size={16} className="text-slate-400" />
            </button>
        </div>
    );
};
