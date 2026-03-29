import React, { useState } from 'react';
import { Download, RefreshCw, AlertTriangle, CheckCircle, Info, Link as LinkIcon, FileSpreadsheet, Database, Users, Box, HardDriveUpload, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { CategorySelect } from '../../../components/products/CategorySelect';
import { DataSyncService } from '../../../services/dataSyncService';

// Definindo abas/tipos de importação que teremos na central
type ImportTab = 'modelos' | 'clientes' | 'produtos' | 'vendas';

export const DataImportExportPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ImportTab>('modelos');
  const [sheetUrl, setSheetUrl] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [syncResults, setSyncResults] = useState<{ processed: number, inserted: number, updated: number, errors: string[] } | null>(null);

  // Download Dinâmico do Template CSV
  const handleDownloadTemplate = async () => {
    if (!selectedCategory) {
      toast.error("Por favor, selecione uma Categoria no Passo 1 antes de baixar o padrão.");
      return;
    }

    try {
      setIsDownloading(true);
      toast.loading("Gerando planilha com dados atualizados...", { id: 'download-csv' });

      // Gera o CSV String da API Frontend
      const csvString = await DataSyncService.generateDynamicTemplate(selectedCategory);
      
      // Converte para Blob e salva
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `MERCADO_DO_VALE_Modelos.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.dismiss('download-csv');
      toast.success("Planilha Dinâmica baixada com sucesso!");
    } catch (error: any) {
      toast.dismiss('download-csv');
      toast.error(error.message || "Erro ao gerar o CSV.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSync = async () => {
    if (!selectedCategory) {
      toast.error('Selecione uma Categoria Base no Passo 1.');
      return;
    }
    if (!sheetUrl) {
      toast.error('Informe o Link ou ID da Planilha do Google Sheets no Passo 2.');
      return;
    }

    setIsSyncing(true);
    setSyncResults(null);
    toast.loading(`Iniciando sincronização estrita para os Modelos...`, { id: 'sync' });

    try {
      const results = await DataSyncService.syncGoogleSpreadsheet(sheetUrl, selectedCategory);
      setSyncResults(results);
      
      toast.dismiss('sync');
      if (results.errors.length > 0) {
        toast.warning(`Sincronização concluída com ${results.errors.length} ressalvas. Veja o relatório.`);
      } else {
        toast.success(`Sucesso absoluto! ${results.inserted} cadastrados e ${results.updated} atualizados.`);
      }
    } catch (error: any) {
      toast.dismiss('sync');
      toast.error(error.message || 'Falha catastrófica ao sincronizar.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
          <Database className="w-8 h-8 text-indigo-600" />
          Central de Importação & Exportação
        </h1>
        <p className="text-slate-500 mt-2">
          Gerencie migrações de dados, integrações com planilhas e backup do sistema legado a partir deste hub centralizado.
        </p>
      </div>

      {/* Tabs / Modules */}
      <div className="flex overflow-x-auto gap-2 mb-8 pb-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('modelos')}
          className={`px-5 py-3 rounded-t-xl font-medium text-sm flex items-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === 'modelos'
              ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Box className="w-4 h-4" />
          Catálogo: Modelos
        </button>
        <button
          onClick={() => setActiveTab('clientes')}
          className={`px-5 py-3 rounded-t-xl font-medium text-sm flex items-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === 'clientes'
              ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Users className="w-4 h-4" />
          Clientes (Migração Legado)
        </button>
        <button
          disabled
          className="px-5 py-3 rounded-t-xl font-medium text-sm flex items-center gap-2 text-slate-400 cursor-not-allowed whitespace-nowrap"
          title="Em breve"
        >
          <Upload className="w-4 h-4" />
          Produtos Fisicos (Em breve)
        </button>
        <button
          disabled
          className="px-5 py-3 rounded-t-xl font-medium text-sm flex items-center gap-2 text-slate-400 cursor-not-allowed whitespace-nowrap"
          title="Em breve"
        >
          <HardDriveUpload className="w-4 h-4" />
          Histórico Vendas (Em breve)
        </button>
      </div>

      {/* MODAL / CONTENT PARA MODELOS */}
      {activeTab === 'modelos' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in slide-in-from-bottom-2">
          {/* Formulário de Sincronização */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-600 flex items-center gap-2">
                    <FileSpreadsheet className="w-6 h-6 text-blue-600" />
                    Sincronizar Modelos (Sheets)
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">Conecte sua planilha mestra para atualizar a vitrine base do catálogo.</p>
                </div>
              </div>
              
              <div className="space-y-6">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <label className="block text-sm font-semibold text-slate-800 mb-2">1️⃣ Selecione a Categoria Base (Obrigatório)</label>
                  <p className="text-xs text-slate-500 mb-3">Escolha a categoria para configurar as colunas do template perfeitamente.</p>
                  <CategorySelect value={selectedCategory} onChange={setSelectedCategory} />
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <label className="block text-sm font-semibold text-slate-800 mb-2 flex justify-between items-center">
                    <span>2️⃣ Planilha Google Sheets (Edição em Massa)</span>
                    <button
                      onClick={handleDownloadTemplate}
                      disabled={isDownloading || !selectedCategory}
                      className="flex items-center gap-2 px-3 py-1.5 bg-white text-indigo-700 border border-indigo-200 text-sm font-medium rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-50"
                    >
                      <Download className="w-4 h-4" />
                      {isDownloading ? 'Gerando...' : 'Baixar Meu Padrão Dinâmico'}
                    </button>
                  </label>
                  <input
                    type="text"
                    value={sheetUrl}
                    onChange={(e) => setSheetUrl(e.target.value)}
                    placeholder="Cole aqui: https://docs.google.com/spreadsheets/d/SEU_ID/edit..."
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 mt-2"
                  />
                  <p className="text-xs text-slate-500 mt-3 flex items-center gap-1">
                    <Info className="w-4 h-4 text-indigo-500" />
                    Após editar o arquivo no Google Sheets, cole a URL acima (verifique se "Qualquer pessoa" tem acesso).
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleSync}
                    disabled={isSyncing}
                    className="w-full flex justify-center items-center gap-2 px-6 py-4 bg-gradient-to-r from-indigo-600 to-blue-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all text-lg disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    {isSyncing ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-5 h-5" />
                    )}
                    {isSyncing ? 'Sincronizando...' : '3️⃣ Executar Sincronização Estrita'}
                  </button>
                </div>
              </div>
            </div>

            {/* Relatório */}
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 border-dashed">
               {!syncResults ? (
                 <div className="flex flex-col items-center justify-center text-center py-8">
                   <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                     <RefreshCw className="w-8 h-8 text-slate-400" />
                   </div>
                   <h3 className="text-slate-800 font-medium">Nenhuma sincronização recente</h3>
                   <p className="text-sm text-slate-500 mt-1 max-w-sm">Após sincronizar a planilha, o relatório de linhas processadas e erros detalhados aparecerá aqui.</p>
                 </div>
               ) : (
                 <div className="space-y-4 animate-in fade-in">
                   <h3 className="font-bold text-slate-800 flex items-center gap-2">
                     <CheckCircle className="w-5 h-5 text-emerald-500" /> Relatório de Sincronização
                   </h3>
                   <div className="grid grid-cols-3 gap-3">
                     <div className="bg-white border col-span-1 p-3 rounded-lg text-center">
                       <p className="text-sm text-slate-500">Processados</p>
                       <p className="text-xl font-bold text-slate-800">{syncResults.processed}</p>
                     </div>
                     <div className="bg-white border col-span-1 p-3 rounded-lg text-center">
                       <p className="text-sm text-slate-500">Cadastrados</p>
                       <p className="text-xl font-bold text-emerald-600">{syncResults.inserted}</p>
                     </div>
                     <div className="bg-white border col-span-1 p-3 rounded-lg text-center">
                       <p className="text-sm text-slate-500">Atualizados</p>
                       <p className="text-xl font-bold text-blue-600">{syncResults.updated}</p>
                     </div>
                   </div>

                   {syncResults.errors.length > 0 && (
                     <div className="mt-4">
                       <h4 className="font-semibold text-rose-700 mb-2 flex items-center gap-2">
                         <AlertTriangle className="w-4 h-4" /> {syncResults.errors.length} Erros Encontrados (Estes foram ignorados):
                       </h4>
                       <div className="bg-white border border-rose-200 rounded-lg p-3 max-h-60 overflow-y-auto space-y-2">
                         {syncResults.errors.map((err, i) => (
                           <div key={i} className="text-sm text-rose-600 bg-rose-50 p-2 rounded">{err}</div>
                         ))}
                       </div>
                     </div>
                   )}
                 </div>
               )}
            </div>
          </div>

          {/* Regras (Strict Mode) */}
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-6 rounded-2xl border border-amber-200 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
              
              <h2 className="text-lg font-bold text-amber-900 mb-4 flex items-center gap-2 relative z-10">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                Modo Estrito Ativado
              </h2>
              
              <ul className="space-y-3 relative z-10">
                <li className="flex gap-3 text-sm text-amber-900">
                  <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span><strong>Categoria e Marca</strong> devem existir exatamente no banco (case sensitive).</span>
                </li>
                <li className="flex gap-3 text-sm text-amber-900">
                  <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span>Novas classificações NÃO são criadas via planilha por segurança.</span>
                </li>
                <li className="flex gap-3 text-sm text-amber-900">
                  <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span>Linhas com divergência são totalmente ignoradas pelo sistema.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* MODAL / CONTENT PARA CLIENTES */}
      {activeTab === 'clientes' && (
        <div className="bg-white p-10 rounded-2xl shadow-sm border border-slate-200 text-center animate-in slide-in-from-bottom-2">
           <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
             <Users className="w-10 h-10 text-blue-500" />
           </div>
           <h2 className="text-2xl font-bold text-slate-800 mb-2">Migração de Clientes (Legado)</h2>
           <p className="text-slate-500 max-w-lg mx-auto mb-6">
             Esta interface será responsável por ler o arquivo exportado do <strong>MV-Gestao</strong> e criar os clientes aqui, automatizando a mensagem de boas-vindas com CPF via Whatsapp.
           </p>
           <button className="px-6 py-3 bg-slate-800 text-white font-medium rounded-xl hover:bg-slate-700 transition">
             Carregar Módulo de Migração
           </button>
        </div>
      )}

    </div>
  );
};
