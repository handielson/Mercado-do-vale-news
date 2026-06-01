/**
 * LegacySalesImportTab
 *
 * Ferramenta de diagnóstico, importação e geração de PDFs de vendas do MV-Gestao.
 *
 * FLUXO:
 * 1. Analisar  — cruza PDFs do Synology + vendas legado + clientes novo sistema
 * 2. Diagnóstico — mostra matches, pendentes e já importadas
 * 3. Teste     — importa 1 venda
 * 4. Gerar PDFs — busca dados completos do produto (IMEI, modelo, marca...) e
 *                 faz upload de cada PDF para o Synology em lote
 */

import React, { useState } from 'react';
import {
  Search, CheckCircle2, AlertTriangle, FileText,
  Loader2, Users, ShoppingBag, RefreshCw,
  ChevronRight, FilePlus2,
} from 'lucide-react';
import { toast } from 'sonner';
import { legacyAPI, LegacySale, LegacyProduct, LegacyBrand } from '../../services/legacyAPI';
import { vpsClient } from '../../services/vpsClient';
import { customerService } from '../../services/customers';
import { companySettingsService } from '../../services/companySettingsService';
import { generateLegacySalePdf, LegacyReceiptItem } from '../../utils/legacySalePdfGenerator';

// ─── Config ───────────────────────────────────────────────────────────────────

const ARQUIVOS_CDN = 'https://arquivos.xiaomipetrolina.com.br';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MatchedSale {
  legacySale: LegacySale;
  cpf: string;
  newCustomerId: string;
  newCustomerName: string;
  pdfUrl: string | null;
  pdfSeq: number;
  alreadyImported: boolean;
}

interface PendingSale {
  cpf: string;
  count: number;
  hasPdfs: number;
}

interface DiagnosticResult {
  totalLegacySales: number;
  matched: MatchedSale[];
  pending: PendingSale[];
  alreadyImportedIds: Set<string>;
}

interface PdfProgress {
  current: number;
  total: number;
  currentName: string;
  errors: string[];
}

interface TableDataResponse<T> {
  rows?: T[];
}

