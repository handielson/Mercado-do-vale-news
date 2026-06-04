import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('pages/display/DisplayPage.tsx', 'utf8');

assert.match(
  source,
  /const APPROVED_PIX_VISIBLE_MS = 8000;/,
  'Display must cap how long an approved Pix confirmation remains visible'
);

assert.match(
  source,
  /export function shouldShowPixPayment\(payment: PdvPixPayment \| null, now = Date\.now\(\)\): boolean/,
  'Display must centralize Pix visibility rules'
);

assert.match(
  source,
  /if \(status === 'pending'\) return true;/,
  'Pending Pix must continue showing the QR code'
);

assert.match(
  source,
  /if \(status !== 'approved'\) return false;/,
  'Only pending and recent approved Pix may be shown'
);

assert.match(
  source,
  /return now - approvedAt < APPROVED_PIX_VISIBLE_MS;/,
  'Approved Pix must stop showing after the confirmation window'
);

assert.match(
  source,
  /const showPix = shouldShowPixPayment\(active_pix\);/,
  'Display rendering must use the capped Pix visibility rule'
);

console.log('pdv display approved pix timeout static checks passed');
