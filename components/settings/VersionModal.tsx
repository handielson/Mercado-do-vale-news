
import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Version, VersionInput } from '../../types/version';
import { versionService } from '../../services/versions';

interface VersionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    version?: Version | null;
}

/**
 * Version Modal Component
 * Add/Edit product version with form validation
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Simple form (name + active status)
 * - Auto-generate slug on save
 * - Follows established modal pattern
 */
export const VersionModal: React.FC<VersionModalProps> = ({ isOpen, onClose, onSave, version }) => {
    const [name, setName] = useState('');
    const [active, setActive] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (version) {
            setName(version.name);
            setActive(version.active);
        } else {
            setName('');
            setActive(true);
        }
        setError('');
    }, [version, isOpen]);

    const handleSave = async () => {
        // Validation
        if (!name.trim()) {
            setError('Nome da versão é obrigatório');
            return;
        }

        if (name.trim().length < 2) {
            setError('Nome deve ter pelo menos 2 caracteres');
            return;
        }

        setSaving(true);
        setError('');

        try {
            const input: VersionInput = {
                name: name.trim(),
                active
            };

            if (version) {
                await versionService.update(version.id, input);
            } else {
                await versionService.create(input);
            }

            onSave();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao salvar versão');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200">
                    <h2 className="text-xl font-bold text-slate-800">
                        {version ? 'Editar Versão' : 'Nova Versão'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                    {/* Name Input */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Versão <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ex: Global, China, USA, iOS 17..."
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            Versões regionais ou de software (Global, China, iOS 17, Android 14, etc.)
                        </p>
                    </div>

                    {/* Active Checkbox */}
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="version-active"
                            checked={active}
                            onChange={(e) => setActive(e.target.checked)}
                            className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="version-active" className="text-sm text-slate-700 cursor-pointer">
                            Versão Ativa (visível no cadastro de produtos)
                        </label>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                            {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 bg-slate-50">
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? 'Salvando...' : 'Salvar'}
                    </button>
                </div>
            </div>
        </div>
    );
};
