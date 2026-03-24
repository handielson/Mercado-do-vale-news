import React from 'react';
import { Category } from '../../../types/category';

interface BasicInfoSectionProps {
    name: string;
    onChange: (name: string) => void;
    parentId?: string | null;
    onParentIdChange?: (id: string | null) => void;
    availableParents?: Category[];
    warrantyDays: number;
    onWarrantyDaysChange: (days: number) => void;
    isEditing?: boolean;
}

/**
 * BasicInfoSection Component
 * Section for category name and slug configuration
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Modular section component
 * - Controlled by parent via props
 * - Slug generated automatically from name
 */
export const BasicInfoSection: React.FC<BasicInfoSectionProps> = ({
    name,
    onChange,
    parentId,
    onParentIdChange,
    availableParents = [],
    warrantyDays,
    onWarrantyDaysChange,
    isEditing = false
}) => {
    // Generate slug from name
    const slug = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
        .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
                📋 Informações Básicas
            </h3>

            <div className="space-y-4">
                {/* Category Name */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Nome da Categoria *
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder="Ex: Celulares, Notebooks, Tablets..."
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                        autoFocus={!isEditing}
                    />
                    <p className="text-xs text-slate-500 mt-1">
                        Nome que aparecerá no sistema e nos formulários
                    </p>
                </div>

                {/* Parent Category */}
                {onParentIdChange && (
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Categoria Pai <span className="text-slate-400 font-normal">(opcional)</span>
                        </label>
                        <select
                            value={parentId || ''}
                            onChange={(e) => onParentIdChange(e.target.value || null)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                            <option value="">Nenhuma (Categoria Principal)</option>
                            {availableParents.map((parent) => (
                                <option key={parent.id} value={parent.id}>
                                    {parent.name}
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-slate-500 mt-1">
                            Selecione caso esta seja uma subcategoria de outro departamento
                        </p>
                    </div>
                )}

                {/* Slug (Auto-generated, Read-only) */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Slug (Identificador)
                    </label>
                    <input
                        type="text"
                        value={slug}
                        readOnly
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-600 font-mono text-sm cursor-not-allowed"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                        Gerado automaticamente a partir do nome (usado internamente)
                    </p>
                </div>

                {/* Warranty Days */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Garantia Padrão (dias)
                    </label>
                    <input
                        type="number"
                        min="0"
                        value={warrantyDays}
                        onChange={(e) => onWarrantyDaysChange(parseInt(e.target.value) || 0)}
                        placeholder="Ex: 90, 365..."
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                        Período de garantia padrão para produtos desta categoria
                    </p>
                </div>
            </div>
        </div>
    );
};
