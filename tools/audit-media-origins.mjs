#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import {
  extractMediaRefsFromCatalogBanners,
  extractMediaRefsFromCompanySettings,
  extractMediaRefsFromModelColorImages,
  extractMediaRefsFromProducts,
  summarizeMediaRefs,
} from '../services/mediaAuditExtractors.js';

for (const envPath of ['.env.local', '.env', '../../.env.local', '../../.env']) {
  dotenv.config({ path: envPath, quiet: true });
}

const REPORT_DIR = 'reports';
const JSON_REPORT_PATH = path.join(REPORT_DIR, 'media-origin-audit.json');
const MD_REPORT_PATH = path.join(REPORT_DIR, 'media-origin-audit.md');
const DEFAULT_VPS_BASE_URL = (process.env.VITE_VPS_BASE_URL || process.env.VPS_BASE_URL || 'https://api.xiaomipetrolina.com.br').replace(/\/+$/, '');
const PRODUCT_LIMIT = process.env.MEDIA_AUDIT_PRODUCT_LIMIT || '5000';
const MODEL_COLOR_LIMIT = Number(process.env.MEDIA_AUDIT_MODEL_COLOR_LIMIT || '2000');
const MODEL_COLOR_PAGE_SIZE = Number(process.env.MEDIA_AUDIT_MODEL_COLOR_PAGE_SIZE || '200');

function getVpsHeaders() {
  const headers = {};
  const syncKey = process.env.VITE_VPS_SYNC_KEY || process.env.VPS_SYNC_KEY || process.env.SYNC_SECRET;
  if (syncKey) headers['x-sync-key'] = syncKey;
  return headers;
}

