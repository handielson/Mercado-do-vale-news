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
            // Aguardar contexto carregar
            if (loading) {
                setStatus('Carregando dados...');
                return;
            }

            // Verificar se usuário está autenticado
            if (!user) {
                setStatus('Redirecionando para login...');
                setTimeout(() => navigate('/cliente/login'), 1000);
                return;
            }

            // Verificar se precisa completar cadastro
            if (!customer) {
                setStatus('Carregando perfil...');
                return;
            }

            // Verificar se dados estão completos
            const needsCompletion = !customer.phone || !customer.cpf_cnpj;

            if (needsCompletion) {
                setStatus('Redirecionando para completar cadastro...');
                setTimeout(() => navigate('/completar-cadastro'), 1000);
            } else {
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
