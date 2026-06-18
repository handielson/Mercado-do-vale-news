import React, { FormEvent, useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import type { CustomField } from '../../services/custom-fields';
import type { ModelListOptionDraft } from '../../services/modelListOptions';
import type { TableOption } from '../../services/table-data';

interface ModelListOptionModalProps {
    isOpen: boolean;
    field: CustomField | null;
    current?: TableOption | null;
    saving?: boolean;
    onClose: () => void;
    onSave: (draft: ModelListOptionDraft) => Promise<void>;
}

export const ModelListOptionModal: React.FC<ModelListOptionModalProps> = ({
    isOpen,
    field,
    current = null,
    saving = false,
    onClose,
    onSave,
}) => {
    const [label, setLabel] = useState('');
    const [hexCode, setHexCode] = useState('#000000');
    const [error, setError] = useState('');
    const isColor = field?.table_config?.table_name === 'colors';

    useEffect(() => {
        if (!isOpen) return;

        setLabel(current?.label || '');
        setHexCode(String(current?.meta?.row?.hex_code || '#000000'));
        setError('');
    }, [current, isOpen]);

    if (!isOpen || !field) return null;

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!label.trim()) {
            setError('Informe o nome da opcao.');
            return;
        }

        setError('');
        try {
            await onSave({
                label: label.trim(),
                hexCode: isColor ? hexCode : undefined,
            });
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : 'Erro ao salvar opcao.');
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
            <form
                onSubmit={handleSubmit}
                className="w-full max-w-md overflow-hidden rounded-lg bg-white shadow-2xl"
            >
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                    <h2 className="min-w-0 truncate text-lg font-semibold text-slate-800">
                        {current ? 'Editar opcao' : 'Adicionar opcao'}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        title="Fechar"
                        aria-label="Fechar"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 disabled:opacity-50"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="space-y-4 p-5">
                    <div>
                        <label htmlFor="model-list-option-label" className="mb-1.5 block text-sm font-medium text-slate-700">
                            Nome da opcao
                        </label>
                        <input
                            id="model-list-option-label"
                            type="text"
                            value={label}
                            onChange={(event) => setLabel(event.target.value)}
                            disabled={saving}
                            autoFocus
                            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
                        />
                    </div>

                    {isColor && (
                        <div>
                            <label htmlFor="model-list-option-hex" className="mb-1.5 block text-sm font-medium text-slate-700">
                                Codigo hexadecimal
                            </label>
                            <div className="grid grid-cols-[minmax(0,1fr)_2.5rem] items-center gap-2">
                                <input
                                    id="model-list-option-hex"
                                    type="text"
                                    value={hexCode}
                                    onChange={(event) => setHexCode(event.target.value)}
                                    disabled={saving}
                                    placeholder="#000000"
                                    className="h-10 min-w-0 rounded-lg border border-slate-200 px-3 font-mono text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
                                />
                                <input
                                    type="color"
                                    value={/^#[0-9a-f]{6}$/i.test(hexCode) ? hexCode : '#000000'}
                                    onChange={(event) => setHexCode(event.target.value)}
                                    disabled={saving}
                                    title="Selecionar cor"
                                    aria-label="Selecionar cor"
                                    className="h-10 w-10 cursor-pointer rounded-lg border border-slate-200 bg-white p-1 disabled:cursor-not-allowed"
                                />
                            </div>
                        </div>
                    )}

                    {error && (
                        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                            {error}
                        </p>
                    )}
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="h-10 rounded-lg px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-200 disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={saving}
                        className="flex h-10 min-w-24 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                        {saving ? 'Salvando...' : 'Salvar'}
                    </button>
                </div>
            </form>
        </div>
    );
};
