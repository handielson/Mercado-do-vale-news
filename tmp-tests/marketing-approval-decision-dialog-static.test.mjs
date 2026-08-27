import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const panel = await readFile(
  new URL('../pages/admin/settings/marketing/MarketingApprovalCenterPanel.tsx', import.meta.url),
  'utf8',
);

test('rejection reason stays visible beside the confirmation actions', () => {
  const scrollableDetailsEnd = panel.indexOf('</div>\n                        <div className="shrink-0 border-t');
  const reasonField = panel.indexOf('Motivo da rejeição (obrigatório)');
  const confirmButton = panel.lastIndexOf("decision === 'reject' && !note.trim()");

  assert.ok(scrollableDetailsEnd >= 0, 'the decision footer must remain outside the scrollable details');
  assert.ok(reasonField > scrollableDetailsEnd, 'the reason field must be rendered in the fixed decision footer');
  assert.ok(confirmButton > reasonField, 'the rejection action must follow the reason field');
  assert.match(panel, /required=\{decision === 'reject'\}/);
  assert.match(panel, /aria-required=\{decision === 'reject'\}/);
});

test('decision footer leaves a safe visible gap above the viewport edge', () => {
  assert.match(panel, /pb-\[max\(1\.5rem,env\(safe-area-inset-bottom\)\)\]/);
  assert.match(panel, /shadow-\[0_-8px_24px_rgba\(15,23,42,0\.10\)\]/);
});
