'use strict';

// autoreply-guard-v1 (08/11/2026, v1.2.819) — dois ajustes no robô do WhatsApp, sem mudar o grafo:
//  1) "Dados": mensagem automática de outra empresa (ausência do WhatsApp Business, "no momento não
//     estou disponível", "mensagem automática"...) não é tratada como fala do cliente. O robô não
//     responde e espera a próxima mensagem; se a pessoa escrever de verdade, o atendimento segue.
//     Caso real: CREAS respondeu a lista com a ausência e o robô perguntou o bairro de entrega.
//  2) "Vendas - Contexto Produtos": o título "📱 Celulares com <memória>" só aparece quando a lista
//     está de fato filtrada por essa memória. Quando o modelo pedido não existe ou o filtro não achou
//     nada e a lista volta ao estoque completo, o título deixa de prometer "64GB".

const MARK = 'autoreply-guard-v1';
const NODE_DADOS = 'Dados';
const NODE_CONTEXTO = 'Vendas - Contexto Produtos';
const NODES = [NODE_DADOS, NODE_CONTEXTO];

const AUTO_REPLY_PATTERNS = [
  'no momento (?:nao|n) (?:estou|estamos|posso|podemos) (?:disponive|atende|responde)',
  '(?:mensagem|resposta) automatica',
  'atendimento automatico',
  'assim que (?:possivel|puder|pudermos)[, ]+(?:eu )?(?:respondo|retorno|responderemos|retornaremos|te respondo|te retorno|entraremos em contato|entro em contato)',
  'fora do (?:nosso )?horario de (?:atendimento|expediente|funcionamento)',
  'em breve (?:retornaremos|responderemos|entraremos em contato|daremos retorno|retornarei|responderei)',
  '(?:estou|estamos) ausentes?\\b',
  'agradecemos (?:o seu |seu |pelo |o )?contato',
];

function once(code, before, after, label) {
  const count = code.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: âncora encontrada ${count} vezes`);
  return code.replace(before, () => after);
}

function patchDados(code) {
  if (code.includes(MARK)) return code;
  return once(code,
    "if (isStaleReplayV226) return [];\n",
    "if (isStaleReplayV226) return [];\n\n"
    + "// " + MARK + ": resposta automática de outra empresa não é fala do cliente; o robô não responde.\n"
    + "const autoReplyTextV1 = String(getText() || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/\\s+/g, ' ');\n"
    + "const autoReplyPatternsV1 = " + JSON.stringify(AUTO_REPLY_PATTERNS) + ".map((source) => new RegExp(source));\n"
    + "const isAutoReplyV1 = !fromMe && eventNameV226 === 'messages.upsert' && autoReplyTextV1.length >= 12\n"
    + "  && autoReplyPatternsV1.some((pattern) => pattern.test(autoReplyTextV1));\n"
    + "if (isAutoReplyV1) return [];\n",
    'guarda de resposta automática');
}

function patchContexto(code) {
  if (code.includes(MARK)) return code;
  return once(code,
    "sameModelConfigurationAlternativeV1?'':String(base.memoryFilterLabel || '').trim()].filter(Boolean).join(' e ');",
    "(sameModelConfigurationAlternativeV1 || unavailableRequestedDevice || structuredFilterFallbackV1)?'':String(base.memoryFilterLabel || '').trim()].filter(Boolean).join(' e '); // " + MARK + ": título só com memória quando a lista está filtrada por ela",
    'título da lista');
}

function patchWorkflow(workflow) {
  const next = JSON.parse(JSON.stringify(workflow));
  const find = (name) => {
    const node = next.nodes.find((item) => item.name === name);
    if (!node?.parameters?.jsCode) throw new Error(`Code node ausente: ${name}`);
    return node;
  };
  const dados = find(NODE_DADOS);
  dados.parameters.jsCode = patchDados(dados.parameters.jsCode);
  const contexto = find(NODE_CONTEXTO);
  contexto.parameters.jsCode = patchContexto(contexto.parameters.jsCode);
  return next;
}

module.exports = { MARK, NODES, NODE_DADOS, NODE_CONTEXTO, AUTO_REPLY_PATTERNS, patchWorkflow, patchDados, patchContexto };

if (require.main === module) {
  const fs = require('node:fs');
  const [input, output] = process.argv.slice(2);
  if (!input || !output) throw new Error('Uso: node scripts/n8n-autoreply-guard.cjs antes.json candidato.json');
  fs.writeFileSync(output, JSON.stringify(patchWorkflow(JSON.parse(fs.readFileSync(input, 'utf8')))), { mode: 0o600 });
  console.log('candidato gravado em', output);
}
