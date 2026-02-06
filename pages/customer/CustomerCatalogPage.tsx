import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, User, LogOut } from 'lucide-react';
import { useSupabaseAuth as useAuth } from '../../hooks/useSupabaseAuth';

export const CustomerCatalogPage: React.FC = () => {
    const { user, customer, signOut } = useAuth();
    const navigate = useNavigate();

    // Redirect admins to admin dashboard
    useEffect(() => {
        if (customer?.customer_type === 'ADMIN') {
            navigate('/admin/dashboard', { replace: true });
        }
    }, [customer, navigate]);

    const handleLogout = async () => {
        await signOut();
        navigate('/cliente/login');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50">
            {/* Header */}
            <header className="bg-white shadow-sm border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <ShoppingBag className="text-blue-600" size={32} />
                        <h1 className="text-2xl font-bold text-slate-800">Mercado do Vale</h1>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-sm font-semibold text-slate-700">
                                {customer?.name || user?.user_metadata?.full_name || 'Cliente'}
                            </p>
                            <p className="text-xs text-slate-500">{user?.email}</p>
                        </div>
                        <button
                            onClick={() => navigate('/perfil')}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors border border-blue-200"
                        >
                            <User size={18} />
                            Meu Perfil
                        </button>
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            <LogOut size={18} />
                            Sair
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 py-12">
                <div className="text-center mb-12">
                    <h2 className="text-4xl font-bold text-slate-800 mb-4">
                        Bem-vindo ao Catálogo!
                    </h2>
                    <p className="text-lg text-slate-600">
                        Em breve você poderá navegar por nossos produtos aqui.
                    </p>
                </div>

                {/* Success Card */}
                <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-lg p-8 border border-slate-200">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-slate-800">Login realizado com sucesso!</h3>
                            <p className="text-slate-600">Sua conta está ativa e pronta para uso.</p>
                        </div>
                    </div>

                    {/* Customer Info */}
                    <div className="bg-slate-50 rounded-xl p-6 space-y-3">
                        <h4 className="font-semibold text-slate-700 mb-4">Informações da Conta</h4>

                        <div className="flex justify-between">
                            <span className="text-slate-600">Nome:</span>
                            <span className="font-semibold text-slate-800">
                                {customer?.name || user?.user_metadata?.full_name || 'N/A'}
                            </span>
                        </div>

                        <div className="flex justify-between">
                            <span className="text-slate-600">Email:</span>
                            <span className="font-semibold text-slate-800">{user?.email}</span>
                        </div>

                        {customer?.cpf_cnpj && (
                            <div className="flex justify-between">
                                <span className="text-slate-600">CPF:</span>
                                <span className="font-semibold text-slate-800">
                                    {customer.cpf_cnpj.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}
                                </span>
                            </div>
                        )}

                        {customer?.phone && (
                            <div className="flex justify-between">
                                <span className="text-slate-600">Telefone:</span>
                                <span className="font-semibold text-slate-800">
                                    {customer.phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}
                                </span>
                            </div>
                        )}

                        <div className="flex justify-between">
                            <span className="text-slate-600">Status:</span>
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                                ✓ Ativo
                            </span>
                        </div>
                    </div>

                    {/* Coming Soon */}
                    <div className="mt-6 text-center">
                        <p className="text-sm text-slate-500">
                            O catálogo de produtos estará disponível em breve.
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
};
