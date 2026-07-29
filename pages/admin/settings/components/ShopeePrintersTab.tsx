import React, { useState, useEffect } from 'react';
import { getCompanyData, saveCompanyData } from '../../../../services/companyService';
import { Company } from '../../../../types/company';
import { Printer, Save, Loader2, Info, RefreshCw, Trash2, Play, Download } from 'lucide-react';
import { toast } from 'sonner';

export default function ShopeePrintersTab() {
    const [company, setCompany] = useState<Company | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [windowsPrinters, setWindowsPrinters] = useState<string[]>([]);
    const [loadingPrinters, setLoadingPrinters] = useState(false);
    const [shippingLabels, setShippingLabels] = useState<{ files: number; total_bytes: number } | null>(null);
    const [cleaningLabels, setCleaningLabels] = useState(false);
    const [testingFlow, setTestingFlow] = useState(false);
    const [updatingService, setUpdatingService] = useState(false);

    useEffect(() => {
        loadData();
        void loadShippingLabels();
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

    const loadWindowsPrinters = async () => {
        setLoadingPrinters(true);
        try {
            const response = await fetch('http://localhost:8081/printers');
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data?.error || 'Falha ao consultar o Windows.');
            const printers = Array.isArray(data?.printers)
                ? data.printers.map((value: unknown) => String(value || '').trim()).filter(Boolean)
                : [];
            setWindowsPrinters(printers);
            if (printers.length === 0) {
                toast.error('Nenhuma impressora foi encontrada no Windows.');
            } else {
                toast.success(`${printers.length} impressora(s) encontrada(s) no PC.`);
            }
        } catch (error: any) {
            toast.error(`Não foi possível consultar este PC. Verifique se o serviço de impressão está ativo. ${error?.message || ''}`.trim());
        } finally {
            setLoadingPrinters(false);
        }
    };

    const loadShippingLabels = async () => {
        try {
            const response = await fetch('http://localhost:8081/shipping-labels');
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data?.error || 'Falha ao consultar as etiquetas.');
            setShippingLabels({
                files: Number(data?.files || 0),
                total_bytes: Number(data?.total_bytes || 0),
            });
        } catch {
            setShippingLabels(null);
        }
    };

    const handleClearShippingLabels = async () => {
        if (!window.confirm('Apagar todos os PDFs da pasta "Etiquetas de envio" deste computador? Os pedidos e o histórico de impressão não serão alterados.')) {
            return;
        }
        setCleaningLabels(true);
        try {
            const response = await fetch('http://localhost:8081/shipping-labels', { method: 'DELETE' });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data?.error || 'Falha ao limpar etiquetas.');
            setShippingLabels({ files: Number(data?.files || 0), total_bytes: Number(data?.total_bytes || 0) });
            toast.success(`${Number(data?.deleted || 0)} etiqueta(s) apagada(s) da pasta local.`);
        } catch (error: any) {
            toast.error(`Não foi possível limpar as etiquetas. Verifique se o serviço de impressão está ativo. ${error?.message || ''}`.trim());
        } finally {
            setCleaningLabels(false);
        }
    };

    const handleTestFlow = async () => {
        if (!company?.shopee_printer_thermal || !company?.shopee_printer_a4) {
            toast.error('Selecione e salve as duas impressoras térmicas antes de testar.');
            return;
        }
        if (!window.confirm('Iniciar o fluxo de teste? Serão impressos uma etiqueta e um resumo de separação, sem alterar pedidos reais.')) {
            return;
        }
        setTestingFlow(true);
        try {
            const response = await fetch('http://localhost:8081/test-flow', { method: 'POST' });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data?.error || 'Falha ao iniciar o teste.');
            toast.success('Teste iniciado: confira a etiqueta e o resumo nas duas impressoras.');
            window.setTimeout(() => void loadShippingLabels(), 1500);
        } catch (error: any) {
            toast.error(`Não foi possível iniciar o teste. Verifique se o serviço de impressão está ativo. ${error?.message || ''}`.trim());
        } finally {
            setTestingFlow(false);
        }
    };

    const handleUpdateService = async () => {
        if (!window.confirm('Atualizar o serviço local de impressão deste computador? O serviço será reiniciado em seguida.')) {
            return;
        }
        setUpdatingService(true);
        try {
            const response = await fetch('http://localhost:8081/update-service', { method: 'POST' });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data?.error || 'Falha ao atualizar o serviço.');
            toast.success('Atualização concluída. O serviço local será reiniciado em alguns segundos.');
        } catch (error: any) {
            toast.error(`Não foi possível atualizar o serviço local. Nesta primeira vez, atualize pelo PowerShell. ${error?.message || ''}`.trim());
        } finally {
            setUpdatingService(false);
        }
    };

    const formatBytes = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const printerOptions = (selected?: string) => Array.from(
        new Set([...windowsPrinters, String(selected || '').trim()].filter(Boolean)),
    ).sort((left, right) => left.localeCompare(right, 'pt-BR'));

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
                            <h2 className="text-base font-bold text-slate-800">Impressão Local (duas térmicas 10x15)</h2>
                            <p className="text-xs text-slate-500">
                                Escolha uma vez as impressoras instaladas neste Windows e salve a configuração.
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
                            <p className="font-semibold mb-1">Como funciona a impressão automática?</p>
                            <p className="text-blue-700/80">
                                No computador onde as impressoras estão conectadas, use o botão para buscar e selecionar cada térmica uma única vez.
                                O serviço local de impressão mantém essa configuração e envia automaticamente a etiqueta de envio para uma térmica 10x15 e o resumo de separação para a outra.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex-1">
                            <p className="text-sm font-bold text-slate-800">Impressoras instaladas neste PC</p>
                            <p className="text-xs text-slate-500">A consulta é feita apenas no computador onde a impressora está conectada.</p>
                        </div>
                        <button
                            type="button"
                            onClick={loadWindowsPrinters}
                            disabled={loadingPrinters}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                        >
                            <RefreshCw className={`h-4 w-4 ${loadingPrinters ? 'animate-spin' : ''}`} />
                            {loadingPrinters ? 'Buscando...' : 'Buscar impressoras deste PC'}
                        </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
                        <div className="flex-1">
                            <p className="text-sm font-bold text-slate-800">Etiquetas e resumos salvos neste PC</p>
                            <p className="text-xs text-slate-500">
                                {shippingLabels
                                    ? `${shippingLabels.files} PDF(s) ocupando ${formatBytes(shippingLabels.total_bytes)} na pasta “Etiquetas de envio”.`
                                    : 'Abra esta tela no computador da impressora para consultar a pasta local “Etiquetas de envio”.'}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => void loadShippingLabels()}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                        >
                            <RefreshCw className="h-4 w-4" />
                            Atualizar
                        </button>
                        <button
                            type="button"
                            onClick={() => void handleClearShippingLabels()}
                            disabled={cleaningLabels || !shippingLabels?.files}
                            className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {cleaningLabels ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            Limpar arquivos
                        </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                        <div className="flex-1">
                            <p className="text-sm font-bold text-emerald-900">Teste completo de impressão</p>
                            <p className="text-xs text-emerald-800">
                                Simula nota enviada, preparo do envio, geração da etiqueta e do resumo. Não acessa nem altera pedidos reais da Shopee.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => void handleTestFlow()}
                            disabled={testingFlow}
                            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {testingFlow ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                            {testingFlow ? 'Iniciando...' : 'Executar fluxo de teste'}
                        </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 text-sm">
                        <Info className="w-5 h-5 shrink-0 text-amber-500 mt-0.5" />
                        <div className="flex-1">
                            <p className="font-bold mb-1 text-amber-800">Atualizar serviço de impressão deste computador</p>
                            <p className="text-amber-700">Use após uma nova publicação para baixar a versão aprovada e reiniciar o serviço local.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => void handleUpdateService()}
                            disabled={updatingService}
                            className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {updatingService ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                            {updatingService ? 'Atualizando...' : 'Atualizar serviço'}
                        </button>
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
                                    <select
                                        value={company?.shopee_printer_thermal || ''}
                                        onChange={e => {
                                            if(company) setCompany({ ...company, shopee_printer_thermal: e.target.value })
                                        }}
                                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 bg-white"
                                    >
                                        <option value="">Selecione após buscar as impressoras</option>
                                        {printerOptions(company?.shopee_printer_thermal).map((printer) => (
                                            <option key={printer} value={printer}>{printer}</option>
                                        ))}
                                    </select>
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
                                    Impressora térmica (Resumo de separação 10x15)
                                </label>
                                <p className="text-xs text-slate-500 mb-2">
                                    Segunda impressora térmica, usada para imprimir o resumo do pedido para separação em papel 10x15.
                                </p>
                                <div className="flex gap-2">
                                    <select
                                        value={company?.shopee_printer_a4 || ''}
                                        onChange={e => {
                                            if(company) setCompany({ ...company, shopee_printer_a4: e.target.value })
                                        }}
                                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 bg-white"
                                    >
                                        <option value="">Não imprimir resumo de separação</option>
                                        {printerOptions(company?.shopee_printer_a4).map((printer) => (
                                            <option key={printer} value={printer}>{printer}</option>
                                        ))}
                                    </select>
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
