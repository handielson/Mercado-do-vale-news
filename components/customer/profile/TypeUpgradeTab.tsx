import React, { useState, useEffect } from 'react';
import { TrendingUp, CheckCircle, Clock, XCircle, Loader2 } from 'lucide-react';
import { useSupabaseAuth } from '../../../hooks/useSupabaseAuth';
import type { TypeUpgradeRequest } from '../../../types/typeUpgradeRequest';
import { toast } from 'sonner';

/**
 * Type Upgrade Tab Component
 * 
 * Shows customer type and allows upgrade requests
 * Max 300 lines (ANTIGRAVITY protocol)
 */
export const TypeUpgradeTab: React.FC = () => {
    const { customer, requestTypeUpgrade, getUpgradeRequestStatus } = useSupabaseAuth();
    const [upgradeRequest, setUpgradeRequest] = useState<TypeUpgradeRequest | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        loadUpgradeRequest();
    }, []);

    const loadUpgradeRequest = async () => {
        setLoading(true);
        try {
            const request = await getUpgradeRequestStatus();
            setUpgradeRequest(request);
        } catch (error) {
            console.error('Error loading upgrade request:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRequestUpgrade = async (type: 'wholesale' | 'resale') => {
        setSubmitting(true);
        try {
            const request = await requestTypeUpgrade(type);
            setUpgradeRequest(request);
        } catch (error) {
            // Error already handled in context
        } finally {
            setSubmitting(false);
        }
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'retail': return 'Varejo';
            case 'wholesale': return 'Atacado';
            case 'resale': return 'Revenda';
            default: return type;
        }
    };

    const getTypeBadgeColor = (type: string) => {
        switch (type) {
            case 'retail': return 'bg-blue-100 text-blue-800';
            case 'wholesale': return 'bg-green-100 text-green-800';
            case 'resale': return 'bg-purple-100 text-purple-800';
            default: return 'bg-slate-100 text-slate-800';
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin text-blue-600" size={32} />
            </div>
        );
    }

    return (
        <div className="max-w-2xl">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Tipo de Conta</h2>
            <p className="text-slate-600 mb-6">
                Gerencie o tipo da sua conta e solicite upgrades
            </p>

            {/* Current Type */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <p className="text-sm font-medium text-slate-600 mb-1">Tipo Atual</p>
                        <span className={`inline-block px-4 py-2 rounded-full text-lg font-semibold ${getTypeBadgeColor(customer?.customer_type || 'retail')}`}>
                            {getTypeLabel(customer?.customer_type || 'retail')}
                        </span>
                    </div>
                    {customer?.customer_type === 'retail' && (
                        <TrendingUp className="text-slate-400" size={48} />
                    )}
                    {customer?.customer_type === 'wholesale' && (
                        <CheckCircle className="text-green-600" size={48} />
                    )}
                    {customer?.customer_type === 'resale' && (
                        <CheckCircle className="text-purple-600" size={48} />
                    )}
                </div>

                {customer?.customer_type === 'retail' && (
                    <p className="text-sm text-slate-600">
                        Você tem acesso aos preços de varejo. Solicite upgrade para atacado ou revenda para ter acesso a preços especiais.
                    </p>
                )}
                {customer?.customer_type === 'wholesale' && (
                    <p className="text-sm text-slate-600">
                        ✓ Você tem acesso aos preços de atacado.
                    </p>
                )}
                {customer?.customer_type === 'resale' && (
                    <p className="text-sm text-slate-600">
                        ✓ Você tem acesso aos preços de revenda.
                    </p>
                )}
            </div>

            {/* Pending Request */}
            {upgradeRequest && upgradeRequest.status === 'pending' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3 mb-6">
                    <Clock className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
                    <div>
                        <p className="font-semibold text-blue-900 mb-1">Solicitação Pendente</p>
                        <p className="text-sm text-blue-800">
                            Sua solicitação de upgrade para <strong>{getTypeLabel(upgradeRequest.requested_type)}</strong> está em análise.
                        </p>
                        <p className="text-xs text-blue-700 mt-1">
                            Solicitado em: {formatDate(upgradeRequest.requested_at)}
                        </p>
                    </div>
                </div>
            )}

            {/* Rejected Request */}
            {upgradeRequest && upgradeRequest.status === 'rejected' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                    <div className="flex items-start gap-3 mb-3">
                        <XCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
                        <div>
                            <p className="font-semibold text-red-900 mb-1">Solicitação Rejeitada</p>
                            <p className="text-sm text-red-800 mb-2">
                                Sua solicitação de upgrade para <strong>{getTypeLabel(upgradeRequest.requested_type)}</strong> foi rejeitada.
                            </p>
                            {upgradeRequest.rejection_reason && (
                                <p className="text-sm text-red-800">
                                    <strong>Motivo:</strong> {upgradeRequest.rejection_reason}
                                </p>
                            )}
                            <p className="text-xs text-red-700 mt-1">
                                Rejeitado em: {upgradeRequest.reviewed_at ? formatDate(upgradeRequest.reviewed_at) : 'N/A'}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Upgrade Request Section */}
            {customer?.customer_type === 'retail' && (!upgradeRequest || upgradeRequest.status === 'rejected') && (
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-slate-900">
                        {upgradeRequest?.status === 'rejected' ? 'Solicitar Novamente' : 'Solicitar Upgrade'}
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Wholesale Card */}
                        <div className="border-2 border-slate-200 rounded-lg p-4 hover:border-green-500 transition-colors">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                                    <TrendingUp className="text-green-600" size={20} />
                                </div>
                                <h4 className="font-semibold text-slate-900">Atacado</h4>
                            </div>
                            <p className="text-sm text-slate-600 mb-4">
                                Preços especiais para compras em quantidade
                            </p>
                            <button
                                onClick={() => handleRequestUpgrade('wholesale')}
                                disabled={submitting}
                                className="w-full bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 className="animate-spin" size={16} />
                                        Enviando...
                                    </>
                                ) : (
                                    'Solicitar Atacado'
                                )}
                            </button>
                        </div>

                        {/* Resale Card */}
                        <div className="border-2 border-slate-200 rounded-lg p-4 hover:border-purple-500 transition-colors">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                                    <TrendingUp className="text-purple-600" size={20} />
                                </div>
                                <h4 className="font-semibold text-slate-900">Revenda</h4>
                            </div>
                            <p className="text-sm text-slate-600 mb-4">
                                Melhores preços para revendedores
                            </p>
                            <button
                                onClick={() => handleRequestUpgrade('resale')}
                                disabled={submitting}
                                className="w-full bg-purple-600 text-white py-2 rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 className="animate-spin" size={16} />
                                        Enviando...
                                    </>
                                ) : (
                                    'Solicitar Revenda'
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <p className="text-sm text-yellow-800">
                            <strong>Atenção:</strong> Sua solicitação será analisada por nossa equipe. Você receberá uma resposta em até 48 horas.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};
