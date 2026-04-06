import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const provider = req.query.provider as string;
    const action = req.query.action as string;

    if (provider === 'frenet' && action === 'calculate') {
        const { from_cep, to_cep, weight_g, height_cm, width_cm, length_cm, order_value, token } = req.body;
        if (!token) return res.status(400).json({ error: 'Token Frenet não fornecido' });
        if (!from_cep || !to_cep) return res.status(400).json({ error: 'CEP de origem e destino são obrigatórios' });

        const body = {
            SellerCEP: from_cep.replace(/\D/g, ''),
            RecipientCEP: to_cep.replace(/\D/g, ''),
            RecipientCountry: 'BR',
            ShipmentInvoiceValue: Math.max((order_value ?? 0) / 100, 10),
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
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'token': token },
                body: JSON.stringify(body),
            });
            const data = await apiRes.json();
            if (!apiRes.ok) return res.status(apiRes.status).json({ error: data });
            return res.status(200).json(data);
        } catch (err: any) {
            return res.status(500).json({ error: err.message ?? 'Erro ao chamar Frenet' });
        }
    }

    if (provider === 'melhor-envio' && action === 'calculate') {
        const { from_cep, to_cep, weight_g, height_cm, width_cm, length_cm, token, sandbox } = req.body;
        if (!token) return res.status(400).json({ error: 'Token do Melhor Envio não fornecido' });
        if (!from_cep || !to_cep) return res.status(400).json({ error: 'CEP de origem e destino são obrigatórios' });

        const baseUrl = sandbox ? 'https://sandbox.melhorenvio.com.br' : 'https://melhorenvio.com.br';
        const body = {
            from: { postal_code: from_cep.replace(/\D/g, '') },
            to: { postal_code: to_cep.replace(/\D/g, '') },
            package: {
                height: height_cm ?? 10, width: width_cm ?? 15, length: length_cm ?? 20, weight: (weight_g ?? 300) / 1000,
            },
            options: { insurance_value: 0, receipt: false, own_hand: false },
        };

        try {
            const apiRes = await fetch(`${baseUrl}/api/v2/me/shipment/calculate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json', 'Accept': 'application/json',
                    'Authorization': `Bearer ${token}`, 'User-Agent': 'Mercado do Vale (contato@mercadodovale.com.br)',
                },
                body: JSON.stringify(body),
            });
            const data = await apiRes.json();
            if (!apiRes.ok) return res.status(apiRes.status).json({ error: data });
            return res.status(200).json(data);
        } catch (err: any) {
            return res.status(500).json({ error: err.message ?? 'Erro ao chamar Melhor Envio' });
        }
    }

    if (provider === 'melhor-envio' && action === 'label') {
        const { token, sandbox, carrier_id, from_cep, to, products } = req.body as any;
        if (!token || !carrier_id || !from_cep || !to?.name) return res.status(400).json({ error: 'Dados incompletos' });

        const baseUrl = sandbox ? 'https://sandbox.melhorenvio.com.br/api/v2' : 'https://melhorenvio.com.br/api/v2';
        const headers = {
            'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Accept': 'application/json',
            'User-Agent': 'MercadoDoVale/1.0 (suporte@mercadodovale.com)',
        };

        try {
            const cartBody = {
                service: carrier_id, from: { postal_code: from_cep },
                to: {
                    name: to.name, phone: to.phone, email: '', document: to.document, company_document: '',
                    address: to.address, city: to.city, district: to.district, state_abbr: to.state_abbr,
                    postal_code: to.postal_code, number: to.number, complement: to.complement || '',
                },
                package: products.map((p: any) => ({ name: p.name, quantity: p.quantity, unitary_value: 1, weight: p.weight })),
                options: { insurance_value: 0, receipt: false, own_hand: false },
            };

            const cartRes = await fetch(`${baseUrl}/me/cart`, { method: 'POST', headers, body: JSON.stringify(cartBody) });
            const cartData: any = await cartRes.json();
            if (!cartRes.ok) return res.status(cartRes.status).json({ error: cartData?.message ?? 'Erro ao adicionar ao carrinho' });

            const orderId: string = cartData?.id;
            if (!orderId) return res.status(502).json({ error: 'ID do pedido não retornado' });

            const checkoutRes = await fetch(`${baseUrl}/me/shipment/checkout`, { method: 'POST', headers, body: JSON.stringify({ orders: [orderId] }) });
            if (!checkoutRes.ok) { const d: any = await checkoutRes.json(); return res.status(checkoutRes.status).json({ error: d?.message ?? 'Erro no checkout' }); }

            const generateRes = await fetch(`${baseUrl}/me/shipment/generate`, { method: 'POST', headers, body: JSON.stringify({ orders: [orderId] }) });
            if (!generateRes.ok) { const d: any = await generateRes.json(); return res.status(generateRes.status).json({ error: d?.message ?? 'Erro ao gerar etiqueta' }); }

            const printUrl = `${baseUrl.replace('/api/v2', '')}/shipment/print?orders[]=${orderId}&token=${token}`;
            return res.status(200).json({ url: printUrl, order_id: orderId });

        } catch (err: any) {
            return res.status(500).json({ error: err.message ?? 'Erro interno' });
        }
    }

    return res.status(404).json({ error: 'Provider or action not match' });
}
