import fs from 'node:fs';
import assert from 'node:assert/strict';

for (const file of ['vps_server.cjs', 'vps_server.js']) {
  const source = fs.readFileSync(file, 'utf8');

  assert.match(source, /formatAutoresponderProductCardPaymentLine[\s\S]+Cartao:/, `${file} must label card payment as Cartao`);
  assert.match(source, /formatAutoresponderProductCardPaymentLine[\s\S]+total /, `${file} must show card total in the requested format`);
  assert.match(source, /formatAutoresponderProductCardLine[\s\S]+vista no PIX/, `${file} must show cash price as PIX`);
  assert.match(source, /formatAutoresponderProductCardLine[\s\S]+Ver produto:/, `${file} must put the product link label above the URL`);
  assert.match(source, /formatAutoresponderProductCardLine[\s\S]+getAutoresponderProductUrl/, `${file} must include the product URL in each card`);
  assert.match(source, /formatAutoresponderProductSearchReplies[\s\S]+pagination\?\.completeList[\s\S]+chunks/, `${file} must keep cellular lists split across messages`);
  assert.match(source, /formatAutoresponderProductSearchReplies[\s\S]+isCompleteList[\s\S]+Era isso que voce estava procurando\?/, `${file} must ask confirmation only for non-complete product searches`);
  assert.match(source, /formatAutoresponderProductSearchReplies[\s\S]+formatAutoresponderProductBrandHeading/, `${file} must keep a brand heading for each brand sequence`);
  assert.match(source, /buildAutoresponderModelAccessoryFollowUpReplies/, `${file} must support a separate accessory follow-up after model searches`);
  assert.match(source, /Encontramos tambem capinha para ele/, `${file} must use the requested accessory follow-up wording`);
}

console.log('autoresponder product answer pattern static checks passed');
