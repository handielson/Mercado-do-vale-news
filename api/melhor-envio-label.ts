import type { VercelRequest, VercelResponse } from '@vercel/node';

// Endpoint proxy para geração de etiqueta via Melhor Envio
// Fluxo: adicionar ao carrinho → checkout → gerar → retornar URL de impressão
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const {
        token, sandbox,
        carrier_id, from_cep,
        to, products,
    } = req.body as {
        token: string;
        sandbox: boolean;
        carrier_id: string;
        from_cep: string;
        to: {
            name: string; document: string; phone: string;
            address: string; number: string; complement?: string;
            district: string; city: string; state_abbr: string; postal_code: string;
        };
        products: { name: string; quantity: number; weight: number }[];
    };

    if (!token || !carrier_id || !from_cep || !to?.name) {
        return res.status(400).json({ error: 'Dados incompletos' });
    }

    const baseUrl = sandbox
        ? 'https://sandbox.melhorenvio.com.br/api/v2'
        : 'https://melhorenvio.com.br/api/v2';

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'MercadoDoVale/1.0 (suporte@mercadodovale.com)',
    };

    try {
        // 1. Adicionar ao carrinho
        const cartBody = {
            service: carrier_id,
            from: { postal_code: from_cep },
            to: {
                name: to.name,
                phone: to.phone,
                email: '',
                document: to.document,
                company_document: '',
                address: to.address,
                city: to.city,
                district: to.district,
                state_abbr: to.state_abbr,
                postal_code: to.postal_code,
                number: to.number,
                complement: to.complement || '',
            },
            package: products.map(p => ({
                name: p.name,
                quantity: p.quantity,
                unitary_value: 1,
                weight: p.weight,
            })),
            options: { insurance_value: 0, receipt: false, own_hand: false },
        };

        const cartRes = await fetch(`${baseUrl}/me/cart`, {
            method: 'POST', headers, body: JSON.stringify(cartBody),
        });
        const cartData: any = await cartRes.json();
        if (!cartRes.ok) {
            return res.status(cartRes.status).json({ error: cartData?.message ?? 'Erro ao adicionar ao carrinho' });
        }

        const orderId: string = cartData?.id;
        if (!orderId) return res.status(502).json({ error: 'ID do pedido não retornado' });

        // 2. Checkout
        const checkoutRes = await fetch(`${baseUrl}/me/shipment/checkout`, {
            method: 'POST', headers, body: JSON.stringify({ orders: [orderId] }),
        });
        if (!checkoutRes.ok) {
            const d: any = await checkoutRes.json();
            return res.status(checkoutRes.status).json({ error: d?.message ?? 'Erro no checkout' });
        }

        // 3. Gerar etiqueta
        const generateRes = await fetch(`${baseUrl}/me/shipment/generate`, {
            method: 'POST', headers, body: JSON.stringify({ orders: [orderId] }),
        });
        if (!generateRes.ok) {
            const d: any = await generateRes.json();
            return res.status(generateRes.status).json({ error: d?.message ?? 'Erro ao gerar etiqueta' });
        }

        // 4. URL de impressão
        const printUrl = `${baseUrl.replace('/api/v2', '')}/shipment/print?orders[]=${orderId}&token=${token}`;
        return res.status(200).json({ url: printUrl, order_id: orderId });

    } catch (err: any) {
        return res.status(500).json({ error: err.message ?? 'Erro interno' });
    }
}
