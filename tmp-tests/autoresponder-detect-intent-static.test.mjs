import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const serverPaths = [
  path.join(root, 'vps_server.cjs'),
  path.join(root, 'vps_server.js'),
];
const docPath = path.join(root, 'Bot_Whatsapp.md');

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
  assert(source.includes('moreRequest: isAutoresponderMoreRequest(message)'), `${filename} intent helper must expose moreRequest`);
  assert(source.includes('const detectedIntent = detectAutoresponderIntent(message)'), `${filename} webhook must use detectedIntent`);
  assert(source.includes('detectedIntent.greetingOnly'), `${filename} webhook must use detected greetingOnly`);
  assert(source.includes('detectedIntent.numberedChoice'), `${filename} webhook must use detected numberedChoice`);
  assert(source.includes('detectedIntent.moreRequest'), `${filename} webhook must use detected moreRequest`);
  assert(source.includes('detectedIntent.humanRequest'), `${filename} webhook must use detected humanRequest`);
}

const doc = fs.readFileSync(docPath, 'utf8');
assert(doc.includes('- [x] Implementar `detectIntent(message)` completo'), 'Bot_Whatsapp.md must mark detectIntent done');

console.log('autoresponder detect intent static checks passed');
