import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useSupabaseAuth as useAuth } from '../../hooks/useSupabaseAuth';

export const AuthCallbackPage: React.FC = () => {
    const [status, setStatus] = useState('Processando autenticação...');
    const navigate = useNavigate();
    const { user, customer, loading } = useAuth();

    useEffect(() => {
        const handleCallback = async () => {
            console.log('[AuthCallback] State:', { loading, user: !!user, customer: !!customer });

            // Aguardar contexto carregar
            if (loading) {
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
                setTimeout(() => navigate('/catalog'), 1000);
            }
        };

        handleCallback();
    }, [user, customer, loading, navigate]);

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
