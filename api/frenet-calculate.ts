import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Proxy para a API da Frenet — evita CORS em produção.
 * POST /api/frenet-calculate
 * Body: { from_cep, to_cep, weight_g, height_cm, width_cm, length_cm, order_value, token }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { from_cep, to_cep, weight_g, height_cm, width_cm, length_cm, order_value, token } = req.body;

    if (!token) return res.status(400).json({ error: 'Token Frenet não fornecido' });
    if (!from_cep || !to_cep) return res.status(400).json({ error: 'CEP de origem e destino são obrigatórios' });

    const body = {
        SellerCEP: from_cep.replace(/\D/g, ''),
        RecipientCEP: to_cep.replace(/\D/g, ''),
        RecipientCountry: 'BR',
        ShipmentInvoiceValue: Math.max(order_value ?? 0, 50),
        ShippingItemArray: [
            {
                Height: height_cm ?? 10,
                Length: length_cm ?? 20,
                Quantity: 1,
                Weight: (weight_g ?? 300) / 1000,
                Width: width_cm ?? 15,
            },
        ],
    };

    try {
        const apiRes = await fetch('https://api.frenet.com.br/shipping/quote', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'token': token,
            },
            body: JSON.stringify(body),
        });

        const data = await apiRes.json();

        if (!apiRes.ok) {
            console.error('[Frenet] HTTP error:', apiRes.status, data);
            return res.status(apiRes.status).json({ error: data });
        }

        // Log para debug no Vercel
        console.log('[Frenet] response status:', apiRes.status,
            'services:', (data.ShippingSevicesArray ?? []).length);

        return res.status(200).json(data);
    } catch (err: any) {
        console.error('[Frenet] fetch error:', err.message);
        return res.status(500).json({ error: err.message ?? 'Erro ao chamar Frenet' });
    }
}
