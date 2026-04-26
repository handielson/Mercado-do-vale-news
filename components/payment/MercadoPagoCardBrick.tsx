/**
 * MercadoPagoCardBrick — Formulário de cartão embutido usando MP Bricks SDK
 * O Brick tokeniza o cartão no browser e retorna o token seguro para o backend.
 */
import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface CardFormData {
    token: string;
    installments: number;
    paymentMethodId: string;
    issuerId: string;
    payer: {
        email: string;
        identification?: { type: string; number: string };
    };
}

interface Props {
    publicKey: string;
    amount: number; // Em reais (ex: 59.90)
    customerEmail?: string;
    onSubmit: (formData: CardFormData) => Promise<void>;
    onError?: (error: unknown) => void;
    submitting?: boolean;
}

let mercadoPagoSdkPromise: Promise<void> | null = null;

function loadMercadoPagoSdk(): Promise<void> {
    if ((window as any).MercadoPago) return Promise.resolve();
    if (mercadoPagoSdkPromise) return mercadoPagoSdkPromise;

    mercadoPagoSdkPromise = new Promise((resolve, reject) => {
        const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://sdk.mercadopago.com/js/v2"]');
        if (existingScript) {
            existingScript.addEventListener('load', () => resolve(), { once: true });
            existingScript.addEventListener('error', reject, { once: true });
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://sdk.mercadopago.com/js/v2';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = reject;
        document.head.appendChild(script);
    });

    return mercadoPagoSdkPromise;
}

export default function MercadoPagoCardBrick({ publicKey, amount, customerEmail, onSubmit, onError, submitting }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const brickControllerRef = useRef<any>(null);

    useEffect(() => {
        if (!publicKey || !amount) return;

        let cancelled = false;

        const initBrick = async () => {
            try {
                await loadMercadoPagoSdk();
                if (cancelled) return;

                const mp = new (window as any).MercadoPago(publicKey, {
                    locale: 'pt-BR'
                });

                const bricksBuilder = mp.bricks();

                if (cancelled) return;

                brickControllerRef.current = await bricksBuilder.create(
                    'cardPayment',
                    'mp-card-brick-container',
                    {
                        initialization: {
                            amount,
                            payer: {
                                email: customerEmail || '',
                            },
                        },
                        customization: {
                            visual: {
                                style: {
                                    theme: 'default',
                                },
                            },
                            paymentMethods: {
                                minInstallments: 1,
                                maxInstallments: 12,
                            },
                        },
                        callbacks: {
                            onReady: () => {
                                if (!cancelled) setLoading(false);
                            },
                            onSubmit: async (formData: CardFormData) => {
                                await onSubmit(formData);
                            },
                            onError: (err: unknown) => {
                                console.error('[MP Brick Error]', err);
                                if (onError) onError(err);
                            },
                        },
                    }
                );
            } catch (err: any) {
                if (!cancelled) {
                    setError('Erro ao carregar formulário de pagamento. Tente recarregar a página.');
                    setLoading(false);
                }
            }
        };

        initBrick();

        return () => {
            cancelled = true;
            brickControllerRef.current?.unmount();
        };
    }, [publicKey, amount, customerEmail]);

    if (error) {
        return (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                {error}
            </div>
        );
    }

    return (
        <div ref={containerRef} className="relative">
            {loading && (
                <div className="flex items-center justify-center gap-2 py-8 text-gray-500">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-sm">Carregando formulário seguro...</span>
                </div>
            )}
            <div id="mp-card-brick-container" className={loading ? 'hidden' : ''} />
            {submitting && (
                <div className="absolute inset-0 bg-white/70 flex items-center justify-center rounded-xl">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
            )}
        </div>
    );
}
