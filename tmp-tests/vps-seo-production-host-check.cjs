const http = require('http');
const https = require('https');

const VPS_ORIGIN = process.env.SEO_PRODUCTION_HOST_VPS_ORIGIN || 'http://76.13.232.162';
const EXPECTED_HOST = process.env.SEO_PRODUCTION_HOST || 'mercadodovale.com.br';
const CANONICAL_HOST = process.env.SEO_PRODUCTION_CANONICAL_HOST || 'www.mercadodovale.com.br';
const LIVE_READ = process.env.SEO_PRODUCTION_HOST_LIVE === 'true';
const PRODUCT_LIMIT = Math.max(1, Math.min(Number(process.env.SEO_PRODUCTION_HOST_PRODUCT_LIMIT || 3), 10));
const JSON_LD_MIME = 'application/ld+json';
const REDIRECT_STATUSES = [301, 302, 303, 307, 308];

function fetchText(url, headers = {}, options = {}, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    const req = client.get(url, { headers, timeout: 30000 }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        const location = res.headers.location;
        if (options.followRedirects !== false && REDIRECT_STATUSES.includes(res.statusCode) && location) {
          if (redirectCount >= 5) {
            reject(new Error(`Too many redirects fetching ${url}`));
            return;
          }
          fetchText(new URL(location, url).toString(), headers, options, redirectCount + 1).then(resolve, reject);
          return;
        }
        resolve({
          status: res.statusCode,
          contentType: res.headers['content-type'] || '',
          location,
          body,
          finalUrl: url,
        });
      });
    });
    req.on('timeout', () => {
      req.destroy(new Error(`Timeout fetching ${url}`));
    });
    req.on('error', reject);
  });
}

function summarizeRedirect(response) {
  const location = response.location ? new URL(response.location, `${VPS_ORIGIN}/`) : null;
  const redirectOk = REDIRECT_STATUSES.includes(response.status)
    && location?.protocol === 'https:'
    && location?.host === CANONICAL_HOST
    && location?.pathname === '/sitemap.xml';

  return {
    status: response.status,
    location: response.location || null,
    redirect_ok: redirectOk,
    ok: redirectOk,
  };
}

function parseSitemapUrls(xml) {
  return [...String(xml || '').matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
}

function summarizeSitemap(response, expectedHost = EXPECTED_HOST) {
  const urls = parseSitemapUrls(response.body);
  const hosts = [...new Set(urls.map((value) => {
    try {
      return new URL(value).host;
    } catch {
      return 'invalid-url';
    }
  }))].sort();
  const productUrls = urls.filter((value) => {
    try {
      return new URL(value).pathname.startsWith('/produto/');
    } catch {
      return false;
    }
  });

  return {
    status: response.status,
    content_type: response.contentType,
    url_count: urls.length,
    product_url_count: productUrls.length,
    hosts,
    ok: response.status === 200
      && urls.length > 0
      && productUrls.length > 0
      && hosts.length === 1
      && hosts[0] === expectedHost,
    product_urls: productUrls.slice(0, PRODUCT_LIMIT),
  };
}

function summarizeProduct(url, response, expectedHost = EXPECTED_HOST) {
  const html = String(response.body || '');
  const pathname = new URL(url).pathname;
  const canonicalMatch = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i);
  const canonical = canonicalMatch ? new URL(canonicalMatch[1]) : null;
  const jsonLdCount = (html.match(new RegExp(JSON_LD_MIME.replace('+', '\\+'), 'g')) || []).length;
  const hasProductOgType = /property="og:type"\s+content="product"/i.test(html);

  return {
    path: pathname,
    status: response.status,
    content_type: response.contentType,
    canonical_host: canonical ? canonical.host : null,
    canonical_path: canonical ? canonical.pathname : null,
    has_product_og_type: hasProductOgType,
    json_ld_count: jsonLdCount,
    ok: response.status === 200
      && canonical?.host === expectedHost
      && canonical?.pathname === pathname
      && hasProductOgType
      && jsonLdCount >= 2,
  };
}

async function main() {
  if (!LIVE_READ) {
    console.log(JSON.stringify({
      ok: true,
      live_read: false,
      reason: 'missing_SEO_PRODUCTION_HOST_LIVE_true',
      expected_host: EXPECTED_HOST,
      note: 'Read-only production host validation requires SEO_PRODUCTION_HOST_LIVE=true.',
    }, null, 2));
    return;
  }

  const checksRootRedirect = EXPECTED_HOST === 'mercadodovale.com.br';
  const validationHost = checksRootRedirect ? CANONICAL_HOST : EXPECTED_HOST;
  const headers = { Host: validationHost };
  const sitemapUrl = `${VPS_ORIGIN.replace(/\/+$/, '')}/sitemap.xml`;
  const redirect = checksRootRedirect
    ? summarizeRedirect(await fetchText(sitemapUrl, { Host: EXPECTED_HOST }, { followRedirects: false }))
    : null;
  const sitemapResponse = await fetchText(sitemapUrl, headers);
  const sitemap = summarizeSitemap(sitemapResponse, validationHost);
  const products = [];

  for (const productUrl of sitemap.product_urls) {
    const pathname = new URL(productUrl).pathname;
    const response = await fetchText(`${VPS_ORIGIN.replace(/\/+$/, '')}${pathname}`, headers);
    products.push(summarizeProduct(productUrl, response, validationHost));
  }

  const ok = (!redirect || redirect.ok) && sitemap.ok && products.length > 0 && products.every((product) => product.ok);
  console.log(JSON.stringify({
    ok,
    live_read: true,
    expected_host: EXPECTED_HOST,
    validation_host: validationHost,
    redirect,
    sitemap,
    products,
  }, null, 2));
  if (!ok) process.exit(1);
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, live_read: LIVE_READ, expected_host: EXPECTED_HOST, error: err.message }, null, 2));
  process.exit(1);
});
