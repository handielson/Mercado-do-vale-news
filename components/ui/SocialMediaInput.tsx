import React, { useState } from 'react';
import { ExternalLink, Copy, Check } from 'lucide-react';
import { copyToClipboard } from '../../utils/socialMediaHelpers';

interface SocialMediaInputProps {
    label: string;
    icon: React.ReactNode;
    iconColor: string;
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    formatUrl: (value: string) => string;
}

export const SocialMediaInput: React.FC<SocialMediaInputProps> = ({
    label,
    icon,
    iconColor,
    value,
    onChange,
    placeholder,
    formatUrl
}) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        const formattedUrl = formatUrl(value);
        const success = await copyToClipboard(formattedUrl);

        if (success) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleOpenLink = () => {
        const formattedUrl = formatUrl(value);
        if (formattedUrl) {
            window.open(formattedUrl, '_blank', 'noopener,noreferrer');
        }
    };

    const formattedUrl = value ? formatUrl(value) : '';

    return (
        <div className="mb-4">
            <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <span className={iconColor}>
                    {icon}
                </span>
                {label}
            </label>

            <div className="flex gap-2">
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="flex-1 border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />

                {/* Botão de acesso direto */}
                <button
                    type="button"
                    onClick={handleOpenLink}
                    disabled={!value}
                    className={`p-2.5 rounded-lg transition-all ${value
                            ? `${iconColor.replace('text-', 'bg-').replace('-600', '-100')} ${iconColor} hover:${iconColor.replace('text-', 'bg-').replace('-600', '-200')}`
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        }`}
                    title="Abrir link"
                >
                    <ExternalLink size={20} />
                </button>

                {/* Botão de copiar */}
                <button
                    type="button"
                    onClick={handleCopy}
                    disabled={!value}
                    className={`p-2.5 rounded-lg transition-all ${value
                            ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        }`}
                    title="Copiar link"
                >
                    {copied ? (
                        <Check size={20} className="text-green-600" />
                    ) : (
                        <Copy size={20} />
                    )}
                </button>
            </div>

            {/* Preview do link formatado */}
            {value && formattedUrl && (
                <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1">
                    <span className="font-medium">Link:</span>
                    <span className="truncate">{formattedUrl}</span>
                </p>
            )}
        </div>
    );
};
