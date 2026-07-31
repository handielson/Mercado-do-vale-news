import assert from 'node:assert/strict';

const { formatBrazilDate, formatBrazilDateTime, formatBrazilTime } = await import('../utils/brazilDateTime.ts');
const instant = '2026-07-31T18:42:48.000Z';

assert.equal(formatBrazilDate(instant), '31/07/2026');
assert.equal(formatBrazilTime(instant), '15:42');
assert.match(formatBrazilDateTime(instant), /31\/07\/2026.*15:42/);

console.log('Brazil date/time checks passed');
