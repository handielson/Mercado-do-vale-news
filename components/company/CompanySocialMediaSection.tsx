/**
 * CompanySocialMediaSection Component
 * 
 * Handles company social media links
 * 
 * Route: Settings → Company Data → Social Media Section
 */

import React from 'react';
import { Globe, Instagram, Facebook, Youtube, Star } from 'lucide-react';
import { Company } from '../../types/company';
import { SocialMediaInput } from '../ui/SocialMediaInput';

interface CompanySocialMediaSectionProps {
    form: Company;
    onChange: (updates: Partial<Company>) => void;
}

export const CompanySocialMediaSection: React.FC<CompanySocialMediaSectionProps> = ({
    form,
    onChange
}) => {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="flex items-center gap-2 font-bold text-slate-800 text-lg mb-6 pb-3 border-b">
                <Globe size={22} className="text-blue-600" />
                Presença Digital
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SocialMediaInput
                    icon={Instagram}
                    label="Instagram"
                    value={form.socialMedia?.instagram || ''}
                    onChange={(value) => onChange({
                        socialMedia: { ...form.socialMedia, instagram: value }
                    })}
                    placeholder="@usuario ou link completo"
                />

                <SocialMediaInput
                    icon={Facebook}
                    label="Facebook"
                    value={form.socialMedia?.facebook || ''}
                    onChange={(value) => onChange({
                        socialMedia: { ...form.socialMedia, facebook: value }
                    })}
                    placeholder="@pagina ou link completo"
                />

                <SocialMediaInput
                    icon={Youtube}
                    label="YouTube"
                    value={form.socialMedia?.youtube || ''}
                    onChange={(value) => onChange({
                        socialMedia: { ...form.socialMedia, youtube: value }
                    })}
                    placeholder="@canal ou link completo"
                />

                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
                        <Globe size={16} />
                        Website
                    </label>
                    <input
                        type="url"
                        value={form.socialMedia?.website || ''}
                        onChange={(e) => onChange({
                            socialMedia: { ...form.socialMedia, website: e.target.value }
                        })}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        placeholder="https://seusite.com.br"
                    />
                </div>

                <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
                        <Star size={16} />
                        Link do Google Avaliações
                    </label>
                    <input
                        type="url"
                        value={form.googleReviewsLink || ''}
                        onChange={(e) => onChange({ googleReviewsLink: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        placeholder="https://g.page/..."
                    />
                    <p className="text-xs text-slate-500 mt-1">
                        Link para clientes deixarem avaliações no Google
                    </p>
                </div>
            </div>
        </div>
    );
};
