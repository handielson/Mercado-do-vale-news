import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const serverPaths = [
  path.join(root, 'server.js'),
  path.join(root, 'vps_server.js'),
  path.join(root, 'vps_server.cjs'),
];
const servicePath = path.join(root, 'services', 'autoResponderService.ts');
const pagePath = path.join(root, 'pages', 'admin', 'AutoResponderPage.tsx');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const serverPath of serverPaths) {
  const source = fs.readFileSync(serverPath, 'utf8');
  const filename = path.basename(serverPath);

  assert(
    source.includes("fastify.post('/autoresponder/conversations/:sender/reset-counters'"),
    `${filename} must expose a reset counters route`
  );
  assert(
    /paused_until = NULL,\s*pause_reason = NULL,\s*consecutive_fallbacks = 0,\s*reply_count = 0,\s*reply_window_started_at = NULL/.test(source),
    `${filename} reset route must clear pause and reply/fallback counters`
  );

  const humanBranchStart = source.indexOf('if (detectedIntent.humanRequest) {');
  assert(humanBranchStart >= 0, `${filename} must keep human request branch`);
  const humanBranchEnd = source.indexOf('const phoneListOptInReply', humanBranchStart);
  assert(humanBranchEnd > humanBranchStart, `${filename} must keep phone opt-in after human branch`);
  const humanBranch = source.slice(humanBranchStart, humanBranchEnd);
  assert(
    !humanBranch.includes("pause_reason = 'human_request'") && !humanBranch.includes("DATE_ADD(NOW(), INTERVAL ? MINUTE)"),
    `${filename} human request must not pause the conversation`
  );
  assert(
    humanBranch.includes('await upsertAutoresponderSuccessConversation(senderKey);'),
    `${filename} human request must keep the conversation active`
  );
  assert(
    source.includes('SELECT paused_until, pause_reason FROM autoresponder_conversations WHERE sender = ? LIMIT 1')
      && source.includes("String(conversationRows[0]?.pause_reason || '') === 'human_request'"),
    `${filename} must automatically clear old human_request pauses`
  );
}

const service = fs.readFileSync(servicePath, 'utf8');
assert(
  service.includes('resetConversationCounters: (sender: string): Promise<AutoResponderOk>'),
  'autoResponderService must expose resetConversationCounters'
);
assert(
  service.includes('/reset-counters'),
  'autoResponderService must call reset-counters route'
);

const page = fs.readFileSync(pagePath, 'utf8');
assert(
  page.includes('const resetConversationCounters = async (sender: string)'),
  'AutoResponderPage must define resetConversationCounters action'
);
assert(
  page.includes('autoResponderService.resetConversationCounters(sender)'),
  'AutoResponderPage must call resetConversationCounters service'
);
assert(
  page.includes('Zerar contadores'),
  'AutoResponderPage must render a Zerar contadores button'
);

console.log('autoresponder reset counters and human no-pause static checks passed');
