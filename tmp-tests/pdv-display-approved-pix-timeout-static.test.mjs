import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('pages/display/DisplayPage.tsx', 'utf8');

assert.match(
  source,
  /const APPROVED_RECEIPT_VISIBLE_MS = 10 \* 60 \* 1000;/,
  'Display must keep the approved Pix receipt visible long enough to share'
);

assert.match(
  source,
  /export function shouldShowPixPayment\(payment: PdvPixPayment \| null, now = Date\.now\(\)\): boolean/,
  'Display must centralize Pix visibility rules'
);

assert.match(
  source,
  /if \(status === 'pending'\) return now - startedAt < PIX_QR_VISIBLE_MS;/,
  'Pending Pix must continue showing the QR code within the QR visibility window'
);

assert.match(
  source,
  /if \(status !== 'approved'\) return false;/,
  'Only pending and recent approved Pix may be shown'
);

assert.match(
  source,
  /const approvedAt = Date\.parse\(String\(payment\.approved_at \|\| payment\.updated_at \|\| payment\.created_at \|\| ''\)\);/,
  'Approved Pix visibility must prefer the immutable approved_at timestamp'
);

assert.match(
  source,
  /return now - approvedAt < APPROVED_RECEIPT_VISIBLE_MS;/,
  'Approved Pix must stop showing after the receipt sharing window'
);

assert.match(
  source,
  /const showPix = shouldShowPixPayment\(active_pix, now\);/,
  'Display rendering must use the capped Pix visibility rule'
);

assert.match(
  source,
  /getRemainingMs\(payment\.approved_at \|\| payment\.updated_at \|\| payment\.created_at, APPROVED_RECEIPT_VISIBLE_MS, now\)/,
  'Receipt countdown must use approved_at before updated_at'
);

console.log('pdv display approved pix timeout static checks passed');