async function fetchJson(url, headers = {}) {
  const res = await fetch(url, {
    method: 'GET',
    headers,
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${res.status} ${url}${body ? ` - ${body.slice(0, 180)}` : ''}`);
  }

  return res.json();
}

async function fetchProductsFromVps() {
  const url = new URL('/products', DEFAULT_VPS_BASE_URL);
  url.searchParams.set('limit', PRODUCT_LIMIT);
  url.searchParams.set('compact', 'false');

  const data = await fetchJson(url.toString(), getVpsHeaders());
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.products)) return data.products;
  if (Array.isArray(data.data)) return data.data;
  return [];
}

async function fetchCompanySettingsFromVps() {
  return fetchJson(new URL('/company-settings', DEFAULT_VPS_BASE_URL).toString(), getVpsHeaders());
}

async function fetchTableRowsFromVps(tableName, { limit = 200, maxRows = Infinity } = {}) {
  const rows = [];
  for (let offset = 0; rows.length < maxRows; offset += limit) {
    const pageLimit = Math.min(limit, maxRows - rows.length);
    const url = new URL(`/table-data/${tableName}`, DEFAULT_VPS_BASE_URL);
    url.searchParams.set('limit', String(pageLimit));
    url.searchParams.set('offset', String(offset));
    const data = await fetchJson(url.toString(), getVpsHeaders());
    const page = Array.isArray(data?.rows) ? data.rows : [];
    rows.push(...page);
    if (page.length < pageLimit) break;
  }
  return rows;
}

async function fetchModelColorImagesFromVps(warnings) {
  const rows = await fetchTableRowsFromVps('model_color_images', {
    limit: MODEL_COLOR_PAGE_SIZE,
    maxRows: MODEL_COLOR_LIMIT,
  });
  if (rows.length >= MODEL_COLOR_LIMIT) {
    warnings.push(`model_color_images limited to ${MODEL_COLOR_LIMIT} rows; increase MEDIA_AUDIT_MODEL_COLOR_LIMIT for a larger audit`);
  }
  return rows;
}

async function fetchVpsRows(warnings) {
  const [modelColorImagesResult, companySettingsResult, catalogBannersResult] = await Promise.allSettled([
    fetchModelColorImagesFromVps(warnings),
    fetchCompanySettingsFromVps(),
    fetchTableRowsFromVps('catalog_banners', { limit: 200 }),
  ]);

  if (modelColorImagesResult.status === 'rejected') {
    warnings.push(`VPS model_color_images: ${modelColorImagesResult.reason?.message || modelColorImagesResult.reason}`);
  }
  if (companySettingsResult.status === 'rejected') {
    warnings.push(`VPS company_settings: ${companySettingsResult.reason?.message || companySettingsResult.reason}`);
  }
  if (catalogBannersResult.status === 'rejected') {
    warnings.push(`VPS catalog_banners: ${catalogBannersResult.reason?.message || catalogBannersResult.reason}`);
  }

  return {
    modelColorImages: modelColorImagesResult.status === 'fulfilled' ? modelColorImagesResult.value : [],
    companySettings: companySettingsResult.status === 'fulfilled' ? companySettingsResult.value : null,
    catalogBanners: catalogBannersResult.status === 'fulfilled' ? catalogBannersResult.value : [],
  };
}

function buildMarkdownReport(report) {
  const originRows = Object.entries(report.summary.byOrigin)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([origin, count]) => `| ${origin} | ${count} |`)
    .join('\n');

  const entityRows = Object.entries(report.summary.byEntityType)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([entityType, count]) => `| ${entityType} | ${count} |`)
    .join('\n');

  const candidateRows = report.refs
    .filter((ref) => ref.shouldMigrate)
    .slice(0, 200)
    .map((ref) => `| ${ref.origin} | ${ref.entityType} | ${ref.entityId} | ${ref.field} | ${ref.redactedUrl} |`)
    .join('\n');

  const warningBlock = report.warnings.length
    ? `\n## Warnings\n\n${report.warnings.map((warning) => `- ${warning}`).join('\n')}\n`
    : '';

  return `# Media Origin Audit

Generated at: ${report.generatedAt}

Read-only: ${report.readOnly ? 'yes' : 'no'}

## Summary

- Total media refs: ${report.summary.total}
- Migration candidates: ${report.summary.migrationCandidates}
- Already canonical VPS refs: ${report.summary.alreadyCanonical}

## Sources Read

- Products from VPS: ${report.sources.products}
- Model/color rows from VPS: ${report.sources.modelColorImages}
- Company settings rows from VPS: ${report.sources.companySettings}
- Catalog banner rows from VPS: ${report.sources.catalogBanners}

## By Origin

| Origin | Count |
|---|---:|
${originRows || '| none | 0 |'}

## By Entity Type

| Entity Type | Count |
|---|---:|
${entityRows || '| none | 0 |'}
${warningBlock}
## Migration Candidates

Showing first 200 candidates. URLs are redacted for signed tokens and sensitive query params.

| Origin | Entity | ID | Field | URL |
|---|---|---|---|---|
${candidateRows || '| none | - | - | - | - |'}
`;
}

export async function runAudit() {
  const warnings = [];

  const [productsResult, vpsRowsResult] = await Promise.allSettled([
    fetchProductsFromVps(),
    fetchVpsRows(warnings),
  ]);

  const products = productsResult.status === 'fulfilled' ? productsResult.value : [];
  if (productsResult.status === 'rejected') {
    warnings.push(`VPS products: ${productsResult.reason?.message || productsResult.reason}`);
  }

  const vpsRows = vpsRowsResult.status === 'fulfilled'
    ? vpsRowsResult.value
    : {
        modelColorImages: [],
        companySettings: null,
        catalogBanners: [],
      };

  if (vpsRowsResult.status === 'rejected') {
    warnings.push(`VPS media rows: ${vpsRowsResult.reason?.message || vpsRowsResult.reason}`);
  }

  const refs = [
    ...extractMediaRefsFromProducts(products),
    ...extractMediaRefsFromModelColorImages(vpsRows.modelColorImages),
    ...extractMediaRefsFromCompanySettings(vpsRows.companySettings),
    ...extractMediaRefsFromCatalogBanners(vpsRows.catalogBanners),
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    limits: {
      productLimit: PRODUCT_LIMIT,
      modelColorLimit: MODEL_COLOR_LIMIT,
      modelColorPageSize: MODEL_COLOR_PAGE_SIZE,
    },
    sources: {
      products: products.length,
      modelColorImages: vpsRows.modelColorImages.length,
      companySettings: vpsRows.companySettings ? 1 : 0,
      catalogBanners: vpsRows.catalogBanners.length,
    },
    summary: summarizeMediaRefs(refs),
    warnings,
    refs,
  };

  await fs.mkdir(REPORT_DIR, { recursive: true });
  await fs.writeFile(JSON_REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  await fs.writeFile(MD_REPORT_PATH, buildMarkdownReport(report));

  return report;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runAudit()
    .then((report) => {
      console.log(`Media audit complete: ${report.summary.total} refs, ${report.summary.migrationCandidates} candidates`);
      console.log(`Wrote ${JSON_REPORT_PATH}`);
      console.log(`Wrote ${MD_REPORT_PATH}`);
      if (report.warnings.length > 0) {
        console.log(`Warnings: ${report.warnings.length}`);
      }
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
