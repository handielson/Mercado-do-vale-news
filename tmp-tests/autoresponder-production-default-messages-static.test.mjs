import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync('vps_server.cjs', 'utf8');

assert.match(
  source,
  /const AUTORESPONDER_DEFAULT_FALLBACK_MESSAGE = 'Nao consegui localizar exatamente isso agora\./,
  'expected a production-friendly fallback message',
);

assert.match(
  source,
  /const AUTORESPONDER_DEFAULT_AUTO_PAUSE_MESSAGE = 'Vou chamar um atendente para te ajudar melhor\./,
  'expected a production-friendly auto-pause message',
);

assert.match(
  source,
  /AUTORESPONDER_DEFAULT_HUMAN_IN_HOURS/,
  'expected human handoff default constants',
);

assert.doesNotMatch(
  source,
  /Atendimento automatico em configuracao/,
  'customer-facing fallback must not say the bot is in configuration',
);

assert.match(
  source,
  /\$\{AUTORESPONDER_DEFAULT_FALLBACK_MESSAGE\}/,
  'expected database seed to reuse the fallback default',
);

console.log('autoresponder production default messages static checks passed');
