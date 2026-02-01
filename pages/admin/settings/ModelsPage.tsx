
import React, { useEffect, useState } from 'react';
import { Smartphone, Plus, Pencil, Trash2 } from 'lucide-react';
import { Model } from '../../../types/model';
import { Brand } from '../../../types/brand';
import { modelService } from '../../../services/models';
import { brandService } from '../../../services/brands';
import { ModelModal } from '../../../components/settings/ModelModal';

/**
 * Models Management Page
 * CRUD interface for managing models
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Follows BrandsPage pattern
 * - Table with edit/delete actions
 * - Shows brand name for each model
 * - Active/Inactive status badges
 */
export function ModelsPage() {
    const [models, setModels] = useState<Model[]>([]);
    const [brands, setBrands] = useState<Brand[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingModel, setEditingModel] = useState<Model | null>(null);

    const loadData = async () => {
        try {
            const [modelsData, brandsData] = await Promise.all([
                modelService.list(),
                brandService.list()
            ]);
            setModels(modelsData);
            setBrands(brandsData);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleAdd = () => {
        setEditingModel(null);
        setModalOpen(true);
    };

    const handleEdit = (model: Model) => {
        setEditingModel(model);
        setModalOpen(true);
    };

    const handleDelete = async (model: Model) => {
        if (!confirm(`Tem certeza que deseja excluir o modelo "${model.name}"?`)) {
            return;
        }

        try {
            await modelService.delete(model.id);
            await loadData();
        } catch (error) {
            console.error('Error deleting model:', error);
            alert('Erro ao excluir modelo');
        }
    };

    const handleSave = async () => {
        await loadData();
    };

    const getBrandName = (brandId: string): string => {
        const brand = brands.find(b => b.id === brandId);
        return brand?.name || 'Marca não encontrada';
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
                        <Smartphone size={32} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Gestão de Modelos</h1>
                        <p className="text-slate-500">Gerencie os modelos de produtos por marca</p>
                    </div>
                </div>
                <button
                    onClick={handleAdd}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <Plus size={20} />
                    Novo Modelo
                </button>
            </div>

            {/* Models Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                Marca
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                Modelo
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
                        {models.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                    Nenhum modelo cadastrado
                                </td>
                            </tr>
                        ) : (
                            models.map((model) => (
                                <tr key={model.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 text-sm font-medium text-slate-600">
                                        {getBrandName(model.brand_id)}
                                    </td>
                                    <td className="px-6 py-4 text-sm font-medium text-slate-800">
                                        {model.name}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600">
                                        <code className="px-2 py-1 bg-slate-100 rounded text-xs">
                                            {model.slug}
                                        </code>
                                    </td>
                                    <td className="px-6 py-4 text-sm">
                                        {model.active ? (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                ✓ Ativo
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                                                ○ Inativo
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleEdit(model)}
                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="Editar"
                                            >
                                                <Pencil size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(model)}
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
                    <p className="text-sm text-slate-500">Total de Modelos</p>
                    <p className="text-2xl font-bold text-slate-800">{models.length}</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-slate-200">
                    <p className="text-sm text-slate-500">Modelos Ativos</p>
                    <p className="text-2xl font-bold text-green-600">
                        {models.filter(m => m.active).length}
                    </p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-slate-200">
                    <p className="text-sm text-slate-500">Marcas com Modelos</p>
                    <p className="text-2xl font-bold text-purple-600">
                        {new Set(models.map(m => m.brand_id)).size}
                    </p>
                </div>
            </div>

            {/* Modal */}
            <ModelModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                onSave={handleSave}
                model={editingModel}
            />
        </div>
    );
}
