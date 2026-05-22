const http = require('http');
const https = require('https');

const SITEMAP_URL = process.env.SEO_SPECIAL_SLUGS_SITEMAP_URL || 'http://76.13.232.162/sitemap.xml';
const VPS_HOST = process.env.SEO_SPECIAL_SLUGS_HOST || 'staging.mercadodovale.com.br';
const LIVE_READ = process.env.SEO_SPECIAL_SLUGS_LIVE === 'true';
const MAX_SLUGS = Math.max(1, Math.min(Number(process.env.SEO_SPECIAL_SLUGS_LIMIT || 8), 20));
const JSON_LD_MIME = 'application/ld+json';

function fetchText(url, headers = {}, redirectCount = 0) {
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
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && location) {
          if (redirectCount >= 5) {
            reject(new Error(`Too many redirects fetching ${url}`));
            return;
          }
          fetchText(new URL(location, url).toString(), headers, redirectCount + 1).then(resolve, reject);
          return;
        }
        resolve({
          status: res.statusCode,
          contentType: res.headers['content-type'] || '',
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

function parseSitemapUrls(xml) {
  return [...String(xml || '').matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((match) => match[1])
    .filter((value) => {
      try {
        return new URL(value).pathname.startsWith('/produto/');
      } catch {
        return false;
      }
    });
}

function scoreProductUrl(value) {
  const pathname = new URL(value).pathname;
  const slug = decodeURIComponent(pathname.replace(/^\/produto\//, ''));
  let score = 0;
  if (slug.length > 70) score += 5;
  if (/\d/.test(slug)) score += 2;
  if (slug.includes('--')) score += 2;
  if (/[^a-z0-9-]/i.test(slug)) score += 4;
  if (slug.split('-').length >= 8) score += 3;
  return score;
}

function selectSpecialProductUrls(urls) {
  const unique = [...new Set(urls)];
  const selected = unique
    .map((url) => ({ url, score: scoreProductUrl(url) }))
    .sort((a, b) => b.score - a.score || b.url.length - a.url.length)
    .slice(0, MAX_SLUGS)
    .map((item) => item.url);

  if (selected.length < MAX_SLUGS) {
    for (const url of unique) {
      if (!selected.includes(url)) selected.push(url);
      if (selected.length >= MAX_SLUGS) break;
    }
  }

  return selected;
}

function sanitizeSeoSpecialSlugResult(url, response) {
  const html = String(response?.body || '');
  const pathname = new URL(url).pathname;
  const canonicalMatch = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i);
  const jsonLdCount = (html.match(new RegExp(JSON_LD_MIME.replace('+', '\\+'), 'g')) || []).length;
  const hasProductOgType = /property="og:type"\s+content="product"/i.test(html);
  const hasHomeCanonical = /href="https:\/\/(?:www\.)?mercadodovale\.com\.br\/"\s*\/?>/i.test(html);

  return {
    path: pathname,
    status: response.status,
    content_type: response.contentType,
    has_canonical: !!canonicalMatch,
    canonical_path: canonicalMatch ? new URL(canonicalMatch[1]).pathname : null,
    canonical_host: canonicalMatch ? new URL(canonicalMatch[1]).host : null,
    has_product_og_type: hasProductOgType,
    json_ld_count: jsonLdCount,
    has_home_canonical: hasHomeCanonical,
    html_bytes: Buffer.byteLength(html),
    ok: response.status === 200
      && !!canonicalMatch
      && canonicalMatch[1].includes(pathname)
      && hasProductOgType
      && jsonLdCount >= 2
      && !hasHomeCanonical,
  };
}

async function main() {
  if (!LIVE_READ) {
    console.log(JSON.stringify({
      ok: true,
      live_read: false,
      reason: 'missing_SEO_SPECIAL_SLUGS_LIVE_true',
      inspected: [],
      note: 'Read-only live validation requires SEO_SPECIAL_SLUGS_LIVE=true.',
    }, null, 2));
    return;
  }

  const sitemap = await fetchText(SITEMAP_URL, { Host: VPS_HOST });
  const urls = parseSitemapUrls(sitemap.body);
  const selected = selectSpecialProductUrls(urls);
  const inspected = [];

  for (const url of selected) {
    const target = new URL(url);
    const response = await fetchText(`http://76.13.232.162${target.pathname}`, { Host: VPS_HOST });
    inspected.push(sanitizeSeoSpecialSlugResult(url, response));
  }

  const ok = sitemap.status === 200 && inspected.length > 0 && inspected.every((item) => item.ok);
  console.log(JSON.stringify({
    ok,
    live_read: true,
    sitemap_status: sitemap.status,
    sitemap_product_url_count: urls.length,
    inspected_count: inspected.length,
    inspected,
  }, null, 2));
  if (!ok) process.exit(1);
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, live_read: LIVE_READ, error: err.message }, null, 2));
  process.exit(1);
});
