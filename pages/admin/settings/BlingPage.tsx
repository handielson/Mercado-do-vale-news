import React, { useState, useEffect } from 'react';
import { Package, Save, Eye, EyeOff, CheckCircle, AlertCircle, Copy, ExternalLink, Download, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../../services/supabase';
import { importBlingProducts, ImportResult } from '../../../services/blingService';

interface BlingCredentials {
    bling_client_id: string;
    bling_client_secret: string;
    bling_callback_url: string;
}

export default function BlingPage() {
    const [credentials, setCredentials] = useState<BlingCredentials>({
        bling_client_id: '',
        bling_client_secret: '',
        bling_callback_url: `${window.location.origin}/admin/settings/bling/callback`,
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showSecret, setShowSecret] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [tokenExpiresAt, setTokenExpiresAt] = useState<string | null>(null);

    // Import state
    const [importing, setImporting] = useState(false);
    const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
    const [importResult, setImportResult] = useState<ImportResult | null>(null);

    useEffect(() => {
        loadCredentials();

        // Feedback do callback OAuth2
        const params = new URLSearchParams(window.location.search);
        if (params.get('connected') === 'true') {
            toast.success('✅ Bling conectado com sucesso!');
            window.history.replaceState({}, '', window.location.pathname);
            setIsConnected(true);
        } else if (params.get('error')) {
            const errMap: Record<string, string> = {
                missing_code: 'Código de autorização não recebido.',
                missing_credentials: 'Credenciais não encontradas. Salve o Client ID e Secret.',
                token_exchange_failed: 'Erro ao trocar o código pelo token. Verifique as credenciais.',
                server_config: 'Erro de configuração do servidor.',
                network_error: 'Erro de rede ao conectar com o Bling.',
                save_failed: 'Token obtido mas falhou ao salvar. Tente novamente.',
            };
            const msg = errMap[params.get('error')!] || `Erro: ${params.get('error')}`;
            toast.error(msg);
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, []);

    async function loadCredentials() {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('company_settings')
                .select('bling_client_id, bling_client_secret, bling_access_token, bling_token_expires_at, bling_callback_url')
                .limit(1)
                .maybeSingle();

            if (error) throw error;

            if (data) {
                setCredentials({
                    bling_client_id: data.bling_client_id || '',
                    bling_client_secret: data.bling_client_secret || '',
                    bling_callback_url: data.bling_callback_url || `${window.location.origin}/admin/settings/bling/callback`,
                });
                setIsConnected(!!data.bling_access_token);
                setTokenExpiresAt(data.bling_token_expires_at || null);
            }
        } catch (err) {
            console.error('Erro ao carregar credenciais Bling:', err);
            toast.error('Erro ao carregar configurações do Bling.');
        } finally {
            setLoading(false);
        }
    }

    async function handleSave() {
        if (!credentials.bling_client_id.trim()) {
            toast.error('Client ID é obrigatório.');
            return;
        }
        if (!credentials.bling_client_secret.trim()) {
            toast.error('Client Secret é obrigatório.');
            return;
        }

        try {
            setSaving(true);

            // Check if record exists
            const { data: existing } = await supabase
                .from('company_settings')
                .select('id')
                .limit(1)
                .maybeSingle();

            if (existing) {
                const { error } = await supabase
                    .from('company_settings')
                    .update({
                        bling_client_id: credentials.bling_client_id.trim(),
                        bling_client_secret: credentials.bling_client_secret.trim(),
                        bling_callback_url: credentials.bling_callback_url.trim() || `${window.location.origin}/admin/settings/bling/callback`,
                    })
                    .eq('id', existing.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('company_settings')
                    .insert({
                        bling_client_id: credentials.bling_client_id.trim(),
                        bling_client_secret: credentials.bling_client_secret.trim(),
                        bling_callback_url: credentials.bling_callback_url.trim() || `${window.location.origin}/admin/settings/bling/callback`,
                    });
                if (error) throw error;
            }

            toast.success('Credenciais salvas com sucesso!');
        } catch (err: any) {
            console.error('Erro ao salvar credenciais:', err);
            toast.error('Erro ao salvar credenciais: ' + (err.message || 'Tente novamente.'));
        } finally {
            setSaving(false);
        }
    }

    function handleConnectBling() {
        if (!credentials.bling_client_id.trim()) {
            toast.error('Salve o Client ID antes de conectar.');
            return;
        }

        const callbackUrl = credentials.bling_callback_url.trim() || `${window.location.origin}/admin/settings/bling/callback`;
        const authUrl = new URL('https://www.bling.com.br/Api/v3/oauth/authorize');
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('client_id', credentials.bling_client_id.trim());
        authUrl.searchParams.set('redirect_uri', callbackUrl);
        authUrl.searchParams.set('state', 'bling_oauth');

        window.location.href = authUrl.toString();
    }

    async function handleImport() {
        setImporting(true);
        setImportResult(null);
        setImportProgress({ current: 0, total: 0 });

        try {
            const result = await importBlingProducts((current, total, partial) => {
                setImportProgress({ current, total });
            });

            setImportResult(result);

            if (result.errors.length === 0) {
                toast.success(`Importação concluída! ${result.created} criados, ${result.updated} atualizados.`);
            } else {
                toast.warning(`Importação com erros: ${result.errors.length} falhas.`);
            }
        } catch (err: any) {
            toast.error('Erro na importação: ' + (err.message || 'Tente novamente.'));
        } finally {
            setImporting(false);
        }
    }

    function copyCallbackUrl() {
        navigator.clipboard.writeText(credentials.bling_callback_url);
        toast.success('URL copiada!');
    }

    const tokenExpired = tokenExpiresAt ? new Date(tokenExpiresAt) < new Date() : false;
    const tokenStatusLabel = !isConnected
        ? 'Não conectado'
        : tokenExpired
            ? 'Token expirado — reconecte'
            : `Conectado até ${new Date(tokenExpiresAt!).toLocaleString('pt-BR')}`;

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
            </div>
        );
    }

    return (
        <div className="animate-in fade-in duration-500 max-w-3xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Package className="w-8 h-8 text-green-500" />
                        Integração Bling
                    </h1>
                    <p className="text-slate-500 mt-1">
                        Conecte sua conta Bling para importar produtos e sincronizar estoque.
                    </p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-green-600 text-white px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                    {saving ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <Save className="w-5 h-5" />
                    )}
                    Salvar Credenciais
                </button>
            </div>

            {/* Status */}
            <div className={`flex items-center gap-3 p-4 rounded-xl border ${isConnected && !tokenExpired
                ? 'bg-green-50 border-green-200 text-green-800'
                : tokenExpired
                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}>
                {isConnected && !tokenExpired ? (
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                ) : (
                    <AlertCircle className="w-5 h-5 text-slate-400 flex-shrink-0" />
                )}
                <p className="text-sm font-medium">{tokenStatusLabel}</p>
            </div>

            {/* Credenciais */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-5">
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-700">1</span>
                    Credenciais do Aplicativo Bling
                </h2>

                <p className="text-sm text-slate-500">
                    Acesse{' '}
                    <a
                        href="https://www.bling.com.br/aplicativos.php"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-600 hover:underline font-medium inline-flex items-center gap-1"
                    >
                        Bling → Aplicativos <ExternalLink className="w-3 h-3" />
                    </a>{' '}
                    e copie as credenciais do seu app privado.
                </p>

                <div className="space-y-4">
                    {/* Client ID */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                            Client ID <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={credentials.bling_client_id}
                            onChange={(e) => setCredentials({ ...credentials, bling_client_id: e.target.value })}
                            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm bg-slate-50"
                            placeholder="Ex: a1b2c3d4e5f6..."
                            autoComplete="off"
                        />
                    </div>

                    {/* Client Secret */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                            Client Secret <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <input
                                type={showSecret ? 'text' : 'password'}
                                value={credentials.bling_client_secret}
                                onChange={(e) => setCredentials({ ...credentials, bling_client_secret: e.target.value })}
                                className="w-full px-4 py-3 pr-12 border border-slate-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm bg-slate-50"
                                placeholder="Cole o Client Secret aqui"
                                autoComplete="off"
                            />
                            <button
                                type="button"
                                onClick={() => setShowSecret(!showSecret)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                {showSecret ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Callback URL */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-700">2</span>
                    URL de Callback (Redirecionamento)
                </h2>
                <p className="text-sm text-slate-500">
                    Defina e cadastre esta URL no campo <strong>"Link de Redirecionamento"</strong> do seu aplicativo no Bling:
                </p>
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        value={credentials.bling_callback_url}
                        onChange={(e) => setCredentials({ ...credentials, bling_callback_url: e.target.value })}
                        className="flex-1 px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm bg-slate-50"
                        placeholder="https://seudominio.com/admin/settings/bling/callback"
                    />
                    <button
                        onClick={copyCallbackUrl}
                        className="flex-shrink-0 p-3 hover:bg-slate-100 rounded-xl transition-colors text-slate-500 hover:text-slate-700 border border-slate-200"
                        title="Copiar URL"
                    >
                        <Copy className="w-4 h-4" />
                    </button>
                </div>
                <p className="text-xs text-slate-400">💡 Para produção use a URL do Vercel. Para desenvolvimento local use <code>http://localhost:3000/...</code></p>
            </div>

            {/* Conectar */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-700">3</span>
                    Autorizar Acesso
                </h2>
                <p className="text-sm text-slate-500">
                    Após salvar as credenciais acima, clique em <strong>"Conectar com Bling"</strong> para autorizar o acesso via OAuth2.
                    Você será redirecionado para o Bling e voltará automaticamente.
                </p>
                <button
                    onClick={handleConnectBling}
                    disabled={!credentials.bling_client_id}
                    className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <ExternalLink className="w-5 h-5" />
                    {isConnected && !tokenExpired ? 'Reconectar com Bling' : 'Conectar com Bling'}
                </button>
            </div>

            {/* Importar Produtos */}
            {isConnected && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
                    <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-700">4</span>
                        Importar Produtos do Bling
                    </h2>
                    <p className="text-sm text-slate-500">
                        Busca todos os produtos cadastrados no Bling e synchroniza com o sistema.
                        Produtos existentes são atualizados; novos são criados automaticamente.
                    </p>

                    {/* SQL warning */}
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <p className="text-xs font-semibold text-amber-800 mb-1">⚠️ Pré-requisito: rode este SQL no Supabase antes de importar</p>
                        <code className="text-xs text-amber-700 block font-mono">
                            ALTER TABLE products ADD COLUMN IF NOT EXISTS bling_id BIGINT;
                        </code>
                    </div>

                    <button
                        onClick={handleImport}
                        disabled={importing}
                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {importing ? (
                            <><Loader2 className="w-5 h-5 animate-spin" /> Importando...</>
                        ) : (
                            <><Download className="w-5 h-5" /> Importar Produtos</>
                        )}
                    </button>

                    {/* Progress */}
                    {importing && importProgress.total > 0 && (
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs text-slate-500">
                                <span>Processando...</span>
                                <span>{importProgress.current} / {importProgress.total}</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2">
                                <div
                                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Results */}
                    {importResult && (
                        <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 space-y-3">
                            <p className="text-sm font-bold text-slate-700">Resultado da Importação</p>
                            <div className="flex gap-4">
                                <div className="text-center">
                                    <p className="text-2xl font-bold text-green-600">{importResult.created}</p>
                                    <p className="text-xs text-slate-500">criados</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-2xl font-bold text-blue-600">{importResult.updated}</p>
                                    <p className="text-xs text-slate-500">atualizados</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-2xl font-bold text-red-500">{importResult.errors.length}</p>
                                    <p className="text-xs text-slate-500">erros</p>
                                </div>
                            </div>
                            {importResult.errors.length > 0 && (
                                <div className="max-h-32 overflow-y-auto space-y-1">
                                    {importResult.errors.map((e, i) => (
                                        <p key={i} className="text-xs text-red-600 font-mono">{e}</p>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Escopos */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-blue-800 mb-2">📋 Escopos necessários no app Bling</p>
                <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                    <li><strong>Produtos</strong> — leitura e escrita</li>
                    <li><strong>Estoques</strong> — leitura de saldos por depósito</li>
                </ul>
            </div>
        </div>
    );
}
