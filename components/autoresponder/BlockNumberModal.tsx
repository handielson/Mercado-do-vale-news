import React from 'react';
import { Save, X } from 'lucide-react';
import type { AutoResponderBlocklistEntry } from '../../types/autoResponder';

export interface BlockNumberFormState {
    pattern: string;
    pattern_type: string;
    contact_name: string;
    reason: string;
    active: boolean;
}

export interface BlockNumberModalProps {
    editingBlocklistEntry: AutoResponderBlocklistEntry | null;
    blockForm: BlockNumberFormState;
    isSaving: boolean;
    onChange: (patch: Partial<BlockNumberFormState>) => void;
    onClose: () => void;
    onSave: () => void;
}

export const BlockNumberModal: React.FC<BlockNumberModalProps> = ({
    editingBlocklistEntry,
    blockForm,
    isSaving,
    onChange,
    onClose,
    onSave,
}) => (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/50 p-4">
        <div className="w-full max-w-xl rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                        {editingBlocklistEntry ? 'Editar bloqueio' : 'Adicionar bloqueio'}
                    </h2>
                    <p className="text-sm text-slate-500">Bloqueie um numero, prefixo ou padrao.</p>
                </div>
                <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800" aria-label="Fechar">
                    <X size={18} />
                </button>
            </div>

            <div className="space-y-4 px-5 py-5">
                <label className="block">
                    <span className="mb-1 block text-sm font-semibold text-slate-700">Padrao</span>
                    <input
                        value={blockForm.pattern}
                        onChange={(event) => onChange({ pattern: event.target.value })}
                        placeholder="Ex: 5587999999999"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                </label>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="block">
                        <span className="mb-1 block text-sm font-semibold text-slate-700">Tipo</span>
                        <select
                            value={blockForm.pattern_type}
                            onChange={(event) => onChange({ pattern_type: event.target.value })}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        >
                            <option value="exact">Exato</option>
                            <option value="prefix">Prefixo</option>
                            <option value="regex">Regex</option>
                        </select>
                    </label>

                    <label className="block">
                        <span className="mb-1 block text-sm font-semibold text-slate-700">Nome</span>
                        <input
                            value={blockForm.contact_name}
                            onChange={(event) => onChange({ contact_name: event.target.value })}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                    </label>
                </div>

                <label className="block">
                    <span className="mb-1 block text-sm font-semibold text-slate-700">Motivo</span>
                    <textarea
                        value={blockForm.reason}
                        onChange={(event) => onChange({ reason: event.target.value })}
                        rows={3}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                </label>

                <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                    <input
                        type="checkbox"
                        checked={blockForm.active}
                        onChange={(event) => onChange({ active: event.target.checked })}
                        className="h-4 w-4 rounded border-slate-300"
                    />
                    <span className="text-sm font-semibold text-slate-700">Bloqueio ativo</span>
                </label>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
                <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                    Cancelar
                </button>
                <button
                    type="button"
                    onClick={onSave}
                    disabled={isSaving || !blockForm.pattern.trim()}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    <Save size={16} />
                    Salvar bloqueio
                </button>
            </div>
        </div>
    </div>
);

export default BlockNumberModal;
