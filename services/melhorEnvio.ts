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
    length?: number;    // cm
    token: string;
    sandbox?: boolean;
    allowed_services?: string;
}

export const melhorEnvioService = {
    async calculate(input: MelhorEnvioInput): Promise<ShippingOption[]> {
        const res = await fetch('/api/melhor-envio-calculate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from_cep: input.from_cep,
                to_cep: input.to_cep,
                weight_g: input.weight,
                height_cm: input.height,
                width_cm: input.width,
                length_cm: input.length ?? 20,
                token: input.token,
                sandbox: input.sandbox,
            }),
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Melhor Envio API error: ${err}`);
        }

        const data: any[] = await res.json();

        const options = data
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

        if (!input.allowed_services?.trim()) {
            return options;
        }

        const allowed = input.allowed_services.toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
        return options.filter(opt =>
            allowed.some(a => opt.name.toLowerCase().includes(a) || opt.carrier.toLowerCase().includes(a))
        );
    },
};