interface LegacyImportedSaleRow {
  id: string;
  legacy_sale_id?: string | null;
  legacy_pdf_url?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapPaymentMethod(method: string, totalCents: number) {
  const m = (method || '').toUpperCase().trim();
  let type: 'money' | 'credit' | 'debit' | 'pix' = 'money';
  if (m.includes('PIX')) type = 'pix';
  else if (m.includes('CRED') || m.includes('CARTAO') || m.includes('CARD')) type = 'credit';
  else if (m.includes('DEB')) type = 'debit';
  return [{ method: type, amount: totalCents, total_with_fee: totalCents }];
}

function fmtCpf(cpf: string) {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR');
}

function fmtBRL(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

async function loadLegacyImportedSales(): Promise<LegacyImportedSaleRow[]> {
  const rows: LegacyImportedSaleRow[] = [];
  const pageSize = 200;

  for (let offset = 0; ; offset += pageSize) {
    const data = await vpsClient.get<TableDataResponse<LegacyImportedSaleRow>>(
      `/table-data/sales?limit=${pageSize}&offset=${offset}`
    );
    const pageRows = Array.isArray(data.rows) ? data.rows : [];
    rows.push(...pageRows.filter(row => row.legacy_sale_id));
    if (pageRows.length < pageSize) break;
  }

  return rows;
}

async function deleteLegacyImportedSale(id: string): Promise<void> {
  await vpsClient.delete(`/table-data/sales/${encodeURIComponent(id)}?pk=id`);
}

async function updateLegacySalePdfUrl(legacySaleId: string, pdfUrl: string): Promise<void> {
  const sale = (await loadLegacyImportedSales())
    .find(row => String(row.legacy_sale_id || '') === String(legacySaleId));
  if (!sale?.id) return;

  await vpsClient.patch(`/table-data/sales/${encodeURIComponent(sale.id)}?pk=id`, {
    legacy_pdf_url: pdfUrl,
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

type Phase = 'idle' | 'loading' | 'diagnostic' | 'testing' | 'done' | 'generating';

export const LegacySalesImportTab: React.FC = () => {
  const [phase, setPhase]           = useState<Phase>('idle');
  const [result, setResult]         = useState<DiagnosticResult | null>(null);
  const [testLog, setTestLog]       = useState<string[]>([]);
  const [pdfProgress, setPdfProgress] = useState<PdfProgress | null>(null);

  // ── Limpar todas as importações legadas ──────────────────────────────────────

  const [clearing, setClearing] = useState(false);

  const clearAllImported = async () => {
    if (!confirm('⚠️ Isso vai apagar TODAS as vendas importadas do MV-Gestao e seus itens. Continuar?')) return;

    setClearing(true);
    try {
      const legacySales = await loadLegacyImportedSales();
      const ids = legacySales.map(s => s.id);

      if (ids.length === 0) {
        toast.info('Nenhuma venda importada encontrada.');
        return;
      }

      for (const id of ids) {
        await deleteLegacyImportedSale(id);
      }

      toast.success(`${ids.length} venda(s) importada(s) apagada(s). Reimporte agora.`);
      setResult(null);
      setPhase('idle');
    } catch (err: any) {
      toast.error('Erro ao limpar: ' + err.message);
    } finally {
      setClearing(false);
    }
  };

  // ── Fase 1: Analisar ─────────────────────────────────────────────────────────

  const analyze = async () => {
    setPhase('loading');
    setResult(null);
    setTestLog([]);
    setPdfProgress(null);

    try {
      toast.loading('Buscando vendas no MV-Gestao...', { id: 'diag' });
      const legacySales = await legacyAPI.getSales();

      toast.loading('Comparando com clientes do novo sistema...', { id: 'diag' });
      const [newCustomers, existingSales] = await Promise.all([
        customerService.list(),
        loadLegacyImportedSales(),
      ]);

      const cpfMap = new Map<string, { id: string; name: string }>();
      (newCustomers || []).forEach(c => {
        if (c.cpf_cnpj) cpfMap.set(c.cpf_cnpj.replace(/\D/g, ''), { id: c.id, name: c.name });
      });

      // Mapeia legacy_sale_id → pdf_url já gravado no banco
      const importedPdfMap = new Map<string, string | null>();
      (existingSales || []).forEach(s => {
        if (s.legacy_sale_id) importedPdfMap.set(s.legacy_sale_id, s.legacy_pdf_url ?? null);
      });
      const alreadyImportedIds = new Set(importedPdfMap.keys());

      // Agrupar por CPF e ordenar por data (sequência de PDF)
      const saleByCpf = new Map<string, LegacySale[]>();
      for (const sale of legacySales) {
        const cust = sale.customer;
        if (!cust) continue;
        const cpf = (cust.cpf || cust.cpf_cnpj || '').replace(/\D/g, '');
        if (cpf.length !== 11) continue;
        if (!saleByCpf.has(cpf)) saleByCpf.set(cpf, []);
        saleByCpf.get(cpf)!.push(sale);
      }
      saleByCpf.forEach(sales =>
        sales.sort((a, b) => new Date(a.sale_date || '').getTime() - new Date(b.sale_date || '').getTime())
      );

      const matched: MatchedSale[]  = [];
      const pendingMap = new Map<string, { count: number; hasPdfs: number }>();

      for (const [cpf, sales] of Array.from(saleByCpf.entries())) {
        const newCust = cpfMap.get(cpf);
        for (let i = 0; i < sales.length; i++) {
          const sale    = sales[i];
          const seq     = i + 1;
          const pdfName = `${cpf}_${String(seq).padStart(3, '0')}.pdf`;
          // Se já foi importada, usa a URL gravada no banco; senão, calcula a URL esperada
          const alreadyImported = alreadyImportedIds.has(sale.id);
          const pdfUrl = alreadyImported
            ? (importedPdfMap.get(sale.id) ?? `${ARQUIVOS_CDN}/${pdfName}`)
            : null;

          if (newCust) {
            matched.push({
              legacySale: sale, cpf,
              newCustomerId: newCust.id, newCustomerName: newCust.name,
              pdfUrl, pdfSeq: seq,
              alreadyImported,
            });
          } else {
            const cur = pendingMap.get(cpf) || { count: 0, hasPdfs: 0 };
            pendingMap.set(cpf, { count: cur.count + 1, hasPdfs: cur.hasPdfs + (alreadyImported ? 1 : 0) });
          }
        }
      }

      const pending: PendingSale[] = Array.from(pendingMap.entries()).map(
        ([cpf, v]) => ({ cpf, ...v })
      );

      toast.dismiss('diag');
      setResult({ totalLegacySales: legacySales.length, matched, pending, alreadyImportedIds });
      setPhase('diagnostic');
    } catch (err: any) {
      toast.dismiss('diag');
      toast.error(err.message || 'Erro ao analisar');
      setPhase('idle');
    }
  };

  // ── Helper: importar uma venda no banco ──────────────────────────────────────

  const importOneSale = async (
    toImport: MatchedSale,
    phoneMap?: Map<string, LegacyProduct>,
    brandMap?: Map<string, LegacyBrand>,
  ) => {
    const { legacySale, newCustomerId, pdfUrl } = toImport;
    const ls = legacySale as any;
    const saleDate  = ls.date || ls.sale_date || '';
    const saleTotal = ls.total ?? ls.total_amount ?? 0;
    const totalCents = Math.round(saleTotal * 100);

    const sale = await vpsClient.post<any>('/table-data/sales', {
      id: crypto.randomUUID(),
      customer_id:     newCustomerId,
      subtotal:        totalCents,
      discount_total:  Math.round((ls.discount_amount || 0) * 100),
      total:           totalCents,
      cost_total:      0,
      profit:          0,
      payment_methods: mapPaymentMethod(ls.payment_method || '', totalCents),
      status:          'completed',
      notes:           `[Migrado do MV-Gestao em ${new Date().toLocaleDateString('pt-BR')}]`,
      legacy_sale_id:  ls.id,
      legacy_pdf_url:  pdfUrl,
      created_at:      saleDate,
    });

    const items: any[] = ls.items || [];
    if (items.length > 0) {
      const saleItems = items.map((item: any) => {
        const phone = phoneMap?.get(item.itemId || item.phone_id || '');
        const brand = phone && brandMap ? brandMap.get(phone.brand_id) : undefined;
        const specs = phone ? {
          imei1:   phone.imei1   || undefined,
          imei2:   phone.imei2   || undefined,
          serial:  phone.serial  || undefined,
          color:   phone.color   || undefined,
          ram:     phone.ram     || undefined,
          storage: phone.storage || undefined,
        } : undefined;
        // Monta nome rico incluindo marca/modelo se disponível
        const displayName = phone
          ? `${brand?.name ? brand.name + ' ' : ''}${phone.model}${phone.version ? ' ' + phone.version : ''}${phone.color ? ' - ' + phone.color : ''}`
          : (item.description || `Produto (ref: ${item.itemId})`);

        // product_sku = IMEI 1 (para exibir no histórico mesmo sem produto vinculado)
        const imeiLine = [phone?.imei1, phone?.imei2].filter(Boolean).join(' / ');

        return {
          id:           crypto.randomUUID(),
          sale_id:      sale.id,
          product_id:   null,
          product_name: displayName,
          product_sku:  imeiLine || null,
          quantity:     item.quantity || 1,
          unit_price:   Math.round((item.price || 0) * 100),
          unit_cost:    Math.round((item.cost  || 0) * 100),
          discount:     0,
          subtotal:     Math.round((item.price || 0) * (item.quantity || 1) * 100),
          total:        Math.round((item.price || 0) * (item.quantity || 1) * 100),
          is_gift:      item.type === 'GIFT',
        };
      });
      await vpsClient.post('/table-data/sale_items/bulk', saleItems);
    }
    return sale;
  };

  // ── Fase 2a: Importar todas as vendas em lote ────────────────────────────────

  const [importingAll, setImportingAll] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);

  const runImportAll = async () => {
    if (!result) return;
    const pending = result.matched.filter(m => !m.alreadyImported);
    if (pending.length === 0) { toast.error('Todas as vendas já foram importadas.'); return; }

    setImportingAll(true);
    setImportProgress({ current: 0, total: pending.length });

    // Pré-carrega phones e brands para popular product_specs
    toast.loading('Carregando dados dos aparelhos...', { id: 'import-all' });
    const [allPhones, allBrands] = await Promise.all([
      legacyAPI.getProducts().catch(() => [] as LegacyProduct[]),
      legacyAPI.getBrands().catch(() => [] as LegacyBrand[]),
    ]);
    toast.dismiss('import-all');
    const pMap = new Map<string, LegacyProduct>(allPhones.map(p => [p.id, p]));
    const bMap = new Map<string, LegacyBrand>(allBrands.map(b => [b.id, b]));

    let ok = 0;
    const errors: string[] = [];

    for (let i = 0; i < pending.length; i++) {
      setImportProgress({ current: i + 1, total: pending.length });
      try {
        await importOneSale(pending[i], pMap, bMap);
        ok++;
        setResult(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            matched: prev.matched.map(m =>
              m.legacySale.id === pending[i].legacySale.id ? { ...m, alreadyImported: true } : m
            ),
            alreadyImportedIds: new Set([...Array.from(prev.alreadyImportedIds), pending[i].legacySale.id]),
          };
        });
      } catch (err: any) {
        errors.push(`${pending[i].newCustomerName}: ${err.message}`);
      }
    }

    setImportingAll(false);
    setImportProgress(null);
    if (errors.length === 0) {
      toast.success(`${ok} vendas importadas com sucesso!`);
    } else {
      toast.warning(`${ok} importadas, ${errors.length} com erro.`);
    }
  };

  // ── Fase 2b: Teste com 1 venda ───────────────────────────────────────────────

  const runTest = async () => {
    if (!result) return;
    const toImport = result.matched.find(m => !m.alreadyImported);
    if (!toImport) { toast.error('Nenhuma venda nova disponível para teste'); return; }

    setPhase('testing');
    const log: string[] = [];
    const add = (msg: string) => { log.push(msg); setTestLog([...log]); };

    try {
      const { legacySale, newCustomerName, pdfUrl } = toImport;
      const ls = legacySale as any;
      add(`Cliente: ${newCustomerName} (CPF: ${fmtCpf(toImport.cpf)})`);
      add(`Venda legado ID: ${ls.id}`);
      add(`Data: ${fmtDate(String(ls.date || ls.sale_date || ''))}`);
      add(`Total: R$ ${(ls.total ?? ls.total_amount ?? 0).toFixed(2)}`);
      add(`PDF: ${pdfUrl || 'Sem PDF vinculado'}`);
      add('');
      add('Carregando dados dos aparelhos...');
      const [testPhones, testBrands] = await Promise.all([
        legacyAPI.getProducts().catch(() => [] as LegacyProduct[]),
        legacyAPI.getBrands().catch(() => [] as LegacyBrand[]),
      ]);
      const tpMap = new Map<string, LegacyProduct>(testPhones.map(p => [p.id, p]));
      const tbMap = new Map<string, LegacyBrand>(testBrands.map(b => [b.id, b]));

      add('Inserindo venda na tabela sales...');
      const sale = await importOneSale(toImport, tpMap, tbMap);
      add(`✓ Venda criada — ID: ${sale.id}`);
      const items: any[] = ls.items || [];
      add(items.length > 0 ? `✓ ${items.length} item(ns) inseridos com specs` : 'Sem itens detalhados.');

      add('');
      add('✓ TESTE CONCLUÍDO COM SUCESSO!');
      if (pdfUrl) add(`✓ PDF vinculado: ${pdfUrl}`);
      add(`→ Venda visível no perfil de ${newCustomerName}`);
      add(`→ Use "Gerar PDFs em Lote" para criar os comprovantes com dados do aparelho`);

      setResult(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          matched: prev.matched.map(m =>
            m.legacySale.id === legacySale.id ? { ...m, alreadyImported: true } : m
          ),
          alreadyImportedIds: new Set([...Array.from(prev.alreadyImportedIds), legacySale.id]),
        };
      });

      toast.success('Venda de teste importada com sucesso!');
      setPhase('done');
    } catch (err: any) {
      add(`❌ ERRO: ${err.message}`);
      toast.error(err.message);
      setPhase('diagnostic');
    }
  };

