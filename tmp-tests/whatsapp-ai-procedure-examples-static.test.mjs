import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const panel = readFileSync('components/whatsapp/WhatsAppAiTeachingPanel.tsx', 'utf8');
const memory = readFileSync('components/whatsapp/WhatsAppAiMemoryPanel.tsx', 'utf8');

[
  'Procedimentos IA',
  'O procedimento nao envia mensagem sozinho',
  'Usar exemplo',
  'Celulares com NFC',
  'Lista de celulares',
  'Entrega por CEP',
  'Endereco da loja',
  'Campos do sistema',
  'Formato padrao da resposta',
  'Quando a IA deve usar',
].forEach((needle) => {
  assert.ok(panel.includes(needle), `procedure panel must include ${needle}`);
});

[
  'consultar produtos ativos em estoque',
  'manter o padrao da lista de celulares ja aprovado',
  'usar o campo de especificacoes NFC',
  'usar o endereco cadastrado no sistema',
  'calcular frete pelo CEP informado',
].forEach((needle) => {
  assert.ok(panel.includes(needle), `procedure examples must guide dynamic system data: ${needle}`);
});

assert.ok(
  memory.includes('WhatsAppAiTeachingPanel'),
  'AI memory panel must keep rendering the procedure editor'
);

console.log('whatsapp AI procedure examples static checks passed');
