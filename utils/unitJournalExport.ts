export interface JournalEvent {
    id: string;
    unit_id: string;
    event_type: string;
    recorded_at: string;
    db_actor: string;
    before_data: Record<string, unknown> | null;
    after_data: Record<string, unknown> | null;
}
export interface JournalResponse { events: JournalEvent[]; next: string | null }

export function journalSummary(event: JournalEvent, labels: Record<string, string>) {
    const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};
    const before = record(event.before_data?.unit);
    const after = record(event.after_data?.unit);
    const unit = event.after_data ? after : before;
    const status = (value: unknown) => value == null ? 'Não informado' : labels[String(value)] || String(value);
    const displayDate = (value: string) => {
        const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(value) ? value.replace(' ', 'T') + 'Z' : value;
        const parsed = new Date(normalized);
        return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    };
    let description = labels[event.event_type] || event.event_type;
    if (event.event_type === 'baseline') {
        description = 'Início do diário — aparelho já cadastrado';
        if (unit.created_at) description += `. Cadastro original: ${displayDate(String(unit.created_at))}`;
    } else if (event.event_type === 'existing_sale_reference') {
        description = 'Venda anterior localizada — referência recuperada';
        const sale = record(event.after_data?.sale);
        if (sale.created_at) description += `. Data da venda: ${displayDate(String(sale.created_at))}`;
    } else if (event.event_type === 'unit_update' && before.status !== after.status) {
        description = `Situação alterada: ${status(before.status)} → ${status(after.status)}`;
    } else if (event.event_type.startsWith('product_stock_locations_')) {
        const oldLocation = record(event.before_data?.product_stock_locations);
        const newLocation = record(event.after_data?.product_stock_locations);
        const oldQuantity = oldLocation.quantity ?? 'Não informado';
        const newQuantity = newLocation.quantity ?? 'Não informado';
        description += `. Saldo do local: ${oldQuantity} → ${newQuantity} (contexto do produto)`;
    } else if (event.event_type.startsWith('stock_location_movements_')) {
        const movement = record(event.after_data?.stock_location_movements || event.before_data?.stock_location_movements);
        if (movement.quantity != null) description += `. Quantidade: ${movement.quantity} (contexto do produto)`;
        if (movement.reason) description += `. Motivo: ${movement.reason}`;
    }
    const identifier = unit.imei_1 || unit.imei_2 || unit.serial;
    return {
        id: event.id,
        date: displayDate(event.recorded_at),
        device: identifier ? `${unit.imei_1 || unit.imei_2 ? 'IMEI' : 'Serial'} final ${String(identifier).slice(-4)}` : `Aparelho ${event.unit_id.slice(0, 8)}`,
        description,
        status: event.event_type === 'unit_delete' ? 'Cadastro removido' : status(unit.status),
    };
}

export function journalSummaryText(title: string, events: JournalEvent[], labels: Record<string, string>) {
    return [`Mercado do Vale — ${title}`, 'EXTRATO RESUMIDO', `${events.length} registros — horário de São Paulo`,
        ...events.map(event => { const row = journalSummary(event, labels); return `${row.date} | ${row.device}\n${row.description}\nSituação: ${row.status}`; }),
        'Registros de saldo por local são contexto do produto; não comprovam movimentação física deste aparelho.',
    ].join('\n\n');
}

export async function collectJournal(read: (cursor?: string) => Promise<JournalResponse>) {
    const events: JournalEvent[] = [];
    const seen = new Set<string>();
    let cursor: string | undefined;
    do {
        const page = await read(cursor);
        events.push(...page.events);
        if (!page.next) break;
        if (seen.has(page.next)) throw new Error('Paginação inconsistente. O histórico não foi exportado.');
        seen.add(page.next);
        cursor = page.next;
    } while (cursor);
    return [...new Map(events.map(event => [event.id, event])).values()].sort((a, b) => BigInt(a.id) < BigInt(b.id) ? -1 : 1);
}

export function journalText(title: string, events: JournalEvent[], labels: Record<string, string>) {
    function data(value: unknown, indent = ''): string {
        if (value == null) return 'Não informado';
        if (typeof value === 'string' && /^[\[{]/.test(value)) {
            try { return data(JSON.parse(value), indent); } catch { /* plain text */ }
        }
        if (typeof value === 'object') return Object.entries(value).map(([key, item]) => `${indent}${labels[key] || key}: ${data(item, indent + '  ')}`).join('\n');
        const text = String(value);
        // Binary image content is preserved in the journal; it is not useful in a text document.
        return text.startsWith('data:image/') ? '[Imagem preservada no registro; consulte no painel]' : labels[text] || text;
    }
    return [journalSummaryText(title, events, labels), '\nDADOS COMPLETOS', `${events.length} registros — ordem cronológica`,
        'Datas dos eventos em horário de São Paulo. Os dados originais preservam seus valores e datas.',
        ...events.map(event => [
            `\n━━━━━━━━━━━━━━━━━━━━━━\n${labels[event.event_type] || event.event_type}`,
            `Registro ${event.id} — ${new Date(event.recorded_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
            `Unidade: ${event.unit_id}`,
            event.event_type === 'baseline' ? 'Fotografia na implantação do diário; não representa um novo cadastro. A data original consta nos dados.' : '',
            event.event_type === 'existing_sale_reference' ? 'Referência de venda preexistente; a data original consta nos dados.' : '',
            `Conta técnica: ${event.db_actor}`,
            event.before_data ? `Dados anteriores:\n${data(event.before_data)}` : '',
            event.after_data ? `Dados completos registrados:\n${data(event.after_data)}` : '',
        ].filter(Boolean).join('\n'))].join('\n');
}

export function journalPrintHtml(title: string, text: string) {
    const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escape(title)}</title><style>@page{size:A4;margin:15mm}body{font-family:Arial,sans-serif;font-size:11px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-family:inherit;line-height:1.5}</style></head><body><pre>${escape(text)}</pre></body></html>`;
}
