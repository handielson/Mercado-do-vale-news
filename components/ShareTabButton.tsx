import React, { useState } from 'react';
import { X, Share2, Copy, Check, Mail } from 'lucide-react';
import { FaWhatsapp, FaFacebook, FaTwitter } from 'react-icons/fa';
import { useShareUrl } from '../hooks/useShareUrl';
import { QRCodeSVG } from 'qrcode.react';

interface ShareTabButtonProps {
    url?: string;
    title?: string;
    description?: string;
    showQRCode?: boolean;
}

/**
 * Botão e modal de compartilhamento para abas
 * 
 * @example
 * <ShareTabButton 
 *   url="/produtos?categoria=celulares"
 *   title="Confira nossos celulares"
 * />
 */
export const ShareTabButton: React.FC<ShareTabButtonProps> = ({
    url,
    title = 'Compartilhar',
    description,
    showQRCode = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const { shareUrl, copyToClipboard, canUseNativeShare, nativeShare } = useShareUrl();

    const currentUrl = url || (typeof window !== 'undefined'
        ? window.location.href
        : '');

    const handleCopy = async () => {
        const success = await copyToClipboard(currentUrl);
        if (success) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleNativeShare = async () => {
        const success = await nativeShare({
            url: currentUrl,
            subject: title,
            text: description
        });

        if (success) {
            setIsOpen(false);
        }
    };

    return (
        <>
            {/* Botão de compartilhamento */}
            <button
                onClick={() => setIsOpen(true)}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                title="Compartilhar esta página"
            >
                <Share2 size={16} />
                <span className="hidden sm:inline">Compartilhar</span>
            </button>

            {/* Modal de compartilhamento */}
            {isOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b">
                            <h3 className="text-lg font-semibold text-gray-900">
                                Compartilhar
                            </h3>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-4 space-y-4">
                            {/* URL */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Link
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={currentUrl}
                                        readOnly
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
                                    />
                                    <button
                                        onClick={handleCopy}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
                                    >
                                        {copied ? (
                                            <>
                                                <Check size={16} />
                                                Copiado!
                                            </>
                                        ) : (
                                            <>
                                                <Copy size={16} />
                                                Copiar
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Botões de compartilhamento */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Compartilhar via
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {/* WhatsApp */}
                                    <button
                                        onClick={() => {
                                            shareUrl('whatsapp', { text: description });
                                            setIsOpen(false);
                                        }}
                                        className="flex items-center justify-center gap-2 px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                                    >
                                        <FaWhatsapp size={20} />
                                        WhatsApp
                                    </button>

                                    {/* Facebook */}
                                    <button
                                        onClick={() => {
                                            shareUrl('facebook');
                                            setIsOpen(false);
                                        }}
                                        className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                                    >
                                        <FaFacebook size={20} />
                                        Facebook
                                    </button>

                                    {/* Twitter */}
                                    <button
                                        onClick={() => {
                                            shareUrl('twitter', { text: description });
                                            setIsOpen(false);
                                        }}
                                        className="flex items-center justify-center gap-2 px-4 py-3 bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition-colors"
                                    >
                                        <FaTwitter size={20} />
                                        Twitter
                                    </button>

                                    {/* Email */}
                                    <button
                                        onClick={() => {
                                            shareUrl('email', { subject: title, body: description });
                                            setIsOpen(false);
                                        }}
                                        className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                                    >
                                        <Mail size={20} />
                                        Email
                                    </button>
                                </div>
                            </div>

                            {/* Native Share (mobile) */}
                            {canUseNativeShare() && (
                                <button
                                    onClick={handleNativeShare}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                                >
                                    <Share2 size={20} />
                                    Mais opções de compartilhamento
                                </button>
                            )}

                            {/* QR Code */}
                            {showQRCode && (
                                <div className="pt-4 border-t">
                                    <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
                                        QR Code
                                    </label>
                                    <div className="flex justify-center bg-white p-4 rounded-lg border">
                                        <QRCodeSVG
                                            value={currentUrl}
                                            size={200}
                                            level="H"
                                            includeMargin={true}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
