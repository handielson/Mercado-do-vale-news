import React, { useMemo } from 'react';
import { Edit2, History, Eye } from 'lucide-react';
import { InventoryGroup } from '../../types/inventory';
import { DynamicColumn } from '../../types/inventory';

interface InventoryTableProps {
    groups: InventoryGroup[];
    onViewUnits: (group: InventoryGroup) => void;
    onAdjustStock: (group: InventoryGroup) => void;
    onViewHistory: (group: InventoryGroup) => void;
    loading?: boolean;
}

/**
 * InventoryTable Component
 * Dynamic table with grouped products and serialized unit support
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Component < 500 lines
 * - Dynamic columns from specs
 * - Grouped serialized products
 * - Status/Units column
 */
export function InventoryTable({ groups, onViewUnits, onAdjustStock, onViewHistory, loading }: InventoryTableProps) {
    // Detect dynamic columns from groups
    const dynamicColumns = useMemo(() => {
        const columnsMap = new Map<string, DynamicColumn>();

        // Priority fields to show first
        const priorityFields = ['color', 'storage', 'ram'];

        groups.forEach(group => {
            // Add color, storage, ram if they exist
            if (group.color) {
                if (!columnsMap.has('color')) {
                    columnsMap.set('color', {
                        key: 'color',
                        label: 'Cor',
                        visible: true,
                        priority: 0
                    });
                }
            }
            if (group.storage) {
                if (!columnsMap.has('storage')) {
                    columnsMap.set('storage', {
                        key: 'storage',
                        label: 'Armazenamento',
                        visible: true,
                        priority: 1
                    });
                }
            }
            if (group.ram) {
                if (!columnsMap.has('ram')) {
                    columnsMap.set('ram', {
                        key: 'ram',
                        label: 'RAM',
                        visible: true,
                        priority: 2
                    });
                }
            }
        });

        return Array.from(columnsMap.values())
            .sort((a, b) => a.priority - b.priority);
    }, [groups]);

    const formatCurrency = (cents: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(cents / 100);
    };

    if (loading) {
        return (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="p-8 text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-slate-600 mt-4">Carregando inventário...</p>
                </div>
            </div>
        );
    }

    if (groups.length === 0) {
        return (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                <p className="text-slate-600">Nenhum produto encontrado</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-4 py-3 text-left font-medium text-slate-700 min-w-[200px]">Produto</th>
                            <th className="px-4 py-3 text-left font-medium text-slate-700">Marca</th>
                            <th className="px-4 py-3 text-left font-medium text-slate-700">Modelo</th>

                            {/* Dynamic Columns */}
                            {dynamicColumns.map(col => (
                                <th key={col.key} className="px-4 py-3 text-left font-medium text-slate-700">
                                    {col.label}
                                </th>
                            ))}

                            {/* Price Columns */}
                            <th className="px-4 py-3 text-right font-medium text-slate-700">R$ Varejo</th>

                            {/* Status/Units Column */}
                            <th className="px-4 py-3 text-center font-medium text-slate-700 min-w-[180px]">Status/Unidades</th>
                            <th className="px-4 py-3 text-center font-medium text-slate-700 w-32">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {groups.map(group => {
                            return (
                                <tr key={group.product_key} className="hover:bg-slate-50 transition-colors">
                                    {/* Product Name */}
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-slate-900">{group.name}</div>
                                        <div className="text-xs text-slate-500">{group.category_id}</div>
                                    </td>

                                    {/* Brand */}
                                    <td className="px-4 py-3">
                                        <div className="text-slate-700">{group.brand || '—'}</div>
                                    </td>

                                    {/* Model */}
                                    <td className="px-4 py-3">
                                        <div className="text-slate-700">{group.model || '—'}</div>
                                    </td>

                                    {/* Dynamic Columns */}
                                    {dynamicColumns.map(col => (
                                        <td key={col.key} className="px-4 py-3 text-slate-600">
                                            {(group as any)[col.key] || '—'}
                                        </td>
                                    ))}

                                    {/* Price */}
                                    <td className="px-4 py-3 text-right font-medium text-slate-900">
                                        {formatCurrency(group.price_retail)}
                                    </td>

                                    {/* Status/Units */}
                                    <td className="px-4 py-3">
                                        {group.is_serialized ? (
                                            <button
                                                onClick={() => onViewUnits(group)}
                                                className="w-full flex items-center justify-center gap-2 hover:bg-blue-50 p-2 rounded-lg transition-colors"
                                            >
                                                <span className="text-blue-600 text-lg">🔵</span>
                                                <div className="text-left">
                                                    <div className="font-medium text-blue-900">
                                                        {group.total_units} serializados
                                                    </div>
                                                    <div className="text-xs text-blue-600">
                                                        {group.available} disponíveis
                                                    </div>
                                                </div>
                                            </button>
                                        ) : (
                                            <div className="flex items-center justify-center gap-2">
                                                <span className="text-lg">
                                                    {group.total_units === 0 ? '🔴' : group.total_units <= 10 ? '🟡' : '🟢'}
                                                </span>
                                                <div className="text-center">
                                                    <div className="font-bold text-slate-900">
                                                        {group.total_units}
                                                    </div>
                                                    <div className="text-xs text-slate-500">
                                                        {group.total_units === 0 ? 'Sem estoque' : group.total_units <= 10 ? 'Estoque baixo' : 'Em estoque'}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </td>

                                    {/* Actions */}
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-center gap-2">
                                            {group.is_serialized && (
                                                <button
                                                    onClick={() => onViewUnits(group)}
                                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                    title="Ver unidades"
                                                >
                                                    <Eye size={16} />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => onAdjustStock(group)}
                                                className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                                                title="Ajustar estoque"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => onViewHistory(group)}
                                                className="p-1.5 text-slate-600 hover:bg-slate-100 rounded transition-colors"
                                                title="Ver histórico"
                                            >
                                                <History size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
