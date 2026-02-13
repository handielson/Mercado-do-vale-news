
import React, { useEffect, useState } from 'react';
import { MemoryStick, Plus, Pencil, Trash2 } from 'lucide-react';
import { Ram } from '../../../types/ram';
import { ramService } from '../../../services/rams-supabase';
import { RamModal } from '../../../components/settings/RamModal';

/**
 * RAMs Management Page
 * CRUD interface for managing RAM memory capacities
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Follows established page pattern
 * - Table with edit/delete actions
 * - Active/Inactive status badges
 */
export function RamsPage() {
    const [rams, setRams] = useState<Ram[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingRam, setEditingRam] = useState<Ram | null>(null);

    const loadRams = async () => {
        try {
            const data = await ramService.list();
            setRams(data);
        } catch (error) {
            console.error('Error loading RAMs:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRams();
    }, []);

    const handleAdd = () => {
        setEditingRam(null);
        setModalOpen(true);
    };

    const handleEdit = (ram: Ram) => {
        setEditingRam(ram);
        setModalOpen(true);
    };

    const handleDelete = async (ram: Ram) => {
        if (!confirm(`Tem certeza que deseja excluir a memória "${ram.name}"?`)) {
            return;
        }

        try {
            await ramService.delete(ram.id);
            await loadRams();
        } catch (error) {
            console.error('Error deleting RAM:', error);
            alert('Erro ao excluir memória RAM');
        }
    };

    const handleSave = async () => {
        await loadRams();
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
                    <div className="p-3 bg-green-100 text-green-600 rounded-xl">
                        <MemoryStick size={32} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Gestão de Memória RAM</h1>
                        <p className="text-slate-500">Gerencie as capacidades de RAM disponíveis no sistema</p>
                    </div>
                </div>
                <button
                    onClick={handleAdd}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <Plus size={20} />
                    Nova Memória RAM
                </button>
            </div>

            {/* RAMs Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                Memória RAM
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
                        {rams.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                                    Nenhuma memória RAM cadastrada
                                </td>
                            </tr>
                        ) : (
                            rams.map((ram) => (
                                <tr key={ram.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 text-sm font-medium text-slate-800">
                                        {ram.name}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600">
                                        <code className="px-2 py-1 bg-slate-100 rounded text-xs">
                                            {ram.slug}
                                        </code>
                                    </td>
                                    <td className="px-6 py-4 text-sm">
                                        {ram.active ? (
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
                                                onClick={() => handleEdit(ram)}
                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="Editar"
                                            >
                                                <Pencil size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(ram)}
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
                    <p className="text-sm text-slate-500">Total de Memórias</p>
                    <p className="text-2xl font-bold text-slate-800">{rams.length}</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-slate-200">
                    <p className="text-sm text-slate-500">Memórias Ativas</p>
                    <p className="text-2xl font-bold text-green-600">
                        {rams.filter(r => r.active).length}
                    </p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-slate-200">
                    <p className="text-sm text-slate-500">Memórias Inativas</p>
                    <p className="text-2xl font-bold text-slate-400">
                        {rams.filter(r => !r.active).length}
                    </p>
                </div>
            </div>

            {/* Modal */}
            <RamModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                onSave={handleSave}
                ram={editingRam}
            />
        </div>
    );
}
