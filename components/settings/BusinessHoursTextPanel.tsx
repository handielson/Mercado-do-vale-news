import React, { useState, useEffect } from 'react';
import { Clock, RefreshCw, Check } from 'lucide-react';
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

/** Formata "08:00" → "8h" ou "08:30" → "8h30" */
function fmtTime(t: string): string {
    const [h, m] = t.split(':');
    return m === '00' ? `${parseInt(h)}h` : `${parseInt(h)}h${m}`;
}

/** Gera texto a partir dos dados de BusinessHours */
export function generateHoursText(hours: BusinessHours): string {
    const days = Object.keys(hours) as (keyof BusinessHours)[];
    const lines: string[] = [];

    // Agrupa dias com mesmos horários para "Segunda a Sexta: 8h às 18h"
    const grouped: { label: string; open: string; close: string; lunch?: string }[] = [];

    let i = 0;
    while (i < days.length) {
        const day = days[i];
        const d = hours[day];

        if (!d.isOpen) {
            grouped.push({ label: DAY_LABELS[day], open: '', close: '' });
            i++;
            continue;
        }

        // Tenta agrupar dias consecutivos com os mesmos horários
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

        grouped.push({ label, open: d.openTime, close: d.closeTime, lunch });
        i = j;
    }

    for (const g of grouped) {
        if (!g.open) {
            lines.push(`${g.label}: Fechado`);
        } else {
            const base = `${g.label}: ${fmtTime(g.open)} às ${fmtTime(g.close)}`;
            lines.push(g.lunch ? `${base} (${g.lunch})` : base);
        }
    }

    return lines.join('\n');
}

export function BusinessHoursTextPanel() {
    const [text, setText] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        companySettingsService.get().then((s) => {
            if (s?.business_hours_display_text) {
                setText(s.business_hours_display_text);
            }
        });
    }, []);

    const save = (value: string) => {
        if (saveTimeout) clearTimeout(saveTimeout);
        const t = setTimeout(async () => {
            setIsSaving(true);
            try {
                await companySettingsService.update({ business_hours_display_text: value });
            } catch {
                toast.error('Erro ao salvar texto de horários.');
            } finally {
                setIsSaving(false);
            }
        }, 800);
        setSaveTimeout(t);
    };

    const handleChange = (value: string) => {
        setText(value);
        save(value);
    };

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            const settings = await companySettingsService.get();
            if (!settings?.business_hours) {
                toast.error('Nenhum horário configurado no painel de horários.');
                return;
            }
            const generated = generateHoursText(settings.business_hours);
            setText(generated);
            save(generated);
        } catch {
            toast.error('Erro ao gerar texto de horários.');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                        <Clock size={20} />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-slate-800">Texto de Horários (Exibição Pública)</h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Texto exibido no cabeçalho da loja. Edite livremente ou gere automaticamente.
                        </p>
                    </div>
                </div>

                <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm font-medium transition-colors disabled:opacity-50"
                >
                    <RefreshCw size={14} className={isGenerating ? 'animate-spin' : ''} />
                    Gerar automático
                </button>
            </div>

            <textarea
                value={text}
                onChange={(e) => handleChange(e.target.value)}
                rows={4}
                placeholder={
                    'Ex:\nSegunda a Sexta: 8h às 18h (almoço 12h às 13h30)\nSábado: 8h às 12h\nDomingo: Fechado'
                }
                className="w-full px-4 py-3 border border-slate-300 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y font-mono bg-slate-50"
            />

            <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
                {isSaving ? (
                    <span className="text-amber-500">Salvando...</span>
                ) : (
                    <>
                        <Check size={12} className="text-green-500" />
                        <span>Texto salvo automaticamente</span>
                    </>
                )}
            </div>
        </div>
    );
}
