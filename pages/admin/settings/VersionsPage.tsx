
import React, { useEffect, useState } from 'react';
import { GitBranch, Plus, Pencil, Trash2 } from 'lucide-react';
import { Version } from '../../../types/version';
import { versionService } from '../../../services/versions';
import { VersionModal } from '../../../components/settings/VersionModal';

/**
 * Versions Management Page
 * CRUD interface for managing product versions
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Follows established page pattern
 * - Table with edit/delete actions
 * - Active/Inactive status badges
 */
export function VersionsPage() {
    const [versions, setVersions] = useState<Version[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingVersion, setEditingVersion] = useState<Version | null>(null);

    const loadVersions = async () => {
        try {
            const data = await versionService.list();
            setVersions(data);
        } catch (error) {
            console.error('Error loading versions:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadVersions();
    }, []);

    const handleAdd = () => {
        setEditingVersion(null);
        setModalOpen(true);
    };

    const handleEdit = (version: Version) => {
        setEditingVersion(version);
        setModalOpen(true);
    };

    const handleDelete = async (version: Version) => {
        if (!confirm(`Tem certeza que deseja excluir a versão "${version.name}"?`)) {
            return;
        }

        try {
            await versionService.delete(version.id);
            await loadVersions();
        } catch (error) {
            console.error('Error deleting version:', error);
            alert('Erro ao excluir versão');
        }
    };

    const handleSave = async () => {
        await loadVersions();
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
                    <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
                        <GitBranch size={32} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Gestão de Versões</h1>
                        <p className="text-slate-500">Gerencie as versões regionais e de software disponíveis</p>
                    </div>
                </div>
                <button
                    onClick={handleAdd}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <Plus size={20} />
                    Nova Versão
                </button>
            </div>

            {/* Versions Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                Versão
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
                        {versions.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                                    Nenhuma versão cadastrada
                                </td>
                            </tr>
                        ) : (
                            versions.map((version) => (
                                <tr key={version.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 text-sm font-medium text-slate-800">
                                        {version.name}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600">
                                        <code className="px-2 py-1 bg-slate-100 rounded text-xs">
                                            {version.slug}
                                        </code>
                                    </td>
                                    <td className="px-6 py-4 text-sm">
                                        {version.active ? (
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
                                                onClick={() => handleEdit(version)}
                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="Editar"
                                            >
                                                <Pencil size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(version)}
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
                    <p className="text-sm text-slate-500">Total de Versões</p>
                    <p className="text-2xl font-bold text-slate-800">{versions.length}</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-slate-200">
                    <p className="text-sm text-slate-500">Versões Ativas</p>
                    <p className="text-2xl font-bold text-green-600">
                        {versions.filter(v => v.active).length}
                    </p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-slate-200">
                    <p className="text-sm text-slate-500">Versões Inativas</p>
                    <p className="text-2xl font-bold text-slate-400">
                        {versions.filter(v => !v.active).length}
                    </p>
                </div>
            </div>

            {/* Modal */}
            <VersionModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                onSave={handleSave}
                version={editingVersion}
            />
        </div>
    );
}