  // ── Fase 3: Gerar PDFs em lote ────────────────────────────────────────────────

  const generatePdfs = async () => {
    if (!result) return;

    // Apenas vendas já importadas (que têm legacy_sale_id no banco)
    const targets = result.matched.filter(m => m.alreadyImported);
    if (targets.length === 0) {
      toast.error('Nenhuma venda importada para gerar PDFs. Importe as vendas primeiro.');
      return;
    }

    setPhase('generating');
    const errors: string[] = [];

    try {
      // 1. Carregar dados em bulk do legado para evitar N+1 requests
      toast.loading('Carregando produtos do MV-Gestao...', { id: 'pdf-gen' });
      const [allPhones, allBrands, settings] = await Promise.all([
        legacyAPI.getProducts(),
        legacyAPI.getBrands(),
        companySettingsService.get(),
      ]);

      const phoneMap = new Map<string, LegacyProduct>(allPhones.map(p => [p.id, p]));
      const brandMap = new Map<string, LegacyBrand>(allBrands.map(b => [b.id, b]));
      toast.dismiss('pdf-gen');

      const company = {
        name:    settings?.company_name || 'Mercado do Vale',
        address: settings?.address      || '',
        phone:   settings?.phone        || '',
        cnpj:    settings?.cnpj         || '',
      };

      // 2. Processar cada venda
      for (let i = 0; i < targets.length; i++) {
        const { legacySale, cpf, newCustomerName, pdfSeq } = targets[i];
        const pdfName = `${cpf}_${String(pdfSeq).padStart(3, '0')}.pdf`;

        setPdfProgress({
          current: i + 1,
          total:   targets.length,
          currentName: `${newCustomerName} — ${pdfName}`,
          errors,
        });

        try {
          const ls2 = legacySale as any;
          const saleDate2 = ls2.date || ls2.sale_date || '';

          // Montar itens com dados completos do produto
          const rawItems: any[] = ls2.items || [];
          const receiptItems: LegacyReceiptItem[] = rawItems.map((item: any) => {
            // itemId é o ID do telefone no sistema legado
            const phoneId = item.itemId || item.phone_id || '';
            const phone = phoneMap.get(phoneId);
            const brand = phone ? brandMap.get(phone.brand_id) : undefined;
            return {
              phone: phone || {
                id: phoneId, device_type: '', imei1: '', brand_id: '',
                model: item.description || `Produto ${phoneId.slice(0, 8)}`, version: '',
                ram: '', storage: '', color: '', buy_price: 0,
                sell_price_suggested: item.price || 0,
                status: '', quantity: item.quantity || 1, condition: 'USED' as const,
                entry_date: saleDate2, updated_at: saleDate2,
              },
              brand,
              quantity:   item.quantity || 1,
              unit_price: item.price    || 0,
              subtotal:   (item.price || 0) * (item.quantity || 1),
            };
          });

          // Adapta o objeto de venda para o gerador de PDF
          const saleForPdf = { ...ls2, sale_date: saleDate2, total_amount: ls2.total ?? 0 };

          // Gerar PDF
          const pdfBlob = await generateLegacySalePdf({
            sale:         saleForPdf,
            customerName: newCustomerName,
            customerCpf:  cpf,
            items:        receiptItems,
            company,
          });

          // Upload para Synology
          const file = new File([pdfBlob], pdfName, { type: 'application/pdf' });
          const fd   = new FormData();
          fd.append('file', file);
          await vpsClient.upload(`/synology/upload?folder=arquivos`, fd);

          const pdfUrl = `${ARQUIVOS_CDN}/${pdfName}`;

          await updateLegacySalePdfUrl(legacySale.id, pdfUrl);

          // Atualizar estado local
          setResult(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              matched: prev.matched.map(m =>
                m.legacySale.id === legacySale.id ? { ...m, pdfUrl } : m
              ),
            };
          });
        } catch (err: any) {
          errors.push(`${pdfName}: ${err.message}`);
          setPdfProgress(p => p ? { ...p, errors: [...errors] } : p);
        }

        // Pequena pausa para não sobrecarregar o Synology
        await new Promise(r => setTimeout(r, 300));
      }

