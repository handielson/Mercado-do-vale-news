
import React, { useEffect, useState } from 'react';
import { BatteryCharging, Plus, Pencil, Trash2 } from 'lucide-react';
import { BatteryHealth } from '../../../types/batteryHealth';
import { batteryHealthService } from '../../../services/batteryHealths-supabase';
import { BatteryHealthModal } from '../../../components/settings/BatteryHealthModal';

/**
 * Battery Healths Management Page
 * CRUD interface for managing battery health percentages
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Follows established page pattern
 * - Table with edit/delete actions
 * - Active/Inactive status badges
 */
export function BatteryHealthsPage() {
    const [batteryHealths, setBatteryHealths] = useState<BatteryHealth[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingBatteryHealth, setEditingBatteryHealth] = useState<BatteryHealth | null>(null);

    const loadBatteryHealths = async () => {
        try {
            const data = await batteryHealthService.list();
            setBatteryHealths(data);
        } catch (error) {
            console.error('Error loading battery healths:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadBatteryHealths();
    }, []);

    const handleAdd = () => {
        setEditingBatteryHealth(null);
        setModalOpen(true);
    };

    const handleEdit = (batteryHealth: BatteryHealth) => {
        setEditingBatteryHealth(batteryHealth);
        setModalOpen(true);
    };

    const handleDelete = async (batteryHealth: BatteryHealth) => {
        if (!confirm(`Tem certeza que deseja excluir a saúde "${batteryHealth.name}"?`)) {
            return;
        }

        try {
            await batteryHealthService.delete(batteryHealth.id);
            await loadBatteryHealths();
        } catch (error) {
            console.error('Error deleting battery health:', error);
            alert('Erro ao excluir saúde da bateria');
        }
    };

    const handleSave = async () => {
        await loadBatteryHealths();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
                        <BatteryCharging size={32} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Gestão de Saúde da Bateria</h1>
                        <p className="text-slate-500">Gerencie os percentuais de saúde da bateria disponíveis</p>
                    </div>
                </div>
                <button
                    onClick={handleAdd}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <Plus size={20} />
                    Nova Saúde
                </button>
            </div>

            {/* Battery Healths Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                Saúde da Bateria
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                Slug
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                Status
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                                Ações
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {batteryHealths.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                                    Nenhuma saúde da bateria cadastrada
                                </td>
                            </tr>
                        ) : (
                            batteryHealths.map((batteryHealth) => (
                                <tr key={batteryHealth.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 text-sm font-medium text-slate-800">
                                        {batteryHealth.name}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600">
                                        <code className="px-2 py-1 bg-slate-100 rounded text-xs">
                                            {batteryHealth.slug}
                                        </code>
                                    </td>
                                    <td className="px-6 py-4 text-sm">
                                        {batteryHealth.active ? (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                ✓ Ativa
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                                                ○ Inativa
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleEdit(batteryHealth)}
                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="Editar"
                                            >
                                                <Pencil size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(batteryHealth)}
                                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Excluir"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-lg border border-slate-200">
                    <p className="text-sm text-slate-500">Total de Saúdes</p>
                    <p className="text-2xl font-bold text-slate-800">{batteryHealths.length}</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-slate-200">
                    <p className="text-sm text-slate-500">Saúdes Ativas</p>
                    <p className="text-2xl font-bold text-green-600">
                        {batteryHealths.filter(bh => bh.active).length}
                    </p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-slate-200">
                    <p className="text-sm text-slate-500">Saúdes Inativas</p>
                    <p className="text-2xl font-bold text-slate-400">
                        {batteryHealths.filter(bh => !bh.active).length}
                    </p>
                </div>
            </div>

            {/* Modal */}
            <BatteryHealthModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                onSave={handleSave}
                batteryHealth={editingBatteryHealth}
            />
        </div>
    );
}
