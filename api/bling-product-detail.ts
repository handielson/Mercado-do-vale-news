// Proxy serverless: busca detalhe completo de um produto Bling por ID
export default async function handler(req: any, res: any) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: 'Missing Authorization header' });

    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Product ID required' });

    try {
        // Busca produto e estoque em paralelo
        const [prodRes, stockRes] = await Promise.all([
            fetch(`https://www.bling.com.br/Api/v3/produtos/${id}`, {
                headers: { 'Authorization': authHeader, 'Accept': 'application/json' },
            }),
            fetch(`https://www.bling.com.br/Api/v3/estoques/saldos?pagina=1&limite=100&idsProdutos[]=${id}`, {
                headers: { 'Authorization': authHeader, 'Accept': 'application/json' },
            }),
        ]);

        if (!prodRes.ok) {
            return res.status(prodRes.status).json({ error: `Bling error: ${prodRes.status}`, detail: await prodRes.text() });
        }

        const prodData = await prodRes.json();
        const produto = prodData.data;

        // Soma estoque de todos os depósitos
        let stock_quantity = 0;
        if (stockRes.ok) {
            const stockData = await stockRes.json();
            for (const item of (stockData.data || [])) {
                stock_quantity += item.saldoFisico ?? 0;
            }
        }
        // Fallback para variações: o endpoint de saldos pode não retornar nada
        // para IDs de variação — nesse caso usa o campo embutido no produto
        if (stock_quantity === 0 && produto.estoque?.saldoVirtualTotal) {
            stock_quantity = produto.estoque.saldoVirtualTotal;
        }

        return res.status(200).json({ ...produto, stock_quantity });
    } catch (err: any) {
        return res.status(500).json({ error: 'network_error', message: err.message });
    }
}
