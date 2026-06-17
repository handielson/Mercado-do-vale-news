import React, { useState, useEffect } from 'react';
import { Receipt, User, Package, Truck, CreditCard, DollarSign, Smartphone } from 'lucide-react';
import { SaleItem, PaymentMethod, DeliveryType } from '../../types/sale';
import * as ReactQRCode from 'react-qr-code';
import { calculateSaleTotals, calculateTotalPaid } from '../../utils/saleCalculations';
import { companySettingsService } from '../../services/companySettingsService';
import { CompanySettings } from '../../types/companySettings';
import { capitalizeName } from '../../utils/customerFormUtils';

const QRCode = (
    (ReactQRCode as any).default?.default ||
    (ReactQRCode as any).default?.QRCode ||
    (ReactQRCode as any).QRCode ||
    (ReactQRCode as any).default
) as React.ComponentType<any>;

interface Customer {
    id: string;
    name: string;
    cpf_cnpj?: string;
    email?: string;
    phone?: string;
}

interface ReceiptPreviewProps {
    customer: Customer | undefined;
    items: SaleItem[];
    deliveryType: DeliveryType | undefined;
    deliveryCostStore: number;
    deliveryCostCustomer: number;
    payments: PaymentMethod[];
    promotionalDiscount?: number;
    finalAdjustmentDiscount?: number;
    orderNumber?: number;
    onFinalizeSale: () => void;
    isFinalizing?: boolean;
    hasPendingPixPayment?: boolean;
}

