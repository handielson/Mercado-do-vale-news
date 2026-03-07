import React, { useState, useEffect, useCallback } from 'react';
import {
    DollarSign, TrendingDown, TrendingUp, RefreshCw, Plus, Check,
    X, AlertCircle, Loader2, Calendar, Filter, Pencil, Search, Printer, ReceiptText
} from 'lucide-react';
import { toast } from 'sonner';
import { blingFinanceService } from '../../../services/blingFinanceService';
import type { ContaPagar, ContaReceber, BaixaConta, CreateContaInput, FinancialSummary } from '../../../types/finance';
import { useTheme } from '../../../contexts/ThemeContext';
import { companySettingsService } from '../../../services/companySettingsService';
import { printContaReceipt } from '../../../utils/printContaReceipt';
import { printPaymentReceipt } from '../../../utils/printPaymentReceipt';

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatCurrency(v: number): string {
    if (v == null) return 'R$ 0,00';
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Bling retorna situacao como número: 1=Em aberto, 2=Pago, 3=Parcial, 4=Cancelado
function normalizeSituacao(s: any): string {
    const map: Record<string, string> = {
        '1': 'em_aberto', 'em_aberto': 'em_aberto',
        '2': 'pago', 'pago': 'pago', 'recebido': 'pago',
        '3': 'parcial', 'parcial': 'parcial',
        '4': 'cancelado', 'cancelado': 'cancelado',
    };
    return map[String(s).toLowerCase()] ?? String(s);
}

function situacaoLabel(s: any): { label: string; cls: string } {
    switch (normalizeSituacao(s)) {
        case 'em_aberto': return { label: 'Em aberto', cls: 'bg-blue-100 text-blue-700' };
        case 'pago': return { label: 'Pago', cls: 'bg-green-100 text-green-700' };
        case 'parcial': return { label: 'Parcial', cls: 'bg-amber-100 text-amber-700' };
        case 'cancelado': return { label: 'Cancelado', cls: 'bg-slate-100 text-slate-500' };
        case 'vencido': return { label: 'Vencido', cls: 'bg-red-100 text-red-700' };
        default: return { label: String(s), cls: 'bg-slate-100 text-slate-600' };
    }
}

function isVencido(vencimento: string, situacao: any): boolean {
    const norm = normalizeSituacao(situacao);
    if (norm === 'pago' || norm === 'cancelado') return false;
    return new Date(vencimento) < new Date(new Date().toDateString());
}

function calcSummary(contas: (ContaPagar | ContaReceber)[]): FinancialSummary {
    let totalEmAberto = 0, totalVencido = 0, totalPago = 0;
    for (const c of contas) {
        if (c.situacao === 'pago') totalPago += c.valor;
        else if (isVencido(c.vencimento, c.situacao)) totalVencido += c.saldo ?? c.valor;
        else if (c.situacao === 'em_aberto' || c.situacao === 'parcial') totalEmAberto += c.saldo ?? c.valor;
    }
    return { totalEmAberto, totalVencido, totalPago, count: contas.length };
}

function getDefaultRange(): { inicio: string; fim: string } {
    const now = new Date();
    const inicio = new Date(now.getFullYear(), now.getMonth(), 1);
    const fim = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
        inicio: inicio.toISOString().split('T')[0],
        fim: fim.toISOString().split('T')[0],
    };
}

// ─── Modal: Baixar Conta ────────────────────────────────────────────────────

interface BaixaModalProps {
    conta: ContaPagar | ContaReceber;
    tipo: 'pagar' | 'receber';
    onConfirm: (baixa: BaixaConta, imprimirRecibo: boolean) => Promise<void>;
    onClose: () => void;
}

