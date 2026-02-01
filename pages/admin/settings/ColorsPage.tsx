
import React, { useEffect, useState } from 'react';
import { Palette, Plus, Pencil, Trash2 } from 'lucide-react';
import { Color } from '../../../types/color';
import { colorService } from '../../../services/colors';
import { ColorModal } from '../../../components/settings/ColorModal';

/**
 * Colors Management Page
 * CRUD interface for managing colors
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Follows BrandsPage pattern
 * - Table with edit/delete actions
 * - Active/Inactive status badges
 * - Visual hex color preview
 */
export function ColorsPage() {
    const [colors, setColors] = useState<Color[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingColor, setEditingColor] = useState<Color | null>(null);

    const loadColors = async () => {
        try {
            const data = await colorService.list();
            setColors(data);
        } catch (error) {
            console.error('Error loading colors:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadColors();
    }, []);

    const handleAdd = () => {
        setEditingColor(null);
        setModalOpen(true);
    };

    const handleEdit = (color: Color) => {
        setEditingColor(color);
        setModalOpen(true);
    };

    const handleDelete = async (color: Color) => {
        if (!confirm(`Tem certeza que deseja excluir a cor "${color.name}"?`)) {
            return;
        }

        try {
            await colorService.delete(color.id);
            await loadColors();
        } catch (error) {
            console.error('Error deleting color:', error);
            alert('Erro ao excluir cor');
        }
    };

    const handleSave = async () => {
        await loadColors();
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
                    <div className="p-3 bg-purple-100 text-purple-600 rounded-xl">
                        <Palette size={32} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Gestão de Cores</h1>
                        <p className="text-slate-500">Gerencie as cores disponíveis no sistema</p>
                    </div>
                </div>
                <button
                    onClick={handleAdd}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <Plus size={20} />
                    Nova Cor
                </button>
            </div>

            {/* Colors Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                Preview
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                Nome
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                Código Hex
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
                        {colors.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                    Nenhuma cor cadastrada
                                </td>
                            </tr>
                        ) : (
                            colors.map((color) => (
                                <tr key={color.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4">
                                        {color.hex_code ? (
                                            <div
                                                className="w-8 h-8 rounded-lg border-2 border-slate-300 shadow-sm"
                                                style={{ backgroundColor: color.hex_code }}
                                                title={color.hex_code}
                                            />
                                        ) : (
                                            <div className="w-8 h-8 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50" />
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-sm font-medium text-slate-800">
                                        {color.name}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600">
                                        {color.hex_code ? (
                                            <code className="px-2 py-1 bg-slate-100 rounded text-xs font-mono">
                                                {color.hex_code}
                                            </code>
                                        ) : (
                                            <span className="text-slate-400 text-xs">—</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-sm">
                                        {color.active ? (
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
                                                onClick={() => handleEdit(color)}
                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="Editar"
                                            >
                                                <Pencil size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(color)}
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
                    <p className="text-sm text-slate-500">Total de Cores</p>
                    <p className="text-2xl font-bold text-slate-800">{colors.length}</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-slate-200">
                    <p className="text-sm text-slate-500">Cores Ativas</p>
                    <p className="text-2xl font-bold text-green-600">
                        {colors.filter(c => c.active).length}
                    </p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-slate-200">
                    <p className="text-sm text-slate-500">Cores Inativas</p>
                    <p className="text-2xl font-bold text-slate-400">
                        {colors.filter(c => !c.active).length}
                    </p>
                </div>
            </div>

            {/* Modal */}
            <ColorModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                onSave={handleSave}
                color={editingColor}
            />
        </div>
    );
}
