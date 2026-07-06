import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const displayPage = readFileSync('pages/display/DisplayPage.tsx', 'utf8');

assert.match(
  displayPage,
  /DISMISSED_APPROVED_RECEIPTS_STORAGE_KEY = '@mdv_dismissed_approved_receipts'/,
  'display must persist manually closed approved receipts locally',
);

assert.match(
  displayPage,
  /function getApprovedReceiptDismissalId\(payment: PdvPixPayment \| null\): string[\s\S]*payment\.status !== 'approved'/,
  'manual close must only apply to approved Pix receipts',
);

assert.match(
  displayPage,
  /function readDismissedApprovedReceipts[\s\S]*Number\(expiresAt\) > now/,
  'manual close entries must expire instead of hiding receipts forever',
);

assert.match(
  displayPage,
  /const showPix = shouldShowPixPayment\(active_pix, now\) && !\(activePixDismissalId && dismissedApprovedReceipts\[activePixDismissalId\]\)/,
  'display must hide a manually closed approved receipt even while polling still returns it',
);

assert.match(
  displayPage,
  /function dismissApprovedReceipt\(payment: PdvPixPayment\)[\s\S]*saveDismissedApprovedReceipts\(next\)/,
  'display must save the dismissed receipt before returning to idle',
);

assert.match(
  displayPage,
  /<ApprovedReceiptView[\s\S]*onDismiss=\{\(\) => onDismissApprovedReceipt\(payment\)\}/,
  'approved receipt view must receive a manual close callback',
);

assert.match(
  displayPage,
  /<X className="h-5 w-5" \/>[\s\S]*Fechar/,
  'approved receipt view must render a visible Fechar button',
);

console.log('pdv display approved receipt dismiss static checks passed');
