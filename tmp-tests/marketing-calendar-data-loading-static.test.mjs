import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const calendar = readFileSync(
  'pages/admin/settings/marketing/MarketingCalendarPanel.tsx',
  'utf8',
);

assert.match(
  calendar,
  /instagramScheduleService\.list\(\)/,
  'Calendar must call the canonical Instagram schedule list method',
);
assert.match(
  calendar,
  /whatsappStatusCampaignService\.list\(\)/,
  'Calendar must load the canonical WhatsApp Status campaign schedule',
);
assert.match(
  calendar,
  /facebookMarketplaceScheduleService\.list\(\)/,
  'Calendar must load the canonical Facebook Marketplace publication queue',
);
assert.doesNotMatch(
  calendar,
  /instagramScheduleService\.listSlots\(/,
  'Calendar must not call the nonexistent listSlots method',
);
assert.match(
  calendar,
  /type:\s*'weekly_slot'[\s\S]*?dateKey,[\s\S]*?statusLabel:\s*'Grade semanal'/,
  'Recurring weekly Instagram slots must be materialized as dated calendar events',
);
assert.match(
  calendar,
  /type:\s*'whatsapp_campaign'[\s\S]*?destinations:\s*\['whatsapp'\]/,
  'WhatsApp Status campaigns must be materialized as dated calendar events',
);
assert.match(
  calendar,
  /type:\s*'facebook_schedule'[\s\S]*?destinations:\s*\['facebook'\]/,
  'Facebook Marketplace schedules must be materialized as dated calendar events',
);
assert.match(
  calendar,
  /setChannelFilter\('facebook'\)/,
  'Calendar must expose the Facebook channel filter',
);
assert.match(
  calendar,
  /event\.rawPayload\?\.schedule\?\.approval_id\s*===\s*app\.id/,
  'A Story schedule and its approval request must not appear as duplicate events',
);
assert.match(
  calendar,
  /Parte das programações não pôde ser carregada/,
  'Partial data-source failures must be visible to the operator',
);
assert.match(
  calendar,
  /hasTimeZone[\s\S]*?timeZone:\s*'America\/Sao_Paulo'/,
  'Zoned Story timestamps must be converted to the Sao Paulo calendar time',
);
assert.match(
  calendar,
  /function CalendarMediaPreview[\s\S]*?<video[\s\S]*?preload="metadata"/,
  'Video Story media must render a real video-frame preview instead of a broken image',
);
assert.match(
  calendar,
  /Possível duplicidade em/,
  'Overlapping Story schedules must be visibly flagged instead of silently looking identical',
);
assert.doesNotMatch(calendar, /if \(event\.status === 'failed'\) return false;/,
  'Failed deliveries must remain visible in the all-status calendar');
assert.match(calendar, /if \(!isVisibleCalendarEvent\(event\)\) return false;/);
assert.match(calendar, /schedule\.status === 'partial'[\s\S]*?normalizedStatus = 'partial';[\s\S]*?statusLabel = 'Concluído parcialmente';/);
assert.match(calendar, /case 'partial':\s*return 'bg-amber-50/,
  'Partial publication must use warning styling');
assert.match(calendar, /<StoryDeliveryDetails items=\{event\.rawPayload\?\.dayItems \|\| \[\]\}/);

// Exercise the real presentation with the incident: Instagram published, WhatsApp timed out.
const require = createRequire(import.meta.url);
const compiled = ts.transpileModule(calendar, { compilerOptions: {
  jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true,
} }).outputText;
const module = { exports: {} };
new Function('require', 'module', 'exports', compiled)(
  (name) => name === 'react' ? require(name) : {}, module, module.exports,
);
const { isVisibleCalendarEvent, StoryDeliveryDetails } = module.exports;
for (const status of ['failed', 'partial', 'completed', 'pending', 'approved']) {
  assert.equal(isVisibleCalendarEvent({ status }), true, `${status} must remain visible`);
}
assert.equal(isVisibleCalendarEvent({ status: 'cancelled' }), false);
const incident = [{ label: 'Realme_C71.png', deliveries: [
  { id: 'ig', destination: 'instagram', status: 'published' },
  { id: 'wa', destination: 'whatsapp', status: 'failed', error: 'The operation was aborted due to timeout' },
] }];
const html = renderToStaticMarkup(React.createElement(StoryDeliveryDetails, { items: incident }));
assert.match(html, /Instagram: Publicado/);
assert.match(html, /WhatsApp: Falhou/);
assert.match(html, /The operation was aborted due to timeout/);
assert.match(html, /border-rose-200/);
const batch = renderToStaticMarkup(React.createElement(StoryDeliveryDetails, { items: [
  ...incident, { label: 'Outro.png', deliveries: [{ id: 'wa2', destination: 'whatsapp', status: 'published' }] },
] }));
assert.match(batch, /WhatsApp: Falhou \(1\/2\) · Publicado \(1\/2\)/);
assert.match(batch, /Realme_C71.png: /);
assert.doesNotThrow(() => renderToStaticMarkup(React.createElement(StoryDeliveryDetails, { items: [{}] })));
assert.match(
  calendar,
  /title="Excluir programação"/,
  'Calendar day details must expose a direct delete action',
);
assert.match(
  calendar,
  /window\.confirm\(confirmation\)/,
  'Deleting a calendar schedule must require explicit confirmation',
);
assert.match(
  calendar,
  /socialStoryScheduleService\.cancel\(targetId\)/,
  'Story schedules must use the canonical cancellation endpoint',
);
assert.match(
  calendar,
  /instagramScheduleService\.delete\(targetId\)/,
  'Weekly Instagram slots must use the canonical delete service',
);
assert.match(
  calendar,
  /whatsappStatusCampaignService\.delete\(targetId\)/,
  'WhatsApp campaigns must use the canonical delete service',
);
assert.match(
  calendar,
  /facebookMarketplaceScheduleService\.delete\(targetId\)/,
  'Facebook schedules must use the canonical delete service',
);
assert.match(
  calendar,
  /Todos os Stories ainda pendentes deste lote, inclusive em outros dias/,
  'Multi-day Story deletion must disclose that the whole batch is cancelled',
);
assert.match(
  calendar,
  /holidayService\.getCalendarHolidays\(holidayYear\)/,
  'Calendar must reuse the canonical national and regional holiday service',
);
assert.match(
  calendar,
  /Legenda dos tipos de dia/,
  'Calendar must explain the distinction between weekdays, weekends, and holidays',
);
assert.match(
  calendar,
  /Feriado nacional/,
  'National holidays must be visibly labelled in the calendar',
);
assert.match(
  calendar,
  /calendarDaySurfaceClass\(day\)/,
  'Calendar day cells must use the centralized visual classification',
);
assert.match(
  calendar,
  /selectedDayData\.kind !== 'weekday'/,
  'Selected weekend and holiday days must identify their type in the details panel',
);

const { getCalendarDayKind } = module.exports;
assert.equal(getCalendarDayKind('2026-09-16'), 'weekday');
assert.equal(getCalendarDayKind('2026-09-19'), 'saturday');
assert.equal(getCalendarDayKind('2026-09-20'), 'sunday');
assert.equal(getCalendarDayKind('2026-09-07', { date: '2026-09-07', name: 'Independência do Brasil', type: 'national' }), 'holiday');

assert.match(calendar, /Feriados do calendário · \{year\}/);
assert.match(calendar, /Pernambuco · estaduais/);
assert.match(calendar, /Bahia · estaduais/);
assert.match(calendar, /Petrolina-PE · municipais/);
assert.match(calendar, /Juazeiro-BA · municipais/);
assert.match(calendar, /companySettingsService\.update\(\{ local_holidays: next \}\)/,
  'Manual holidays must reuse the canonical company settings storage');

const holidayServiceSource = readFileSync('utils/holidayService.ts', 'utf8');
const holidayCompiled = ts.transpileModule(holidayServiceSource, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
} }).outputText;
const holidayModule = { exports: {} };
new Function('require', 'module', 'exports', holidayCompiled)(require, holidayModule, holidayModule.exports);
const regional2026 = holidayModule.exports.getRegionalHolidays(2026);
assert.ok(regional2026.some((holiday) => holiday.date === '2026-03-06' && holiday.location === 'Pernambuco'));
assert.ok(regional2026.some((holiday) => holiday.date === '2026-07-02' && holiday.location === 'Bahia'));
assert.ok(regional2026.some((holiday) => holiday.date === '2026-06-04' && holiday.location === 'Petrolina-PE' && holiday.name === 'Corpus Christi'));
assert.ok(regional2026.some((holiday) => holiday.date === '2026-09-21' && holiday.location === 'Petrolina-PE'));
assert.ok(regional2026.some((holiday) => holiday.date === '2026-02-17' && holiday.location === 'Juazeiro-BA' && holiday.name === 'Carnaval'));
assert.ok(regional2026.some((holiday) => holiday.date === '2026-09-08' && holiday.location === 'Juazeiro-BA'));

console.log('marketing calendar data-loading static checks passed');
