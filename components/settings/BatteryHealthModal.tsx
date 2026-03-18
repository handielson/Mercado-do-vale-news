import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { batteryHealthService, BatteryHealth } from '../../services/batteryHealths';

interface BatteryHealthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    batteryHealth?: BatteryHealth | null;
}

export const BatteryHealthModal: React.FC<BatteryHealthModalProps> = ({ isOpen, onClose, onSave, batteryHealth }) => {
    const [label, setLabel] = useState('');
    const [valuePct, setValuePct] = useState<number | ''>('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (batteryHealth) {
            setLabel(batteryHealth.label);
            setValuePct(batteryHealth.value);
        } else {
            setLabel('');
            setValuePct('');
        }
        setError('');
    }, [batteryHealth, isOpen]);

    const handleSave = async () => {
        if (!label.trim()) { setError('Label é obrigatório'); return; }
        const numValue = typeof valuePct === 'number' ? valuePct : parseInt(String(valuePct).replace(/[^0-9]/g, '')) || 0;
        setSaving(true); setError('');
        try {
            if (batteryHealth) {
                // Nota: battery_healths não tem update na API — delete + create
                await batteryHealthService.delete(batteryHealth.id);
            }
            await batteryHealthService.create({ label: label.trim(), value: numValue });
            onSave(); onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao salvar');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between p-6 border-b border-slate-200">
                    <h2 className="text-xl font-bold text-slate-800">
                        {batteryHealth ? 'Editar Saúde da Bateria' : 'Nova Saúde da Bateria'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Label <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                            placeholder="Ex: 100%, 95%, 90%..."
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Valor % (numérico)</label>
                        <input
                            type="number"
                            value={valuePct}
                            onChange={(e) => setValuePct(e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder="Ex: 95"
                            min={0} max={100}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                            {error}
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 bg-slate-50">
                    <button onClick={onClose} disabled={saving} className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50">
                        Cancelar
                    </button>
                    <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        {saving ? 'Salvando...' : 'Salvar'}
                    </button>
                </div>
            </div>
        </div>
    );
};
