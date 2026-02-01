
import React, { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { ramService } from '../../../services/rams';
import { Ram } from '../../../types/ram';

interface RamSelectProps {
    value: string;
    onChange: (ram: string) => void;
    error?: string;
}

/**
 * RamSelect Component
 * Selector for RAM memory capacities with inline creation
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Uses localStorage-based ramService
 * - Shows only active RAMs
 * - Inline creation capability
 */
export const RamSelect: React.FC<RamSelectProps> = ({ value, onChange, error }) => {
    const [rams, setRams] = useState<Ram[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [newRamName, setNewRamName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        loadRams();
    }, []);

    const loadRams = async () => {
        try {
            setIsLoading(true);
            const data = await ramService.listActive(); // Only active RAMs
            setRams(data);
        } catch (error) {
            console.error('Error loading RAMs:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateRam = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!newRamName.trim()) return;

        try {
            setIsCreating(true);
            const newRam = await ramService.create({
                name: newRamName.trim(),
                active: true
            });
            await loadRams(); // Reload to get updated list
            onChange(newRam.name); // Set the new RAM as selected
            setNewRamName('');
            setShowCreateDialog(false);
        } catch (error) {
            console.error('Error creating RAM:', error);
            alert('Erro ao criar memória RAM');
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
                Memória RAM <span className="text-red-500">*</span>
            </label>

            <div className="flex items-center gap-2">
                <select
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={isLoading}
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-50"
                >
                    <option value="">Selecione a memória RAM</option>
                    {rams.map((ram) => (
                        <option key={ram.id} value={ram.name}>
                            {ram.name}
                        </option>
                    ))}
                </select>

                <button
                    type="button"
                    onClick={() => setShowCreateDialog(true)}
                    className="p-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                    title="Nova Memória RAM"
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
                            <h3 className="text-lg font-semibold text-slate-900">Nova Memória RAM</h3>
                            <button
                                onClick={() => setShowCreateDialog(false)}
                                className="p-1 hover:bg-slate-100 rounded transition-colors"
                            >
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateRam} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Memória RAM
                                </label>
                                <input
                                    type="text"
                                    value={newRamName}
                                    onChange={(e) => setNewRamName(e.target.value)}
                                    placeholder="Ex: 8GB, 16GB..."
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
                                    disabled={isCreating || !newRamName.trim()}
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
