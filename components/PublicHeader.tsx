import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, User, LogOut, ChevronDown, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

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
    const { user, customer, isAdmin, logout } = useAuth();
    const navigate = useNavigate();
    const [showLoginDropdown, setShowLoginDropdown] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);

    const handleLogout = async () => {
        await logout();
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

    return (
        <header className="sticky top-0 z-50 bg-white shadow-md border-b border-slate-200">
            <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
                {/* Logo */}
                <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                    <ShoppingBag className="text-blue-600" size={32} />
                    <h1 className="text-2xl font-bold text-slate-800">Mercado do Vale</h1>
                </Link>

                {/* Right Side */}
                <div className="flex items-center gap-4">
                    {user && customer ? (
                        <>
                            {/* Customer Type Badge */}
                            {getCustomerTypeBadge()}

                            {/* User Menu */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowUserMenu(!showUserMenu)}
                                    className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg transition-colors border border-slate-300"
                                >
                                    <User size={18} />
                                    <span className="font-medium">{customer.name || user.email}</span>
                                    <ChevronDown size={16} />
                                </button>

                                {showUserMenu && (
                                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-slate-200 py-2">
                                        <div className="px-4 py-2 border-b border-slate-200">
                                            <p className="text-sm font-semibold text-slate-800">{customer.name}</p>
                                            <p className="text-xs text-slate-500">{user.email}</p>
                                        </div>

                                        {isAdmin && (
                                            <Link
                                                to="/admin"
                                                className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                                                onClick={() => setShowUserMenu(false)}
                                            >
                                                <Shield size={16} />
                                                Painel Admin
                                            </Link>
                                        )}

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
                            {/* Login Dropdown */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowLoginDropdown(!showLoginDropdown)}
                                    className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg transition-colors border border-slate-300"
                                >
                                    Entrar
                                    <ChevronDown size={16} />
                                </button>

                                {showLoginDropdown && (
                                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-2">
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
                                    </div>
                                )}
                            </div>

                            {/* Register Button */}
                            <Link
                                to="/cliente/login?tab=register"
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                            >
                                Cadastrar
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
};
