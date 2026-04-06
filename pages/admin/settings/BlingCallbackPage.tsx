import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../../../services/supabase';

type Status = 'processing' | 'success' | 'error';

export default function BlingCallbackPage() {
    const navigate = useNavigate();
    const [status, setStatus] = useState<Status>('processing');
    const [message, setMessage] = useState('Conectando ao Bling...');

    useEffect(() => {
        handleCallback();
    }, []);

    async function handleCallback() {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const error = params.get('error');

        if (error) {
            setStatus('error');
            setMessage(`Autorização negada pelo Bling: ${error}`);
            setTimeout(() => navigate('/admin/settings/bling?error=' + encodeURIComponent(error)), 3000);
            return;
        }

        if (!code) {
            setStatus('error');
            setMessage('Código de autorização não encontrado na URL.');
            setTimeout(() => navigate('/admin/settings/bling?error=missing_code'), 3000);
            return;
        }

        try {
            // 1. Buscar credenciais do banco (client-side, autenticado)
            setMessage('Buscando credenciais...');
            const { data: settings, error: dbError } = await supabase
                .from('company_settings')
                .select('id, bling_client_id, bling_client_secret, bling_callback_url')
                .limit(1)
                .maybeSingle();

            if (dbError || !settings?.bling_client_id || !settings?.bling_client_secret) {
                throw new Error('Credenciais Bling não encontradas. Configure o Client ID e Secret primeiro.');
            }

            const callbackUrl = settings.bling_callback_url ||
                `${window.location.origin}/admin/settings/bling/callback`;

            // 2. Trocar code por token via API (sem expor o secret num CORS request direto)
            setMessage('Obtendo token de acesso...');
            const exchangeRes = await fetch('/api/bling-exchange', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code,
                    client_id: settings.bling_client_id,
                    client_secret: settings.bling_client_secret,
                    redirect_uri: callbackUrl,
                }),
            });

            if (!exchangeRes.ok) {
                const errData = await exchangeRes.json().catch(() => ({}));
                throw new Error(errData.error || `Erro na troca do token (${exchangeRes.status})`);
            }

            const tokens = await exchangeRes.json();

            // 3. Salvar tokens no Supabase (client-side)
            setMessage('Salvando conexão...');
            const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();

            const { error: saveError } = await supabase
                .from('company_settings')
                .update({
                    bling_access_token: tokens.access_token,
                    bling_refresh_token: tokens.refresh_token || null,
                    bling_token_expires_at: expiresAt,
                })
                .eq('id', settings.id);

            if (saveError) throw new Error('Erro ao salvar tokens: ' + saveError.message);

            // Sucesso
            setStatus('success');
            setMessage('Bling conectado com sucesso! Redirecionando...');
            setTimeout(() => navigate('/admin/settings/bling?connected=true'), 2000);

        } catch (err: any) {
            console.error('Bling callback error:', err);
            setStatus('error');
            setMessage(err.message || 'Erro desconhecido ao processar autorização.');
            setTimeout(() => navigate('/admin/settings/bling?error=callback_failed'), 3500);
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-10 max-w-md w-full text-center space-y-5">
                {status === 'processing' && (
                    <Loader2 className="w-14 h-14 text-green-500 animate-spin mx-auto" />
                )}
                {status === 'success' && (
                    <CheckCircle className="w-14 h-14 text-green-500 mx-auto" />
                )}
                {status === 'error' && (
                    <AlertCircle className="w-14 h-14 text-red-400 mx-auto" />
                )}

                <div>
                    <h1 className="text-xl font-bold text-slate-800">
                        {status === 'processing' && 'Processando Autorização'}
                        {status === 'success' && 'Bling Conectado!'}
                        {status === 'error' && 'Erro na Conexão'}
                    </h1>
                    <p className="text-sm text-slate-500 mt-2">{message}</p>
                </div>

                {status !== 'processing' && (
                    <p className="text-xs text-slate-400">Redirecionando em instantes...</p>
                )}
            </div>
        </div>
    );
}
