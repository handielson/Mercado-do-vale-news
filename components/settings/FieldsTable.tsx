import React from 'react';
import { Trash2 } from 'lucide-react';
import { FieldFormat, FieldDefinition } from '../../config/field-dictionary';

interface FieldsTableProps {
    fields: [string, FieldDefinition][];
    formatOptions: { value: FieldFormat; label: string; color: string }[];
    onFormatChange: (fieldKey: string, newFormat: FieldFormat) => void;
    onDeleteField: (fieldKey: string) => void;
    isCustomField: (key: string) => boolean;
}

/**
 * FieldsTable
 * Table displaying all fields with format configuration
 */
export function FieldsTable({ fields, formatOptions, onFormatChange, onDeleteField, isCustomField }: FieldsTableProps) {
    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                            Chave do Campo
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                            Label Padrão
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                            Placeholder
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                            Formatação
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                            Obrigatório
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                            Ações
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {fields.map(([key, definition]) => (
                        <tr key={key} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 text-sm">
                                <code className="px-2 py-1 bg-slate-100 rounded text-xs font-mono text-slate-800">
                                    {key}
                                </code>
                            </td>
                            <td className="px-6 py-4 text-sm font-medium text-slate-800">
                                {definition.label}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">
                                <span className="italic">{definition.placeholder}</span>
                            </td>
                            <td className="px-6 py-4 text-sm">
                                <select
                                    value={definition.format}
                                    onChange={(e) => onFormatChange(key, e.target.value as FieldFormat)}
                                    className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                >
                                    {formatOptions.map(option => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </td>
                            <td className="px-6 py-4 text-sm text-center">
                                {definition.required ? (
                                    <span className="text-red-600 font-bold">✓</span>
                                ) : (
                                    <span className="text-slate-300">—</span>
                                )}
                            </td>
                            <td className="px-6 py-4 text-sm text-center">
                                {isCustomField(key) ? (
                                    <button
                                        onClick={() => onDeleteField(key)}
                                        className="text-red-600 hover:text-red-800 transition-colors"
                                        title="Deletar campo customizado"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                ) : (
                                    <span className="text-slate-300">—</span>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
