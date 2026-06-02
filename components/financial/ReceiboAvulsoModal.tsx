import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    X, Printer, Search, Loader2, User, Check,
    ReceiptText, ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';
import { customerService } from '../../services/customers';
import { vpsClient } from '../../services/vpsClient';
import { companySettingsService } from '../../services/companySettingsService';
import { printPaymentReceipt } from '../../utils/printPaymentReceipt';
import type { Customer } from '../../types/customer';
import type { CreateAvulsoReceiptInput, AvulsoReceipt } from '../../types/avulsoReceipt';
import type { ContaReceber } from '../../types/finance';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(v: number): string {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function gerarNumeroRecibo(tipo: string): string {
    const prefixo = tipo === 'receber' ? 'REC' : 'PAG';
    const hoje = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(Math.random() * 9000) + 1000;
    return `${prefixo}-${hoje}-${rand}`;
}

// ─── Customer Search ──────────────────────────────────────────────────────────

interface CustomerSearchProps {
    onSelect: (customer: Customer | null) => void;
    selected: Customer | null;
}

function CustomerSearch({ onSelect, selected }: CustomerSearchProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Customer[]>([]);
    const [searching, setSearching] = useState(false);
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Fecha dropdown ao clicar fora
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const doSearch = useCallback(async (q: string) => {
        if (q.trim().length < 2) { setResults([]); setOpen(false); return; }
        setSearching(true);
        try {
            const found = await customerService.search(q.trim());
            setResults(found.filter(c => c.is_active).slice(0, 8));
            setOpen(true);
        } catch {
            setResults([]);
        } finally {
            setSearching(false);
        }
    }, []);

    function handleInput(v: string) {
        setQuery(v);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => doSearch(v), 300);
    }

    function handleSelect(c: Customer) {
        onSelect(c);
        setQuery('');
        setResults([]);
        setOpen(false);
    }

    function handleClear() {
        onSelect(null);
        setQuery('');
        setResults([]);
    }

    if (selected) {
        return (
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                <User size={15} className="text-blue-500 shrink-0" />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-blue-800 truncate">{selected.name}</p>
                    {selected.cpf_cnpj && (
                        <p className="text-xs text-blue-600">{selected.cpf_cnpj}</p>
                    )}
                </div>
                <button
                    type="button"
                    onClick={handleClear}
                    className="p-1 rounded hover:bg-blue-100 text-blue-400 hover:text-blue-600 transition-colors"
                    title="Remover cliente selecionado"
                >
                    <X size={14} />
                </button>
            </div>
        );
    }

    return (
        <div ref={ref} className="relative">
            <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                    type="text"
                    value={query}
                    onChange={e => handleInput(e.target.value)}
                    placeholder="Buscar cliente pelo nome, CPF/CNPJ ou telefone..."
                    className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 bg-white"
                />
                {searching && (
                    <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />
                )}
            </div>
            {open && results.length > 0 && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl max-h-52 overflow-y-auto">
                    {results.map(c => (
                        <button
                            key={c.id}
                            type="button"
                            onClick={() => handleSelect(c)}
                            className="w-full flex items-start gap-2 px-3 py-2.5 hover:bg-slate-50 transition-colors text-left border-b border-slate-100 last:border-b-0"
                        >
                            <User size={14} className="text-slate-400 mt-0.5 shrink-0" />
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-800 truncate">{c.name}</p>
                                <p className="text-xs text-slate-500 truncate">
                                    {[c.cpf_cnpj, c.phone].filter(Boolean).join(' · ') || 'Sem documento/telefone'}
                                </p>
                            </div>
                        </button>
                    ))}
                </div>
            )}
            {open && results.length === 0 && !searching && query.length >= 2 && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl px-3 py-3 text-sm text-slate-500 text-center">
                    Nenhum cliente encontrado para "{query}"
                </div>
            )}
        </div>
    );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface ReceiboAvulsoModalProps {
    onClose: () => void;
}

