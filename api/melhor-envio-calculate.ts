import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Proxy para a API do Melhor Envio — evita CORS em produção.
 * Chamado pelo componente FreightCalculator na calculadora de frete avulso.
 *
 * POST /api/melhor-envio-calculate
 * Body: { from_cep, to_cep, weight_g, height_cm, width_cm, length_cm, sandbox }
 * Headers internos: token buscado das shipping_settings via Supabase
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { from_cep, to_cep, weight_g, height_cm, width_cm, length_cm, token, sandbox } = req.body;

    if (!token) {
        return res.status(400).json({ error: 'Token do Melhor Envio não fornecido' });
    }
    if (!from_cep || !to_cep) {
        return res.status(400).json({ error: 'CEP de origem e destino são obrigatórios' });
    }

    const baseUrl = sandbox
        ? 'https://sandbox.melhorenvio.com.br'
        : 'https://melhorenvio.com.br';

    const body = {
        from: { postal_code: from_cep.replace(/\D/g, '') },
        to: { postal_code: to_cep.replace(/\D/g, '') },
        package: {
            height: height_cm ?? 10,
            width: width_cm ?? 15,
            length: length_cm ?? 20,
            weight: (weight_g ?? 300) / 1000, // API recebe em KG
        },
        options: {
            insurance_value: 0,
            receipt: false,
            own_hand: false,
        },
    };

    try {
        const apiRes = await fetch(`${baseUrl}/api/v2/me/shipment/calculate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`,
                'User-Agent': 'Mercado do Vale (contato@mercadodovale.com.br)',
            },
            body: JSON.stringify(body),
        });

        const data = await apiRes.json();

        if (!apiRes.ok) {
            return res.status(apiRes.status).json({ error: data });
        }

        return res.status(200).json(data);
    } catch (err: any) {
        return res.status(500).json({ error: err.message ?? 'Erro ao chamar Melhor Envio' });
    }
}
