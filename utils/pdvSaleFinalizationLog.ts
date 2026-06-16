import type { SaleInput } from '../types/sale';

export type PdvSaleFinalizationStatus = 'success' | 'needs_review' | 'failed';

export type PdvSaleFinalizationLog = {
    id: string;
    status: PdvSaleFinalizationStatus;
    created_at: string;
    updated_at: string;
    sale_id?: string;
    sale_input: SaleInput;
    pdv_state: Record<string, unknown>;
    steps: Array<Record<string, unknown>>;
    errors: Array<Record<string, unknown>>;
    browser?: Record<string, unknown>;
};

function createLogId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
    return `pdv-log-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getPdvSaleFinalizationLogFileId(log: PdvSaleFinalizationLog): string {
    return log.sale_id ? log.sale_id.split('-')[0].toUpperCase() : log.id;
}

export function serializePdvSaleFinalizationLog(log: PdvSaleFinalizationLog): string {
    return JSON.stringify(log, null, 2);
}

export function buildPdvSaleFinalizationLog(input: {
    saleInput: SaleInput;
    pdvState: Record<string, unknown>;
    steps?: Array<Record<string, unknown>>;
}): PdvSaleFinalizationLog {
    const now = new Date().toISOString();
    return {
        id: createLogId(),
        status: 'success',
        created_at: now,
        updated_at: now,
        sale_input: input.saleInput,
        pdv_state: input.pdvState,
        steps: input.steps || [],
        errors: [],
        browser: typeof navigator === 'undefined' ? undefined : {
            userAgent: navigator.userAgent,
            language: navigator.language,
            online: navigator.onLine,
        },
    };
}

export function updatePdvSaleFinalizationLog(
    log: PdvSaleFinalizationLog,
    patch: Partial<PdvSaleFinalizationLog>
): PdvSaleFinalizationLog {
    return {
        ...log,
        ...patch,
        errors: patch.errors || log.errors,
        steps: patch.steps || log.steps,
        updated_at: new Date().toISOString(),
    };
}

export async function copyPdvSaleFinalizationLogText(log: PdvSaleFinalizationLog): Promise<void> {
    const text = serializePdvSaleFinalizationLog(log);
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
    }
    throw new Error('Area de transferencia indisponivel neste navegador');
}

export function downloadPdvSaleFinalizationLogText(log: PdvSaleFinalizationLog): void {
    if (typeof document === 'undefined') return;
    const blob = new Blob([serializePdvSaleFinalizationLog(log)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `venda-pdv-log-${getPdvSaleFinalizationLogFileId(log)}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}
