import { VercelRequest, VercelResponse } from '@vercel/node';

const VPS_BASE = process.env.VITE_VPS_API_URL || 'https://api.xiaomipetrolina.com.br';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Busca os produtos de forma compacta (só os ativos e que precisam de URL)
        // Usamos um limit alto o suficiente para pegar quase tudo na VPS
        const vpsRes = await fetch(`${VPS_BASE}/products?status=Ativo&limit=5000&compact=true`);
        
        let products: any[] = [];
        if (vpsRes.ok) {
            products = await vpsRes.json();
        }

        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const host = req.headers['x-forwarded-host'] || req.headers.host || 'mercadodovale.com.br';
        const baseUrl = `${protocol}://${host}`;

        // Garante que é array
        if (!Array.isArray(products)) {
            products = [];
        }

        // Filtra produtos que tenham slug e nome
        const validProducts = products.filter(p => p.slug && p.name);

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <!-- Páginas principais -->
    <url>
        <loc>${baseUrl}/</loc>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
    </url>
    <url>
        <loc>${baseUrl}/quem-somos</loc>
        <changefreq>monthly</changefreq>
        <priority>0.8</priority>
    </url>
    <url>
        <loc>${baseUrl}/faq</loc>
        <changefreq>monthly</changefreq>
        <priority>0.5</priority>
    </url>

    <!-- URLs de Produtos Dinâmicos -->
    ${validProducts.map(product => `
    <url>
        <loc>${baseUrl}/produto/${product.slug}</loc>
        <lastmod>${(product.updated_at || new Date().toISOString()).split('T')[0]}</lastmod>
        <changefreq>daily</changefreq>
        <priority>0.9</priority>
    </url>
    `).join('')}
</urlset>`;

        // Cachea agressivamente por 1 hora e serve "stale" por mais 24h
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
        res.setHeader('Content-Type', 'text/xml');
        return res.status(200).send(xml.trim());

    } catch (err: any) {
        console.error('[sitemap] Erro ao gerar:', err);
        return res.status(500).json({ error: 'Failed to generate sitemap' });
    }
}
