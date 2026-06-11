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

  assert(source.includes('function detectAutoresponderIntent(message)'), `${filename} must define detectAutoresponderIntent`);
  assert(source.includes('greeting: isAutoresponderGreeting(message)'), `${filename} intent helper must expose greeting`);
  assert(source.includes('greetingOnly: isAutoresponderGreetingOnly(message)'), `${filename} intent helper must expose greetingOnly`);
  assert(source.includes('humanRequest: isAutoresponderHumanRequest(message)'), `${filename} intent helper must expose humanRequest`);
  assert(source.includes('numberedChoice: getAutoresponderNumberedChoice(message)'), `${filename} intent helper must expose numberedChoice`);
  assert(source.includes('normalizeAutoresponderText(message).trim()'), `${filename} numbered choice must normalize text phrases`);
  assert(source.includes('quero|queria|vou querer|escolho|separa|manda|pega|pode ser|fecha|fechar'), `${filename} numbered choice must detect purchase phrases like "quero esse 15"`);
  assert(source.includes('(?:esse|este|essa|esta|o|a)'), `${filename} numbered choice must require a demonstrative/article before phrase numbers to avoid model names like Redmi Note 15`);
  assert(source.includes('moreRequest: isAutoresponderMoreRequest(message)'), `${filename} intent helper must expose moreRequest`);
  assert(source.includes('const detectedIntent = detectAutoresponderIntent(message)'), `${filename} webhook must use detectedIntent`);
  assert(source.includes('detectedIntent.greetingOnly'), `${filename} webhook must use detected greetingOnly`);
  assert(source.includes('detectedIntent.numberedChoice'), `${filename} webhook must use detected numberedChoice`);
  assert(source.includes('detectedIntent.moreRequest'), `${filename} webhook must use detected moreRequest`);
  assert(source.includes('detectedIntent.humanRequest'), `${filename} webhook must use detected humanRequest`);
}

const doc = readBotWhatsappDoc(root);
assert(doc.includes('- [x] Implementar `detectIntent(message)` completo'), 'Bot_Whatsapp.md must mark detectIntent done');

console.log('autoresponder detect intent static checks passed');
