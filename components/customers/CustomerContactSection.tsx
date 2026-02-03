import React from 'react';
import { Mail, MessageCircle, Instagram, Facebook } from 'lucide-react';
import { CustomerInput } from '../../types/customer';
import { formatPhone } from '../../utils/cpfCnpjValidation';
import { getWhatsAppUrl as getWhatsAppUrlUtil } from '../../utils/customerFormUtils';

interface CustomerContactSectionProps {
    formData: CustomerInput;
    onFieldUpdate: (field: string, value: any) => void;
}

export default function CustomerContactSection({
    formData,
    onFieldUpdate
}: CustomerContactSectionProps) {

    // Get WhatsApp URL
    const getWhatsAppUrl = () => getWhatsAppUrlUtil(formData.phone || '', formData.name);

    // Get Instagram URL
    const getInstagramUrl = () => {
        if (!formData.instagram) return null;
        const username = formData.instagram.replace(/[@\\s]/g, '');
        if (!username) return null;
        return `https://www.instagram.com/${username}`;
    };

    // Get Facebook URL
    const getFacebookUrl = () => {
        if (!formData.facebook) return null;
        const username = formData.facebook.replace(/[@\\s]/g, '');
        if (!username) return null;
        return `https://www.facebook.com/${username}`;
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4">
                <Mail className="w-5 h-5 text-slate-600" />
                <h2 className="text-lg font-semibold text-slate-900">Contato</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Email
                    </label>
                    <input
                        type="email"
                        value={formData.email || ''}
                        onChange={(e) => onFieldUpdate('email', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="email@exemplo.com"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Telefone
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="tel"
                            value={formData.phone || ''}
                            onChange={(e) => {
                                // Permitir apenas números, parênteses, espaços e hífens
                                const value = e.target.value.replace(/[^\d\s()-]/g, '');
                                onFieldUpdate('phone', value);
                            }}
                            onBlur={(e) => onFieldUpdate('phone', formatPhone(e.target.value))}
                            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="(00) 00000-0000"
                            maxLength={15}
                        />
                        {getWhatsAppUrl() && (
                            <a
                                href={getWhatsAppUrl()!}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                                title="Abrir WhatsApp"
                            >
                                <MessageCircle className="w-5 h-5" />
                            </a>
                        )}
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Instagram
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={formData.instagram || ''}
                            onChange={(e) => onFieldUpdate('instagram', e.target.value)}
                            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="@usuario ou usuario"
                        />
                        {getInstagramUrl() && (
                            <a
                                href={getInstagramUrl()!}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center px-3 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-colors"
                                title="Abrir Instagram"
                            >
                                <Instagram className="w-5 h-5" />
                            </a>
                        )}
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Facebook
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={formData.facebook || ''}
                            onChange={(e) => onFieldUpdate('facebook', e.target.value)}
                            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="@usuario ou usuario"
                        />
                        {getFacebookUrl() && (
                            <a
                                href={getFacebookUrl()!}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                title="Abrir Facebook"
                            >
                                <Facebook className="w-5 h-5" />
                            </a>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
