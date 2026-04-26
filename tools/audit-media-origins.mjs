#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
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
const DEFAULT_VPS_BASE_URL = process.env.VITE_VPS_BASE_URL || process.env.VPS_BASE_URL || 'https://api.xiaomipetrolina.com.br';
const PRODUCT_LIMIT = process.env.MEDIA_AUDIT_PRODUCT_LIMIT || '5000';
const MODEL_COLOR_LIMIT = Number(process.env.MEDIA_AUDIT_MODEL_COLOR_LIMIT || '2000');
const MODEL_COLOR_PAGE_SIZE = Number(process.env.MEDIA_AUDIT_MODEL_COLOR_PAGE_SIZE || '50');

function getSupabaseEnv() {
  return {
    url: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
    key: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
  };
}

function getVpsHeaders() {
  const headers = {};
  const syncKey = process.env.VITE_VPS_SYNC_KEY || process.env.VPS_SYNC_KEY;
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

function createSupabaseReadClient(warnings) {
  const { url, key } = getSupabaseEnv();
  if (!url || !key) {
    warnings.push('Supabase env vars missing; skipped Supabase-backed image sources');
    return null;
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

async function selectArray(promise, label, warnings) {
  const { data, error } = await promise;
  if (error) {
    warnings.push(`${label}: ${error.message}`);
    return [];
  }
  return Array.isArray(data) ? data : [];
}

async function selectObject(promise, label, warnings) {
  const { data, error } = await promise;
  if (error) {
    warnings.push(`${label}: ${error.message}`);
    return null;
  }
  return data || null;
}

async function selectPagedModelColorImages(supabase, warnings) {
  const rows = [];
  let offset = 0;

  while (offset < MODEL_COLOR_LIMIT) {
    const pageSize = Math.min(MODEL_COLOR_PAGE_SIZE, MODEL_COLOR_LIMIT - offset);
    const { data, error } = await supabase
      .from('model_color_images')
      .select('id, model_id, color_id, images')
      .range(offset, offset + pageSize - 1);

    if (error) {
      warnings.push(`model_color_images page ${offset}-${offset + pageSize - 1}: ${error.message}`);
      break;
    }

    const page = Array.isArray(data) ? data : [];
    rows.push(...page);

    if (page.length < pageSize) break;
    offset += pageSize;
  }

  if (rows.length >= MODEL_COLOR_LIMIT) {
    warnings.push(`model_color_images limited to ${MODEL_COLOR_LIMIT} rows; increase MEDIA_AUDIT_MODEL_COLOR_LIMIT for a larger audit`);
  }

  return rows;
}

async function fetchSupabaseRows(warnings) {
  const supabase = createSupabaseReadClient(warnings);
  if (!supabase) {
    return {
      modelColorImages: [],
      companySettings: null,
      catalogBanners: [],
    };
  }

  const [modelColorImages, companySettings, catalogBanners] = await Promise.all([
    selectPagedModelColorImages(supabase, warnings),
    selectObject(
      supabase
        .from('company_settings')
        .select('id, name, logo, favicon, about_us_image_url, watermark_url')
        .limit(1)
        .maybeSingle(),
      'company_settings',
      warnings,
    ),
    selectArray(
      supabase.from('catalog_banners').select('*'),
      'catalog_banners',
      warnings,
    ),
  ]);

  return { modelColorImages, companySettings, catalogBanners };
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
- Model/color rows from Supabase: ${report.sources.modelColorImages}
- Company settings rows from Supabase: ${report.sources.companySettings}
- Catalog banner rows from Supabase: ${report.sources.catalogBanners}

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

  const [productsResult, supabaseResult] = await Promise.allSettled([
    fetchProductsFromVps(),
    fetchSupabaseRows(warnings),
  ]);

  const products = productsResult.status === 'fulfilled' ? productsResult.value : [];
  if (productsResult.status === 'rejected') {
    warnings.push(`VPS products: ${productsResult.reason?.message || productsResult.reason}`);
  }

  const supabaseRows = supabaseResult.status === 'fulfilled'
    ? supabaseResult.value
    : {
        modelColorImages: [],
        companySettings: null,
        catalogBanners: [],
      };

  if (supabaseResult.status === 'rejected') {
    warnings.push(`Supabase: ${supabaseResult.reason?.message || supabaseResult.reason}`);
  }

  const refs = [
    ...extractMediaRefsFromProducts(products),
    ...extractMediaRefsFromModelColorImages(supabaseRows.modelColorImages),
    ...extractMediaRefsFromCompanySettings(supabaseRows.companySettings),
    ...extractMediaRefsFromCatalogBanners(supabaseRows.catalogBanners),
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
      modelColorImages: supabaseRows.modelColorImages.length,
      companySettings: supabaseRows.companySettings ? 1 : 0,
      catalogBanners: supabaseRows.catalogBanners.length,
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
