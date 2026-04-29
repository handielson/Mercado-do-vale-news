import React, { useEffect, useState } from 'react';
import { Store, ShieldCheck, MapPin, Building2 } from 'lucide-react';
import { getPublicCompanyData } from '../../services/publicCompanySettings';
import { Company } from '../../types/company';

export const AboutUsPage: React.FC = () => {
    const [company, setCompany] = useState<Company | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        getPublicCompanyData()
            .then(setCompany)
            .catch(() => setCompany(null))
            .finally(() => setIsLoading(false));
    }, []);

    if (isLoading) {
        return (
            <main className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </main>
        );
    }

    if (!company) return null;

    const formatText = (text?: string) => {
        if (!text) return null;
        return text.split('\n').map((paragraph, index) => (
            <p key={index} className="mb-4 text-slate-700 leading-relaxed text-lg">
                {paragraph}
            </p>
        ));
    };

    return (
        <main className="min-h-screen bg-slate-50 pb-20">
            {/* Hero Section */}
            <div className="bg-white border-b border-slate-200">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
                    <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
                        Quem Somos
                    </h1>
                    <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto">
                        Conheça um pouco mais sobre a nossa história e o que nos move todos os dias.
                    </p>
                </div>
            </div>

            {/* Content Section */}
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

                {/* Imagem de Destaque */}
                {company.aboutUsImageUrl && (
                    <div className="mb-12 rounded-2xl overflow-hidden shadow-lg border border-slate-100 aspect-video w-full bg-slate-100">
                        <img
                            src={company.aboutUsImageUrl}
                            alt={`Fachada / Equipe da ${company.name}`}
                            className="w-full h-full object-cover"
                        />
                    </div>
                )}

                <div className="bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-slate-200">

                    {/* Texto da História */}
                    <div className="prose prose-blue max-w-none">
                        {company.aboutUsText ? (
                            formatText(company.aboutUsText)
                        ) : (
                            <div className="text-center py-10">
                                <Building2 size={48} className="mx-auto text-slate-300 mb-4" />
                                <p className="text-slate-500 text-lg">
                                    A história da nossa empresa está sendo escrita. Em breve, novidades por aqui!
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Quick Infos Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12 bg-slate-50 rounded-2xl p-8 border border-slate-100">

                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                                <Store size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 mb-1">Loja de Confiança</h3>
                                {company.dataAbertura && (
                                    <p className="text-sm text-slate-600">Fundada em {company.dataAbertura}</p>
                                )}
                                {company.cnpj && (
                                    <p className="text-sm text-slate-600 font-medium">CNPJ: {company.cnpj}</p>
                                )}
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0">
                                <ShieldCheck size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 mb-1">Transparência</h3>
                                <p className="text-sm text-slate-600">Compra segura e atendimento especializado.</p>
                            </div>
                        </div>

                        {company.address?.city && (
                            <div className="flex items-start gap-4 md:col-span-2">
                                <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                                    <MapPin size={24} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 mb-1">Nossa Localização</h3>
                                    <p className="text-sm text-slate-600">
                                        {company.address.street}, {company.address.number} — {company.address.city} / {company.address.state}
                                    </p>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </main>
    );
};
