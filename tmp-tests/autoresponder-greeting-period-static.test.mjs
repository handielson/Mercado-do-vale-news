import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const files = ['vps_server.cjs', 'vps_server.js'];

for (const file of files) {
  const source = readFileSync(file, 'utf8');

  assert.match(
    source,
    /function getAutoresponderGreetingPeriod\(now = new Date\(\)\)/,
    `${file} must choose the greeting period from the Sao Paulo clock, not from the customer text`,
  );

  const periodFunction = source.match(/function getAutoresponderGreetingPeriod\(now = new Date\(\)\) \{[\s\S]*?\n\}/)?.[0] || '';
  assert.ok(periodFunction, `${file} must expose getAutoresponderGreetingPeriod`);
  assert.ok(!periodFunction.includes('normalizeAutoresponderText'), `${file} greeting period must not inspect customer text`);
  assert.ok(!periodFunction.includes('bom dia'), `${file} greeting period must not force morning from the customer text`);
  assert.ok(periodFunction.includes("timeZone: 'America/Sao_Paulo'"), `${file} greeting period must use Sao Paulo timezone`);
  assert.ok(periodFunction.includes('hour >= 5 && hour < 12'), `${file} must classify morning from 05:00 to 11:59`);
  assert.ok(periodFunction.includes('hour >= 12 && hour < 18'), `${file} must classify afternoon from 12:00 to 17:59`);

  assert.match(
    source,
    /function isAutoresponderDefaultGreetingFlowMessage\(value\) \{/,
    `${file} must detect the old fixed Bom dia default greeting`,
  );

  assert.match(
    source,
    /if \(customGreeting && !isAutoresponderDefaultGreetingFlowMessage\(customGreeting\)\) return customGreeting;/,
    `${file} must keep real custom greetings but ignore the old fixed default`,
  );

  assert.match(
    source,
    /const emoji = period === 'night'[\s\S]*?:/,
    `${file} must keep a friendly emoji pattern for the time-based greeting`,
  );

  assert.match(
    source,
    /Seja bem-vindo ao Mercado do Vale[\s\S]*Como posso ajudar voce hoje\? \$\{emoji\}/,
    `${file} must keep the friendly standard greeting body with the period emoji`,
  );
}

console.log('autoresponder greeting period static checks passed');
