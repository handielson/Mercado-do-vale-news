import React from 'react';
import { Link } from 'react-router-dom';

interface AuthLayoutProps {
    children: React.ReactNode;
    title: string;
    subtitle?: string;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children, title, subtitle }) => {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-slate-50 p-6">
            <div className="w-full max-w-md">
                {/* Header */}
                <div className="text-center mb-8">
                    <Link to="/" className="inline-block">
                        <h1 className="text-3xl font-bold text-slate-900 mb-2">
                            Mercado do Vale
                        </h1>
                    </Link>
                    {subtitle && (
                        <p className="text-slate-600 text-sm">
                            {subtitle}
                        </p>
                    )}
                </div>

                {/* Card */}
                <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                    <div className="p-8 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                        <h2 className="text-2xl font-bold">{title}</h2>
                    </div>

                    <div className="p-8">
                        {children}
                    </div>
                </div>

                {/* Footer */}
                <div className="text-center mt-6 text-sm text-slate-500">
                    <p>© 2026 Mercado do Vale. Todos os direitos reservados.</p>
                </div>
            </div>
        </div>
    );
};
