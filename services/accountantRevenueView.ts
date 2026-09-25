import type { AccountantRevenueReport } from './accountantPortalService';

export type RevenueFilter = 'fiscal' | 'nfe' | 'nfce' | 'no_invoice' | 'pending' | 'all';
export const revenueFilterLabels: Record<RevenueFilter, string> = {
  fiscal: 'Notas importadas: NF-e e NFC-e', nfe: 'Notas importadas: NF-e', nfce: 'Notas importadas: NFC-e',
  no_invoice: 'Sem nota confirmado', pending: 'Pendente de conciliação', all: 'Todas as vendas',
};

export function lastTwelveMonths(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (type: string) => parts.find(part => part.type === type)!.value;
  const to = `${get('year')}-${get('month')}-${get('day')}`;
  const start = new Date(`${to}T00:00:00Z`);
  start.setUTCDate(1); start.setUTCMonth(start.getUTCMonth() - 11);
  return { from: start.toISOString().slice(0, 10), to };
}

export function revenueView(report: AccountantRevenueReport, filter: RevenueFilter) {
  const fiscal = ['fiscal', 'nfe', 'nfce'].includes(filter);
  const model = filter === 'nfe' ? '55' : filter === 'nfce' ? '65' : null;
  const documents = report.documents.filter(doc => filter === 'all' || (fiscal && doc.status === 'authorized' && ['55','65'].includes(doc.model) && (!model || doc.model === model)));
  const sales = report.sales.filter(sale => {
    if (filter === 'all') return true;
    if (filter === 'no_invoice') return sale.fiscalState === 'no_invoice_confirmed';
    if (filter === 'pending') return sale.fiscalState === 'reconciliation_pending';
    const models = sale.authorizedModels || (sale.document ? [sale.document.model] : []);
    return sale.fiscalState === 'invoiced' && (model ? models.includes(model) : models.some(value => ['55','65'].includes(value)));
  });
  const months = new Map<string, { month: string; type: string; channel: string; totalCents: number; count: number }>();
  const entries = fiscal ? documents.map(doc => ({ date: doc.issuedAt, cents: doc.totalCents, type: doc.model === '65' ? 'NFC-e' : 'NF-e', channel: doc.channel }))
    : sales.filter(sale => sale.operationalState === 'completed').map(sale => ({ date: sale.occurredAt, cents: sale.totalCents, type: filter === 'no_invoice' ? 'Sem nota' : filter === 'pending' ? 'A conciliar' : 'Venda', channel: sale.channel }));
  for (const entry of entries) {
    const month = entry.date.slice(0,7);
    if (month < report.period.from.slice(0,7) || month > report.period.to.slice(0,7)) continue;
    const key = `${month}:${entry.type}:${entry.channel}`;
    if (!months.has(key)) months.set(key, { month, type: entry.type, channel: entry.channel, totalCents: 0, count: 0 });
    const row = months.get(key)!;
    row.totalCents += entry.cents;
    row.count++;
  }
  const rows = [...months.values()].sort((left, right) => right.month.localeCompare(left.month) || left.type.localeCompare(right.type) || left.channel.localeCompare(right.channel));
  return { sales, documents, months: rows, totalCents: rows.reduce((sum,row) => sum+row.totalCents,0), count: rows.reduce((sum,row) => sum+row.count,0), fiscal };
}
