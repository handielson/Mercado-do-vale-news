import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { modelService } from '../../services/models';
import { categoryService } from '../../services/categories';
import { stockLocationService } from '../../services/stockLocationService';
import { readExcelObjects, writeExcelRows } from '../../utils/excel';
import { ENTRY_TEMPLATE_HEADERS, rowsToLines, templateExampleRows } from './spreadsheetRows.js';
import { hasIdentity } from './entryList.js';
import type { EntryLine, EntryState } from './EntryListPanel';

export interface SpreadsheetEntryTabProps {
    onAddLines: (lines: EntryLine[]) => void;
    /** Lista atual da tela, para não adicionar de novo o que já está nela. */
    existingState: EntryState;
    busy?: boolean;
}

interface Parsed { fileName: string; lines: EntryLine[]; issues: { row: number; message: string }[]; fatal?: string; empty: boolean }
interface Ctx { models: any[]; categories: any[]; locations: any[] }

const READ_ERROR = 'Não foi possível ler a planilha. Use o modelo .xlsx da Entrada.';
const CTX_ERROR = 'Não foi possível carregar modelos, categorias e locais. Recarregue a página.';
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const SpreadsheetEntryTab: React.FC<SpreadsheetEntryTabProps> = ({ onAddLines, existingState, busy }) => {
    const [ctx, setCtx] = useState<Ctx | null>(null);
    const [loadError, setLoadError] = useState(false);
    const [parsed, setParsed] = useState<Parsed | null>(null);
    const [readError, setReadError] = useState<string | null>(null);
    const [reading, setReading] = useState(false);
    const ctxRef = useRef<Ctx | null>(null);
    const ctxPromise = useRef<Promise<Ctx> | null>(null);
    const seq = useRef(0);

    // Modelos, categorias e locais carregam uma vez (na primeira necessidade ou ao abrir a aba).
    const loadCtx = useCallback((): Promise<Ctx> => {
        if (!ctxPromise.current) {
            ctxPromise.current = Promise.all([
                modelService.list(), categoryService.list(), stockLocationService.listLocations(),
            ]).then(([models, categories, locations]) => {
                const loaded: Ctx = {
                    models: models as any[], categories: categories as any[],
                    locations: (locations as any[]).filter(l => l.is_active !== false),
                };
                ctxRef.current = loaded;
                setCtx(loaded);
                setLoadError(false);
                return loaded;
            }).catch(err => { ctxPromise.current = null; setLoadError(true); throw err; });
        }
        return ctxPromise.current;
    }, []);
    useEffect(() => { loadCtx().catch(() => undefined); }, [loadCtx]);

    const onDrop = useCallback(async (files: File[]) => {
        const f = files[0];
        if (!f) return;
        const mine = ++seq.current;
        setReading(true); setReadError(null); setParsed(null);
        try {
            const [readResult, ctxResult] = await Promise.allSettled([readExcelObjects(f), loadCtx()]);
            if (mine !== seq.current) return;
            if (readResult.status === 'rejected') { setReadError(READ_ERROR); return; }
            if (ctxResult.status === 'rejected') { setReadError(CTX_ERROR); return; }
            const records = readResult.value;
            const c = ctxResult.value;
            if (!records || records.length === 0) {
                setParsed({ fileName: f.name, lines: [], issues: [], empty: true });
            } else {
                const r = rowsToLines(records, c);
                setParsed({ fileName: f.name, lines: r.lines as EntryLine[], issues: r.issues, fatal: r.fatal, empty: false });
            }
        } catch (err) {
            if (mine !== seq.current) return;
            setReadError(READ_ERROR);
        } finally {
            if (mine === seq.current) setReading(false);
        }
    }, [loadCtx]);

    const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
        accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
        maxFiles: 1,
        multiple: false,
        onDrop,
    });

    // Linhas cujo IMEI/serial já está na lista não entram de novo.
    const { ready, already } = useMemo(() => {
        const ready: EntryLine[] = [];
        let already = 0;
        for (const line of parsed?.lines || []) {
            const id = ((line.item as any)?.identity || {}) as Record<string, string | null>;
            const dup = [id.imei1, id.imei2, id.serial].some(v => v && hasIdentity(existingState, v));
            if (dup) already++; else ready.push(line);
        }
        return { ready, already };
    }, [parsed, existingState]);

    const downloadTemplate = async () => {
        try { await writeExcelRows('modelo_entrada.xlsx', templateExampleRows(), ENTRY_TEMPLATE_HEADERS); }
        catch { setReadError('Não foi possível gerar o modelo.'); }
    };

    const add = () => {
        if (busy || ready.length === 0) return;
        onAddLines(ready);
        setParsed(null);
    };

    const showResult = parsed && !parsed.fatal && !parsed.empty;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={downloadTemplate}
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                    Baixar modelo da planilha
                </button>
                <span className="text-sm text-gray-500">Preencha o modelo e envie o arquivo .xlsx (até 500 linhas).</span>
            </div>

            <div {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-6 text-center text-sm cursor-pointer ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50'}`}>
                <input {...getInputProps()} aria-label="Arquivo da planilha" />
                <p className="text-slate-700">{isDragActive ? 'Solte o arquivo aqui' : 'Arraste a planilha .xlsx aqui ou clique para escolher'}</p>
            </div>

            {fileRejections.length > 0 && !readError && (
                <p role="alert" className="text-sm text-red-700">Envie um arquivo .xlsx.</p>
            )}
            {loadError && <p role="alert" className="text-sm text-red-700">Não foi possível carregar modelos, categorias e locais. Recarregue a página.</p>}
            {readError && <p role="alert" className="text-sm text-red-700">{readError}</p>}
            {reading && <p className="text-sm text-gray-500">Lendo a planilha…</p>}

            {parsed?.fatal && <p role="alert" className="text-sm text-red-700">{parsed.fatal}</p>}
            {parsed?.empty && <p className="text-sm text-gray-600">Nenhuma linha encontrada na planilha.</p>}

            {showResult && (
                <div className="space-y-3">
                    <p className="text-xs text-gray-500">{parsed.fileName}</p>
                    <p className="text-sm text-gray-800">
                        <span className="font-semibold">{plural(ready.length, 'linha pronta', 'linhas prontas')}</span>
                        {already > 0 && <span className="text-gray-600"> · {already} {already === 1 ? 'já está na lista' : 'já estão na lista'}</span>}
                        {parsed.issues.length > 0 && <span className="text-red-700"> · {plural(parsed.issues.length, 'problema', 'problemas')}</span>}
                    </p>

                    {parsed.issues.length > 0 && (
                        <table className="w-full text-sm border border-gray-200">
                            <thead className="bg-gray-50 text-left">
                                <tr><th className="px-3 py-1.5 w-24">Linha</th><th className="px-3 py-1.5">Problema</th></tr>
                            </thead>
                            <tbody>
                                {parsed.issues.map((i, idx) => (
                                    <tr key={idx} className="border-t border-gray-100">
                                        <td className="px-3 py-1.5">{i.row}</td>
                                        <td className="px-3 py-1.5 text-red-700">{i.message}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    {ready.length > 0 && (
                        <button type="button" onClick={add} disabled={busy}
                            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                            Adicionar {plural(ready.length, 'linha', 'linhas')} à lista
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};
