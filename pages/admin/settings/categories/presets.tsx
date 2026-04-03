import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Save, X, Loader2, BookMarked, ChevronDown } from 'lucide-react';
import { vpsApiService, FieldPreset, FieldPresetInput } from '../../../../services/vpsApiService';
import { customFieldsService } from '../../../../services/custom-fields';
import { toast } from 'react-hot-toast';

type FieldRequirement = 'off' | 'optional' | 'required';

interface DynamicField {
    key: string;
    label: string;
}

const VISIBILITY_OPTIONS: { value: FieldRequirement; label: string; color: string }[] = [
    { value: 'off',      label: 'Oculto',      color: 'text-red-600' },
    { value: 'optional', label: 'Opcional',    color: 'text-yellow-600' },
    { value: 'required', label: 'Obrigatório', color: 'text-green-600' },
];

// ─── Preset Form (criar/editar) ───────────────────────────────────────────────
function PresetForm({
    initial,
    availableFields,
    onSave,
    onCancel,
    isSaving,
}: {
    initial?: FieldPreset;
    availableFields: DynamicField[];
    onSave: (data: FieldPresetInput) => void;
    onCancel: () => void;
    isSaving: boolean;
}) {
    const [name, setName] = useState(initial?.name ?? '');
    const [description, setDescription] = useState(initial?.description ?? '');
    const [config, setConfig] = useState<Record<string, FieldRequirement>>(
        (initial?.config as Record<string, FieldRequirement>) ?? {}
    );

    const setField = (key: string, value: FieldRequirement) =>
        setConfig(prev => ({ ...prev, [key]: value }));

    return (
        <div className="bg-white border border-blue-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <BookMarked className="w-4 h-4 text-blue-600" />
                {initial ? 'Editar Preset' : 'Novo Preset'}
            </h3>

            <div className="space-y-4 mb-6">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nome do preset *</label>
                    <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Ex: Smartphone, Notebook, Genérico..."
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
                    <input
                        type="text"
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="Descreva quando usar este preset..."
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
            </div>

            {/* Field config table */}
            <div className="border border-slate-200 rounded-lg overflow-x-auto mb-6">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-4 py-2 text-left font-medium text-slate-700">Campo</th>
                            {VISIBILITY_OPTIONS.map(opt => (
                                <th key={opt.value} className={`px-4 py-2 text-center font-medium ${opt.color} min-w-[100px]`}>
                                    {opt.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {availableFields.map(field => {
                            const current = config[field.key] ?? 'off';
                            return (
                                <tr key={field.key} className="hover:bg-slate-50">
                                    <td className="px-4 py-2 font-medium text-slate-800">{field.label}</td>
                                    {VISIBILITY_OPTIONS.map(opt => (
                                        <td key={opt.value} className="px-4 py-2 text-center">
                                            <input
                                                type="radio"
                                                name={`preset-${field.key}`}
                                                checked={current === opt.value}
                                                onChange={() => setField(field.key, opt.value)}
                                                className="w-4 h-4 cursor-pointer"
                                            />
                                        </td>
                                    ))}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="flex items-center justify-end gap-3">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 text-sm border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                >
                    Cancelar
                </button>
                <button
                    type="button"
                    disabled={!name.trim() || isSaving}
                    onClick={() => onSave({ name: name.trim(), description: description.trim() || undefined, config })}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {isSaving ? 'Salvando...' : 'Salvar Preset'}
                </button>
            </div>
        </div>
    );
}

// ─── Preset Card ──────────────────────────────────────────────────────────────
function PresetCard({
    preset,
    onEdit,
    onDelete,
}: {
    preset: FieldPreset;
    onEdit: () => void;
    onDelete: () => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const required = Object.entries(preset.config).filter(([, v]) => v === 'required').map(([k]) => k);
    const optional = Object.entries(preset.config).filter(([, v]) => v === 'optional').map(([k]) => k);

    return (
        <div className="bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-300 transition-colors">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <BookMarked className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                        <h4 className="font-semibold text-slate-900 truncate">{preset.name}</h4>
                        {preset.description && (
                            <p className="text-xs text-slate-500 mt-0.5 truncate">{preset.description}</p>
                        )}
                        <div className="flex flex-wrap gap-1 mt-2">
                            {required.slice(0, 4).map(k => (
                                <span key={k} className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">{k}</span>
                            ))}
                            {required.length > 4 && (
                                <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">+{required.length - 4}</span>
                            )}
                            {optional.slice(0, 2).map(k => (
                                <span key={k} className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">{k}</span>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
                        title="Ver detalhes"
                    >
                        <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                    </button>
                    <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors" title="Editar">
                        <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors" title="Excluir">
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {expanded && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                    <div className="grid grid-cols-3 gap-3 text-xs">
                        <div>
                            <p className="font-semibold text-green-700 mb-1">Obrigatórios ({required.length})</p>
                            {required.length === 0
                                ? <p className="text-slate-400 italic">Nenhum</p>
                                : required.map(k => <p key={k} className="text-slate-600">{k}</p>)
                            }
                        </div>
                        <div>
                            <p className="font-semibold text-yellow-700 mb-1">Opcionais ({optional.length})</p>
                            {optional.length === 0
                                ? <p className="text-slate-400 italic">Nenhum</p>
                                : optional.map(k => <p key={k} className="text-slate-600">{k}</p>)
                            }
                        </div>
                        <div>
                            <p className="font-semibold text-red-700 mb-1">Ocultos</p>
                            <p className="text-slate-400 italic">Todos os demais</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function FieldPresetsPage() {
    const [presets, setPresets] = useState<FieldPreset[]>([]);
    const [availableFields, setAvailableFields] = useState<DynamicField[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<FieldPreset | null>(null);

    const load = useCallback(async () => {
        setIsLoading(true);
        try {
            const [presetsData, fieldsData] = await Promise.all([
                vpsApiService.getFieldPresets(),
                customFieldsService.list(),
            ]);
            setPresets(presetsData ?? []);
            setAvailableFields(
                (fieldsData ?? [])
                    .filter(f => f.category === 'basic' || f.category === 'spec')
                    .map(f => ({ key: f.key, label: f.label }))
                    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
            );
        } catch {
            toast.error('Erro ao carregar presets');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleSave = async (data: FieldPresetInput) => {
        setIsSaving(true);
        try {
            if (editing) {
                await vpsApiService.updateFieldPreset(editing.id, data);
                toast.success('Preset atualizado!');
            } else {
                await vpsApiService.createFieldPreset(data);
                toast.success('Preset criado!');
            }
            setShowForm(false);
            setEditing(null);
            await load();
        } catch {
            toast.error('Erro ao salvar preset');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (preset: FieldPreset) => {
        if (!confirm(`Excluir o preset "${preset.name}"?`)) return;
        const ok = await vpsApiService.deleteFieldPreset(preset.id);
        if (ok) { toast.success('Preset excluído'); load(); }
        else toast.error('Erro ao excluir preset');
    };

    return (
        <div className="min-h-screen bg-slate-50 py-8">
            <div className="max-w-4xl mx-auto px-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                            <BookMarked className="w-6 h-6 text-blue-600" />
                            Presets de Campos
                        </h1>
                        <p className="text-slate-500 text-sm mt-1">
                            Grupos pré-configurados de visibilidade para aplicar rapidamente ao criar categorias.
                        </p>
                    </div>
                    <button
                        onClick={() => { setEditing(null); setShowForm(true); }}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Novo Preset
                    </button>
                </div>

                {/* Form */}
                {(showForm || editing) && (
                    <div className="mb-6">
                        <PresetForm
                            initial={editing ?? undefined}
                            availableFields={availableFields}
                            onSave={handleSave}
                            onCancel={() => { setShowForm(false); setEditing(null); }}
                            isSaving={isSaving}
                        />
                    </div>
                )}

                {/* List */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    </div>
                ) : presets.length === 0 ? (
                    <div className="text-center py-16 text-slate-400">
                        <BookMarked className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="font-medium">Nenhum preset criado ainda.</p>
                        <p className="text-sm mt-1">Crie grupos de campos para agilizar a criação de categorias.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {presets.map(preset => (
                            <PresetCard
                                key={preset.id}
                                preset={preset}
                                onEdit={() => { setEditing(preset); setShowForm(false); }}
                                onDelete={() => handleDelete(preset)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
