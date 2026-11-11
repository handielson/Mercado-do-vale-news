// marketing-live-now-v1: a Central de Aprovações mostra o que está no ar e arquiva falhas antigas.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { isArchivedFailure, storeClockLabel, upcomingStories } from '../utils/marketingLiveNow.js';

const NOW = Date.parse('2026-11-11T12:30:00Z');
const story = (id, status, at, items = []) => ({ id, status, title: id, scheduled_at: at, destinations: ['whatsapp'], items });

test('stories agendados: só os que ainda vão sair, do mais próximo ao mais distante', () => {
  const list = upcomingStories([
    story('depois', 'approved', '2026-11-14T11:00:00.000Z'),
    story('amanha', 'approved', '2026-11-12T11:00:00.000Z'),
    story('feito', 'completed', '2026-11-13T11:00:00.000Z'),
    story('cancelado', 'cancelled', '2026-11-13T11:00:00.000Z'),
    story('passou', 'approved', '2026-11-10T11:00:00.000Z'),
    story('serie', 'scheduled', '2026-11-10T11:00:00.000Z', [{ scheduled_at: '2026-11-10T11:00:00.000Z' }, { scheduled_at: '2026-11-13T11:00:00.000Z' }]),
  ], NOW);
  assert.deepEqual(list.map(entry => entry.schedule.id), ['amanha', 'serie', 'depois']);
  assert.equal(list[1].next, Date.parse('2026-11-13T11:00:00.000Z'), 'série mostra a próxima mídia, não a primeira');
});

test('horário da loja devolvido como UTC é mostrado sem trocar o fuso', () => {
  assert.equal(storeClockLabel('2026-11-11T11:00:02.000Z'), '11/11 11:00');
  assert.equal(storeClockLabel('2026-11-11 08:00:02'), '11/11 08:00');
  assert.equal(storeClockLabel(null), '');
});

test('falha com mais de 30 dias é arquivada; recentes e outros status não', () => {
  assert.equal(isArchivedFailure({ status: 'failed', created_at: '2026-08-30 15:36:39', updated_at: '2026-08-30 15:40:00' }, NOW), true);
  assert.equal(isArchivedFailure({ status: 'failed', created_at: '2026-11-01T10:00:00Z' }, NOW), false);
  assert.equal(isArchivedFailure({ status: 'succeeded', created_at: '2026-08-30 15:36:39' }, NOW), false);
});

test('painel ligado na Central de Aprovações', () => {
  const center = fs.readFileSync(new URL('../pages/admin/settings/marketing/MarketingApprovalCenterPanel.tsx', import.meta.url), 'utf8');
  assert.match(center, /<MarketingLiveNowPanel \/>/);
  assert.match(center, /failed: Math\.max\(0, Number\(counts\.failed \|\| 0\) - archivedFailures\)/);
  assert.match(center, /visibleRequests\.map\(/);
  const panel = fs.readFileSync(new URL('../pages/admin/settings/marketing/MarketingLiveNowPanel.tsx', import.meta.url), 'utf8');
  for (const call of ['socialStoryScheduleService.list()', 'promoCampaignService.listProductPromotions()', 'facebookMarketplaceCampaignService.listCampaigns()', 'whatsappStatusCampaignService.list()']) assert.ok(panel.includes(call), call);
  assert.match(panel, /productPromotionEditPath\(promo\)/);
  assert.match(panel, /\?tab=facebook/);
  assert.match(panel, /\?tab=whatsapp/);
  assert.match(panel, /storeClockLabel\(campaign\.next_run_at\)/);
});
