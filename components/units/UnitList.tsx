
import React from 'react';
import { Trash2, Package } from 'lucide-react';
import { Unit } from '../../types/unit';
import { UnitStatus } from '../../utils/field-standards';

interface UnitListProps {
    units: Unit[];
    isLoading?: boolean;
    onDelete?: (unit: Unit) => void;
}

/**
 * UnitList Component
 * Displays inventory units in a table format with IMEI tracking
 */
export const UnitList: React.FC<UnitListProps> = ({
    units,
    isLoading = false,
    onDelete
}) => {
    // Loading state
    if (isLoading) {
        return (
            <div className="bg-white rounded-xl border border-slate-200 p-8">
                <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-slate-600">Carregando unidades...</p>
                    </div>
                </div>
            </div>
        );
    }

    // Empty state
    if (units.length === 0) {
        return (
            <div className="bg-white rounded-xl border border-slate-200 p-8">
                <div className="flex flex-col items-center justify-center py-12">
                    <Package className="w-16 h-16 text-slate-300 mb-4" />
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                        Nenhuma unidade cadastrada
                    </h3>
                    <p className="text-sm text-slate-500 text-center max-w-md">
                        Adicione unidades ao estoque para rastrear IMEIs e gerenciar o inventário deste produto.
                    </p>
                </div>
            </div>
        );
    }

    // Format price
    const formatPrice = (centavos?: number) => {
        if (!centavos) return '-';
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(centavos / 100);
    };

    // Get status badge color
    const getStatusBadge = (status: UnitStatus) => {
        const badges = {
            [UnitStatus.AVAILABLE]: 'bg-green-100 text-green-800',
            [UnitStatus.RESERVED]: 'bg-yellow-100 text-yellow-800',
            [UnitStatus.SOLD]: 'bg-blue-100 text-blue-800',
            [UnitStatus.RMA]: 'bg-red-100 text-red-800'
        };

        const labels = {
            [UnitStatus.AVAILABLE]: 'Disponível',
            [UnitStatus.RESERVED]: 'Reservado',
            [UnitStatus.SOLD]: 'Vendido',
            [UnitStatus.RMA]: 'RMA'
        };

        return (
            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${badges[status]}`}>
                {labels[status]}
            </span>
        );
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                IMEI Principal
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                IMEI Secundário
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                Serial
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                Status
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                Custo
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                Ações
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {units.map((unit) => (
                            <tr key={unit.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3 text-sm font-mono text-slate-900">
                                    {unit.imei_1}
                                </td>
                                <td className="px-4 py-3 text-sm font-mono text-slate-600">
                                    {unit.imei_2 || '-'}
                                </td>
                                <td className="px-4 py-3 text-sm font-mono text-slate-600">
                                    {unit.serial_number || '-'}
                                </td>
                                <td className="px-4 py-3">
                                    {getStatusBadge(unit.status)}
                                </td>
                                <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                                    {formatPrice(unit.cost_price)}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    {onDelete && unit.status === UnitStatus.AVAILABLE && (
                                        <button
                                            onClick={() => onDelete(unit)}
                                            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
                                            title="Excluir unidade"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                            Excluir
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Summary */}
            <div className="bg-slate-50 px-4 py-3 border-t border-slate-200">
                <p className="text-sm text-slate-600">
                    Total: <span className="font-semibold text-slate-900">{units.length}</span> {units.length === 1 ? 'unidade' : 'unidades'}
                </p>
            </div>
        </div>
    );
};
