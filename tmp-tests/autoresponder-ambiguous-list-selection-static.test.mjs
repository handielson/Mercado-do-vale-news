import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const files = ['vps_server.js', 'vps_server.cjs', 'server.js'];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const file of files) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');

  assert(
    source.includes('function buildAutoresponderAmbiguousSelectionReply'),
    `${file}: must build a filtered reply for ambiguous selections inside the recent list`
  );
  assert(
    source.includes('ambiguous_options'),
    `${file}: selected option resolver must return ambiguous_options when a token matches more than one recent list item`
  );
  assert(
    source.includes("intent: 'product_selection_refinement'"),
    `${file}: ambiguous list filtering must be logged separately`
  );
  assert(
    source.includes('await upsertAutoresponderOptionsConversation(senderKey, selectedOption.ambiguous_options'),
    `${file}: filtered options must replace the recent list so the next customer answer narrows from that list`
  );
  assert(
    source.includes('LISTAS NUMERADAS DE CELULAR:'),
    `${file}: AI prompt must explain numbered phone lists and ambiguous model numbers`
  );
}

console.log('autoresponder ambiguous list selection static checks passed');
