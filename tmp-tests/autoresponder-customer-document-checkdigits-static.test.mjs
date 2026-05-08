import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const serverFiles = ['vps_server.js', 'vps_server.cjs'];
const docPath = path.join(root, 'Bot_Whatsapp.md');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const fileName of serverFiles) {
  const source = fs.readFileSync(path.join(root, fileName), 'utf8');

  [
    'function hasAutoresponderRepeatedDigitsOnly',
    'function validateAutoresponderCpf',
    'function validateAutoresponderCnpj',
    'validateAutoresponderCpf(digits)',
    'validateAutoresponderCnpj(digits)',
    'digits.length === 11',
    'digits.length === 14',
    'digits[9]',
    'digits[10]',
    'digits[12]',
    'digits[13]',
  ].forEach((needle) => {
    assert(source.includes(needle), `${fileName} must include ${needle}`);
  });

  assert(
    source.includes("String(message || '').replace(/\\D+/g, '')"),
    `${fileName} must strip punctuation before validating CPF/CNPJ`
  );
  assert(
    source.includes('hasAutoresponderRepeatedDigitsOnly(digits)'),
    `${fileName} must reject repeated digit CPF/CNPJ values`
  );
}

const doc = fs.readFileSync(docPath, 'utf8');
assert(
  doc.includes('- [x] CPF/CNPJ remove pontuacao e valida digitos verificadores antes de salvar'),
  'Bot_Whatsapp.md must mark CPF/CNPJ check digit validation done'
);
assert(
  doc.includes('tmp-tests/autoresponder-customer-document-checkdigits-static.test.mjs'),
  'Bot_Whatsapp.md must mention CPF/CNPJ check digit validation test'
);

console.log('autoresponder customer document check digit static checks passed');
