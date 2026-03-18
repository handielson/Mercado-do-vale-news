import React, { useEffect, useState } from 'react';
import { FreightCalculator } from '../../components/shipping/FreightCalculator';
import { shippingService } from '../../services/shippingService';
import type { ShippingSettings } from '../../types/shipping';
import { Loader2 } from 'lucide-react';

export default function FreightCalculatorPage() {
    const [settings, setSettings] = useState<ShippingSettings | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        shippingService.getSettings()
            .then(s => setSettings(s))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return (
        <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
    );

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">🚚 Calcular Frete</h1>
                <p className="text-gray-500 text-sm mt-1">
                    Cotação rápida por produto e CEP de destino
                    {settings?.secondary_origin_cep && ' · comparativo de 2 depósitos'}
                </p>
            </div>
            <FreightCalculator
                originCep={settings?.origin_cep ?? ''}
                secondaryCep={settings?.secondary_origin_cep || undefined}
            />
        </div>
    );
}
