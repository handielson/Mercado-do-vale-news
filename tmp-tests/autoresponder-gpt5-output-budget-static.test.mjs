import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const files = ['vps_server.js', 'vps_server.cjs', 'server.js'];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const file of files) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const callStart = source.indexOf('async function callAutoresponderOpenAi');
  assert(callStart >= 0, `${file}: callAutoresponderOpenAi not found`);
  const callBlock = source.slice(callStart, source.indexOf('\n}\n\nasync function buildAutoresponderNeedsPromptReply', callStart));

  assert(
    callBlock.includes('const outputTokenBudget = Math.max(600, Number(maxOutputTokens) || 0);'),
    `${file}: OpenAI calls must reserve enough output budget for GPT-5 text`
  );
  assert(
    callBlock.includes('max_output_tokens: outputTokenBudget'),
    `${file}: OpenAI calls must use the protected output token budget`
  );
  assert(
    callBlock.includes("reasoning: { effort: aiConfig.reasoningEffort }"),
    `${file}: GPT-5 calls must use configured reasoning effort`
  );
  assert(
    callBlock.includes("text: { verbosity: 'low' }"),
    `${file}: WhatsApp AI replies must request low verbosity`
  );

  assert(
    source.includes('function normalizeAutoresponderAiReasoningEffort'),
    `${file}: AI reasoning effort must be normalized`
  );
  assert(
    source.includes("return ['low', 'medium', 'high'].includes(normalized) ? normalized : 'low';"),
    `${file}: AI reasoning effort must fall back to low`
  );
  assert(
    source.includes('ai_reasoning_effort: (v) => normalizeAutoresponderAiReasoningEffort(v)'),
    `${file}: settings API must accept ai_reasoning_effort`
  );
  assert(
    source.includes("addColumnIfMissing('autoresponder_settings', 'ai_reasoning_effort'"),
    `${file}: schema migration must create ai_reasoning_effort`
  );
}

console.log('Autoresponder GPT-5 output budget is protected.');
