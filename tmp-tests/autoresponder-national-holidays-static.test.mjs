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

  assert(source.includes('function getBrazilianEasterDate'), `${filename} must calculate Easter`);
  assert(source.includes('function getAutoresponderBrazilNationalHoliday'), `${filename} must detect Brazilian national holidays`);
  assert(source.includes("'Confraternizacao Universal'"), `${filename} must include Jan 1 holiday`);
  assert(source.includes("'Tiradentes'"), `${filename} must include Tiradentes`);
  assert(source.includes("'Dia do Trabalhador'"), `${filename} must include Labor Day`);
  assert(source.includes("'Independencia do Brasil'"), `${filename} must include Independence Day`);
  assert(source.includes("'Nossa Senhora Aparecida'"), `${filename} must include Oct 12 holiday`);
  assert(source.includes("'Finados'"), `${filename} must include Finados`);
  assert(source.includes("'Proclamacao da Republica'"), `${filename} must include Republic holiday`);
  assert(source.includes("'Natal'"), `${filename} must include Christmas`);
  assert(source.includes("'Sexta-feira Santa'"), `${filename} must include Good Friday`);
  assert(source.includes("'Carnaval'"), `${filename} must include Carnival`);
  assert(source.includes("'Corpus Christi'"), `${filename} must include Corpus Christi`);
  assert(source.includes('holidayOverrides.includes(dateString)'), `${filename} must allow holiday overrides`);
  assert(source.includes('nationalHoliday.name'), `${filename} store status must return national holiday name`);
}

const doc = fs.readFileSync(docPath, 'utf8');
assert(doc.includes('- [x] Portar `holidayService` (feriados nacionais)'), 'Bot_Whatsapp.md must mark holiday service done');
assert(doc.includes('feriados nacionais brasileiros'), 'Bot_Whatsapp.md must document national holidays');

console.log('autoresponder national holidays static checks passed');
