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
                                Um script local (PM2) em sua loja vai ler esses nomes do servidor Vercel e disparar a impressão dupla (Etiqueta Térmica 10x15 + Resumo do Pedido de folha de Sulfite).
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="block text-sm font-bold text-slate-700">
                                Impressora Térmica (10x15)
                            </label>
                            <p className="text-xs text-slate-500 mb-2">
                                Nome da impressora para emitir E-AWB (Etiqueta de Envio Shopee).
                            </p>
                            <input 
                                type="text"
                                value={company?.shopee_printer_thermal || ''}
                                onChange={e => {
                                    if(company) setCompany({ ...company, shopee_printer_thermal: e.target.value })
                                }}
                                placeholder="Ex: Zebra TLP2844"
                                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 bg-white"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="block text-sm font-bold text-slate-700">
                                Impressora A4 (Resumo)
                            </label>
                            <p className="text-xs text-slate-500 mb-2">
                                Nome da impressora para imprimir a guia/resumo do pedido de itens de separação (Pick List).
                            </p>
                            <input 
                                type="text"
                                value={company?.shopee_printer_a4 || ''}
                                onChange={e => {
                                    if(company) setCompany({ ...company, shopee_printer_a4: e.target.value })
                                }}
                                placeholder="Ex: HP LaserJet Pro P1102w"
                                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 bg-white"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