export function ReceiboAvulsoModal({ onClose }: ReceiboAvulsoModalProps) {
    const today = new Date().toISOString().split('T')[0];

    const [tipo, setTipo] = useState<'receber' | 'pagar'>('receber');
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [nomeManual, setNomeManual] = useState('');
    const [cpfCnpj, setCpfCnpj] = useState('');
    const [telefone, setTelefone] = useState('');
    const [valor, setValor] = useState('');
    const [descricao, setDescricao] = useState('');
    const [dataEmissao, setDataEmissao] = useState(today);
    const [saving, setSaving] = useState(false);

    // Preenche campos automaticamente ao selecionar cliente
    useEffect(() => {
        if (selectedCustomer) {
            setNomeManual(selectedCustomer.name);
            setCpfCnpj(selectedCustomer.cpf_cnpj || '');
            setTelefone(selectedCustomer.phone || '');
        }
    }, [selectedCustomer]);

    const nomeEfetivo = selectedCustomer?.name || nomeManual.trim();

    async function handleEmitir() {
        if (!nomeEfetivo) { toast.error('Informe o nome do cliente ou fornecedor.'); return; }
        if (!valor || parseFloat(valor) <= 0) { toast.error('Informe um valor válido.'); return; }
        if (!descricao.trim()) { toast.error('Informe a descrição / referência do recibo.'); return; }

        setSaving(true);
        try {
            const valorNum = parseFloat(valor);
            const input: CreateAvulsoReceiptInput = {
                tipo,
                nome_contato: nomeEfetivo,
                cpf_cnpj: cpfCnpj.trim() || undefined,
                telefone: telefone.trim() || undefined,
                customer_id: selectedCustomer?.id || undefined,
                valor: valorNum,
                descricao: descricao.trim(),
                data_emissao: dataEmissao,
            };

            // Registra na VPS para consulta futura
            const recibo = await vpsClient.post<AvulsoReceipt>('/financial/avulso-receipts', input);

            toast.success(`Recibo ${recibo.numero} emitido e registrado!`);

            // Imprime usando o mesmo template A4 configurável
            const settings = await companySettingsService.get();
            const contaMock = {
                id: 0,
                vencimento: dataEmissao,
                valor: valorNum,
                situacao: 'pago' as const,
                historico: descricao.trim(),
                contato: {
                    nome: nomeEfetivo,
                    cpf_cnpj: cpfCnpj.trim() || undefined,
                    telefone: telefone.trim() || undefined,
                } as ContaReceber['contato'] & { cpf_cnpj?: string; telefone?: string },
            };
            printPaymentReceipt(contaMock as any, settings as any, tipo);

            onClose();
        } catch (err: any) {
            toast.error(`Erro ao emitir recibo: ${err?.message || 'Tente novamente.'}`);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
                    <div className="flex items-center gap-2">
                        <ReceiptText size={18} className="text-blue-600" />
                        <h3 className="text-base font-bold text-slate-800">Emitir Recibo Avulso</h3>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 space-y-4 overflow-y-auto">

                    {/* Tipo */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Tipo de Recibo</label>
                        <div className="grid grid-cols-2 gap-2">
                            {(['receber', 'pagar'] as const).map(t => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setTipo(t)}
                                    className={`px-3 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                                        tipo === t
                                            ? t === 'receber'
                                                ? 'bg-green-600 text-white border-green-600'
                                                : 'bg-red-600 text-white border-red-600'
                                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                    }`}
                                >
                                    {t === 'receber' ? '💰 Recibo de Recebimento' : '💸 Recibo de Pagamento'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Cliente (busca no sistema) */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                            {tipo === 'receber' ? 'Cliente / Pagante' : 'Fornecedor / Beneficiário'}
                            <span className="ml-1 font-normal text-slate-400">(busque no cadastro ou preencha manualmente)</span>
                        </label>
                        <CustomerSearch
                            selected={selectedCustomer}
                            onSelect={c => {
                                setSelectedCustomer(c);
                                if (!c) { setNomeManual(''); setCpfCnpj(''); setTelefone(''); }
                            }}
                        />
                    </div>

                    {/* Nome manual (só aparece se não selecionou cliente) */}
                    {!selectedCustomer && (
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">
                                Nome <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={nomeManual}
                                onChange={e => setNomeManual(e.target.value)}
                                placeholder="Nome completo"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 bg-white"
                            />
                        </div>
                    )}

                    {/* CPF/CNPJ e Telefone */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">CPF / CNPJ</label>
                            <input
                                type="text"
                                value={cpfCnpj}
                                onChange={e => setCpfCnpj(e.target.value)}
                                placeholder="Opcional"
                                disabled={!!selectedCustomer && !!selectedCustomer.cpf_cnpj}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 bg-white disabled:bg-slate-50 disabled:text-slate-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Telefone</label>
                            <input
                                type="text"
                                value={telefone}
                                onChange={e => setTelefone(e.target.value)}
                                placeholder="Opcional"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 bg-white"
                            />
                        </div>
                    </div>

                    {/* Valor e Data */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">
                                Valor (R$) <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={valor}
                                onChange={e => setValor(e.target.value)}
                                placeholder="0,00"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 bg-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Data de Emissão</label>
                            <input
                                type="date"
                                value={dataEmissao}
                                onChange={e => setDataEmissao(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 bg-white"
                            />
                        </div>
                    </div>

                    {/* Descrição */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                            Descrição / Referência <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={descricao}
                            onChange={e => setDescricao(e.target.value)}
                            rows={2}
                            placeholder="Ex: Referente à venda do Apple iPhone 15 (128GB) - Rosa"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 bg-white resize-none"
                        />
                    </div>

                    {/* Preview do valor */}
                    {valor && parseFloat(valor) > 0 && (
                        <div className={`rounded-xl p-3 text-center ${tipo === 'receber' ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'}`}>
                            <p className="text-xs text-slate-500 mb-0.5">{tipo === 'receber' ? 'Valor a Receber' : 'Valor a Pagar'}</p>
                            <p className={`text-2xl font-bold ${tipo === 'receber' ? 'text-green-700' : 'text-red-700'}`}>
                                {fmt(parseFloat(valor))}
                            </p>
                            {nomeEfetivo && (
                                <p className="text-xs text-slate-500 mt-0.5">
                                    {tipo === 'receber' ? 'de' : 'a'} <strong>{nomeEfetivo}</strong>
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 px-5 pb-5 pt-3 border-t border-slate-100 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleEmitir}
                        disabled={saving || !nomeEfetivo || !valor || !descricao.trim()}
                        className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                        {saving ? <Loader2 size={15} className="animate-spin" /> : <Printer size={15} />}
                        {saving ? 'Registrando...' : 'Emitir e Imprimir'}
                    </button>
                </div>
            </div>
        </div>
    );
}
