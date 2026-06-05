import fs from 'node:fs';
import assert from 'node:assert/strict';

for (const file of ['vps_server.cjs', 'vps_server.js']) {
  const source = fs.readFileSync(file, 'utf8');

  assert.match(
    source,
    /function buildAutoresponderReplyMessagesWithSeparateGreeting/,
    `${file} must have a helper for separate greeting replies`
  );
  assert.match(
    source,
    /getAutoresponderGreetingReply\(message, contactFirstName, settings\);[\s\S]*formatAutoresponderReplies\(\[greetingText, \.\.\.messages\], settings, false\)/,
    `${file} must put greeting in its own message before product-search replies`
  );

  const productSearchBlocks = source.match(/intent: 'product_search'[\s\S]{0,900}/g) || [];
  assert.ok(productSearchBlocks.length >= 2, `${file} must keep product_search in test and webhook flows`);
  assert.ok(
    source.includes('buildAutoresponderReplyMessagesWithSeparateGreeting(productReplyMessages'),
    `${file} product search must use separate greeting helper`
  );
  assert.ok(
    source.includes('shouldIncludeGreeting: shouldPrefixGreeting || isAutoresponderGreeting(message)'),
    `${file} product search must detect greeting directly when formatting replies`
  );
  assert.ok(
    !/intent: 'product_search'[\s\S]{0,900}formatAutoresponderReplies\(productReplyMessages, settings, shouldPrefixGreeting\)/.test(source),
    `${file} product_search must not merge greeting into the product message`
  );
}

console.log('autoresponder product search separate greeting static checks passed');
