import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const messageSource = readFileSync('utils/catalogMessageGenerator.ts', 'utf8');
const pdfSource = readFileSync('utils/catalogPDFGenerator.ts', 'utf8');

assert.match(
  messageSource,
  /export function generateCatalogMessage[\s\S]*products\s*=\s*normalizeProducts\(products\)/,
  'generateCatalogMessage must filter out-of-stock products even when products are passed from the current catalog view',
);

assert.match(
  pdfSource,
  /export async function generateCatalogPDF[\s\S]*products\s*=\s*normalizeProducts\(products\)/,
  'generateCatalogPDF must filter out-of-stock products even when products are passed from the current catalog view',
);

console.log('catalog share stock guard static checks passed');
