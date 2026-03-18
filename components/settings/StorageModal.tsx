import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { storageService, Storage } from '../../services/storages';

interface StorageModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    storage?: Storage | null;
}

export const StorageModal: React.FC<StorageModalProps> = ({ isOpen, onClose, onSave, storage }) => {
    const [label, setLabel] = useState('');
    const [valueGb, setValueGb] = useState<number | ''>('');
    const [active, setActive] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (storage) {
            setLabel(storage.label);
            setValueGb(storage.value);
            setActive(storage.active);
        } else {
            setLabel('');
            setValueGb('');
            setActive(true);
        }
        setError('');
    }, [storage, isOpen]);

    const handleSave = async () => {
        if (!label.trim()) { setError('Label é obrigatório'); return; }
        const numValue = typeof valueGb === 'number' ? valueGb : parseInt(String(valueGb).replace(/[^0-9]/g, '')) || 0;
        setSaving(true); setError('');
        try {
            if (storage) {
                await storageService.update(storage.id, { label: label.trim(), value: numValue, active });
            } else {
                await storageService.create({ label: label.trim(), value: numValue, active });
            }
            onSave(); onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao salvar capacidade');
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
                        {storage ? 'Editar Capacidade' : 'Nova Capacidade'}
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
                            placeholder="Ex: 256GB, 1TB..."
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">GB (numérico)</label>
                        <input
                            type="number"
                            value={valueGb}
                            onChange={(e) => setValueGb(e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder="Ex: 256"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="storage-active"
                            checked={active}
                            onChange={(e) => setActive(e.target.checked)}
                            className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="storage-active" className="text-sm text-slate-700 cursor-pointer">
                            Ativo (visível no cadastro de produtos)
                        </label>
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
