import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('pages/admin/AutoResponderPage.tsx', 'utf8');

assert.ok(
  source.includes('const toggleRuleActive = async (rule: AutoResponderRule)'),
  'rules page must provide a direct row action to activate/deactivate a response'
);

assert.ok(
  source.includes('await autoResponderService.updateRule(rule.id, { active: !isEnabled(rule.active) })'),
  'row status action must persist the active flag without opening the modal'
);

assert.ok(
  source.includes('{isEnabled(rule.active) ? \'Desativar\' : \'Ativar\'}'),
  'row must show an explicit Ativar/Desativar button'
);

assert.ok(
  source.includes('aria-label={`${isEnabled(rule.active) ? \'Desativar\' : \'Ativar\'} resposta ${rule.name}`}'),
  'row toggle must have an accessible label'
);

assert.doesNotMatch(
  source,
  /<span className="text-sm font-semibold text-slate-700">Resposta ativa<\/span>/,
  'active toggle must be removed from the rule modal'
);

console.log('autoresponder rule row toggle static checks passed');
