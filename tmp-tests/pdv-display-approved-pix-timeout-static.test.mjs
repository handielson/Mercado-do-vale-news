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
  /if \(status === 'pending'\) return true;/,
  'Pending Pix must always take over the totem while it is the active Pix'
);

assert.doesNotMatch(
  source,
  /PIX_QR_VISIBLE_MS/,
  'Display must not expire an active pending Pix in the WebView layer'
);

assert.match(
  source,
  /Aguardando pagamento/,
  'Pending Pix must show a waiting-for-payment state instead of a visual expiration countdown'
);

assert.match(
  source,
  /mdv:force-display-refresh/,
  'Native Android wake event must force the display to refresh active Pix state immediately'
);

assert.match(
  source,
  /if \(showPix\) setSettingsOpen\(false\);/,
  'Active Pix must close settings overlays and take the foreground'
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
  /const showPix = shouldShowPixPayment\(active_pix, now\) && !\(activePixDismissalId && dismissedApprovedReceipts\[activePixDismissalId\]\);/,
  'Display rendering must use the capped Pix visibility rule'
);

assert.match(
  source,
  /<PixView payment=\{active_pix\} display=\{display\} now=\{now\} displayToken=\{token\} onDismissApprovedReceipt=\{dismissApprovedReceipt\} \/>/,
  'Display must pass its pairing token to the approved receipt view'
);

assert.match(
  source,
  /createDisplayPixReceiptShareLink\(payment\.id,\s*displayToken\)/,
  'Display receipt QR must use the display-token endpoint instead of the sync-key admin endpoint'
);

assert.match(
  source,
  /sendDisplayPixReceiptWhatsApp\(payment\.id,\s*displayToken,\s*\{\s*phone\s*\}\)/,
  'Display receipt WhatsApp must use the display-token endpoint instead of the sync-key admin endpoint'
);

assert.match(
  source,
  /phoneModalOpen/,
  'Display receipt WhatsApp entry must open in a modal'
);

assert.match(
  source,
  /appendPhoneDigit/,
  'Display receipt WhatsApp modal must use the on-screen numeric keypad'
);

assert.match(
  source,
  /Confirmar numero/,
  'Display receipt WhatsApp modal must have an explicit confirmation button'
);

assert.match(
  source,
  /getRemainingMs\(payment\.approved_at \|\| payment\.updated_at \|\| payment\.created_at, APPROVED_RECEIPT_VISIBLE_MS, now\)/,
  'Receipt countdown must use approved_at before updated_at'
);

console.log('pdv display approved pix timeout static checks passed');
