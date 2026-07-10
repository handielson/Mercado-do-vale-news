import React from 'react';
import { Ban, Copy, ExternalLink, MessageCircle, Printer, QrCode, RefreshCw, Send, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { standalonePixService } from '../../../services/standalonePixService';
import { pdvDisplayService, buildPdvPixPrintData } from '../../../services/pdvDisplayService';
import { moneyInputToCents } from '../../../utils/moneyInput';
import { printPixQr } from '../../../utils/printPixQr';
import { printStandalonePixReceipt } from '../../../utils/printStandalonePixReceipt';
import type { PdvDisplay } from '../../../types/pdvDisplay';
import type { GoogleContactOption, StandalonePixPayment } from '../../../types/standalonePix';
import { formatStandalonePixStatus, isStandalonePixPayable } from '../../../types/standalonePix';
import { useCashSession } from '../../../hooks/useCashSession';

function formatCurrency(cents: number): string {
  return (Number(cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDateTime(value?: string | null): string {
  return value ? new Date(value).toLocaleString('pt-BR') : '-';
}

function normalizeBrazilLocalPhone(value: string): string {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.startsWith('55') ? digits.slice(2) : digits;
}

function buildBrazilWhatsAppPhone(value: string): string {
  const local = normalizeBrazilLocalPhone(value);
  return local ? `55${local}` : '';
}

const STANDALONE_PIX_STATUS_POLLING_MS = 3000;

export default function StandalonePixPage() {
  const { session: cashSession } = useCashSession();
  const [amount, setAmount] = React.useState('');
  const [description, setDescription] = React.useState('Pix avulso Mercado do Vale');
  const [cashierKey, setCashierKey] = React.useState(() => localStorage.getItem('standalone_pix_cashier_key') || 'caixa-01');
  const [displayId, setDisplayId] = React.useState(() => localStorage.getItem('standalone_pix_display_id') || '');
  const [phone, setPhone] = React.useState('');
  const [contactSearch, setContactSearch] = React.useState('');
  const [contactResults, setContactResults] = React.useState<GoogleContactOption[]>([]);
  const [contactLoading, setContactLoading] = React.useState(false);
  const [currentPix, setCurrentPix] = React.useState<StandalonePixPayment | null>(null);
  const [payments, setPayments] = React.useState<StandalonePixPayment[]>([]);
  const [displays, setDisplays] = React.useState<PdvDisplay[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const approvedToastRef = React.useRef('');

  const displayOptions = React.useMemo(
    () => displays.filter((display) => display.is_active && (display.type === 'cashier' || display.type === 'hybrid')),
    [displays]
  );

  const loadData = React.useCallback(async () => {
    const [pixRows, displayRows] = await Promise.all([
      standalonePixService.list({ limit: 80, search }),
      pdvDisplayService.listDisplays(),
    ]);
    setPayments(pixRows);
    setDisplays(displayRows);
  }, [search]);

  React.useEffect(() => {
    loadData().catch((error) => {
      console.error('Erro ao carregar Pix avulso:', error);
      toast.error('Erro ao carregar Pix avulso');
    });
  }, [loadData]);

  React.useEffect(() => {
    const currentDisplayId = displayId.trim();
    const currentStillAvailable = displayOptions.some((display) => display.id === currentDisplayId);
    if (currentDisplayId && currentStillAvailable) return;

    const nextDisplayId = displayOptions[0]?.id || '';
    if (!nextDisplayId) return;
    setDisplayId(nextDisplayId);
    localStorage.setItem('standalone_pix_display_id', nextDisplayId);
  }, [displayId, displayOptions]);

  React.useEffect(() => {
    if (!currentPix || !isStandalonePixPayable(currentPix)) return;
    let cancelled = false;

    async function pollCurrentPixStatus() {
      try {
        const updated = await standalonePixService.refreshStatus(currentPix.id);
        if (cancelled) return;
        setCurrentPix(updated);
        setPayments((items) => items.map((item) => item.id === updated.id ? updated : item));
        if (updated.status === 'approved' && approvedToastRef.current !== updated.id) {
          approvedToastRef.current = updated.id;
          toast.success('Pagamento aprovado');
          void loadData();
        }
      } catch (error) {
        console.error('Erro ao monitorar Pix avulso:', error);
      }
    }

    const interval = window.setInterval(pollCurrentPixStatus, STANDALONE_PIX_STATUS_POLLING_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [currentPix?.id, currentPix?.status, loadData]);

  React.useEffect(() => {
    const query = contactSearch.trim();
    if (query.length < 2) {
      setContactResults([]);
      return;
    }
    const timeout = window.setTimeout(() => {
      setContactLoading(true);
      standalonePixService.searchGoogleContacts(query)
        .then(setContactResults)
        .catch((error) => {
          console.error('Erro ao buscar agenda Google:', error);
          setContactResults([]);
        })
        .finally(() => setContactLoading(false));
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [contactSearch]);

  async function copyText(text?: string | null, label = 'Texto') {
    if (!text) {
      toast.error(`${label} indisponivel`);
      return;
    }
    const absoluteText = text.startsWith('/pix/') ? `${window.location.origin}${text}` : text;
    await navigator.clipboard.writeText(absoluteText);
    toast.success(`${label} copiado`);
  }

  async function handleCreate() {
    const cents = moneyInputToCents(amount);
    if (cents <= 0) {
      toast.error('Informe um valor para gerar o Pix');
      return;
    }
    const targetDisplayId = displayId.trim() || displayOptions[0]?.id || '';
    setLoading(true);
    try {
      localStorage.setItem('standalone_pix_cashier_key', cashierKey.trim() || 'caixa-01');
      localStorage.setItem('standalone_pix_display_id', targetDisplayId);
      if (targetDisplayId && targetDisplayId !== displayId.trim()) setDisplayId(targetDisplayId);
      const pix = await standalonePixService.create({
        amount: cents,
        description: description.trim() || 'Pix avulso Mercado do Vale',
        cashier_key: cashierKey.trim() || 'caixa-01',
        display_id: targetDisplayId || null,
        cash_session_id: cashSession?.id || null,
      });
      setCurrentPix(pix);
      await loadData();
      toast.success('Pix Avulso gerado');
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao gerar Pix Avulso');
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh(pix = currentPix) {
    if (!pix) return;
    setLoading(true);
    try {
      const updated = await standalonePixService.refreshStatus(pix.id);
      setCurrentPix(updated);
      await loadData();
      toast.success('Status atualizado');
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao atualizar Pix');
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel(pix = currentPix) {
    if (!pix) {
      toast.error('Selecione um Pix para cancelar');
      return;
    }
    if (!isStandalonePixPayable(pix)) {
      toast.error('Somente Pix pendente pode ser cancelado');
      return;
    }
    if (!window.confirm('Cancelar este Pix avulso? Ele sera removido do display e nao podera ser pago por aqui.')) {
      return;
    }
    setLoading(true);
    try {
      const cancelled = await standalonePixService.cancel(pix.id);
      setCurrentPix(cancelled);
      await loadData();
      toast.success('Pix avulso cancelado');
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao cancelar Pix');
    } finally {
      setLoading(false);
    }
  }

  async function handleDisplay(pix = currentPix) {
    if (!pix || !displayId) {
      toast.error('Selecione um Pix e um display');
      return;
    }
    if (!isStandalonePixPayable(pix)) {
      toast.error('Pix aprovado ou cancelado nao pode ir para o display');
      return;
    }
    await pdvDisplayService.setActivePix(displayId, pix.id);
    toast.success('Pix exibido no display');
  }

  async function handleShare(pix = currentPix) {
    if (!pix) {
      toast.error('Gere ou selecione um Pix primeiro');
      return;
    }
    const whatsappPhone = buildBrazilWhatsAppPhone(phone);
    if (!whatsappPhone) {
      toast.error('Informe o WhatsApp do cliente');
      return;
    }
    const result = await standalonePixService.shareWhatsApp(pix.id, whatsappPhone);
    setCurrentPix(result);
    window.open(result.whatsapp_url, '_blank');
    await loadData();
  }

  function handleSelectGoogleContact(contact: GoogleContactOption) {
    setPhone(normalizeBrazilLocalPhone(contact.phone_local || contact.phone_digits || contact.phone));
    setContactSearch(contact.name);
    setContactResults([]);
    toast.success(`Contato selecionado: ${contact.name}`);
  }

  function handlePrint(pix = currentPix) {
    if (!pix) return;
    printPixQr(buildPdvPixPrintData({
      payment: pix as any,
      storeName: 'Mercado do Vale',
      instructions: 'Este Pix avulso vence em 10 minutos.',
    }));
  }

  function handlePrintReceipt(pix = currentPix) {
    if (!pix) return;
    if (pix.status !== 'approved') {
      toast.error('Comprovante disponivel somente apos aprovacao do Pix');
      return;
    }
    printStandalonePixReceipt(pix);
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Pix Avulso</h1>
        <p className="text-sm text-slate-500">Gere cobrancas Mercado Pago fora do PDV, com extrato e display.</p>
      </div>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[420px_1fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800">
            <QrCode size={18} /> Gerar Pix
          </div>
          <div className="space-y-3">
            <input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Valor em reais" className="w-full rounded border border-slate-200 px-3 py-2 text-sm" />
            <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Texto que aparece no comprovante" className="w-full rounded border border-slate-200 px-3 py-2 text-sm" />
            <input value={cashierKey} onChange={(event) => setCashierKey(event.target.value)} placeholder="caixa-01" className="w-full rounded border border-slate-200 px-3 py-2 text-sm" />
            <select value={displayId} onChange={(event) => setDisplayId(event.target.value)} className="w-full rounded border border-slate-200 px-3 py-2 text-sm">
              <option value="">Sem display</option>
              {displayOptions.map((display) => <option key={display.id} value={display.id}>{display.name}</option>)}
            </select>
            <div className="space-y-2">
              <input value={contactSearch} onChange={(event) => setContactSearch(event.target.value)} placeholder="Buscar cliente na agenda Google" className="w-full rounded border border-slate-200 px-3 py-2 text-sm" />
              {contactLoading && <div className="text-xs text-slate-500">Buscando agenda...</div>}
              {contactResults.length > 0 && (
                <div className="max-h-36 overflow-y-auto rounded border border-slate-200 bg-white text-sm shadow-sm">
                  {contactResults.map((contact) => (
                    <button
                      key={`${contact.resource_name || contact.phone_digits}`}
                      type="button"
                      onClick={() => handleSelectGoogleContact(contact)}
                      className="block w-full border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-cyan-50"
                    >
                      <span className="block font-semibold text-slate-800">{contact.name}</span>
                      <span className="block text-xs text-slate-500">+{contact.phone_digits}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="flex rounded border border-slate-200 bg-white text-sm focus-within:ring-1 focus-within:ring-cyan-500">
                <span className="inline-flex items-center border-r border-slate-200 bg-slate-50 px-3 font-semibold text-slate-600">+55</span>
                <input value={phone} onChange={(event) => setPhone(normalizeBrazilLocalPhone(event.target.value))} placeholder="87988032612" className="min-w-0 flex-1 px-3 py-2 outline-none" />
              </div>
            </div>
            <button onClick={handleCreate} disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded bg-cyan-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
              <QrCode size={16} /> {loading ? 'Gerando...' : 'Gerar Pix'}
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          {currentPix ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_1fr]">
              <div className="rounded border border-slate-200 bg-slate-50 p-3">
                {currentPix.qr_code_base64 && isStandalonePixPayable(currentPix) ? (
                  <img src={`data:image/png;base64,${currentPix.qr_code_base64}`} alt="QR Code Pix" className="h-48 w-48 object-contain" />
                ) : (
                  <div className="flex h-48 w-48 items-center justify-center text-center text-sm text-slate-500">{formatStandalonePixStatus(currentPix)}</div>
                )}
              </div>
              <div className="space-y-3">
                <div>
                  <div className="text-2xl font-black text-slate-900">{formatCurrency(currentPix.amount)}</div>
                  <div className="text-sm font-semibold text-cyan-700">{formatStandalonePixStatus(currentPix)}</div>
                  <div className="text-xs text-slate-500">Expira em: {formatDateTime(currentPix.expires_at)}</div>
                </div>
                <p className="break-all rounded bg-slate-50 p-2 font-mono text-xs text-slate-600">{currentPix.qr_code || 'Pix copia e cola indisponivel'}</p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => copyText(currentPix.qr_code, 'Copiar codigo Pix')} className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-semibold"><Copy size={14} />Copiar codigo Pix</button>
                  <button onClick={() => copyText(currentPix.public_path, 'Copiar link publico')} className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-semibold"><ExternalLink size={14} />Copiar link publico</button>
                  <button onClick={() => handleShare()} className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-semibold"><MessageCircle size={14} />Compartilhar no WhatsApp</button>
                  <button onClick={() => handleDisplay()} className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-semibold"><Smartphone size={14} />Exibir no display</button>
                  <button onClick={() => handleRefresh()} className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-semibold"><RefreshCw size={14} />Atualizar</button>
                  <button onClick={() => handlePrint()} className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-semibold"><Printer size={14} />Imprimir QR</button>
                  {currentPix.status === 'approved' && (
                    <button onClick={() => handlePrintReceipt()} className="inline-flex items-center gap-1 rounded border border-emerald-200 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"><Printer size={14} />Imprimir comprovante</button>
                  )}
                  {isStandalonePixPayable(currentPix) && (
                    <button onClick={() => handleCancel()} className="inline-flex items-center gap-1 rounded border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"><Ban size={14} />Cancelar Pix</button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-64 items-center justify-center text-sm text-slate-500">Gere um Pix Avulso para ver o QR Code.</div>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Extrato</h2>
            <p className="text-xs text-slate-500">Pix vencido aparece como Cancelado por falta de pagamento.</p>
          </div>
          <div className="flex gap-2">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar no extrato" className="rounded border border-slate-200 px-3 py-2 text-sm" />
            <button onClick={() => loadData()} className="inline-flex items-center gap-1 rounded border px-3 py-2 text-sm font-semibold"><RefreshCw size={14} />Filtrar</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Criado</th>
                <th className="px-3 py-2">Valor</th>
                <th className="px-3 py-2">Descricao</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Caixa</th>
                <th className="px-3 py-2">WhatsApp</th>
                <th className="px-3 py-2">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((pix) => (
                <tr key={pix.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{formatDateTime(pix.created_at)}</td>
                  <td className="px-3 py-2 font-bold">{formatCurrency(pix.amount)}</td>
                  <td className="px-3 py-2">{pix.description}</td>
                  <td className="px-3 py-2">{formatStandalonePixStatus(pix)}</td>
                  <td className="px-3 py-2">{pix.cashier_key || '-'}</td>
                  <td className="px-3 py-2">{pix.shared_phone || '-'}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button title="Abrir" onClick={() => setCurrentPix(pix)} className="rounded border p-1"><ExternalLink size={14} /></button>
                      <button title="Atualizar" onClick={() => handleRefresh(pix)} className="rounded border p-1"><RefreshCw size={14} /></button>
                      <button title="Copiar codigo" onClick={() => copyText(pix.qr_code, 'Copiar codigo Pix')} className="rounded border p-1"><Copy size={14} /></button>
                      <button title="Imprimir" onClick={() => handlePrint(pix)} className="rounded border p-1"><Printer size={14} /></button>
                      {pix.status === 'approved' && (
                        <button title="Imprimir comprovante" onClick={() => handlePrintReceipt(pix)} className="rounded border border-emerald-200 p-1 text-emerald-700"><Printer size={14} /></button>
                      )}
                      <button title="Compartilhar" onClick={() => handleShare(pix)} className="rounded border p-1"><Send size={14} /></button>
                      {isStandalonePixPayable(pix) && (
                        <button title="Cancelar Pix" onClick={() => handleCancel(pix)} className="rounded border border-red-200 p-1 text-red-700"><Ban size={14} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
