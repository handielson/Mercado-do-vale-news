/**
 * Melhor Envio Service
 * Integration with Melhor Envio API (sandbox + production)
 * Docs: https://docs.melhorenvio.com.br
 */
import type { ShippingOption } from '../types/shipping';

interface MelhorEnvioInput {
    from_cep: string;
    to_cep: string;
    weight: number;     // gramas
    height: number;     // cm
    width: number;      // cm
    length: number;     // cm
    token: string;
    sandbox?: boolean;
}

export const melhorEnvioService = {
    async calculate(input: MelhorEnvioInput): Promise<ShippingOption[]> {
        const baseUrl = input.sandbox
            ? 'https://sandbox.melhorenvio.com.br'
            : 'https://melhorenvio.com.br';

        const body = {
            from: { postal_code: input.from_cep.replace(/\D/g, '') },
            to: { postal_code: input.to_cep.replace(/\D/g, '') },
            package: {
                height: input.height,
                width: input.width,
                length: input.length,
                weight: input.weight / 1000, // API espera KG
            },
            options: {
                insurance_value: 0,
                receipt: false,
                own_hand: false,
            },
        };

        const res = await fetch(`${baseUrl}/api/v2/me/shipment/calculate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${input.token}`,
                'User-Agent': 'Mercado do Vale (contato@mercadodovale.com.br)',
            },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Melhor Envio API error: ${err}`);
        }

        const data: any[] = await res.json();

        return data
            .filter((item) => !item.error && item.price)
            .map((item) => ({
                id: `me_${item.id}`,
                name: item.name,
                carrier: item.company?.name ?? 'Transportadora',
                price: parseFloat(item.price),
                isFree: parseFloat(item.price) === 0,
                estimatedDaysMin: item.delivery_time ?? 1,
                estimatedDaysMax: (item.delivery_time ?? 1) + 2,
                daysLabel: `${item.delivery_time ?? '?'} dias úteis`,
                type: 'carrier' as const,
            }));
    },
};
