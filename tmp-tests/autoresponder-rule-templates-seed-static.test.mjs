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

const doc = fs.readFileSync(docPath, 'utf8');

const requiredTemplateNames = [
  'Saudacao manha',
  'Saudacao tarde',
  'Saudacao noite',
  'Saudacao generica',
  'Despedida',
  'Endereco/localizacao',
  'Horario de funcionamento',
  'Estacionamento',
  'Entrega/frete',
  'Formas de pagamento',
  'Desconto a vista / PIX',
  'Nota fiscal',
  'Garantia',
  'Troca/devolucao',
  'Assistencia tecnica',
  'Troca de tela / pelicula',
  'Desbloqueio',
  'Aceita usado/seminovo',
  'Catalogo / produtos',
  'Promocoes/ofertas',
  'Falar com humano',
  'Fallback auto',
];

for (const serverPath of serverPaths) {
  const server = fs.readFileSync(serverPath, 'utf8');
  const filename = path.basename(serverPath);

  assert(server.includes('AUTORESPONDER_RULE_TEMPLATES'), `${filename} must define autoresponder rule templates`);
  assert(server.includes('seedAutoresponderRuleTemplates'), `${filename} must seed autoresponder rule templates`);
  assert(server.includes('INSERT INTO autoresponder_rules'), `${filename} seed must insert into autoresponder_rules`);
  assert(server.includes('WHERE NOT EXISTS'), `${filename} seed must be idempotent by template name`);

  for (const name of requiredTemplateNames) {
    assert(server.includes(`name: '${name}'`), `${filename} missing template ${name}`);
  }

  const templateNameCount = (server.match(/name: '/g) || []).length;
  assert(templateNameCount >= 22, `${filename} expected at least 22 template names, got ${templateNameCount}`);
  assert(server.includes("name: 'Falar com humano'") && server.includes('active: 1'), `${filename} human template must be active`);
  assert(server.includes("name: 'Fallback auto'") && server.includes('active: 0'), `${filename} fallback template must be inactive`);
}
assert(doc.includes('- [x] Seed: 22 templates de regras'), 'Bot_Whatsapp.md must mark rule template seed done');

console.log('autoresponder rule templates seed static checks passed');
