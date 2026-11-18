'use strict';

// Linha do tempo de um aparelho serializado, montada a partir do que o banco
// já guarda (diário unit_journal_events, vendas, entrada por foto, garantias).
// Função pura: recebe as linhas, devolve { current, events }. Só admin lê isso.

const STATUS_LABELS = {
  available: 'Disponível', reserved: 'Reservado', sold: 'Vendido',
  rma: 'RMA', hidden: 'Oculto', scrapped: 'Descartado',
};
const CANCELLED = new Set(['cancelled', 'canceled']);
const REFUNDED = new Set(['refunded']);
const CORRECTABLE_FIELDS = [
  ['imei_1', 'IMEI 1'], ['imei_2', 'IMEI 2'], ['imei', 'IMEI'], ['serial', 'Serial'],
  ['cost_price', 'Custo', 'money'], ['condition', 'Condição'],
];
const PAYMENT_LABELS = {
  money: 'dinheiro', cash: 'dinheiro', pix: 'Pix', credit: 'crédito', debit: 'débito',
  a_prazo: 'crediário', saldo_entregas: 'saldo de entregas', transfer: 'transferência',
};

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const money = cents => brl.format((Number(cents) || 0) / 100);
const saleCode = id => String(id || '').replace(/-/g, '').slice(0, 8).toUpperCase();

// Datas do MySQL vêm sem fuso e estão em UTC.
function iso(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const text = String(value).trim();
  if (/Z$|[+-]\d\d:?\d\d$/.test(text)) return new Date(text).toISOString();
  return new Date(text.replace(' ', 'T') + 'Z').toISOString();
}
const parse = v => (typeof v === 'string' ? (() => { try { return JSON.parse(v); } catch { return null; } })() : v) || null;
const status = snap => String(snap?.unit?.status || '').toLowerCase();
const payStatus = snap => String(snap?.sale?.payment_status || '').toLowerCase();

function paymentText(sale) {
  const methods = parse(sale?.payment_methods);
  const list = Array.isArray(methods) && methods.length
    ? methods.map(m => PAYMENT_LABELS[m.method] || m.method).filter(Boolean)
    : String(sale?.payment_method || '').split(',').map(m => PAYMENT_LABELS[m.trim()] || m.trim()).filter(Boolean);
  return [...new Set(list)].join(' + ');
}

