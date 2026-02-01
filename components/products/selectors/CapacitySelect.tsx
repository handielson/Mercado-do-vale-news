
import React, { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { storageService } from '../../../services/storages';
import { Storage } from '../../../types/storage';

interface CapacitySelectProps {
    value: string;
    onChange: (capacity: string) => void;
    error?: string;
    label?: string;
    placeholder?: string;
}

/**
 * CapacitySelect Component
 * Generic selector for storage/RAM capacities with inline creation
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Uses localStorage-based storageService
 * - Shows only active storages
 * - Inline creation capability
 */
export const CapacitySelect: React.FC<CapacitySelectProps> = ({
    value,
    onChange,
    error,
    label = 'Capacidade',
    placeholder = 'Selecione a capacidade'
}) => {
    const [capacities, setCapacities] = useState<Storage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [newCapacityName, setNewCapacityName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        loadCapacities();
    }, []);

    const loadCapacities = async () => {
        try {
            setIsLoading(true);
            const data = await storageService.listActive(); // Only active storages
            setCapacities(data);
        } catch (error) {
            console.error('Error loading capacities:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateCapacity = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!newCapacityName.trim()) return;

        try {
            setIsCreating(true);
            const newCapacity = await storageService.create({
                name: newCapacityName.trim(),
                active: true
            });
            await loadCapacities(); // Reload to get updated list
            onChange(newCapacity.name); // Set the new capacity as selected
            setNewCapacityName('');
            setShowCreateDialog(false);
        } catch (error) {
            console.error('Error creating capacity:', error);
            alert('Erro ao criar capacidade');
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
                    <option value="">{placeholder}</option>
                    {capacities.map((capacity) => (
                        <option key={capacity.id} value={capacity.name}>
                            {capacity.name}
                        </option>
                    ))}
                </select>

                <button
                    type="button"
                    onClick={() => setShowCreateDialog(true)}
                    className="p-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                    title={`Nova ${label}`}
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
                            <h3 className="text-lg font-semibold text-slate-900">Nova {label}</h3>
                            <button
                                onClick={() => setShowCreateDialog(false)}
                                className="p-1 hover:bg-slate-100 rounded transition-colors"
                            >
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateCapacity} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    {label}
                                </label>
                                <input
                                    type="text"
                                    value={newCapacityName}
                                    onChange={(e) => setNewCapacityName(e.target.value)}
                                    placeholder="Ex: 256GB ou 8GB"
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
                                    disabled={isCreating || !newCapacityName.trim()}
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
