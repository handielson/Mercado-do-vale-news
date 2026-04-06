import React, { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { batteryHealthService, BatteryHealth } from '../../../services/batteryHealths';

interface BatteryHealthSelectProps {
    value: string;
    onChange: (batteryHealth: string) => void;
    error?: string;
}

/**
 * BatteryHealthSelect Component
 * Selector for battery health percentages with inline creation
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Uses localStorage-based batteryHealthService
 * - Shows only active battery healths
 * - Inline creation capability
 */
export const BatteryHealthSelect: React.FC<BatteryHealthSelectProps> = ({ value, onChange, error }) => {
    const [batteryHealths, setBatteryHealths] = useState<BatteryHealth[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [newBatteryHealthName, setNewBatteryHealthName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        loadBatteryHealths();
    }, []);

    const loadBatteryHealths = async () => {
        try {
            setIsLoading(true);
            const data = await batteryHealthService.list();
            setBatteryHealths(data);
        } catch (err) {
            console.error('Error loading battery healths:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateBatteryHealth = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newBatteryHealthName.trim()) return;
        try {
            setIsCreating(true);
            const pct = parseInt(newBatteryHealthName.trim().replace(/[^0-9]/g, '')) || 0;
            const newBH = await batteryHealthService.create({
                value: pct,
                label: newBatteryHealthName.trim(),
            });
            await loadBatteryHealths();
            onChange(newBH.label);
            setNewBatteryHealthName('');
            setShowCreateDialog(false);
        } catch (err) {
            console.error('Error creating battery health:', err);
            alert('Erro ao criar saúde da bateria');
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
                Saúde da Bateria <span className="text-red-500">*</span>
            </label>

            <div className="flex items-center gap-2">
                <select
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={isLoading}
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-50"
                >
                    <option value="">Selecione a saúde da bateria</option>
                    {batteryHealths.map((bh) => (
                        <option key={bh.id} value={bh.label}>
                            {bh.label}
                        </option>
                    ))}
                </select>

                <button
                    type="button"
                    onClick={() => setShowCreateDialog(true)}
                    className="p-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                    title="Nova Saúde da Bateria"
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
                            <h3 className="text-lg font-semibold text-slate-900">Nova Saúde da Bateria</h3>
                            <button
                                onClick={() => setShowCreateDialog(false)}
                                className="p-1 hover:bg-slate-100 rounded transition-colors"
                            >
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateBatteryHealth} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Saúde da Bateria
                                </label>
                                <input
                                    type="text"
                                    value={newBatteryHealthName}
                                    onChange={(e) => setNewBatteryHealthName(e.target.value)}
                                    placeholder="Ex: 100%, 95%, 90%..."
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
                                    disabled={isCreating || !newBatteryHealthName.trim()}
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
