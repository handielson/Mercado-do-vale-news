import React, { useState, useMemo } from 'react';
import { X, Search, Download } from 'lucide-react';
import { InventoryGroup, UnitStatus, SerializedUnit } from '../../../types/inventory';

interface SerializedUnitsModalProps {
    group: InventoryGroup | null;
    isOpen: boolean;
    onClose: () => void;
    onReload: () => void;
}

/**
 * SerializedUnitsModal
 * Shows individual units of a serialized product group
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Component < 300 lines
 * - Filterable list
 * - Status badges
 * - Export functionality
 */
export function SerializedUnitsModal({ group, isOpen, onClose, onReload }: SerializedUnitsModalProps) {
    const [statusFilter, setStatusFilter] = useState<UnitStatus | 'all'>('all');
    const [searchTerm, setSearchTerm] = useState('');

    // Filter units - MUST be before early return (React hooks rule)
    const filteredUnits = useMemo(() => {
        if (!group || !group.units) return [];

        let units = group.units;

        // Filter by status
        if (statusFilter !== 'all') {
            units = units.filter(u => u.unit_status === statusFilter);
        }

        // Filter by search term
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            units = units.filter(u =>
                u.imei1?.toLowerCase().includes(term) ||
                u.imei2?.toLowerCase().includes(term) ||
                u.serial?.toLowerCase().includes(term)
            );
        }

        return units;
    }, [group, statusFilter, searchTerm]);

    // Early return AFTER hooks
    if (!isOpen || !group || !group.is_serialized) return null;

    const getStatusBadge = (status: UnitStatus) => {
        const badges = {
            available: { emoji: '🟢', label: 'Disponível', class: 'bg-green-100 text-green-800' },
            reserved: { emoji: '🟡', label: 'Reservado', class: 'bg-yellow-100 text-yellow-800' },
            sold: { emoji: '🔴', label: 'Vendido', class: 'bg-red-100 text-red-800' },
            maintenance: { emoji: '🔵', label: 'Manutenção', class: 'bg-blue-100 text-blue-800' },
            defective: { emoji: '⚫', label: 'Defeituoso', class: 'bg-gray-100 text-gray-800' }
        };

        const badge = badges[status];
        return (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.class}`}>
                <span>{badge.emoji}</span>
                <span>{badge.label}</span>
            </span>
        );
    };

    const handleExportCSV = () => {
        const headers = ['IMEI 1', 'IMEI 2', 'Serial', 'Status', 'Data Entrada'];
        const rows = filteredUnits.map(u => [
            u.imei1 || '',
            u.imei2 || '',
            u.serial || '',
            u.unit_status,
            new Date(u.created_at).toLocaleDateString('pt-BR')
        ]);

        const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${group.name.replace(/\s+/g, '_')}_unidades.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-gray-200">
                    <div className="flex items-start justify-between">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">
                                📱 {group.name}
                            </h2>
                            <p className="text-sm text-gray-500 mt-1">
                                Unidades Serializadas
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Stats */}
                    <div className="mt-4 flex items-center gap-4 text-sm">
                        <div className="font-medium">
                            Total: <span className="text-blue-600">{group.total_units}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            🟢 {group.available}
                        </div>
                        <div className="flex items-center gap-2">
                            🟡 {group.reserved}
                        </div>
                        <div className="flex items-center gap-2">
                            🔴 {group.sold}
                        </div>
                        <div className="flex items-center gap-2">
                            🔵 {group.in_maintenance}
                        </div>
                        <div className="flex items-center gap-2">
                            ⚫ {group.defective}
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="p-4 border-b border-gray-200 bg-gray-50">
                    <div className="flex items-center gap-4">
                        {/* Status Filter */}
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as UnitStatus | 'all')}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="all">Todos os Status</option>
                            <option value="available">🟢 Disponíveis</option>
                            <option value="reserved">🟡 Reservados</option>
                            <option value="sold">🔴 Vendidos</option>
                            <option value="maintenance">🔵 Manutenção</option>
                            <option value="defective">⚫ Defeituosos</option>
                        </select>

                        {/* Search */}
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Buscar IMEI ou Serial..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>

                        {/* Export */}
                        <button
                            onClick={handleExportCSV}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                            <Download size={18} />
                            <span>Exportar CSV</span>
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 sticky top-0">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">IMEI 1</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">IMEI 2</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Serial</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Data Entrada</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {filteredUnits.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                                        Nenhuma unidade encontrada
                                    </td>
                                </tr>
                            ) : (
                                filteredUnits.map((unit) => (
                                    <tr key={unit.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 text-sm font-mono">{unit.imei1 || '-'}</td>
                                        <td className="px-4 py-3 text-sm font-mono">{unit.imei2 || '-'}</td>
                                        <td className="px-4 py-3 text-sm font-mono">{unit.serial || '-'}</td>
                                        <td className="px-4 py-3">{getStatusBadge(unit.unit_status)}</td>
                                        <td className="px-4 py-3 text-sm text-gray-600">
                                            {new Date(unit.created_at).toLocaleDateString('pt-BR')}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200 bg-gray-50">
                    <div className="flex items-center justify-between text-sm text-gray-600">
                        <div>
                            Mostrando {filteredUnits.length} de {group.total_units} unidades
                        </div>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
                        >
                            Fechar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
