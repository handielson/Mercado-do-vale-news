import React from 'react';
import { Loader2, Pencil, Plus } from 'lucide-react';
import type { CustomField } from '../../services/custom-fields';
import type { TableOption } from '../../services/table-data';

interface ModelListFieldInputProps {
    field: CustomField;
    value: string | number | null | undefined;
    options: TableOption[];
    loading?: boolean;
    saving?: boolean;
    onChange: (value: string) => void;
    onAdd: (field: CustomField) => void;
    onEdit: (field: CustomField, option: TableOption) => void;
}

export const ModelListFieldInput: React.FC<ModelListFieldInputProps> = ({
    field,
    value,
    options,
    loading = false,
    saving = false,
    onChange,
    onAdd,
    onEdit,
}) => {
    const selectedOption = options.find(option => String(option.value) === String(value));
    const disabled = loading || saving;

    return (
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_2.5rem_2.5rem] items-center gap-2">
            <div className="relative min-w-0">
                <select
                    value={String(value ?? '')}
                    onChange={(event) => onChange(event.target.value)}
                    disabled={disabled}
                    aria-label={field.label}
                    className="h-10 w-full min-w-0 truncate rounded-lg border border-slate-200 bg-white px-3 pr-8 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                >
                    <option value="">{loading ? 'Carregando...' : 'Selecione...'}</option>
                    {options.map(option => (
                        <option key={String(option.value)} value={String(option.value)}>
                            {option.label}
                        </option>
                    ))}
                </select>
                {loading && (
                    <Loader2 className="pointer-events-none absolute right-8 top-3 h-4 w-4 animate-spin text-slate-400" />
                )}
            </div>

            <button
                type="button"
                onClick={() => onAdd(field)}
                disabled={disabled}
                title="Adicionar opcao"
                aria-label="Adicionar opcao"
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
                <Plus className="h-4 w-4" />
            </button>

            <button
                type="button"
                onClick={() => selectedOption && onEdit(field, selectedOption)}
                disabled={disabled || !selectedOption}
                title="Editar opcao selecionada"
                aria-label="Editar opcao selecionada"
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
                <Pencil className="h-4 w-4" />
            </button>
        </div>
    );
};
