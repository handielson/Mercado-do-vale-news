import React, { useState, useEffect, useRef } from 'react';
import { Check, Tag } from 'lucide-react';
import { companySettingsService } from '../../services/companySettingsService';
import { BusinessHours } from '../../types/companySettings';
import toast from 'react-hot-toast';

const DAY_LABELS: Record<keyof BusinessHours, string> = {
    monday: 'Segunda',
    tuesday: 'Terça',
    wednesday: 'Quarta',
    thursday: 'Quinta',
    friday: 'Sexta',
    saturday: 'Sábado',
    sunday: 'Domingo',
};

function fmtTime(t: string): string {
    const [h, m] = t.split(':');
    return m === '00' ? `${parseInt(h)}h` : `${parseInt(h)}h${m}`;
}

export function generateHoursText(hours: BusinessHours): string {
    const days = Object.keys(hours) as (keyof BusinessHours)[];
    const lines: string[] = [];

    let i = 0;
    while (i < days.length) {
        const day = days[i];
        const d = hours[day];

        if (!d.isOpen) {
            lines.push(`${DAY_LABELS[day]}: Fechado`);
            i++;
            continue;
        }

        let j = i + 1;
        while (j < days.length) {
            const next = hours[days[j]];
            if (
                next.isOpen &&
                next.openTime === d.openTime &&
                next.closeTime === d.closeTime &&
                !!next.hasLunchBreak === !!d.hasLunchBreak &&
                (next.lunchStart || '') === (d.lunchStart || '') &&
                (next.lunchEnd || '') === (d.lunchEnd || '')
            ) {
                j++;
            } else {
                break;
            }
        }

        const label =
            j - i > 1
                ? `${DAY_LABELS[day]} a ${DAY_LABELS[days[j - 1]]}`
                : DAY_LABELS[day];

        const lunch =
            d.hasLunchBreak && d.lunchStart && d.lunchEnd
                ? `almoço ${fmtTime(d.lunchStart)} às ${fmtTime(d.lunchEnd)}`
                : undefined;

        const base = `${label}: ${fmtTime(d.openTime)} às ${fmtTime(d.closeTime)}`;
        lines.push(lunch ? `${base} (${lunch})` : base);
        i = j;
    }

    return lines.join('\n');
}

interface Labels {
    open: string;
    closed: string;
    closing_soon: string;
    lunch: string;
}

const DEFAULTS: Labels = {
    open: 'Loja Aberta',
    closed: 'Fechado',
    closing_soon: 'Fechando em breve',
    lunch: 'Retorna às',
};

export function BusinessHoursTextPanel() {
    const [labels, setLabels] = useState<Labels>(DEFAULTS);
    const [isSaving, setIsSaving] = useState(false);
    // useRef evita stale closure no debounce: sempre acessa o timeout mais recente
    const saveTimeout = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        companySettingsService.get().then((s) => {
            setLabels({
                open: s?.store_label_open || DEFAULTS.open,
                closed: s?.store_label_closed || DEFAULTS.closed,
                closing_soon: s?.store_label_closing_soon || DEFAULTS.closing_soon,
                lunch: s?.store_label_lunch || DEFAULTS.lunch,
            });
        });
    }, []);

    const save = (patch: object) => {
        if (saveTimeout.current) clearTimeout(saveTimeout.current);
        saveTimeout.current = setTimeout(async () => {
            setIsSaving(true);
            try {
                await companySettingsService.update(patch);
            } catch {
                toast.error('Erro ao salvar.');
            } finally {
                setIsSaving(false);
            }
        }, 800);
    };

    const handleLabelChange = (key: keyof Labels, value: string) => {
        const newLabels = { ...labels, [key]: value };
        setLabels(newLabels);
        save({
            store_label_open: newLabels.open,
            store_label_closed: newLabels.closed,
            store_label_closing_soon: newLabels.closing_soon,
            store_label_lunch: newLabels.lunch,
        });
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            {/* Badge Labels */}
            <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                    <Tag size={18} />
                </div>
                <div>
                    <h2 className="text-base font-bold text-slate-800">Textos do Badge "Loja Aberta"</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Personalize os textos exibidos no badge do header da loja. A lógica de aberto/fechado permanece igual.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {([
                    ['open', '🟢 Quando aberta', 'Ex: Loja Aberta'],
                    ['closed', '⚪ Quando fechada', 'Ex: Fechado'],
                    ['closing_soon', '🟡 Fechando em breve', 'Ex: Encerrando em breve'],
                    ['lunch', '🍽️ No almoço (prefixo)', 'Ex: Voltamos às'],
                ] as [keyof Labels, string, string][]).map(([key, label, placeholder]) => (
                    <div key={key}>
                        <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
                        <input
                            type="text"
                            value={labels[key]}
                            onChange={(e) => handleLabelChange(key, e.target.value)}
                            placeholder={placeholder}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50"
                        />
                    </div>
                ))}
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400">
                {isSaving ? (
                    <span className="text-amber-500">Salvando...</span>
                ) : (
                    <>
                        <Check size={12} className="text-green-500" />
                        <span>Salvo automaticamente</span>
                    </>
                )}
            </div>
        </div>
    );
}
