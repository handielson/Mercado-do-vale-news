import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useVpsAuth as useAuth } from '../../hooks/useVpsAuth';
import { vpsAuthService } from '../../services/vpsAuthService';

export const AuthCallbackPage: React.FC = () => {
    const [status, setStatus] = useState('Processando autenticação...');
    const [processingGoogle] = useState(() => window.location.hash.includes('token='));
    const navigate = useNavigate();
    const { user, customer, isLoading } = useAuth();

    useEffect(() => {
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const token = hash.get('token') || '';
        if (!token) return;

        const completeGoogleLogin = async () => {
            setStatus('Confirmando login com Google...');
            window.history.replaceState({}, '', window.location.pathname);
            try {
                const session = await vpsAuthService.completeGoogleSignIn(token);
                const requestedNext = hash.get('next') || sessionStorage.getItem('auth_next') || '/';
                const safeNext = requestedNext.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : '/';
                sessionStorage.removeItem('auth_next');
                const destination = !session.customer.phone || !session.customer.cpf_cnpj
                    ? '/completar-cadastro'
                    : safeNext;
                window.location.replace(destination);
            } catch {
                window.location.replace('/cliente/login?google_error=oauth_failed');
            }
        };

        void completeGoogleLogin();
    }, []);

    useEffect(() => {
        const handleCallback = async () => {
            if (processingGoogle) return;
            console.log('[AuthCallback] State:', { isLoading, user: !!user, customer: !!customer });

            // Aguardar contexto carregar
            if (isLoading) {
                setStatus('Carregando dados...');
                return;
            }

            // Verificar se usuário está autenticado
            if (!user) {
                console.log('[AuthCallback] No user, redirecting to login');
                setStatus('Redirecionando para login...');
                setTimeout(() => navigate('/cliente/login'), 1000);
                return;
            }

            console.log('[AuthCallback] User authenticated:', user.email);

            // Verificar se precisa completar cadastro
            if (!customer) {
                console.log('[AuthCallback] No customer record, redirecting to complete registration');
                setStatus('Redirecionando para completar cadastro...');
                setTimeout(() => navigate('/completar-cadastro'), 500);
                return;
            }

            console.log('[AuthCallback] Customer found:', {
                phone: customer.phone,
                cpf: customer.cpf_cnpj
            });

            // Verificar se dados estão completos
            const needsCompletion = !customer.phone || !customer.cpf_cnpj;

            if (needsCompletion) {
                console.log('[AuthCallback] Customer needs completion');
                setStatus('Redirecionando para completar cadastro...');
                setTimeout(() => navigate('/completar-cadastro'), 1000);
            } else {
                console.log('[AuthCallback] Customer complete, redirecting to catalog');
                setStatus('Login realizado! Redirecionando...');
                const nextPath = sessionStorage.getItem('auth_next') || '/';
                sessionStorage.removeItem('auth_next');
                setTimeout(() => navigate(nextPath), 1000);
            }
        };

        handleCallback();
    }, [user, customer, isLoading, navigate, processingGoogle]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-slate-50">
            <div className="text-center">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
                <p className="text-lg font-semibold text-slate-700">{status}</p>
                <p className="text-sm text-slate-500 mt-2">Aguarde um momento...</p>
            </div>
        </div>
    );
};
