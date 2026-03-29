import React, { useState } from 'react';
import { Download, RefreshCw, AlertTriangle, CheckCircle, Info, Link as LinkIcon, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';

export const ModelImportPage: React.FC = () => {
  const [sheetUrl, setSheetUrl] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  // Template CSV Link (Mock based on planned architecture)
  const handleDownloadTemplate = () => {
    toast.info("A funcionalidade de download do template será conectada ao Supabase Storage na próxima etapa.");
  };

  const handleSync = async () => {
    if (!sheetUrl) {
      toast.error('Informe o Link ou ID da Planilha do Google Sheets.');
      return;
    }

    setIsSyncing(true);
    toast.loading('Iniciando sincronização rigorosa...', { id: 'sync' });

    // Mocking the sync delay for now
    setTimeout(() => {
      toast.dismiss('sync');
      toast.success('Sincronização concluída (Test Mock)! Detalhes abaixo.');
      setIsSyncing(false);
    }, 2000);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-600 flex items-center gap-2">
            <FileSpreadsheet className="w-8 h-8 text-blue-600" />
            Sincronizar Modelos (Sheets)
          </h1>
          <p className="text-slate-500 mt-2">
            Importação em lote de catálogos base via Google Sheets. O sistema não criará categorias ou marcas automaticamente.
          </p>
        </div>
        <button
          onClick={handleDownloadTemplate}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 font-medium rounded-xl shadow-sm hover:bg-slate-50 transition-colors"
        >
          <Download className="w-4 h-4" />
          Baixar Planilha Padrão
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Formulário de Sincronização */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <LinkIcon className="w-5 h-5 text-indigo-500" />
              Fonte de Dados
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">URL Pública ou ID do Google Sheets</label>
                <input
                  type="text"
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/SEU_ID/edit..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400"
                />
                <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  Certifique-se de que a planilha está configurada como "Qualquer pessoa com o link pode ver".
                </p>
              </div>

              <div className="pt-4">
                <button
                  onClick={handleSync}
                  disabled={isSyncing}
                  className="w-full flex justify-center items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-blue-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {isSyncing ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-5 h-5" />
                  )}
                  {isSyncing ? 'Sincronizando & Validando...' : 'Iniciar Sincronização Estrita'}
                </button>
              </div>
            </div>
          </div>

          {/* Área de Relatório (Aparecerá apenas após o sync) */}
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 border-dashed">
             <div className="flex flex-col items-center justify-center text-center py-8">
               <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                 <RefreshCw className="w-8 h-8 text-slate-400" />
               </div>
               <h3 className="text-slate-800 font-medium">Nenhuma sincronização recente</h3>
               <p className="text-sm text-slate-500 mt-1 max-w-sm">Após sincronizar a planilha, o relatório de linhas processadas e erros detalhados aparecerá aqui.</p>
             </div>
          </div>
        </div>

        {/* Regras de Validação (Strict Mode) */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-6 rounded-2xl border border-amber-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
            
            <h2 className="text-lg font-bold text-amber-900 mb-4 flex items-center gap-2 relative z-10">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              Modo Estrito (Strict Mode)
            </h2>
            
            <p className="text-sm text-amber-800 mb-6 relative z-10 font-medium leading-relaxed">
              O sistema <strong>NÃO</strong> cria tags ou classificações automaticamente. Qualquer divergência causará a rejeição da linha inteira.
            </p>

            <ul className="space-y-3 relative z-10">
              <li className="flex gap-3 text-sm text-amber-900">
                <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                <span>A <strong>Categoria</strong> deve existir exatamente no sistema (ex: Smartphone).</span>
              </li>
              <li className="flex gap-3 text-sm text-amber-900">
                <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                <span>A <strong>Marca</strong> deve ser idêntica ao cadastro do painel (ex: Apple).</span>
              </li>
              <li className="flex gap-3 text-sm text-amber-900">
                <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                <span>As regras de <strong>Preço</strong> (Varejo &gt;= Revenda &gt;= Atacado) serão validadas numericamente.</span>
              </li>
              <li className="flex gap-3 text-sm text-amber-900">
                <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                <span>Campos obrigatórios em branco travam a inserção do Modelo.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