export default function ReceiptPreview({
    customer,
    items,
    deliveryType,
    deliveryCostStore,
    deliveryCostCustomer,
    payments,
    promotionalDiscount,
    finalAdjustmentDiscount,
    orderNumber,
    onFinalizeSale,
    isFinalizing = false,
    hasPendingPixPayment = false
}: ReceiptPreviewProps) {
    const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);

    // Load company settings
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const settings = await companySettingsService.get();
                if (settings) {
                    setCompanySettings(settings);
                } else {
                    // Use defaults if no settings found
                    const defaults = companySettingsService.getDefaults();
                    setCompanySettings(defaults as CompanySettings);
                }
            } catch (error) {
                console.error('Error loading company settings:', error);
                // Use defaults on error
                const defaults = companySettingsService.getDefaults();
                setCompanySettings(defaults as CompanySettings);
            }
        };
        loadSettings();
    }, []);

    const { subtotal, discount_total, total: itemsTotal } = calculateSaleTotals(items);

    // Calcular desconto de brindes (valor integral dos produtos marcados como brinde)
    const giftDiscount = items.reduce((sum, item) => {
        if (item.is_gift) {
            return sum + (item.unit_price * item.quantity);
        }
        return sum;
    }, 0);

    console.log('Gift items:', items.filter(i => i.is_gift));
    console.log('Gift discount:', giftDiscount);

    // Calcular total de juros/taxas dos pagamentos
    const totalFees = payments.reduce((sum, p) => {
        const fee = (p.fee_amount || 0);
        return sum + fee;
    }, 0);

    // Total = Subtotal - Brindes - Promoção + Entrega + Juros
    const total = itemsTotal - giftDiscount - (promotionalDiscount || 0) - (finalAdjustmentDiscount || 0) + deliveryCostCustomer + totalFees;

    // Total pago usa o mesmo calculo da secao de pagamento, incluindo juros do credito.
    const totalPaid = calculateTotalPaid(payments);

    // Troco ou falta
    const change = totalPaid - total;
    const isComplete = customer && items.length > 0 && totalPaid >= total;

    // Função para mascarar CPF (mostra apenas os últimos 3 dígitos)
    const maskCPF = (cpf: string) => {
        // Remove formatação
        const numbers = cpf.replace(/\D/g, '');
        if (numbers.length === 11) {
            // CPF: xxx.xxx.xxx-XX
            return `xxx.xxx.xx${numbers.slice(-3, -2)}-${numbers.slice(-2)}`;
        } else if (numbers.length === 14) {
            // CNPJ: xx.xxx.xxx/xxxx-XX
            return `xx.xxx.xxx/xxxx-${numbers.slice(-2)}`;
        }
        return cpf; // Retorna original se não for CPF/CNPJ válido
    };

    const formatCurrency = (value: number) => {
        return `R$ ${(value / 100).toFixed(2).replace('.', ',')}`;
    };

    const getDeliveryTypeLabel = () => {
        if (!deliveryType) return '-';
        switch (deliveryType) {
            case 'pickup':
            case 'store_pickup': return 'Retirada na Loja';
            case 'delivery':
            case 'store_delivery': return 'Entrega pela Loja';
            case 'hybrid':
            case 'hybrid_delivery': return 'Entrega Híbrida';
            default: return '-';
        }
    };

    const getPaymentMethodLabel = (method: string) => {
        switch (method) {
            case 'pix': return 'PIX';
            case 'money': return 'Dinheiro';
            case 'credit': return 'Crédito';
            case 'debit': return 'Débito';
            default: return method;
        }
    };

    const getPaymentIcon = (method: string) => {
        switch (method) {
            case 'pix': return <Smartphone size={14} className="text-cyan-600" />;
            case 'money': return <DollarSign size={14} className="text-green-600" />;
            case 'credit': return <CreditCard size={14} className="text-blue-600" />;
            case 'debit': return <CreditCard size={14} className="text-purple-600" />;
            default: return <CreditCard size={14} />;
        }
    };

    // Função para obter o max-width baseado na configuração do DB
    const getReceiptMaxWidthClass = () => {
        const width = companySettings?.receipt_width || '80mm';
        if (width === '58mm') return 'max-w-[280px]'; // Aprox 58mm legível em tela
        if (width === '100mm') return 'max-w-[500px]'; // Aprox 100mm / Impressora Larga
        return 'max-w-[400px]'; // Aprox 80mm padrão
    };

    // Replace dynamic tags for the extra page

    const getReplacedExtraPageText = () => {
        let text = companySettings?.receipt_extra_page_text || '';
        if (!text) return '';

        text = text.replace(/\{\{cliente_nome\}\}/g, customer?.name || 'Cliente Avulso');
        text = text.replace(/\{\{cliente_documento\}\}/g, customer?.cpf_cnpj || 'Não informado');
        text = text.replace(/\{\{cliente_telefone\}\}/g, customer?.phone || 'Não informado');
        text = text.replace(/\{\{cliente_email\}\}/g, customer?.email || 'Não informado');
        text = text.replace(/\{\{empresa_nome\}\}/g, companySettings?.company_name || 'MERCADO DO VALE');
        text = text.replace(/\{\{empresa_telefone\}\}/g, companySettings?.phone || 'Não informado');
        text = text.replace(/\{\{empresa_email\}\}/g, companySettings?.email || 'Não informado');
        text = text.replace(/\{\{empresa_cnpj\}\}/g, companySettings?.cnpj || 'Não informado');
        text = text.replace(/\{\{empresa_endereco\}\}/g, companySettings?.address || 'Não informado');

        const now = new Date();
        text = text.replace(/\{\{data_venda\}\}/g, now.toLocaleDateString('pt-BR'));
        text = text.replace(/\{\{hora_venda\}\}/g, now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
        text = text.replace(/\{\{numero_pedido\}\}/g, orderNumber ? String(orderNumber).padStart(7, '0') : '0000000');

        return text;
    };

    return (
        <div className="bg-white rounded-xl border-2 border-slate-200 shadow-lg sticky top-6">
            {/* Header - Padronizado com Termo de Garantia */}
            <div className="bg-white p-6 rounded-t-xl border-b-2 border-slate-300">
                {companySettings ? (
                    <div dangerouslySetInnerHTML={{
                        __html: (companySettings.default_thermal_header || companySettingsService.getDefaults().default_thermal_header || '')
                            .replace(/{{logo}}/g, companySettings.receipt_logo_url || (companySettings as any).logo
                                ? `<img src="${companySettings.receipt_logo_url || (companySettings as any).logo}" alt="Logo Empresa" style="max-height:80px; object-fit:contain; margin:0 auto;" />`
                                : `<div style="width:120px; height:60px; background:#e2e8f0; margin:0 auto; display:flex; align-items:center; justify-content:center; color:#64748b; font-size:12px;">Logo</div>`
                            )
                            .replace(/{{nome_loja}}/g, companySettings.company_name || 'Mercado do Vale')
                            .replace(/{{cnpj}}/g, companySettings.cnpj || '')
                            .replace(/{{endereco}}/g, companySettings.address || '')
                            .replace(/{{telefone}}/g, companySettings.phone || '')
                            .replace(/{{email}}/g, companySettings.email || '')
                            .replace(/{{nome_documento}}/g, 'COMPROVANTE DE VENDA')
                    }} />
                ) : (
                    <div className="animate-pulse flex flex-col items-center justify-center gap-2 w-full">
                        <div className="h-16 w-32 bg-slate-200 rounded"></div>
                        <div className="h-4 w-48 bg-slate-200 rounded mt-2"></div>
                        <div className="h-3 w-32 bg-slate-200 rounded"></div>
                    </div>
                )}

                {/* Custom Header Text */}
                {companySettings?.header_text && (
                    <div className="mt-4 pt-3 border-t border-slate-200 text-sm text-slate-600 text-center italic">
                        {companySettings.header_text}
                    </div>
                )}

                {/* Order Number */}
                {companySettings?.show_order_number && orderNumber && (
                    <div className="mt-3 pt-3 border-t border-slate-200 text-center">
                        <p className="text-xs text-slate-500">Pedido</p>
                        <p className="text-2xl font-bold text-blue-600 tracking-wider">
                            #{orderNumber.toString().padStart(7, '0')}
                        </p>
                    </div>
                )}

                {/* Timestamp */}
                {companySettings?.show_timestamp && (
                    <div className="text-xs text-slate-500 mt-2 text-center">
                        {new Date().toLocaleString('pt-BR')}
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="p-6 space-y-4 max-h-[calc(100vh-300px)] overflow-y-auto">
                {/* Cliente */}
                <div className="border-b border-slate-200 pb-4">
                    <div className="flex items-center gap-2 mb-2">
                        <User size={16} className="text-slate-600" />
                        <h3 className="font-semibold text-slate-800">Cliente</h3>
                    </div>
                    {customer ? (
                        <div className="text-sm text-slate-600 space-y-1 ml-6">
                            <p className="font-medium text-slate-800">{capitalizeName(customer.name)}</p>
                            {customer.cpf_cnpj && <p>CPF/CNPJ: {maskCPF(customer.cpf_cnpj)}</p>}
                            {customer.phone && <p>Tel: {customer.phone}</p>}
                        </div>
                    ) : (
                        <p className="text-sm text-slate-400 ml-6">Nenhum cliente selecionado</p>
                    )}
                </div>

                {/* Produtos - A */}
                <div className="border-b border-slate-200 pb-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Package size={16} className="text-slate-600" />
                        <h3 className="font-semibold text-slate-800">Produtos</h3>
                    </div>
                    {items.length > 0 ? (
                        <div className="space-y-2">
                            {items.map((item, index) => {
                                const productTotal = item.unit_price * item.quantity;
                                const warrantyTotal = item.warranty_price || 0;
                                const serializedImei1 = item.serialized_unit?.imei1;

                                return (
                                    <div key={index} className="space-y-0.5">
                                        {/* Linha do produto */}
                                        <div className="flex justify-between text-sm">
                                            <div className="flex-1">
                                                <span className="text-slate-600">{item.quantity}x </span>
                                                <span className="text-slate-800">{item.product_name}</span>
                                                {item.is_gift && (
                                                    <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                                                        BRINDE
                                                    </span>
                                                )}
                                                {item.quantity > 1 && (
                                                    <span className="text-xs text-slate-500 ml-2">
                                                        (Uni {formatCurrency(item.unit_price)})
                                                    </span>
                                                )}
                                                {serializedImei1 && (
                                                    <p className="mt-0.5 font-mono text-xs text-slate-500">
                                                        IMEI 1: {serializedImei1}
                                                    </p>
                                                )}
                                            </div>
                                            <span className="font-mono text-slate-800 ml-2 text-right">
                                                {formatCurrency(productTotal)}
                                            </span>
                                        </div>

                                        {/* Linha da garantia (se selecionada) */}
                                        {item.warranty_months && warrantyTotal > 0 && (
                                            <div className="flex justify-between text-sm text-blue-700 pl-3">
                                                <span className="flex items-center gap-1">
                                                    🛡️ + Garantia {item.warranty_months}M
                                                </span>
                                                <span className="font-mono ml-2 text-right">
                                                    {formatCurrency(warrantyTotal)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            <div className="pt-2 mt-2 border-t border-slate-300 text-sm text-right">
                                <span className="text-xs text-slate-500">Subtotal (A): </span>
                                <span className="font-mono font-semibold text-slate-800">{formatCurrency(subtotal)}</span>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-slate-400 ml-6">Nenhum produto adicionado</p>
                    )}
                </div>

                {/* Entrega - B */}
                <div className="border-b border-slate-200 pb-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Truck size={16} className="text-slate-600" />
                        <h3 className="font-semibold text-slate-800">Entrega</h3>
                    </div>
                    <div className="text-sm text-slate-600 space-y-1 ml-6">
                        <p>Tipo: <span className="text-slate-800">{getDeliveryTypeLabel()}</span></p>
                        {(deliveryType === 'hybrid' || deliveryType === 'hybrid_delivery') && (
                            <>
                                <p>Loja: <span className="text-slate-800 font-medium">{formatCurrency(deliveryCostStore)}</span></p>
                                <p>Cliente: <span className="text-slate-800 font-medium">{formatCurrency(deliveryCostCustomer)}</span></p>
                            </>
                        )}
                        {deliveryType && deliveryType !== 'pickup' && deliveryType !== 'store_pickup' && (deliveryCostCustomer > 0 || deliveryCostStore > 0) && (
                            <div className="pt-2 mt-2 border-t border-slate-300 text-sm text-right">
                                <span className="text-xs text-slate-500">Subtotal (B): </span>
                                <span className="font-mono font-semibold text-slate-800">{formatCurrency(deliveryCostCustomer + deliveryCostStore)}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Descontos - C */}
                {(giftDiscount > 0 || (promotionalDiscount && promotionalDiscount > 0) || (finalAdjustmentDiscount && finalAdjustmentDiscount > 0) || deliveryCostStore > 0) && (
                    <div className="border-b border-slate-200 pb-4">
                        <div className="flex items-center gap-2 mb-3">
                            <DollarSign size={16} className="text-slate-600" />
                            <h3 className="font-semibold text-slate-800">Descontos</h3>
                        </div>
                        <div className="text-sm text-slate-600 space-y-1 ml-6">
                            {promotionalDiscount && promotionalDiscount > 0 ? (
                                <div className="flex justify-between">
                                    <span>Desconto Promocional:</span>
                                    <span className="font-mono text-red-600">-{formatCurrency(promotionalDiscount)}</span>
                                </div>
                            ) : null}
                            {finalAdjustmentDiscount && finalAdjustmentDiscount > 0 ? (
                                <div className="flex justify-between">
                                    <span>Desconto Ajuste Final:</span>
                                    <span className="font-mono text-red-600">-{formatCurrency(finalAdjustmentDiscount)}</span>
                                </div>
                            ) : null}
                            {giftDiscount > 0 && (
                                <div className="flex justify-between">
                                    <span>Desconto Brinde:</span>
                                    <span className="font-mono text-red-600">-{formatCurrency(giftDiscount)}</span>
                                </div>
                            )}
                            {deliveryCostStore > 0 && (
                                <div className="flex justify-between">
                                    <span>Subsídio Frete (Loja):</span>
                                    <span className="font-mono text-red-600">-{formatCurrency(deliveryCostStore)}</span>
                                </div>
                            )}
                            <div className="pt-2 mt-2 border-t border-slate-300 text-sm text-right">
                                <span className="text-xs text-slate-500">Subtotal (C): </span>
                                <span className="font-mono font-semibold text-red-600">-{formatCurrency((promotionalDiscount || 0) + (finalAdjustmentDiscount || 0) + giftDiscount + deliveryCostStore)}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Pagamentos */}
                <div className="border-b border-slate-200 pb-4">
                    <div className="flex items-center gap-2 mb-3">
                        <CreditCard size={16} className="text-slate-600" />
                        <h3 className="font-semibold text-slate-800">Pagamentos</h3>
                    </div>
                    {payments.length > 0 ? (
                        <div className="space-y-2">
                            {payments.map((payment, index) => (
                                <div key={index} className="flex justify-between items-center text-sm">
                                    <div className="flex items-center gap-2">
                                        {getPaymentIcon(payment.method)}
                                        <span className="text-slate-600">
                                            {getPaymentMethodLabel(payment.method)}
                                            {payment.installments && payment.installments > 1 && (
                                                <span className="ml-1">({payment.installments}x)</span>
                                            )}
                                        </span>
                                    </div>
                                    <span className="font-mono text-slate-800">
                                        {formatCurrency(payment.total_with_fee ?? payment.amount)}
                                        {payment.method === 'credit' && payment.installments && payment.installments > 1 && (
                                            <span className="ml-1 text-xs text-slate-500">
                                                {payment.installments}x de {formatCurrency(Math.round((payment.total_with_fee ?? payment.amount) / payment.installments))}
                                            </span>
                                        )}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-slate-400 ml-6">Nenhum pagamento adicionado</p>
                    )}
                </div>


                {/* TOTAL A PAGAR */}
                <div className="border-t-2 border-slate-300 pt-4 mt-4">
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs text-slate-500">
                            <span>(Subtotal A + Subtotal B) - (Subtotal C)</span>
                        </div>
                        <div className="flex justify-between font-bold text-lg">
                            <span className="text-slate-800">TOTAL A PAGAR:</span>
                            <span className="font-mono text-blue-600">
                                {formatCurrency((itemsTotal + deliveryCostCustomer + deliveryCostStore) - (giftDiscount + (promotionalDiscount || 0) + (finalAdjustmentDiscount || 0) + deliveryCostStore))}
                            </span>
                        </div>
                    </div>

                    {/* JUROS (se houver) */}
                    {totalFees > 0 && (
                        <div className="space-y-2 text-sm pt-2 border-t border-slate-200">
                            <div className="flex justify-between text-orange-600">
                                <span>Acréscimos:</span>
                                <span className="font-mono">+{formatCurrency(totalFees)}</span>
                            </div>
                            <div className="flex justify-between font-semibold">
                                <span className="text-slate-800">TOTAL COM JUROS:</span>
                                <span className="font-mono text-blue-600">{formatCurrency(total)}</span>
                            </div>
                        </div>
                    )}

                    {/* PAGAMENTOS */}
                    {payments.length > 0 && (
                        <div className="space-y-2 text-sm pt-3 border-t-2 border-slate-300">
                            <div className="flex justify-between text-green-600 font-medium">
                                <span>Pago:</span>
                                <span className="font-mono">{formatCurrency(totalPaid)}</span>
                            </div>
                            {change > 0 && (
                                <div className="flex justify-between text-amber-600 font-medium">
                                    <span>Troco:</span>
                                    <span className="font-mono">{formatCurrency(change)}</span>
                                </div>
                            )}
                            {change < 0 && (
                                <div className="flex justify-between text-red-600 font-medium">
                                    <span>Falta:</span>
                                    <span className="font-mono">{formatCurrency(Math.abs(change))}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div >

            {/* Footer com botão */}
            < div className="p-6 bg-slate-50 border-t border-slate-200 rounded-b-xl" >
                {/* Custom Footer Text */}
                {companySettings?.footer_text && (
                    <div className="mb-4 text-center text-sm text-slate-600 italic border-t border-slate-300 pt-4">
                        {companySettings.footer_text}
                    </div>
                )}

                {/* Warranty Terms */}
                {companySettings?.warranty_terms && (
                    <div className="mb-4 p-4 bg-amber-50 border-2 border-amber-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                            <h3 className="text-sm font-bold text-amber-900 uppercase">
                                Termos de Garantia
                            </h3>
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                            {companySettings.warranty_terms}
                        </p>
                        <p className="text-xs text-amber-700 font-semibold mt-2 italic">
                            * Este recibo é parte integrante do termo de garantia
                        </p>
                    </div>
                )}

                {hasPendingPixPayment && (
                    <div className="mb-4 rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-sm font-medium text-cyan-800">
                        Pix pendente. Atualize o pagamento antes de finalizar a venda.
                    </div>
                )}

                <button
                    onClick={onFinalizeSale}
                    disabled={!isComplete || isFinalizing || hasPendingPixPayment}
                    className={`w-full py-3 rounded-lg font-semibold transition-all ${isComplete && !isFinalizing && !hasPendingPixPayment
                        ? 'bg-green-600 text-white hover:bg-green-700 shadow-md hover:shadow-lg'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                >
                    {isFinalizing ? 'Finalizando...' : (hasPendingPixPayment ? 'Pix pendente' : (isComplete ? 'Finalizar Venda' : 'Complete os dados para finalizar'))}
                </button>
            </div >

            {/* FOLHA EXTRA OPCIONAL (Somente Impressão / Final do Recibo) */}
            {companySettings?.receipt_show_extra_page && (
                <div className={`print-only-extra-page hidden print:block mt-8 pt-8 border-t-2 border-dashed border-slate-300 mx-auto ${getReceiptMaxWidthClass()}`} style={{ pageBreakBefore: 'always' }}>
                    <div className="flex flex-col items-center justify-center text-center p-8">
                        {companySettings.receipt_logo_url && (
                            <img
                                src={companySettings.receipt_logo_url}
                                alt="Logo Empresa"
                                className="max-w-[200px] max-h-[100px] object-contain mb-8"
                            />
                        )}
                        <div className="w-full bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-8">
                            {companySettings.receipt_extra_page_qr_url ? (
                                <div className="flex justify-center mb-6">
                                    <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-100">
                                        <QRCode
                                            value={companySettings.receipt_extra_page_qr_url}
                                            size={200}
                                            level="H"
                                            className="mx-auto"
                                        />
                                    </div>
                                </div>
                            ) : null}

                            {companySettings.receipt_extra_page_text && (
                                <p className="text-sm text-slate-700 leading-relaxed font-medium whitespace-pre-wrap text-left">
                                    {getReplacedExtraPageText()}
                                </p>
                            )}
                        </div>

                        <p className="text-xs text-slate-400 mt-4">
                            Documento acessório ao recibo principal pedido #{orderNumber ? String(orderNumber).padStart(7, '0') : ''}
                        </p>
                    </div>
                </div>
            )}
        </div >
    );
}
