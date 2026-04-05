// Strip HTML tags from description before injecting in meta tags
function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

const VPS_BASE = process.env.VITE_VPS_API_URL || 'https://api.xiaomipetrolina.com.br';

export default async function handler(req: any, res: any) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { slug } = req.query;
    if (!slug) {
        return res.redirect('/');
    }

    try {
        // ── 1. Busca produto na VPS (fonte de verdade principal) ──────────────
        let product: any = null;

        try {
            const vpsRes = await fetch(`${VPS_BASE}/produto/${encodeURIComponent(slug)}`, {
                signal: AbortSignal.timeout(5000),
            });
            if (vpsRes.ok) {
                const data = await vpsRes.json();
                if (data && !data.error && data.name) {
                    product = data;
                }
            }
        } catch (vpsErr) {
            console.warn('[seo-produto] VPS indisponível, tentando Supabase como fallback:', vpsErr);
        }

        // ── 2. Fallback: Supabase (caso VPS falhe) ────────────────────────────
        if (!product) {
            const { createClient } = await import('@supabase/supabase-js');
            const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
            const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
            const supabase = createClient(supabaseUrl, supabaseKey);

            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(slug);
            let query = supabase
                .from('products')
                .select('name, description, meta_title, meta_description, seo_keywords, images, price_retail, stock_quantity, sku, slug');

            if (isUuid) {
                query = query.eq('id', slug);
            } else {
                query = query.eq('slug', slug);
            }

            const { data } = await query.single();
            if (data) product = data;
        }

        // ── 3. Busca o index.html base para clonagem ──────────────────────────
        const protocol = req.headers['x-forwarded-proto'] || 'http';
        const host = req.headers['x-forwarded-host'] || req.headers.host;
        const baseUrl = `${protocol}://${host}`;

        let baseHtml = '';
        try {
            const htmlRes = await fetch(`${baseUrl}/index.html`);
            if (htmlRes.ok) baseHtml = await htmlRes.text();
        } catch (e) {
            console.warn('[seo-produto] Erro ao buscar index.html base', e);
        }

        if (!baseHtml) {
            baseHtml = `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Mercado do Vale</title>
  </head>
  <body>
    <div id="root">Carregando...</div>
    <script type="module" src="/index.tsx"></script>
  </body>
</html>`;
        }

        // Se produto não encontrado, serve o SPA normalmente (React cuida do 404)
        if (!product) {
            return res.status(200).send(baseHtml);
        }

        // ── 4. Normaliza imagens (VPS pode retornar string JSON ou array) ─────
        let images = product.images;
        if (typeof images === 'string') {
            try { images = JSON.parse(images); } catch { images = []; }
        }
        if (!Array.isArray(images)) images = [];

        // ── 5. Monta tags de SEO ──────────────────────────────────────────────
        const rawDesc = product.meta_description || product.description || '';
        // IMPORTANTE: strip HTML antes de injetar (evita <div>, <h4>, etc. no preview)
        const cleanDesc = stripHtml(rawDesc);

        const title = product.meta_title || `${product.name} | Mercado do Vale`;
        const description = (cleanDesc.slice(0, 155) || `Compre ${product.name} no Mercado do Vale com o melhor preço.`).replace(/"/g, '&quot;');
        const image = images[0] || `${baseUrl}/og-cover.jpg`;
        const canonicalSlug = product.slug || slug;
        const url = `${baseUrl}/produto/${canonicalSlug}`;
        const price = ((product.price_retail || 0) / 100).toFixed(2);
        const availability = (product.stock_quantity || 0) > 0
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock';

        const safeTitle = title.replace(/"/g, '&quot;');
        const safeImage = images.slice(0, 5);

        const metaTags = `
    <!-- SEO Injetado via Vercel Serverless (seo-produto) -->
    <title>${title}</title>
    <meta name="description" content="${description}" />
    ${Array.isArray(product.seo_keywords) && product.seo_keywords.length > 0
        ? `<meta name="keywords" content="${product.seo_keywords.join(', ')}" />`
        : ''}
    <link rel="canonical" href="${url}" />

    <!-- Open Graph (WhatsApp, Facebook, LinkedIn) -->
    <meta property="og:type" content="product" />
    <meta property="og:url" content="${url}" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:site_name" content="Mercado do Vale" />
    <meta property="og:locale" content="pt_BR" />

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:url" content="${url}" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${image}" />

    <!-- Google Shopping / Schema.org -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org/",
      "@type": "Product",
      "name": "${(product.name || '').replace(/"/g, '&quot;')}",
      "image": ${JSON.stringify(safeImage)},
      "description": "${description}",
      "sku": "${(product.sku || '').replace(/"/g, '&quot;')}",
      "offers": {
        "@type": "Offer",
        "url": "${url}",
        "priceCurrency": "BRL",
        "price": "${price}",
        "availability": "${availability}",
        "itemCondition": "https://schema.org/NewCondition"
      }
    }
    </script>
    <!-- Fim SEO seo-produto -->
        `;

        // ── 6. Injeta no HTML removendo tags duplicadas do index.html ─────────
        let finalHtml = baseHtml;
        finalHtml = finalHtml.replace(/<title>(.*?)<\/title>/i, '');
        finalHtml = finalHtml.replace(/<meta[^>]*name=["']description["'][^>]*>/i, '');
        finalHtml = finalHtml.replace('<head>', `<head>\n${metaTags}`);

        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');

        return res.status(200).send(finalHtml);

    } catch (err: any) {
        console.error('[seo-produto] Erro catastrófico:', err);
        return res.redirect('/');
    }
}