function buildUnitTimeline(input = {}) {
  const unit = input.unit || {};
  const byId = rows => new Map((rows || []).map(r => [String(r.id), r]));
  const sales = byId(input.sales);
  const customers = byId(input.customers);
  const team = byId(input.teamMembers);
  const deposits = byId(input.deposits);
  const locations = byId(input.locations);
  const intakes = byId(input.intakes);
  const events = new Map();
  const add = (key, event, order) => { if (!events.has(key)) events.set(key, { key, saleId: null, orderId: null, intakeId: null, detail: null, actor: null, ...event, _order: order }); };

  const customerName = (sale, snapSale) => {
    const id = sale?.customer_id || snapSale?.customer_id;
    return customers.get(String(id || ''))?.name || 'Cliente não encontrado';
  };
  const sellerName = (sale, snapSale) => team.get(String(sale?.seller_id || snapSale?.seller_id || ''))?.name || null;
  const itemFor = saleId => (input.saleItems || []).find(i => String(i.sale_id) === String(saleId) && String(i.serialized_unit_id || '') === String(unit.id));

  const soldEvent = (row, saleId, snap, itemSnap) => {
    const sale = sales.get(String(saleId)) || null;
    const snapSale = snap?.sale || null;
    const item = itemSnap || itemFor(saleId);
    const parts = [customerName(sale, snapSale)];
    if (item?.unit_price != null) parts.push(money(item.unit_price));
    const pay = paymentText(sale || snapSale);
    if (pay) parts.push(pay);
    add(`sold:${saleId}`, {
      type: 'sold', at: iso(row.recorded_at), title: `Vendido · venda #${saleCode(saleId)}`,
      detail: parts.join(' · '), actor: sellerName(sale, snapSale), saleId: String(saleId),
    }, row.id);
  };

  for (const raw of input.journal || []) {
    const row = { ...raw, before_data: parse(raw.before_data), after_data: parse(raw.after_data) };
    const before = row.before_data; const after = row.after_data;
    const at = iso(row.recorded_at);
    switch (row.event_type) {
      case 'unit_insert': {
        const u = after?.unit || {};
        const parts = [u.intake_id ? 'Cadastro por foto' : 'Cadastro manual'];
        if (u.cost_price != null) parts.push(`custo ${money(u.cost_price)}`);
        add(`entry:${row.id}`, { type: 'entry', at, title: 'Entrada no estoque', detail: parts.join(' · '), intakeId: u.intake_id || null,
          actor: intakes.get(String(u.intake_id || ''))?.created_by_name || null }, row.id);
        break;
      }
      case 'baseline': {
        const u = after?.unit || {};
        add(`legacy_entry:${row.id}`, { type: 'legacy_entry', at: iso(u.created_at) || at, title: 'Já estava cadastrado',
          detail: 'Registro anterior ao diário (14/10/2026).', intakeId: u.intake_id || null }, row.id);
        break;
      }
      case 'existing_sale_reference': {
        const saleId = after?.sale?.id || after?.unit?.sale_id;
        const sale = sales.get(String(saleId || ''));
        add(`legacy_sale:${saleId || row.id}`, { type: 'legacy_sale', at: iso(sale?.created_at || after?.sale?.created_at || after?.unit?.sold_at) || at,
          title: saleId ? `Venda anterior ao diário · #${saleCode(saleId)}` : 'Venda anterior ao diário',
          detail: saleId ? customerName(sale, after?.sale) : null, saleId: saleId ? String(saleId) : null }, row.id);
        break;
      }
      case 'sale_items_insert': {
        const saleId = after?.sale_items?.sale_id || after?.sale?.id;
        if (saleId) soldEvent(row, saleId, after, after?.sale_items);
        break;
      }
      case 'sale_update': {
        const was = payStatus(before); const now = payStatus(after);
        const saleId = after?.sale?.id;
        const wasClosed = CANCELLED.has(was) || REFUNDED.has(was);
        if (!saleId || wasClosed) break;
        if (CANCELLED.has(now)) add(`sale_cancelled:${saleId}`, { type: 'sale_cancelled', at, title: `Venda cancelada · #${saleCode(saleId)}`, detail: customerName(sales.get(String(saleId)), after.sale), saleId: String(saleId) }, row.id);
        else if (REFUNDED.has(now)) add(`sale_refunded:${saleId}`, { type: 'sale_refunded', at, title: `Venda estornada · #${saleCode(saleId)}`, detail: customerName(sales.get(String(saleId)), after.sale), saleId: String(saleId) }, row.id);
        break;
      }
      case 'unit_update': {
        const from = status(before); const to = status(after);
        const bu = before?.unit || {}; const au = after?.unit || {};
        if (from !== to) {
          if (to === 'sold' && au.sale_id) soldEvent(row, au.sale_id, after);
          else if (to === 'sold') add(`sold:${row.id}`, { type: 'sold', at, title: 'Vendido', detail: au.order_id ? `Pedido ${au.order_id}` : null, orderId: au.order_id || null }, row.id);
          else if (to === 'reserved') add(`reserved:${row.id}`, { type: 'reserved', at, title: 'Reservado para pedido', detail: au.order_id ? `Pedido ${au.order_id}` : null, orderId: au.order_id || null }, row.id);
          else if (from === 'reserved' && to === 'available') add(`reservation_released:${row.id}`, { type: 'reservation_released', at, title: 'Reserva liberada', orderId: bu.order_id || null }, row.id);
          else if (from === 'sold' && to === 'available') add(`returned_to_stock:${row.id}`, { type: 'returned_to_stock', at, title: 'Voltou ao estoque', detail: bu.sale_id ? `Saiu da venda #${saleCode(bu.sale_id)}` : null, saleId: bu.sale_id || null }, row.id);
          else if (from === 'hidden' && to === 'available') add(`unhidden:${row.id}`, { type: 'unhidden', at, title: 'Voltou a ficar visível' }, row.id);
          else if (to === 'rma') add(`rma:${row.id}`, { type: 'rma', at, title: 'Enviado para RMA' }, row.id);
          else if (to === 'hidden') add(`hidden:${row.id}`, { type: 'hidden', at, title: 'Ocultado' }, row.id);
          else if (to === 'scrapped') add(`scrapped:${row.id}`, { type: 'scrapped', at, title: 'Descartado' }, row.id);
        }
        const changes = CORRECTABLE_FIELDS
          .filter(([field]) => String(bu[field] ?? '') !== String(au[field] ?? '') && (bu[field] != null || au[field] != null))
          .filter(([field]) => !(field === 'cost_price' && Number(bu[field]) === Number(au[field])))
          .map(([field, label, kind]) => `${label}: ${kind === 'money' ? money(bu[field]) : (bu[field] ?? 'vazio')} → ${kind === 'money' ? money(au[field]) : (au[field] ?? 'vazio')}`);
        if (changes.length) add(`data_corrected:${row.id}`, { type: 'data_corrected', at, title: 'Dados do aparelho corrigidos', detail: changes.join(' · ') }, row.id);
        break;
      }
      default: break; // eventos de produto, saldo por local e pedido são do produto, não do aparelho
    }
  }

  for (const w of input.warranties || []) {
    if (String(w.serialized_unit_id || '') !== String(unit.id)) continue;
    add(`warranty_issued:${w.id}`, { type: 'warranty_issued', at: iso(w.created_at), title: 'Garantia emitida', saleId: w.sale_id || null }, `w${w.id}`);
  }
  for (const s of input.signedWarranties || []) {
    if (String(s.status || '') !== 'available') continue;
    add(`warranty_signed:${s.id}`, { type: 'warranty_signed', at: iso(s.created_at), title: 'Termo de garantia assinado', saleId: s.sale_id || null }, `s${s.id}`);
  }

  const orderNum = v => (/^\d+$/.test(String(v)) ? Number(v) : 0);
  const list = [...events.values()]
    .sort((a, b) => (b.at || '').localeCompare(a.at || '') || orderNum(b._order) - orderNum(a._order))
    .map(({ _order, ...event }) => event);

  const unitStatus = String(unit.status || '').toLowerCase();
  const currentSaleId = unitStatus === 'sold' ? unit.sale_id : null;
  const currentSale = currentSaleId ? sales.get(String(currentSaleId)) : null;
  const lastIn = list.find(e => ['entry', 'legacy_entry', 'returned_to_stock', 'reservation_released', 'unhidden'].includes(e.type));
  const since = lastIn?.at || iso(unit.created_at);
  const daysInStock = unitStatus === 'available' && since
    ? Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 86400000)) : null;
  const deposit = deposits.get(String(unit.deposit_id || ''));
  const location = locations.get(String(unit.location_id || ''));

  return {
    current: {
      status: unitStatus,
      statusLabel: STATUS_LABELS[unitStatus] || unitStatus || 'Desconhecido',
      deposit: deposit ? { id: String(deposit.id), name: deposit.name } : null,
      location: location ? { id: String(location.id), name: location.name } : null,
      sale: currentSaleId ? {
        id: String(currentSaleId), code: saleCode(currentSaleId),
        customerName: customerName(currentSale, null), soldAt: iso(unit.sold_at || currentSale?.created_at),
      } : null,
      orderId: unitStatus === 'reserved' ? (unit.order_id || null) : null,
      costCents: unit.cost_price != null ? Number(unit.cost_price) : null,
      priceCents: input.product?.price_retail != null ? Math.round(Number(input.product.price_retail)) : null,
      daysInStock,
      timesSold: list.filter(e => e.type === 'sold' || e.type === 'legacy_sale').length,
      timesReturned: list.filter(e => e.type === 'returned_to_stock').length,
    },
    events: list,
  };
}

module.exports = { buildUnitTimeline, STATUS_LABELS };