function BaixaModal({ conta, tipo, onConfirm, onClose }: BaixaModalProps) {
    const today = new Date().toISOString().split('T')[0];
    const [data, setData] = useState(today);
    const [valor, setValor] = useState(String((conta.saldo ?? conta.valor).toFixed(2)));
    const [historico, setHistorico] = useState('');
    const [juros, setJuros] = useState('0');
    const [desconto, setDesconto] = useState('0');
    const [saving, setSaving] = useState(false);
    const [imprimirRecibo, setImprimirRecibo] = useState(true);

    async function handleConfirm() {
        setSaving(true);
        try {
            await onConfirm({
                data,
                valor: parseFloat(valor) || 0,
                juros: parseFloat(juros) || 0,
                desconto: parseFloat(desconto) || 0,
                historico: historico || undefined,
            }, imprimirRecibo);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                <div className="flex items-center justify-between p-5 border-b border-slate-100">
                    <h3 className="text-base font-bold text-slate-800">
                        {tipo === 'pagar' ? '💸 Baixar Pagamento' : '💰 Baixar Recebimento'}
                    </h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                        <X size={16} />
                    </button>
                </div>
                <div className="p-5 space-y-4">
                    <div className="bg-slate-50 rounded-xl p-3 text-sm">
                        <p className="font-medium text-slate-800 truncate">{conta.historico || '(sem descrição)'}</p>
                        <p className="text-slate-500 mt-0.5">
                            {conta.contato?.nome && <span className="mr-2">{conta.contato.nome}</span>}
                            Venc: <strong>{conta.vencimento.split('-').reverse().join('/')}</strong>
                            {' — '}Valor: <strong>{formatCurrency(conta.valor)}</strong>
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Data da baixa</label>
                            <input type="date" value={data} onChange={e => setData(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 bg-white" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Valor pago (R$)</label>
                            <input type="number" step="0.01" value={valor} onChange={e => setValor(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 bg-white" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Juros (R$)</label>
                            <input type="number" step="0.01" min="0" value={juros} onChange={e => setJuros(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 bg-white" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Desconto (R$)</label>
                            <input type="number" step="0.01" min="0" value={desconto} onChange={e => setDesconto(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 bg-white" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Observação</label>
                        <input type="text" value={historico} onChange={e => setHistorico(e.target.value)}
                            placeholder="Opcional"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 bg-white" />
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                        <input
                            type="checkbox"
                            id="imprimirRecibo"
                            checked={imprimirRecibo}
                            onChange={(e) => setImprimirRecibo(e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                        />
                        <label htmlFor="imprimirRecibo" className="text-sm text-slate-700 cursor-pointer">
                            Imprimir Recibo desta baixa?
                        </label>
                    </div>
                </div>
                <div className="flex justify-end gap-2 px-5 pb-5">
                    <button onClick={onClose}
                        className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                    <button onClick={handleConfirm} disabled={saving}
                        className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50">
                        {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                        Confirmar Baixa
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Modal: Lançar Conta ────────────────────────────────────────────────────

interface LancarModalProps {
    tipo: 'pagar' | 'receber';
    onConfirm: (input: CreateContaInput) => Promise<void>;
    onClose: () => void;
}

function LancarModal({ tipo, onConfirm, onClose }: LancarModalProps) {
    const today = new Date().toISOString().split('T')[0];
    const [vencimento, setVencimento] = useState(today);
    const [valor, setValor] = useState('');
    const [historico, setHistorico] = useState('');
    const [contatoNome, setContatoNome] = useState('');
    const [saving, setSaving] = useState(false);

    async function handleConfirm() {
        if (!valor || parseFloat(valor) <= 0) { toast.error('Informe um valor válido.'); return; }
        if (!vencimento) { toast.error('Informe a data de vencimento.'); return; }
        setSaving(true);
        try {
            await onConfirm({
                tipo,
                vencimento,
                valor: parseFloat(valor),
                historico: historico || undefined,
                contato: contatoNome ? { nome: contatoNome } : undefined,
            });
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                <div className="flex items-center justify-between p-5 border-b border-slate-100">
                    <h3 className="text-base font-bold text-slate-800">
                        {tipo === 'pagar' ? '➕ Nova Conta a Pagar' : '➕ Nova Conta a Receber'}
                    </h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                        <X size={16} />
                    </button>
                </div>
                <div className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Vencimento *</label>
                            <input type="date" value={vencimento} onChange={e => setVencimento(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 bg-white" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Valor (R$) *</label>
                            <input type="number" step="0.01" min="0.01" value={valor}
                                onChange={e => setValor(e.target.value)}
                                placeholder="0,00"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 bg-white" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                            {tipo === 'pagar' ? 'Fornecedor / Beneficiário' : 'Cliente / Pagante'}
                        </label>
                        <input type="text" value={contatoNome} onChange={e => setContatoNome(e.target.value)}
                            placeholder="Nome do contato (opcional)"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 bg-white" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Descrição / Histórico</label>
                        <input type="text" value={historico} onChange={e => setHistorico(e.target.value)}
                            placeholder="Ex: Aluguel março"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 bg-white" />
                    </div>
                </div>
                <div className="flex justify-end gap-2 px-5 pb-5">
                    <button onClick={onClose}
                        className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                    <button onClick={handleConfirm} disabled={saving}
                        className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
                        {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                        Lançar no Bling
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Modal: Editar Conta ───────────────────────────────────────────────────

interface EditModalProps {
    conta: ContaPagar | ContaReceber;
    tipo: 'pagar' | 'receber';
    onConfirm: (data: { historico: string; vencimento: string; valor: number; contatoNome: string }) => Promise<void>;
    onClose: () => void;
}

function EditModal({ conta, onConfirm, onClose }: EditModalProps) {
    const [historico, setHistorico] = useState(conta.historico || '');
    const [vencimento, setVencimento] = useState(conta.vencimento);
    const [valor, setValor] = useState(String(conta.valor.toFixed(2)));
    const [contatoNome, setContatoNome] = useState(conta.contato?.nome || '');
    const [saving, setSaving] = useState(false);

    async function handleSave() {
        if (!valor || parseFloat(valor) <= 0) { toast.error('Informe um valor válido.'); return; }
        setSaving(true);
        try {
            await onConfirm({ historico, vencimento, valor: parseFloat(valor), contatoNome });
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                <div className="flex items-center justify-between p-5 border-b border-slate-100">
                    <h3 className="text-base font-bold text-slate-800">✏️ Editar Conta</h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                        <X size={16} />
                    </button>
                </div>
                <div className="p-5 space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Descrição / Histórico</label>
                        <input type="text" value={historico} onChange={e => setHistorico(e.target.value)}
                            placeholder="Ex: Aluguel março"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 bg-white" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Vencimento *</label>
                            <input type="date" value={vencimento} onChange={e => setVencimento(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 bg-white" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Valor (R$) *</label>
                            <input type="number" step="0.01" min="0.01" value={valor} onChange={e => setValor(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 bg-white" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Contato / Beneficiário</label>
                        <input type="text" value={contatoNome} onChange={e => setContatoNome(e.target.value)}
                            placeholder="Nome do contato"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 bg-white" />
                    </div>
                </div>
                <div className="flex justify-end gap-2 px-5 pb-5">
                    <button onClick={onClose}
                        className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                    <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
                        {saving ? <Loader2 size={15} className="animate-spin" /> : <Pencil size={15} />}
                        Salvar no Bling
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Summary Cards ──────────────────────────────────────────────────────────

function SummaryCard({ label, value, icon, colorCls }: { label: string; value: number; icon: React.ReactNode; colorCls: string }) {
    return (
        <div className={`rounded-xl border p-4 flex items-center gap-3 ${colorCls}`}>
            <div className="flex-shrink-0">{icon}</div>
            <div>
                <p className="text-xs font-semibold opacity-70 uppercase tracking-wide">{label}</p>
                <p className="text-xl font-bold">{formatCurrency(value)}</p>
            </div>
        </div>
    );
}

// ─── Row ─────────────────────────────────────────────────────────────────────

interface RowProps {
    conta: ContaPagar | ContaReceber;
    tipo: 'pagar' | 'receber';
    onBaixar: (c: ContaPagar | ContaReceber) => void;
    onCancelar: (c: ContaPagar | ContaReceber) => void;
    onEditar: (c: ContaPagar | ContaReceber) => void;
    onPrint: (c: ContaPagar | ContaReceber) => void;
    onPrintReceipt: (c: ContaPagar | ContaReceber) => void;
}

function ContaRow({ conta, tipo, onBaixar, onCancelar, onEditar, onPrint, onPrintReceipt }: RowProps) {
    const vencido = isVencido(conta.vencimento, conta.situacao);
    const sit = situacaoLabel(vencido && normalizeSituacao(conta.situacao) === 'em_aberto' ? 'vencido' : conta.situacao);
    const vencDate = conta.vencimento.split('-').reverse().join('/');
    const normSit = normalizeSituacao(conta.situacao);
    const isPaid = normSit === 'pago';
    const isCancelled = normSit === 'cancelado';
    const canBaixar = !isPaid && !isCancelled;
    const canCancelar = !isPaid && !isCancelled;


    return (
        <tr className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${vencido ? 'bg-red-50/40' : ''}`}>
            <td className="py-3 px-4">
                <p className="text-sm font-medium text-slate-800 leading-tight">{conta.historico || '—'}</p>
                {conta.contato?.nome && (
                    <p className="text-xs text-slate-400 mt-0.5">{conta.contato.nome}</p>
                )}
            </td>
            <td className="py-3 px-4 text-sm text-slate-600 whitespace-nowrap">
                <span className={vencido ? 'text-red-600 font-semibold' : ''}>{vencDate}</span>
            </td>
            <td className="py-3 px-4 text-right">
                <p className="text-sm font-bold text-slate-800">{formatCurrency(conta.valor)}</p>
                {conta.saldo != null && conta.saldo !== conta.valor && (
                    <p className="text-xs text-slate-400">Saldo: {formatCurrency(conta.saldo)}</p>
                )}
            </td>
            <td className="py-3 px-4">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${sit.cls}`}>
                    {sit.label}
                </span>
            </td>
            <td className="py-3 px-4">
                <div className="flex items-center gap-1.5 justify-end">
                    {canBaixar && (
                        <button onClick={() => onBaixar(conta)}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${tipo === 'pagar' ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}>
                            <Check size={12} />
                            {tipo === 'pagar' ? 'Pagar' : 'Receber'}
                        </button>
                    )}
                    <button onClick={() => onEditar(conta)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors">
                        <Pencil size={12} />
                        Editar
                    </button>
                    {canCancelar && (
                        <button onClick={() => onCancelar(conta)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 transition-colors">
                            <X size={12} />
                            Cancelar
                        </button>
                    )}
                    <button onClick={() => onPrint(conta)}
                        title="Imprimir Histórico Completo"
                        className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors ml-1">
                        <Printer size={14} />
                    </button>
                    {(isPaid || normSit === 'parcial') && (
                        <button onClick={() => onPrintReceipt(conta)}
                            title="Emitir Recibo de Pagamento"
                            className="flex items-center justify-center w-7 h-7 rounded-lg text-blue-500 hover:bg-blue-100 transition-colors">
                            <ReceiptText size={14} />
                        </button>
                    )}
                    {isPaid && (
                        <span className="flex items-center gap-1 text-xs text-green-600 font-semibold ml-1">
                            <Check size={12} /> Quitado
                        </span>
                    )}
                </div>
            </td>
        </tr>
    );
}

// ─── Page ────────────────────────────────────────────────────────────────────

type Tab = 'pagar' | 'receber';

export default function FinancialPage() {
    const { settings: themeSettings } = useTheme();
    const [fullSettings, setFullSettings] = useState<any>({});

    useEffect(() => {
        companySettingsService.get().then(s => {
            if (s) setFullSettings(s);
        }).catch(console.error);
    }, []);

    const range = getDefaultRange();
    const [tab, setTab] = useState<Tab>('pagar');
    const [contasPagar, setContasPagar] = useState<ContaPagar[]>([]);
    const [contasReceber, setContasReceber] = useState<ContaReceber[]>([]);
    const [loading, setLoading] = useState(false);
    const [dataInicio, setDataInicio] = useState(range.inicio);
    const [dataFim, setDataFim] = useState(range.fim);
    const [filtroSituacao, setFiltroSituacao] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    const [baixaTarget, setBaixaTarget] = useState<(ContaPagar | ContaReceber) | null>(null);
    const [lancarTipo, setLancarTipo] = useState<Tab | null>(null);
    const [editTarget, setEditTarget] = useState<(ContaPagar | ContaReceber) | null>(null);

    const contasOriginais = tab === 'pagar' ? contasPagar : contasReceber;

    // Filtragem local por texto
    const contas = contasOriginais.filter(c => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        const hist = (c.historico || '').toLowerCase();
        const cont = (c.contato?.nome || '').toLowerCase();
        return hist.includes(term) || cont.includes(term);
    });

    const summary = calcSummary(contas);

    const load = useCallback(async (forceRefresh = false) => {
        setLoading(true);
        try {
            const filters = {
                dataVencimentoInicio: dataInicio,
                dataVencimentoFim: dataFim,
                situacao: filtroSituacao || undefined,
            };

            const cacheKey = `bling_finance_${dataInicio}_${dataFim}_${filtroSituacao || 'all'}`;

            if (!forceRefresh) {
                const cached = localStorage.getItem(cacheKey);
                if (cached) {
                    try {
                        const { pagar, receber } = JSON.parse(cached);
                        setContasPagar(pagar);
                        setContasReceber(receber);
                        toast.success('Contas carregadas da memória local.');
                        setLoading(false);
                        return;
                    } catch (e) {
                        // ignore corrupt cache
                    }
                }
            }

            const [pagar, receber] = await Promise.all([
                blingFinanceService.listContasPagar(filters),
                blingFinanceService.listContasReceber(filters),
            ]);

            localStorage.setItem(cacheKey, JSON.stringify({ pagar, receber, timestamp: Date.now() }));

            setContasPagar(pagar);
            setContasReceber(receber);
            toast.success(`${pagar.length + receber.length} contas atualizadas do Bling.`);
        } catch (err: any) {
            toast.error('Erro ao buscar contas: ' + err.message);
        } finally {
            setLoading(false);
        }
    }, [dataInicio, dataFim, filtroSituacao]);

    async function handleBaixar(baixa: BaixaConta, imprimirRecibo: boolean) {
        if (!baixaTarget) return;
        try {
            await blingFinanceService.baixarConta(tab, (baixaTarget as any).id, baixa);
            toast.success('Baixa registrada com sucesso!');

            if (imprimirRecibo) {
                // Cria uma conta "mockada" apenas com o valor da baixa e o historico
                const contaMock: ContaPagar | ContaReceber = {
                    ...baixaTarget,
                    valor: baixa.valor + (baixa.juros || 0) + (baixa.acrescimo || 0) - (baixa.desconto || 0),
                    saldo: undefined, // undefined -> printPaymentReceipt vai imprimir conta.valor direto
                    historico: `Abatimento / Pagamento Parcial. Ref: ${baixaTarget.historico || 'S/N'}`
                };
                printPaymentReceipt(contaMock, fullSettings, tab);
            }

            setBaixaTarget(null);
            await load(true);
        } catch (err: any) {
            toast.error('Erro ao registrar baixa: ' + err.message);
        }
    }

    async function handleCancelar(conta: ContaPagar | ContaReceber) {
        if (!confirm(`Cancelar esta conta no Bling?\n\n"${conta.historico || ''}" — ${formatCurrency(conta.valor)}`)) return;
        try {
            await blingFinanceService.cancelarConta(tab, (conta as any).id);
            toast.success('Conta cancelada.');
            await load(true);
        } catch (err: any) {
            toast.error('Erro ao cancelar: ' + err.message);
        }
    }

    async function handlePrint(conta: ContaPagar | ContaReceber) {
        const tId = toast.loading('Carregando histórico detalhado do Bling...');
        try {
            const detalhe = await blingFinanceService.getConta(tab, (conta as any).id);
            toast.dismiss(tId);
            printContaReceipt(detalhe || conta, fullSettings, tab);
        } catch (err: any) {
            toast.dismiss(tId);
            toast.error('Erro ao trazer detalhes (imprimindo resumo): ' + err.message);
            printContaReceipt(conta, fullSettings, tab);
        }
    }

    async function handlePrintReceipt(conta: ContaPagar | ContaReceber) {
        const tId = toast.loading('Carregando dados da conta para recibo...');
        try {
            const detalhe = await blingFinanceService.getConta(tab, (conta as any).id);
            toast.dismiss(tId);
            printPaymentReceipt(detalhe || conta, fullSettings, tab);
        } catch (err: any) {
            toast.dismiss(tId);
            toast.error('Erro ao trazer dados (imprimindo resumo): ' + err.message);
            printPaymentReceipt(conta, fullSettings, tab);
        }
    }

    async function handleLancar(input: CreateContaInput) {
        try {
            await blingFinanceService.createConta(input);
            toast.success('Conta lançada no Bling!');
            setLancarTipo(null);
            await load(true);
        } catch (err: any) {
            toast.error('Erro ao lançar: ' + err.message);
        }
    }

    async function handleEditar(data: { historico: string; vencimento: string; valor: number; contatoNome: string }) {
        if (!editTarget) return;
        try {
            await blingFinanceService.updateConta(tab, (editTarget as any).id, {
                historico: data.historico || undefined,
                vencimento: data.vencimento,
                valor: data.valor,
                contato: data.contatoNome ? { nome: data.contatoNome } : undefined,
            });
            toast.success('Conta atualizada no Bling!');
            setEditTarget(null);
            await load(true);
        } catch (err: any) {
            toast.error('Erro ao editar: ' + err.message);
        }
    }

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                        <DollarSign className="text-blue-700" size={20} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">Financeiro</h1>
                        <p className="text-sm text-slate-500">Contas a Pagar e Receber — sincronizado com Bling</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={() => setLancarTipo('pagar')}
                        className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-semibold hover:bg-red-100 transition-colors">
                        <TrendingDown size={15} /> Nova a Pagar
                    </button>
                    <button
                        onClick={() => setLancarTipo('receber')}
                        className="flex items-center gap-1.5 px-3 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm font-semibold hover:bg-green-100 transition-colors">
                        <TrendingUp size={15} /> Nova a Receber
                    </button>
                    <button
                        onClick={() => load(true)}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-semibold hover:bg-slate-900 transition-colors disabled:opacity-50">
                        {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                        Atualizar do Bling
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-4">
                <div className="flex flex-wrap gap-3 items-end">
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Buscar por Descrição / Contato</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder="Digite para filtrar a lista..."
                                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 bg-white"
                            />
                        </div>
                    </div>
                </div>
                <div className="flex flex-wrap gap-3 items-end pt-3 border-t border-slate-100">
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Vencimento de (Bling)</label>
                        <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
                            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 bg-white" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">até</label>
                        <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
                            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 bg-white" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Situação no Bling</label>
                        <select value={filtroSituacao} onChange={e => setFiltroSituacao(e.target.value)}
                            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 bg-white">
                            <option value="">Todas</option>
                            <option value="em_aberto">Em aberto</option>
                            <option value="pago">Pago</option>
                            <option value="cancelado">Cancelado</option>
                        </select>
                    </div>
                    <button onClick={load} disabled={loading}
                        className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50">
                        <Filter size={14} />
                        Buscar no Bling
                    </button>
                    <div className="flex-1"></div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200">
                {(['pagar', 'receber'] as Tab[]).map(t => (
                    <button key={t} onClick={() => setTab(t)}
                        className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${tab === t
                            ? t === 'pagar' ? 'border-red-500 text-red-600' : 'border-green-500 text-green-700'
                            : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                        {t === 'pagar' ? <TrendingDown size={16} /> : <TrendingUp size={16} />}
                        Contas a {t === 'pagar' ? 'Pagar' : 'Receber'}
                        {(t === 'pagar' ? contasPagar : contasReceber).length > 0 && (
                            <span className={`ml-1 text-xs font-bold px-2 py-0.5 rounded-full ${t === 'pagar' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                {(t === 'pagar' ? contasPagar : contasReceber).length}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Summary cards */}
            {contas.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <SummaryCard
                        label="Em aberto"
                        value={summary.totalEmAberto}
                        icon={<Calendar size={20} className="text-blue-600" />}
                        colorCls="bg-blue-50 border-blue-100 text-blue-900"
                    />
                    <SummaryCard
                        label="Vencido"
                        value={summary.totalVencido}
                        icon={<AlertCircle size={20} className="text-red-600" />}
                        colorCls="bg-red-50 border-red-100 text-red-900"
                    />
                    <SummaryCard
                        label="Pago no período"
                        value={summary.totalPago}
                        icon={<Check size={20} className="text-green-600" />}
                        colorCls="bg-green-50 border-green-100 text-green-900"
                    />
                </div>
            )}

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
                        <Loader2 className="animate-spin" size={22} />
                        <span>Buscando contas no Bling...</span>
                    </div>
                ) : contas.length === 0 ? (
                    <div className="text-center py-16 text-slate-400">
                        <DollarSign size={40} className="mx-auto mb-3 opacity-30" />
                        <p className="font-medium">Nenhuma conta encontrada</p>
                        <p className="text-sm mt-1">Clique em <strong>Atualizar do Bling</strong> para carregar as contas.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50">
                                    <th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wide">Descrição / Contato</th>
                                    <th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wide">Vencimento</th>
                                    <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wide">Valor</th>
                                    <th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wide">Situação</th>
                                    <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wide">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {contas.map(c => (
                                    <ContaRow
                                        key={(c as any).id}
                                        conta={c}
                                        tipo={tab}
                                        onBaixar={setBaixaTarget}
                                        onCancelar={handleCancelar}
                                        onEditar={setEditTarget}
                                        onPrint={handlePrint}
                                        onPrintReceipt={handlePrintReceipt}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modals */}
            {baixaTarget && (
                <BaixaModal
                    conta={baixaTarget}
                    tipo={tab}
                    onConfirm={handleBaixar}
                    onClose={() => setBaixaTarget(null)}
                />
            )}
            {lancarTipo && (
                <LancarModal
                    tipo={lancarTipo}
                    onConfirm={handleLancar}
                    onClose={() => setLancarTipo(null)}
                />
            )}
            {editTarget && (
                <EditModal
                    conta={editTarget}
                    tipo={tab}
                    onConfirm={handleEditar}
                    onClose={() => setEditTarget(null)}
                />
            )}
        </div>
    );
}
