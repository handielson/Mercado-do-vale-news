import React from 'react';
import { Calendar, Copy } from 'lucide-react';

type KitField = {
    label: string;
    value: string;
};

type Props = {
    statusLabel: string;
    summary: string;
    instructions: string;
    fields: KitField[];
    onCopy: (label: string, value: string) => void;
    onCreateSlot?: () => void;
};

export default function MarketingKitPanel({
    statusLabel,
    summary,
    instructions,
    fields,
    onCopy,
    onCreateSlot,
}: Props) {
    const safeSummary = summary?.trim() || 'Nenhum kit gerado ainda.';
    const safeInstructions = instructions?.trim() || 'Selecione categoria e produto para montar o pacote.';

    return (
        <section className="border border-slate-200 bg-white p-5 shadow-sm rounded-lg">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="space-y-1">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-500">Kit Telegram</p>
                    <h2 className="text-xl font-black text-slate-900">Pacote operacional do dia</h2>
                    <p className="text-sm text-slate-500">Resumo, legenda pronta, CTA, hashtags e instrucoes de uso.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-600">
                        {statusLabel}
                    </span>
                    {onCreateSlot && (
                        <button
                            type="button"
                            onClick={onCreateSlot}
                            className="inline-flex items-center gap-2 rounded-lg bg-pink-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-pink-700"
                        >
                            <Calendar className="h-4 w-4" />
                            Criar slot
                        </button>
                    )}
                </div>
            </div>

            <div className="mt-4 space-y-4">
                <article className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Resumo</p>
                        <button
                            type="button"
                            onClick={() => onCopy('Resumo', safeSummary)}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-100"
                        >
                            <Copy className="h-3.5 w-3.5" />
                            Copiar
                        </button>
                    </div>
                    <pre className="whitespace-pre-wrap text-sm text-slate-700">{safeSummary}</pre>
                </article>

                {fields.map((field) => (
                    <article key={field.label} className="rounded-lg border border-slate-100 bg-white p-4">
                        <div className="mb-2 flex items-center justify-between gap-3">
                            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{field.label}</p>
                            <button
                                type="button"
                                onClick={() => onCopy(field.label, field.value)}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-100"
                            >
                                <Copy className="h-3.5 w-3.5" />
                                Copiar
                            </button>
                        </div>
                        <pre className="whitespace-pre-wrap text-sm text-slate-700">{field.value?.trim() || 'Nenhum conteudo gerado ainda.'}</pre>
                    </article>
                ))}

                <article className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-600">Instrucoes</p>
                        <button
                            type="button"
                            onClick={() => onCopy('Instrucoes', safeInstructions)}
                            className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-white px-2 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-100"
                        >
                            <Copy className="h-3.5 w-3.5" />
                            Copiar
                        </button>
                    </div>
                    <pre className="whitespace-pre-wrap text-sm text-slate-700">{safeInstructions}</pre>
                </article>
            </div>
        </section>
    );
}
