import fs from 'node:fs';
import path from 'node:path';
import { readBotWhatsappDoc } from '../tools/autoresponder-bot-doc.cjs';

const root = process.cwd();
const serverPaths = [
  path.join(root, 'vps_server.cjs'),
  path.join(root, 'vps_server.js'),
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const serverPath of serverPaths) {
  const source = fs.readFileSync(serverPath, 'utf8');
  const filename = path.basename(serverPath);

  assert(source.includes('function isAutoresponderWarrantyRequest(message)'), `${filename} must detect warranty requests`);
  assert(source.includes('warrantyRequest: isAutoresponderWarrantyRequest(message)'), `${filename} intent helper must expose warrantyRequest`);
  assert(source.includes('function extractAutoresponderWarrantySearchTokens(message)'), `${filename} must extract warranty search tokens`);
  assert(source.includes('function formatAutoresponderWarrantyRefinementReply(options = [])'), `${filename} must format warranty refinement reply`);
  assert(source.includes('async function handleAutoresponderWarrantyRequest'), `${filename} must implement warranty request handler`);
  assert(source.includes("intent: 'warranty_request'"), `${filename} must log warranty_request intent`);
  assert(source.includes("intent: 'warranty_refine'"), `${filename} must log warranty_refine intent`);
  assert(source.includes('detectedIntent.warrantyRequest'), `${filename} webhook must branch on warrantyRequest`);
  assert(source.includes('formatAutoresponderProductWarrantyLine(product)'), `${filename} warranty handler must reuse product warranty line`);
  assert(source.includes('Para te passar a garantia certinha'), `${filename} must ask for product or brand when context is missing`);
}

const doc = readBotWhatsappDoc(root);
assert(doc.includes('- [x] Pergunta generica de garantia pede marca/produto quando nao houver contexto'), 'Bot_Whatsapp.md must mark generic warranty refinement done');
assert(doc.includes('tmp-tests/autoresponder-warranty-refinement-static.test.mjs'), 'Bot_Whatsapp.md must mention warranty refinement test');

console.log('autoresponder warranty refinement static checks passed');
