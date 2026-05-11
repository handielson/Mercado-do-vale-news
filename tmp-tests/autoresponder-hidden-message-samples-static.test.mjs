import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pagePath = path.join(root, 'pages', 'admin', 'AutoResponderPage.tsx');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const page = fs.readFileSync(pagePath, 'utf8');

[
  'hiddenAutoResponderMessageSamples',
  'Amostras de mensagens automaticas',
  'Mensagens geradas pelo fluxo do bot que nao aparecem como regras editaveis.',
  'Produto escolhido',
  'Pergunta de quantidade',
  'Sem estoque',
  'Estoque insuficiente',
  'Item adicionado',
  'Adicionar mais produtos',
  'Carrinho cancelado',
  'Item removido',
  'Resumo do pedido',
  'Retirada na loja',
  'Entrega',
  'Endereco anotado',
  'Confirmacao de dados',
  'CPF/CNPJ',
  'Produto indisponivel',
  'Garantia precisa detalhe',
  'copyCategoryTagPlaceholder(sample.text)',
  'sample.source',
].forEach((needle) => {
  assert(page.includes(needle), `AutoResponderPage must render hidden bot message sample: ${needle}`);
});

console.log('autoresponder hidden message samples static checks passed');