      toast.success(`${targets.length - errors.length} PDFs gerados e enviados ao Synology!`);
      setPhase('done');
    } catch (err: any) {
      toast.error(err.message);
      setPhase('diagnostic');
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  const readyToImport = result?.matched.filter(m => !m.alreadyImported)  ?? [];
  const withPdf       = result?.matched.filter(m => m.pdfUrl !== null)   ?? [];
  const alreadyDone   = result?.matched.filter(m => m.alreadyImported)   ?? [];

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-2">

      {/* ─── Header ──────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 bg-violet-50 rounded-2xl flex items-center justify-center shrink-0">
            <ShoppingBag className="w-6 h-6 text-violet-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Importar Histórico de Vendas (MV-Gestao)</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Importa vendas do sistema antigo e gera PDFs com IMEI, modelo, marca e demais dados únicos do aparelho.
            </p>
          </div>
        </div>
        <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-700">
          <p className="font-semibold text-slate-800 mb-1">Convenção de nomes de PDF no Synology:</p>
          <code className="text-violet-700 font-mono">{'{cpf_11_digitos}_{sequencia_3_digitos}.pdf'}</code>
          <span className="text-slate-400 ml-2">
            ex: <code className="text-slate-600">12345678901_001.pdf</code>, <code className="text-slate-600">12345678901_002.pdf</code>
          </span>
          <p className="text-slate-500 mt-1 text-xs">A venda mais antiga do cliente = 001, ordenadas por data crescente.</p>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={clearAllImported}
            disabled={clearing}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors disabled:opacity-50"
          >
            {clearing ? <Loader2 size={13} className="animate-spin" /> : <AlertTriangle size={13} />}
            {clearing ? 'Apagando...' : 'Limpar todas as importações'}
          </button>
        </div>
      </div>

      {/* ─── Idle ────────────────────────────────────────────────────────────── */}
      {phase === 'idle' && (
        <div className="flex justify-center">
          <button onClick={analyze}
            className="flex items-center gap-2 px-8 py-4 bg-violet-600 text-white font-semibold rounded-xl shadow-md hover:bg-violet-700 hover:-translate-y-0.5 transition-all">
            <Search className="w-5 h-5" /> Analisar Dados
          </button>
        </div>
      )}

      {/* ─── Loading ─────────────────────────────────────────────────────────── */}
      {phase === 'loading' && (
        <div className="flex flex-col items-center gap-3 py-12 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
          <p className="text-sm">Analisando dados... aguarde</p>
        </div>
      )}

      {/* ─── Diagnóstico ─────────────────────────────────────────────────────── */}
      {(phase === 'diagnostic' || phase === 'testing' || phase === 'done' || phase === 'generating') && result && (
        <div className="space-y-4">

          {/* Cards resumo */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryCard icon={<ShoppingBag className="w-5 h-5 text-slate-500" />}
              label="Total no Legado" value={result.totalLegacySales} color="slate" />
            <SummaryCard icon={<FileText className="w-5 h-5 text-violet-500" />}
              label="Já com PDF" value={alreadyDone.filter(m => m.pdfUrl !== null).length} color="violet" />
            <SummaryCard icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
              label="Prontas p/ Importar" value={readyToImport.length} color="emerald" />
            <SummaryCard icon={<AlertTriangle className="w-5 h-5 text-amber-500" />}
              label="Sem Cliente Cadastrado" value={result.pending.length} color="amber" />
          </div>

          {/* Lista de vendas prontas */}
          {readyToImport.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Prontas para importar ({readyToImport.length})
                  {withPdf.filter(m => !m.alreadyImported).length > 0 && (
                    <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">
                      {withPdf.filter(m => !m.alreadyImported).length} com PDF
                    </span>
                  )}
                </h3>
              </div>
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {readyToImport.slice(0, 30).map((m, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{m.newCustomerName}</p>
                      <p className="text-xs text-slate-400">{fmtCpf(m.cpf)} · {fmtDate(String((m.legacySale as any).date || m.legacySale.sale_date || ''))}</p>
                    </div>
                    <div className="text-sm font-semibold text-slate-700 shrink-0">
                      {fmtBRL(Math.round(((m.legacySale as any).total ?? m.legacySale.total_amount ?? 0) * 100))}
                    </div>
                    {m.pdfUrl
                      ? <a href={m.pdfUrl} target="_blank" rel="noopener noreferrer"
                          className="shrink-0 flex items-center gap-1 text-xs text-violet-600 bg-violet-50 px-2 py-1 rounded-lg border border-violet-200"
                          onClick={e => e.stopPropagation()}>
                          <FileText className="w-3 h-3" /> PDF
                        </a>
                      : <span className="shrink-0 text-xs text-slate-300 px-2 py-1">sem PDF</span>
                    }
                  </div>
                ))}
                {readyToImport.length > 30 && (
                  <div className="px-5 py-3 text-xs text-slate-400 text-center">
                    ... e mais {readyToImport.length - 30} vendas
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Já importadas */}
          {alreadyDone.length > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <p className="text-sm text-emerald-800">
                <span className="font-semibold">{alreadyDone.length} vendas</span> já importadas.
                {alreadyDone.filter(m => !m.pdfUrl).length > 0 && (
                  <span className="ml-1 text-emerald-700">
                    {alreadyDone.filter(m => !m.pdfUrl).length} ainda sem PDF — use "Gerar PDFs em Lote".
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Clientes sem cadastro */}
          {result.pending.length > 0 && (
            <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-amber-100">
                <h3 className="font-semibold text-amber-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Clientes não cadastrados ({result.pending.length} CPFs · {result.pending.reduce((s, p) => s + p.count, 0)} vendas)
                </h3>
                <p className="text-xs text-amber-600 mt-1">
                  Serão vinculados automaticamente quando o cliente se cadastrar.
                </p>
              </div>
              <div className="divide-y divide-amber-50 max-h-48 overflow-y-auto">
                {result.pending.map((p, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-2.5">
                    <Users className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="text-sm text-slate-700 font-mono">{fmtCpf(p.cpf)}</span>
                    <span className="text-xs text-slate-400">{p.count} venda(s)</span>
                    {p.hasPdfs > 0 && (
                      <span className="text-xs text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded">
                        {p.hasPdfs} PDF(s)
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Botões de ação */}
          {phase === 'diagnostic' && (
            <div className="flex flex-wrap gap-3 justify-center pt-2">
              {readyToImport.length > 0 && (
                <>
                  <button onClick={runImportAll} disabled={importingAll}
                    className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white font-semibold rounded-xl shadow-md hover:bg-emerald-700 transition-all disabled:opacity-60">
                    {importingAll
                      ? <><Loader2 className="w-5 h-5 animate-spin" /> Importando {importProgress?.current}/{importProgress?.total}...</>
                      : <><ChevronRight className="w-5 h-5" /> Importar Todas ({readyToImport.length} vendas)</>
                    }
                  </button>
                  <button onClick={runTest} disabled={importingAll}
                    className="flex items-center gap-2 px-5 py-3 bg-white border border-emerald-300 text-emerald-700 font-medium rounded-xl hover:bg-emerald-50 transition-colors text-sm disabled:opacity-60">
                    <ChevronRight className="w-4 h-4" /> Testar (1 venda)
                  </button>
                </>
              )}
              {alreadyDone.length > 0 && (
                <button onClick={generatePdfs}
                  className="flex items-center gap-2 px-6 py-3 bg-violet-600 text-white font-semibold rounded-xl shadow-md hover:bg-violet-700 transition-all">
                  <FilePlus2 className="w-5 h-5" /> Gerar PDFs em Lote ({alreadyDone.length})
                </button>
              )}
              <button onClick={analyze}
                className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 px-4 py-3">
                <RefreshCw className="w-3.5 h-3.5" /> Reanalisar
              </button>
            </div>
          )}

          {phase === 'done' && (
            <div className="flex flex-wrap gap-3 justify-center pt-2">
              {readyToImport.length > 0 && (
                <button onClick={runImportAll} disabled={importingAll}
                  className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white font-semibold rounded-xl shadow-md hover:bg-emerald-700 transition-all disabled:opacity-60">
                  {importingAll
                    ? <><Loader2 className="w-5 h-5 animate-spin" /> Importando {importProgress?.current}/{importProgress?.total}...</>
                    : <><ChevronRight className="w-5 h-5" /> Importar Restantes ({readyToImport.length})</>
                  }
                </button>
              )}
              {alreadyDone.length > 0 && (
                <button onClick={generatePdfs}
                  className="flex items-center gap-2 px-6 py-3 bg-violet-600 text-white font-semibold rounded-xl shadow-md hover:bg-violet-700 transition-all">
                  <FilePlus2 className="w-5 h-5" /> Gerar PDFs em Lote ({alreadyDone.length})
                </button>
              )}
              <button onClick={analyze}
                className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors text-sm">
                <RefreshCw className="w-4 h-4" /> Reanalisar
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── Log do Teste ────────────────────────────────────────────────────── */}
      {(phase === 'testing' || phase === 'done') && testLog.length > 0 && (
        <div className="bg-slate-900 rounded-2xl p-5 font-mono text-sm">
          <p className="text-slate-400 mb-3 text-xs uppercase tracking-widest">Log do Teste</p>
          <div className="space-y-1">
            {testLog.map((line, i) => (
              <p key={i} className={
                line.startsWith('✓') ? 'text-emerald-400' :
                line.startsWith('❌') ? 'text-red-400' :
                line.startsWith('⚠️') ? 'text-amber-400' :
                line.startsWith('→') ? 'text-violet-400' :
                'text-slate-300'
              }>
                {line || '\u00A0'}
              </p>
            ))}
            {phase === 'testing' && (
              <p className="text-slate-400 flex items-center gap-2 mt-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Processando...
              </p>
            )}
          </div>
        </div>
      )}

      {/* ─── Progresso da geração de PDFs ────────────────────────────────────── */}
      {phase === 'generating' && pdfProgress && (
        <div className="bg-white rounded-2xl border border-violet-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <Loader2 className="w-5 h-5 animate-spin text-violet-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-800">
                Gerando PDF {pdfProgress.current} de {pdfProgress.total}
              </p>
              <p className="text-xs text-slate-500 truncate mt-0.5">{pdfProgress.currentName}</p>
            </div>
            <span className="text-sm font-bold text-violet-700">
              {Math.round((pdfProgress.current / pdfProgress.total) * 100)}%
            </span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-violet-500 to-purple-600 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${(pdfProgress.current / pdfProgress.total) * 100}%` }}
            />
          </div>
          {pdfProgress.errors.length > 0 && (
            <div className="mt-4 space-y-1">
              <p className="text-xs font-semibold text-red-600">{pdfProgress.errors.length} erro(s):</p>
              {pdfProgress.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-500 font-mono bg-red-50 px-2 py-1 rounded">{e}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── SummaryCard ──────────────────────────────────────────────────────────────

function SummaryCard({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: number;
  color: 'slate' | 'violet' | 'emerald' | 'amber';
}) {
  const bg     = { slate: 'bg-slate-50',   violet: 'bg-violet-50',   emerald: 'bg-emerald-50',   amber: 'bg-amber-50'   }[color];
  const border = { slate: 'border-slate-200', violet: 'border-violet-200', emerald: 'border-emerald-200', amber: 'border-amber-200' }[color];
  const txt    = { slate: 'text-slate-800', violet: 'text-violet-800', emerald: 'text-emerald-800', amber: 'text-amber-800' }[color];
  return (
    <div className={`${bg} border ${border} rounded-xl p-4`}>
      <div className="mb-1">{icon}</div>
      <p className={`text-2xl font-bold ${txt}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}
