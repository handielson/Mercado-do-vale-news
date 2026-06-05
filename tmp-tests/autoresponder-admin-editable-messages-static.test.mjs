import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const messages = readFileSync('services/autoresponder/engine/messages.js', 'utf8');
const page = readFileSync('pages/admin/AutoResponderPage.tsx', 'utf8');

[
  'AUTORESPONDER_MESSAGE_KEYS',
  'resolveAutoresponderMessage',
  'delivery.ask_cep',
  'delivery.cep_not_found',
  'delivery.cep_found_no_rule',
  'product_search.choice_prompt',
  'fallback.global',
  'fallback.delivery_awaiting_cep',
].forEach((needle) => {
  assert.ok(messages.includes(needle), `messages catalog must include ${needle}`);
});

[
  'Mensagens do Bot',
  'delivery.ask_cep',
  'delivery.cep_not_found',
  'delivery.cep_found_no_rule',
  'delivery.choose_product_after_cep',
  'product_search.choice_prompt',
  'product_search.more_prompt',
  'fallback.global',
  'fallback.delivery_awaiting_cep',
  'fallback.product_choice',
  'fallback.purchase_quantity',
].forEach((needle) => {
  assert.ok(page.includes(needle), `admin must expose editable message ${needle}`);
});

console.log('autoresponder admin editable messages static checks passed');
