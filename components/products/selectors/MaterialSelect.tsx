import React, { useEffect, useId, useRef, useState } from 'react';
import { Plus, RefreshCw, X } from 'lucide-react';
import { print3dMaterialsService } from '../../../services/print3dMaterials';

interface MaterialSelectProps {
    value: string;
    onChange: (value: string) => void;
    label?: string;
    required?: boolean;
    error?: string;
}

export function MaterialSelect({ value, onChange, label = 'Material', required = false, error }: MaterialSelectProps) {
    const fieldId = useId();
    const dialog = useRef<HTMLDialogElement>(null);
    const [materials, setMaterials] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [notice, setNotice] = useState('');
    const [refresh, setRefresh] = useState(0);

    useEffect(() => {
        let active = true;
        setLoading(true);
        setLoadError('');
        print3dMaterialsService.list().then(items => {
            if (active) setMaterials(items);
        }).catch(() => {
            if (active) setLoadError('Não foi possível carregar os materiais. Clique em atualizar para tentar novamente.');
        }).finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [refresh]);

    useEffect(() => {
        if (open && !dialog.current?.open) dialog.current?.showModal();
        if (!open && dialog.current?.open) dialog.current.close();
    }, [open]);

    const save = async () => {
        if (!name.trim() || saving) return;
        setSaving(true);
        setSaveError('');
        try {
            const result = await print3dMaterialsService.create(name);
            setMaterials(result.materials);
            onChange(result.name);
            setNotice(result.created ? 'Material cadastrado e selecionado.' : 'Esse material já estava cadastrado e foi selecionado.');
            setOpen(false);
            setName('');
        } catch {
            setSaveError('Não foi possível cadastrar. Confira o nome (até 80 caracteres) e tente novamente.');
        } finally { setSaving(false); }
    };

    return <div className="space-y-1 min-w-0">
        <label htmlFor={fieldId} className="block text-sm font-medium text-slate-700 mb-1">
            {label} {required && <span className="text-red-500">*</span>}
        </label>
        <div className="flex items-center gap-2">
            <select id={fieldId} aria-label={label} value={value} required={required}
                disabled={loading || saving} onChange={event => { onChange(event.target.value); setNotice(''); }}
                className={`min-w-0 w-full flex-1 rounded-md border p-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 ${error ? 'border-red-500' : 'border-slate-300'}`}>
                <option value="">{loading ? 'Carregando materiais...' : 'Selecione um material'}</option>
                {value && !materials.includes(value) && <option value={value}>{value} (valor atual preservado)</option>}
                {materials.map(material => <option key={material} value={material}>{material}</option>)}
            </select>
            <button type="button" aria-label="Atualizar materiais" title="Atualizar materiais" disabled={loading || saving}
                onClick={() => setRefresh(current => current + 1)} className="p-2 border border-slate-300 rounded-lg text-slate-600 disabled:opacity-50">
                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <button type="button" aria-label="Novo material" title="Novo material" disabled={loading || saving || Boolean(loadError)}
                onClick={() => { setSaveError(''); setName(''); setOpen(true); }} className="p-2 border border-slate-300 rounded-lg text-slate-600 disabled:opacity-50">
                <Plus size={18} />
            </button>
        </div>
        {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
        {loadError && <p className="text-xs text-red-600" role="alert">{loadError}</p>}
        {notice && <p className="text-xs text-emerald-700" role="status">{notice}</p>}
        <dialog ref={dialog} aria-labelledby={`${fieldId}-title`} onClose={() => setOpen(false)}
            onCancel={event => { if (saving) event.preventDefault(); }}
            className="w-[calc(100%_-_2rem)] max-w-md rounded-xl border-0 p-6 shadow-xl backdrop:bg-black/50">
            <div className="flex items-center justify-between gap-3 mb-3">
                <h3 id={`${fieldId}-title`} className="text-lg font-semibold text-slate-900">Novo material</h3>
                <button type="button" aria-label="Fechar cadastro de material" disabled={saving} onClick={() => setOpen(false)}><X size={20} /></button>
            </div>
            <p className="text-sm text-slate-600 mb-4">Este cadastro é compartilhado entre os produtos. Informe o tipo do material; marca, cor e custo do rolo ficam na ficha de produção.</p>
            <label htmlFor={`${fieldId}-name`} className="block text-sm font-medium mb-1">Nome do material</label>
            <input id={`${fieldId}-name`} value={name} maxLength={80} disabled={saving} autoFocus
                onChange={event => setName(event.target.value)} onKeyDown={event => {
                    if (event.key === 'Enter') { event.preventDefault(); void save(); }
                }} placeholder="Ex.: PETG-CF" className="w-full rounded-md border border-slate-300 p-2 text-sm" />
            {saveError && <p role="alert" className="text-sm text-red-600 mt-2">{saveError}</p>}
            <div className="mt-5 flex justify-end gap-2">
                <button type="button" disabled={saving} onClick={() => setOpen(false)} className="rounded-lg border px-3 py-2 text-sm">Cancelar</button>
                <button type="button" disabled={saving || !name.trim()} onClick={() => void save()}
                    className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50">{saving ? 'Salvando...' : 'Cadastrar e selecionar'}</button>
            </div>
        </dialog>
    </div>;
}
