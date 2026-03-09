import { createClient } from '@supabase/supabase-js';

// Inicializa o cliente Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: any, res: any) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { slug } = req.query;
    if (!slug) {
        return res.redirect('/');
    }

    try {
        // 1. Busca os dados de SEO do produto no Supabase usando o slug
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(slug);

        let query = supabase
            .from('products')
            .select(`
                name, 
                description, 
                meta_title, 
                meta_description, 
                seo_keywords,
                images,
                price_retail,
                stock_quantity
            `);

        if (isUuid) {
            query = query.eq('id', slug);
        } else {
            query = query.eq('slug', slug);
        }

        const { data: product, error } = await query.single();

        // 2. Tenta buscar o `index.html` original do servidor
        const protocol = req.headers['x-forwarded-proto'] || 'http';
        const host = req.headers['x-forwarded-host'] || req.headers.host;
        const baseUrl = `${protocol}://${host}`;

        let baseHtml = '';
        try {
            const htmlRes = await fetch(`${baseUrl}/index.html`);
            if (htmlRes.ok) {
                baseHtml = await htmlRes.text();
            }
        } catch (e) {
            console.warn('Erro ao buscar index.html local', e);
        }

        // Se falhar em ler o index.html, cria um fallback básico
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
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;
        }

        // Se não achou o produto, serve o HTML original que vai dar 404 no React Client-side
        if (error || !product) {
            return res.status(200).send(baseHtml);
        }

        // 3. Monta as tags dinâmicas
        const title = product.meta_title || `${product.name} | Mercado do Vale`;
        const description = product.meta_description ||
            (product.description ? product.description.substring(0, 150) : `Compre ${product.name} no Mercado do Vale com o melhor preço.`);
        const image = product.images?.[0] || `${baseUrl}/logo.png`;
        const url = `${baseUrl}/produto/${slug}`;

        // Determina disponibilidade
        const availability = product.stock_quantity > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock";
        const price = (product.price_retail / 100).toFixed(2);

        const metaTags = `
    <!-- SEO Injetado via Vercel Edge -->
    <title>${title}</title>
    <meta name="description" content="${description}" />
    ${product.seo_keywords && product.seo_keywords.length > 0 ? `<meta name="keywords" content="${product.seo_keywords.join(', ')}" />` : ''}
    
    <!-- Open Graph / Facebook / WhatsApp -->
    <meta property="og:type" content="product" />
    <meta property="og:url" content="${url}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:site_name" content="Mercado do Vale" />

    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:url" content="${url}" />
    <meta property="twitter:title" content="${title}" />
    <meta property="twitter:description" content="${description}" />
    <meta property="twitter:image" content="${image}" />

    <!-- Google Shopping JSON-LD -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org/",
      "@type": "Product",
      "name": "${product.name}",
      "image": ["${image}"],
      "description": "${description}",
      "sku": "${product.sku || ''}",
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
    <!-- Fim da Injeção SEO -->
        `;

        // 4. Injeta as tags no HTML substituindo o <title> padrão
        // Usamos regex para garantir que não vai duplicar
        let finalHtml = baseHtml;

        // Remove <title> existente se houver
        finalHtml = finalHtml.replace(/<title>(.*?)<\/title>/i, '');
        // Remove meta description existente
        finalHtml = finalHtml.replace(/<meta[^>]*name=["']description["'][^>]*>/i, '');

        // Injeta as novas meta tags logo após o <head>
        finalHtml = finalHtml.replace('<head>', `<head>\n${metaTags}`);

        // Define Headers de Cache para performance do WhatsApp Hit
        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');

        // Retorna a página preenchida
        return res.status(200).send(finalHtml);

    } catch (err: any) {
        console.error('Erro no SEO Proxy:', err);
        // Em caso de falha catastrófica, redireciona pra home pra não quebrar a navegação
        return res.redirect('/');
    }
}
