import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Copy, QrCode, Share2, Check } from 'lucide-react';
import { Company } from '../types/company';

interface SharePaymentDataModalProps {
    isOpen: boolean;
    onClose: () => void;
    companyData: Company;
}

export const SharePaymentDataModal: React.FC<SharePaymentDataModalProps> = ({
    isOpen,
    onClose,
    companyData
}) => {
    const [copied, setCopied] = useState(false);
    const [activeTab, setActiveTab] = useState<'text' | 'qrcode'>('text');

    if (!isOpen) return null;

    // Formatar dados para compartilhamento
    const formatPaymentData = (): string => {
        const lines = [
            '📋 DADOS PARA PAGAMENTO',
            '',
            `🏢 Empresa: ${companyData.name}`,
            ''
        ];

        // Dados PIX
        if (companyData.pixKey) {
            lines.push('💳 PIX');
            lines.push(`Chave: ${companyData.pixKey}`);
            if (companyData.pixKeyType) {
                lines.push(`Tipo: ${companyData.pixKeyType}`);
            }
            if (companyData.pixBeneficiaryName) {
                lines.push(`Beneficiário: ${companyData.pixBeneficiaryName}`);
            }
            lines.push('');
        }

        // Dados Bancários
        if (companyData.bankName || companyData.bankAgency || companyData.bankAccount) {
            lines.push('🏦 DADOS BANCÁRIOS');
            if (companyData.bankName) lines.push(`Banco: ${companyData.bankName}`);
            if (companyData.bankAgency) lines.push(`Agência: ${companyData.bankAgency}`);
            if (companyData.bankAccount) lines.push(`Conta: ${companyData.bankAccount}`);
            if (companyData.pixBeneficiaryName) lines.push(`Titular: ${companyData.pixBeneficiaryName}`);
        }

        return lines.join('\n');
    };

    // Copiar para área de transferência
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(formatPaymentData());
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Erro ao copiar:', error);
        }
    };

    // Compartilhar via WhatsApp
    const handleWhatsApp = () => {
        const text = encodeURIComponent(formatPaymentData());
        window.open(`https://wa.me/?text=${text}`, '_blank');
    };

    // Compartilhar via Email
    const handleEmail = () => {
        const subject = encodeURIComponent(`Dados de Pagamento - ${companyData.name}`);
        const body = encodeURIComponent(formatPaymentData());
        window.open(`mailto:?subject=${subject}&body=${body}`);
    };

    // Gerar string PIX Copia e Cola (formato simplificado)
    const generatePixString = (): string => {
        if (!companyData.pixKey) return '';

        // Formato simplificado - apenas a chave PIX
        // Em produção, você pode usar uma biblioteca para gerar o formato EMV completo
        return companyData.pixKey;
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <h2 className="text-xl font-semibold text-gray-900">
                        Compartilhar Dados de Pagamento
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b">
                    <button
                        onClick={() => setActiveTab('text')}
                        className={`flex-1 px-6 py-3 font-medium transition-colors ${activeTab === 'text'
                                ? 'text-blue-600 border-b-2 border-blue-600'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <Copy size={18} />
                            Dados em Texto
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('qrcode')}
                        className={`flex-1 px-6 py-3 font-medium transition-colors ${activeTab === 'qrcode'
                                ? 'text-blue-600 border-b-2 border-blue-600'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                        disabled={!companyData.pixKey}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <QrCode size={18} />
                            QR Code PIX
                        </div>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {activeTab === 'text' ? (
                        <div className="space-y-4">
                            {/* Texto formatado */}
                            <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm whitespace-pre-wrap">
                                {formatPaymentData()}
                            </div>

                            {/* Botão Copiar */}
                            <button
                                onClick={handleCopy}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                            >
                                {copied ? (
                                    <>
                                        <Check size={20} />
                                        Copiado!
                                    </>
                                ) : (
                                    <>
                                        <Copy size={20} />
                                        Copiar Dados
                                    </>
                                )}
                            </button>

                            {/* Botões de Compartilhamento */}
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={handleWhatsApp}
                                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                                >
                                    <Share2 size={18} />
                                    WhatsApp
                                </button>
                                <button
                                    onClick={handleEmail}
                                    className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                                >
                                    <Share2 size={18} />
                                    Email
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {companyData.pixKey ? (
                                <>
                                    {/* QR Code */}
                                    <div className="flex justify-center bg-white p-6 rounded-lg border-2 border-gray-200">
                                        <QRCodeSVG
                                            value={generatePixString()}
                                            size={256}
                                            level="H"
                                            includeMargin={true}
                                        />
                                    </div>

                                    {/* Informações */}
                                    <div className="text-center text-sm text-gray-600">
                                        <p className="font-medium">Escaneie o QR Code para pagar via PIX</p>
                                        <p className="mt-2">Chave: {companyData.pixKey}</p>
                                        {companyData.pixBeneficiaryName && (
                                            <p>Beneficiário: {companyData.pixBeneficiaryName}</p>
                                        )}
                                    </div>

                                    {/* Copiar chave PIX */}
                                    <button
                                        onClick={async () => {
                                            await navigator.clipboard.writeText(companyData.pixKey || '');
                                            setCopied(true);
                                            setTimeout(() => setCopied(false), 2000);
                                        }}
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                                    >
                                        {copied ? (
                                            <>
                                                <Check size={20} />
                                                Chave Copiada!
                                            </>
                                        ) : (
                                            <>
                                                <Copy size={20} />
                                                Copiar Chave PIX
                                            </>
                                        )}
                                    </button>
                                </>
                            ) : (
                                <div className="text-center text-gray-500 py-8">
                                    <QrCode size={48} className="mx-auto mb-4 opacity-50" />
                                    <p>Nenhuma chave PIX cadastrada</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
