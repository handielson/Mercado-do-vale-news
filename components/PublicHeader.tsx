import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, User, LogOut, ChevronDown, Shield, Tag, Heart } from 'lucide-react';
import { useSupabaseAuth } from '../contexts/SupabaseAuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { StoreStatusBadge } from './ui/StoreStatusBadge';
import { WeatherWidget } from './WeatherWidget';
import { FastDeliveryBadge } from './FastDeliveryBadge';

/**
 * PublicHeader - Header for public pages (catalog)
 * 
 * Features:
 * - Logo/company name (clickable → /)
 * - Login dropdown (Admin/Cliente)
 * - Register button
 * - User menu when logged in
 * - Customer type badge
 */
export const PublicHeader: React.FC = () => {
    const { user, customer, signOut, setAdminPreviewType } = useSupabaseAuth();
    const { settings: themeSettings } = useTheme();
    const navigate = useNavigate();
    const [showLoginDropdown, setShowLoginDropdown] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 10);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const handleLogout = async () => {
        await signOut();
        navigate('/');
    };

    const getCustomerTypeBadge = () => {
        if (!customer) return null;

        const badges = {
            'retail': { icon: '🛒', label: 'Varejo', color: 'bg-blue-100 text-blue-800' },
            'wholesale': { icon: '💰', label: 'Atacado', color: 'bg-green-100 text-green-800' },
            'resale': { icon: '💰💰', label: 'Revenda', color: 'bg-purple-100 text-purple-800' },
            'ADMIN': { icon: '⚙️', label: 'Admin', color: 'bg-red-100 text-red-800' }
        };

        const badge = badges[customer.customer_type as keyof typeof badges];
        if (!badge) return null;

        return (
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${badge.color}`}>
                <span>{badge.icon}</span>
                {badge.label}
            </span>
        );
    };

    const getStoreAgeBadge = () => {
        if (!themeSettings.data_abertura) return null;

        // Formato da string de data_abertura vinda da Receita Brasileira costuma ser "DD/MM/YYYY" ou "YYYY-MM-DD"
        let year = null;

        if (themeSettings.data_abertura.includes('/')) {
            const parts = themeSettings.data_abertura.split('/');
            if (parts.length === 3) year = parseInt(parts[2], 10);
        } else if (themeSettings.data_abertura.includes('-')) {
            const parts = themeSettings.data_abertura.split('-');
            if (parts.length >= 1) year = parseInt(parts[0], 10);
        }

        if (!year || isNaN(year)) return null;

        const currentYear = new Date().getFullYear();
        const age = currentYear - year;

        if (age <= 0) return null;

        return (
            <div className="flex flex-col justify-center border-l border-slate-200 pl-4 ml-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Desde {year}</span>
                <span className="text-sm font-semibold text-slate-700 leading-tight mt-0.5">{age} {age === 1 ? 'Ano' : 'Anos'}</span>
            </div>
        );
    };

    return (
        <>
        <header className="sticky top-0 z-50 bg-white shadow-md border-b border-slate-200">
            <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
                {/* Logo */}
                <div className="flex items-center gap-2">
                    <Link
                        to="/"
                        className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer"
                        title="Ir para o catalogo"
                        aria-label="Ir para o catalogo"
                    >
                        {themeSettings.logo_main ? (
                            <img
                                src={themeSettings.logo_main}
                                alt={themeSettings.company_name}
                                width={112}
                                height={40}
                                className="h-10 w-[112px] object-contain"
                            />
                        ) : (
                            <>
                                <ShoppingBag className="text-blue-600" size={32} />
                                <h1 className="text-2xl font-bold text-slate-800">{themeSettings.company_name}</h1>
                            </>
                        )}
                    </Link>
                    {/* Badge anos — só no desktop */}
                    <div className="hidden sm:flex">{getStoreAgeBadge()}</div>
                    {/* Clima — só no desktop */}
                    <div className="hidden sm:flex">
                        <WeatherWidget
                            defaultCity={themeSettings.address_city}
                            defaultState={themeSettings.address_state}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <StoreStatusBadge />

                    {/* Promoções — só no desktop */}
                    <Link
                        to="/promocoes"
                        className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-sm font-bold text-white rounded-full transition-all hover:scale-105 hover:shadow-lg active:scale-95"
                        style={{ background: 'linear-gradient(135deg, #f97316, #ef4444)' }}
                        title="Ver Promoções e Vantagens"
                    >
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                        </span>
                        <span>🔥 Promoções</span>
                    </Link>

                    {user && customer ? (
                        <>
                            {/* Customer Type Badge */}
                            {getCustomerTypeBadge()}

                            {/* Admin: Customer Type Selector for Preview */}
                            {customer?.customer_type === 'ADMIN' && (
                                <div className="relative">
                                    <select
                                        className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-700 font-medium hover:bg-slate-50 transition-colors cursor-pointer"
                                        value={customer.admin_preview_type || 'retail'}
                                        onChange={async (e) => {
                                            const newPreviewType = e.target.value as 'retail' | 'resale' | 'wholesale';
                                            console.log('[PublicHeader] Preview type changing to', newPreviewType);
                                            
                                            // Call the context function which handles optimistic update + localStorage
                                            if (setAdminPreviewType) {
                                                await setAdminPreviewType(newPreviewType);
                                            }
                                        }}
                                        title="Visualizar catálogo como..."
                                    >
                                        <option value="retail">👁️ Ver como Varejo</option>
                                        <option value="resale">👁️ Ver como Revenda</option>
                                        <option value="wholesale">👁️ Ver como Atacado</option>
                                    </select>
                                </div>
                            )}

                            {/* User Menu */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowUserMenu(!showUserMenu)}
                                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 rounded-full transition-colors border border-slate-300 shadow-sm"
                                >
                                    {customer.avatar_url ? (
                                        <img 
                                            src={customer.avatar_url} 
                                            alt="Avatar" 
                                            className="w-7 h-7 rounded-full object-cover border border-slate-200"
                                        />
                                    ) : (
                                        <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
                                            <User size={16} />
                                        </div>
                                    )}
                                    <span className="font-medium pr-1">{customer.name.split(' ')[0] || user.email?.split('@')[0]}</span>
                                    <ChevronDown size={14} className="text-slate-400" />
                                </button>

                                {showUserMenu && (
                                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-slate-200 py-2">
                                        <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-3">
                                            {customer.avatar_url ? (
                                                <img 
                                                    src={customer.avatar_url} 
                                                    alt="Avatar" 
                                                    className="w-10 h-10 rounded-full object-cover border border-slate-200"
                                                />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                                                    <User size={20} />
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-slate-800 truncate">{customer.name}</p>
                                                <p className="text-xs text-slate-500 truncate">{user.email}</p>
                                            </div>
                                        </div>

                                        {customer?.customer_type === 'ADMIN' && (
                                            <Link
                                                to="/admin"
                                                className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                                                onClick={() => setShowUserMenu(false)}
                                            >
                                                <Shield size={16} />
                                                Painel Admin
                                            </Link>
                                        )}

                                        {/* Favoritos — só para clientes não-admin */}
                                        {customer?.customer_type !== 'ADMIN' && (
                                            <Link
                                                to="/favoritos"
                                                className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                                                onClick={() => setShowUserMenu(false)}
                                            >
                                                <Heart size={16} className="text-red-500" />
                                                Meus Favoritos
                                            </Link>
                                        )}

                                        <Link
                                            to="/perfil?tab=history"
                                            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                                            onClick={() => setShowUserMenu(false)}
                                        >
                                            <ShoppingBag size={16} />
                                            Meus Pedidos
                                        </Link>

                                        <Link
                                            to="/perfil"
                                            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                                            onClick={() => setShowUserMenu(false)}
                                        >
                                            <User size={16} />
                                            Meu Perfil
                                        </Link>

                                        <button
                                            onClick={handleLogout}
                                            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                        >
                                            <LogOut size={16} />
                                            Sair
                                        </button>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Auth Dropdown (Entrar + Cadastrar unificados) */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowLoginDropdown(!showLoginDropdown)}
                                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                                >
                                    <User size={16} />
                                    <span className="hidden sm:inline">Entrar / Cadastrar</span>
                                    <ChevronDown size={16} />
                                </button>

                                {showLoginDropdown && (
                                    <div className="absolute right-0 mt-2 w-52 bg-white rounded-lg shadow-lg border border-slate-200 py-2">
                                        <Link
                                            to="/cliente/login"
                                            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                                            onClick={() => setShowLoginDropdown(false)}
                                        >
                                            <User size={16} />
                                            Entrar como Cliente
                                        </Link>
                                        <Link
                                            to="/admin/login"
                                            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                                            onClick={() => setShowLoginDropdown(false)}
                                        >
                                            <Shield size={16} />
                                            Entrar como Admin
                                        </Link>
                                        <div className="border-t border-slate-200 my-1" />
                                        <Link
                                            to="/cliente/login?tab=register"
                                            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50"
                                            onClick={() => setShowLoginDropdown(false)}
                                        >
                                            ➕ Cadastrar
                                        </Link>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Segunda linha — só no mobile, some ao rolar */}
            <div
                className="sm:hidden overflow-hidden transition-all duration-300 ease-in-out border-t border-slate-100"
                style={{ maxHeight: scrolled ? '0px' : '48px', opacity: scrolled ? 0 : 1 }}
            >
                <div className="max-w-7xl mx-auto px-4 py-1.5 flex items-center gap-3">
                    <WeatherWidget
                        defaultCity={themeSettings.address_city}
                        defaultState={themeSettings.address_state}
                    />
                    {getStoreAgeBadge()}
                </div>
            </div>
        </header>

        {/* Banner de Entrega Expressa — visível abaixo do header apenas para clientes locais */}
        <FastDeliveryBadge className="max-w-7xl mx-auto px-4 pt-3" />
        </>
    );
};
