import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Shield } from 'lucide-react';
import { WarrantyTemplate } from '../../../types/warranty';
import { warrantyTemplateService } from '../../../services/warrantyTemplates';
import { WarrantyTemplateModal } from '../../../components/settings/WarrantyTemplateModal';
import { toast } from 'sonner';

/**
 * WarrantyTemplatesPage
 * Admin interface for managing warranty templates
 * 
 * ANTIGRAVITY PROTOCOL:
 * - List view with modal for create/edit
 * - CRUD operations via service
 * - Toast notifications for feedback
 */
export default function WarrantyTemplatesPage() {
    const [templates, setTemplates] = useState<WarrantyTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<WarrantyTemplate | undefined>();

    useEffect(() => {
        loadTemplates();
    }, []);

    const loadTemplates = async () => {
        try {
            setIsLoading(true);
            const data = await warrantyTemplateService.list();
            setTemplates(data);
        } catch (error) {
            console.error('Error loading warranty templates:', error);
            toast.error('Erro ao carregar templates de garantia');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreate = () => {
        setSelectedTemplate(undefined);
        setIsModalOpen(true);
    };

    const handleEdit = (template: WarrantyTemplate) => {
        setSelectedTemplate(template);
        setIsModalOpen(true);
    };

    const handleSave = async (input: any) => {
        try {
            if (selectedTemplate) {
                await warrantyTemplateService.update(selectedTemplate.id, input);
                toast.success('Template atualizado com sucesso!');
            } else {
                await warrantyTemplateService.create(input);
                toast.success('Template criado com sucesso!');
            }
            await loadTemplates();
        } catch (error) {
            console.error('Error saving warranty template:', error);
            throw error;
        }
    };

    const handleDelete = async (template: WarrantyTemplate) => {
        if (!confirm(`Tem certeza que deseja excluir o template "${template.name}"?`)) {
            return;
        }

        try {
            await warrantyTemplateService.remove(template.id);
            toast.success('Template excluído com sucesso!');
            await loadTemplates();
        } catch (error) {
            console.error('Error deleting warranty template:', error);
            toast.error('Erro ao excluir template');
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Shield className="w-6 h-6 text-blue-600" />
                        Templates de Garantia
                    </h1>
                    <p className="text-slate-600 mt-1">
                        Gerencie templates reutilizáveis para garantias diferenciadas
                    </p>
                </div>
                <button
                    onClick={handleCreate}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    Novo Template
                </button>
            </div>

            {/* Templates Table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Nome</th>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Descrição</th>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Duração</th>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Status</th>
                            <th className="px-6 py-3 text-right text-sm font-semibold text-slate-700">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {isLoading ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                                    Carregando templates...
                                </td>
                            </tr>
                        ) : templates.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                                    Nenhum template cadastrado
                                </td>
                            </tr>
                        ) : (
                            templates.map((template) => (
                                <tr key={template.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-slate-900">{template.name}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm text-slate-600 max-w-md truncate">
                                            {template.description || '-'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                            {template.duration_days} dias
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        {template.active ? (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                Ativo
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                Inativo
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleEdit(template)}
                                                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="Editar template"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                                Editar
                                            </button>
                                            <button
                                                onClick={() => handleDelete(template)}
                                                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Excluir template"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                Excluir
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Info Box */}
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="text-sm font-semibold text-blue-900 mb-2">💡 Sobre Templates de Garantia</h3>
                <div className="text-sm text-blue-800 space-y-1">
                    <p>• Templates permitem criar termos de garantia reutilizáveis para produtos</p>
                    <p>• Use variáveis como <code className="bg-blue-100 px-1 rounded">{'{dias}'}</code>, <code className="bg-blue-100 px-1 rounded">{'{produto}'}</code>, <code className="bg-blue-100 px-1 rounded">{'{marca}'}</code> para personalização automática</p>
                    <p>• Templates inativos não aparecem na seleção de produtos</p>
                    <p>• Os termos serão exibidos no recibo de venda com as variáveis substituídas</p>
                </div>
            </div>

            {/* Modal */}
            <WarrantyTemplateModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSave}
                template={selectedTemplate}
            />
        </div>
    );
}
