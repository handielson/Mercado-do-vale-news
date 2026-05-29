import React, { useState, useEffect } from 'react';
import { getCompanyData, saveCompanyData } from '../../../../services/companyService';
import { Company } from '../../../../types/company';
import { Printer, Save, Loader2, Info } from 'lucide-react';
import { toast } from 'sonner';

export default function ShopeePrintersTab() {
    const [company, setCompany] = useState<Company | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const data = await getCompanyData();
            setCompany(data);
        } catch (error) {
            toast.error('Erro ao buscar configurações de impressora.');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!company) return;
        try {
            setSaving(true);
            await saveCompanyData(company);
            toast.success('Configurações de impressora salvas com sucesso!');
        } catch (error) {
            toast.error('Erro ao salvar as impressoras.');
        } finally {
            setSaving(false);
        }
    };

    const handleTestPrint = async (printerName?: string) => {
        if (!printerName?.trim()) {
            toast.error('Informe o nome da impressora para testar.');
            return;
        }
        toast.loading('Enviando página de teste do Windows...', { id: 'test-print' });
        try {
            const res = await fetch(`http://localhost:8081/test-print?printer=${encodeURIComponent(printerName)}`);
            if (!res.ok) throw new Error('Falha no comando de teste');
            toast.success(`Página de teste enviada para "${printerName}"!`, { id: 'test-print' });
        } catch (error: any) {
            toast.error(`Verifique se o servidor de impressoras está rodando (porta 8081). Erro: ${error.message}`, { id: 'test-print' });
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Printer className="w-5 h-5 text-slate-500" />
                        <div>
                            <h2 className="text-base font-bold text-slate-800">Impressão Local (Dual-Print)</h2>
                            <p className="text-xs text-slate-500">
                                Configure os nomes exatos das impressoras instaladas no Windows.
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={handleSave} 
                        disabled={saving}
                        className="bg-orange-500 text-white px-6 py-2 rounded-xl font-semibold flex items-center gap-2 hover:bg-orange-600 transition-colors disabled:opacity-50 shadow-sm text-sm"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Salvar Impressoras
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3 text-blue-800 text-sm">
                        <Info className="w-5 h-5 shrink-0 text-blue-500 mt-0.5" />
                        <div>
                            <p className="font-semibold mb-1">Como funciona a impressão em lote?</p>
                            <p className="text-blue-700/80">
                                O sistema precisa do nome <strong>NOME EXATO</strong> da impressora como aparece no painel de controle do Windows.
                                Por exemplo: <code className="bg-white px-1 py-0.5 rounded border border-blue-200 text-blue-900 font-mono text-xs">Zebra TLP2844</code>.
                                Um script local (PM2) em sua loja vai ler esses nomes da API VPS e disparar a impressão dupla (Etiqueta Térmica 10x15 + Resumo do Pedido de folha de Sulfite).
                            </p>
                        </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 text-amber-900 text-sm">
                        <Info className="w-5 h-5 shrink-0 text-amber-500 mt-0.5" />
                        <div className="flex-1">
                            <p className="font-bold mb-1 text-amber-800">⚠️ Atualização Necessária no PC do Caixa</p>
                            <p className="mb-3 text-amber-700">
                                Foram adicionadas as rotas de "Imprimir Teste" e "Impressão Manual". Para que funcionem, você precisa abrir o <strong>PowerShell</strong> no PC onde a impressora está ligada, entrar na pasta do projeto e rodar o script de atualização do Node:
                            </p>
                            <div className="bg-amber-900/5 p-3 rounded-lg border border-amber-200/50 font-mono text-xs text-amber-900 relative group">
                                <code>git pull origin main<br/>pm2 restart shopee-auto-print<br/>pm2 save</code>
                                <button 
                                    onClick={() => {
                                        navigator.clipboard.writeText('git pull origin main && pm2 restart shopee-auto-print && pm2 save');
                                        toast.success('Comando copiado!');
                                    }}
                                    className="absolute top-2 right-2 p-1.5 bg-white text-slate-500 hover:text-amber-600 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Copiar Comando"
                                >
                                    <Save className="w-4 h-4" /> 
                                    {/* Using Save icon as a placeholder since Copy isn't imported, but wait, I can just write "Copiar" */}
                                </button>
                                <button 
                                    onClick={() => {
                                        navigator.clipboard.writeText('git pull origin main && pm2 restart shopee-auto-print && pm2 save');
                                        toast.success('Comando copiado!');
                                    }}
                                    className="absolute top-2 right-2 px-2 py-1 bg-white text-xs font-bold text-slate-600 hover:text-amber-600 rounded border border-amber-200 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    Copiar
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="block text-sm font-bold text-slate-700">
                                    Impressora Térmica (10x15)
                                </label>
                                <p className="text-xs text-slate-500 mb-2">
                                    Nome da impressora para emitir E-AWB (Etiqueta de Envio Shopee).
                                </p>
                                <div className="flex gap-2">
                                    <input 
                                        type="text"
                                        value={company?.shopee_printer_thermal || ''}
                                        onChange={e => {
                                            if(company) setCompany({ ...company, shopee_printer_thermal: e.target.value })
                                        }}
                                        placeholder="Ex: Zebra TLP2844"
                                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 bg-white"
                                    />
                                    <button 
                                        type="button"
                                        onClick={() => handleTestPrint(company?.shopee_printer_thermal)}
                                        className="px-3 py-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors flex items-center justify-center shrink-0"
                                        title="Imprimir Página de Teste"
                                    >
                                        <Printer className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="block text-sm font-bold text-slate-700">
                                    Impressora A4 (Resumo)
                                </label>
                                <p className="text-xs text-slate-500 mb-2">
                                    Nome da impressora para imprimir a guia/resumo do pedido de itens de separação (Pick List).
                                </p>
                                <div className="flex gap-2">
                                    <input 
                                        type="text"
                                        value={company?.shopee_printer_a4 || ''}
                                        onChange={e => {
                                            if(company) setCompany({ ...company, shopee_printer_a4: e.target.value })
                                        }}
                                        placeholder="Ex: HP LaserJet Pro P1102w"
                                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 bg-white"
                                    />
                                    <button 
                                        type="button"
                                        onClick={() => handleTestPrint(company?.shopee_printer_a4)}
                                        className="px-3 py-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors flex items-center justify-center shrink-0"
                                        title="Imprimir Página de Teste"
                                    >
                                        <Printer className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
