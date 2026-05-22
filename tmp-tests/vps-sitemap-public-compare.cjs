const http = require('http');
const https = require('https');

const PRODUCTION_URL = process.env.SITEMAP_PRODUCTION_URL || 'https://mercadodovale.com.br/sitemap.xml';
const VPS_URL = process.env.SITEMAP_VPS_URL || 'http://76.13.232.162/sitemap.xml';
const VPS_HOST = process.env.SITEMAP_VPS_HOST || 'staging.mercadodovale.com.br';

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
          const nextUrl = new URL(location, url).toString();
          fetchText(nextUrl, headers, redirectCount + 1).then(resolve, reject);
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

function parseUrls(xml) {
  return [...String(xml || '').matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
}

function summarize(name, response) {
  const urls = parseUrls(response.body);
  const hosts = [...new Set(urls.map((value) => {
    try {
      return new URL(value).host;
    } catch {
      return 'invalid-url';
    }
  }))].sort();

  return {
    name,
    status: response.status,
    content_type: response.contentType,
    final_url_host: response.finalUrl ? new URL(response.finalUrl).host : null,
    url_count: urls.length,
    hosts,
    first_path: urls[0] ? new URL(urls[0]).pathname : null,
    last_path: urls.at(-1) ? new URL(urls.at(-1)).pathname : null,
  };
}

async function main() {
  const production = await fetchText(PRODUCTION_URL);
  const vps = await fetchText(VPS_URL, { Host: VPS_HOST });

  const productionSummary = summarize('production', production);
  const vpsSummary = summarize('vps_staging', vps);

  console.log(JSON.stringify({
    ok: production.status === 200 && vps.status === 200,
    production: productionSummary,
    vps_staging: vpsSummary,
    count_delta: vpsSummary.url_count - productionSummary.url_count,
    note: 'Only public sitemap URLs and counts are printed.',
  }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
