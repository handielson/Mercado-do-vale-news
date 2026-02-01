
import React, { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { versionService } from '../../../services/versions';
import { Version } from '../../../types/version';

interface VersionSelectProps {
    value: string;
    onChange: (version: string) => void;
    error?: string;
}

/**
 * VersionSelect Component
 * Select for regional variants with inline creation
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Uses localStorage-based versionService
 * - Shows only active versions
 * - Inline creation capability
 */
export const VersionSelect: React.FC<VersionSelectProps> = ({
    value,
    onChange,
    error
}) => {
    const [versions, setVersions] = useState<Version[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [newVersionName, setNewVersionName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        loadVersions();
    }, []);

    const loadVersions = async () => {
        try {
            setIsLoading(true);
            const data = await versionService.listActive(); // Only active versions
            setVersions(data);
        } catch (error) {
            console.error('Error loading versions:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateVersion = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!newVersionName.trim()) return;

        try {
            setIsCreating(true);
            const newVersion = await versionService.create({
                name: newVersionName.trim(),
                active: true
            });
            await loadVersions(); // Reload to get updated list
            onChange(newVersion.name); // Set the new version as selected
            setNewVersionName('');
            setShowCreateDialog(false);
        } catch (error) {
            console.error('Error creating version:', error);
            alert('Erro ao criar versão');
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <select
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={isLoading}
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-50"
                >
                    <option value="">Selecione uma versão</option>
                    {versions.map((version) => (
                        <option key={version.id} value={version.name}>
                            {version.name}
                        </option>
                    ))}
                </select>

                <button
                    type="button"
                    onClick={() => setShowCreateDialog(true)}
                    className="p-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                    title="Nova Versão"
                >
                    <Plus className="w-5 h-5" />
                </button>
            </div>

            {error && (
                <p className="text-xs text-red-600">{error}</p>
            )}

            {/* Inline Create Dialog */}
            {showCreateDialog && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-slate-900">Nova Versão</h3>
                            <button
                                onClick={() => setShowCreateDialog(false)}
                                className="p-1 hover:bg-slate-100 rounded transition-colors"
                            >
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateVersion} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Nome da Versão
                                </label>
                                <input
                                    type="text"
                                    value={newVersionName}
                                    onChange={(e) => setNewVersionName(e.target.value)}
                                    placeholder="Ex: Global, China, USA"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    autoFocus
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateDialog(false)}
                                    disabled={isCreating}
                                    className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isCreating || !newVersionName.trim()}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isCreating ? 'Criando...' : 'Criar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
