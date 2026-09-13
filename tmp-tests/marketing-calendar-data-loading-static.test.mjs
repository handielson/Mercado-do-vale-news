import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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
assert.match(
  calendar,
  /if \(event\.status === 'failed'\) return false;/,
  'Cancelled or rejected records must not look like active publications in the calendar',
);
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

console.log('marketing calendar data-loading static checks passed');
