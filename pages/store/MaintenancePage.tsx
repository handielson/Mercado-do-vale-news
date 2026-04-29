import React, { useEffect, useState } from 'react';
import { MapPin, Instagram, Phone, Info } from 'lucide-react';
import { Company } from '../../types/company';
import {
    matchesPublicMaintenanceBypass,
    publicCompanySettingsService,
    publicCompanySettingsToCompany,
} from '../../services/publicCompanySettings';

interface MaintenancePageProps {
    onBypassComplete?: () => void;
}

export const MaintenancePage: React.FC<MaintenancePageProps> = ({ onBypassComplete }) => {
    const [company, setCompany] = useState<Company | null>(null);

    // Escuta se o usuário tentou injetar a tag VIP na URL para liberar a loja
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const adminKey = urlParams.get('admin');

        const checkBypass = async () => {
            const settings = await publicCompanySettingsService.get();
            const dbCompany = publicCompanySettingsToCompany(settings);
            setCompany(dbCompany);

            if (adminKey && await matchesPublicMaintenanceBypass(settings, adminKey)) {
                // Salva nos Cookies do PC do administrador que ele tem passagem livre
                localStorage.setItem('@MercadoDoVale:maintenance_bypass', adminKey);

                if (onBypassComplete) {
                    onBypassComplete(); // recarrega rotas do index.tsx
                } else {
                    window.location.href = '/catalog';
                }
            }
        };

        checkBypass();
    }, [onBypassComplete]);

    if (!company) return null;

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 relative overflow-hidden">

            {/* Background Decorativo */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-3xl mix-blend-multiply" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-3xl mix-blend-multiply" />

            <div className="max-w-xl w-full bg-white rounded-3xl shadow-xl border border-slate-100 p-8 md:p-12 text-center relative z-10 animate-in fade-in zoom-in-95 duration-700">

                {/* Logo da Loja */}
                {company.logo ? (
                    <img src={company.logo} alt={company.name} className="h-20 mx-auto mb-8 object-contain" />
                ) : (
                    <div className="h-20 w-20 bg-blue-600 rounded-2xl mx-auto mb-8 flex items-center justify-center text-white font-bold text-3xl shadow-lg">
                        {company.name.charAt(0)}
                    </div>
                )}

                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 text-blue-700 font-semibold text-sm mb-6 border border-blue-100">
                    <Info size={16} />
                    <span>Voltamos em Breve</span>
                </div>

                <h1 className="text-3xl md:text-4xl font-extrabold text-slate-800 mb-4 tracking-tight">
                    Estamos em Manutenção
                </h1>

                <p className="text-slate-600 text-lg md:text-xl leading-relaxed mb-10">
                    {company.maintenanceMessage || 'Nossa loja virtual está passando por melhorias para atender você cada vez melhor.'}
                </p>

                {/* Informações de Contato Físicas da Loja */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8 pb-8 border-b border-slate-100">

                    {company.phone && (
                        <a
                            href={`https://wa.me/55${company.phone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-center gap-3 p-4 rounded-2xl bg-slate-50 hover:bg-green-50 hover:text-green-700 hover:border-green-200 border border-slate-100 text-slate-700 font-medium transition-all group"
                        >
                            <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center group-hover:text-green-600">
                                <Phone size={18} />
                            </div>
                            <span>WhatsApp Store</span>
                        </a>
                    )}

                    {company.socialMedia?.instagram && (
                        <a
                            href={company.socialMedia.instagram.includes('http') ? company.socialMedia.instagram : `https://instagram.com/${company.socialMedia.instagram.replace('@', '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-center gap-3 p-4 rounded-2xl bg-slate-50 hover:bg-pink-50 hover:text-pink-700 hover:border-pink-200 border border-slate-100 text-slate-700 font-medium transition-all group"
                        >
                            <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center group-hover:text-pink-600">
                                <Instagram size={18} />
                            </div>
                            <span>Instagram</span>
                        </a>
                    )}
                </div>

                {/* Endereço Físico */}
                {(company.address.street) && (
                    <div className="mt-8">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Visite nossa Loja Física</h3>
                        <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${company.name} ${company.address.street} ${company.address.number} ${company.address.city}`)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-3 p-4 rounded-2xl bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors w-full text-left"
                        >
                            <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center flex-shrink-0 text-blue-600">
                                <MapPin size={22} />
                            </div>
                            <div className="flex-1">
                                <p className="font-bold">{company.address.street}, {company.address.number}</p>
                                <p className="text-sm opacity-80">{company.address.neighborhood} - {company.address.city}</p>
                            </div>
                        </a>
                    </div>
                )}

            </div>

            {/* Texto de Rodapé */}
            <p className="mt-12 text-slate-400 text-sm animate-pulse text-center w-full max-w-sm">
                A equipe do Mercado do Vale está trabalhando nos bastidores.
            </p>
        </div>
    );
};
