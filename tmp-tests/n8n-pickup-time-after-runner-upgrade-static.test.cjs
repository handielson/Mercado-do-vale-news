const assert = require('node:assert/strict');
const {
  OLD_PICKUP_PARSER,
  NEW_PICKUP_PARSER,
  OLD_SETTINGS_HELPER,
  NEW_SETTINGS_HELPER,
  patchPostListCode,
} = require('./n8n-fix-pickup-time-after-runner-upgrade.cjs');

const source = `const normalized = '';\n${OLD_PICKUP_PARSER}\n${OLD_SETTINGS_HELPER}\nreturn [];`;
const patched = patchPostListCode(source);
assert.ok(patched.includes(NEW_PICKUP_PARSER));
assert.ok(patched.includes(NEW_SETTINGS_HELPER));
assert.match(patched, /\/public\/company-settings/);
assert.match(patched, /parseObject\(publicRow\.business_hours\)/);
assert.doesNotMatch(patched, /Math\.max\(0, Math\.min\(23/);

function parse(text) {
  const normalized = text.toLowerCase();
  const match = normalized.match(/\b(\d{1,2})(?:(?::|h)\s*(\d{2}))?\s*(?:h|horas?)?\b/);
  if (!match) return '';
  const hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) return '';
  return String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
}

assert.equal(parse('Hoje por volta das 15h.'), '15:00');
assert.equal(parse('15:30'), '15:30');
assert.equal(parse('Pode ser às 9 horas'), '09:00');
assert.equal(parse('24h'), '');
assert.equal(parse('18:75'), '');
console.log('n8n pickup time and runner upgrade regression checks ok');
