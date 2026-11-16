'use strict';

// visit-split-messages-v1 (16/11/2026): "posso ir aí ver?" / "onde fica a loja?" no mesmo formato da retirada (v1.2.855).
// O nó "Loja - Localizacao" juntava tudo com "||", que o "Dividir mensagens" transforma em quebra de linha
// (só "|||" separa), então saía um bloco único com endereço, horário, link enorme do Maps e a pergunta final.
// Agora sai em mensagens separadas:
//   visita: 1) "Pode sim! 😊 ..." + horário de hoje  2) "📍 Nosso endereço: ..."  3) localização (pino com coordenadas,
//           senão link)  4) "Se algum modelo te interessou ..."
//   onde fica: 1) endereço  2) localização  3) "Se precisar de ajuda para chegar ..."
// Também devolve `output` com "|||" (mesmo texto) para qualquer caminho que leia só o texto.

const MARK = 'visit-split-messages-v1';
const NODE = 'Loja - Localizacao';
const NODES = [NODE];

function once(code, before, after, label) {
  const count = code.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: âncora encontrada ${count} vezes`);
  return code.replace(before, () => after);
}

const OLD_START = 'const first = isVisit\n';
const OLD_END = "return [{ json: { ...source, output: lines.join('||') } }];";
const NEW_TAIL = `// ${MARK}: endereço, localização e pergunta final em mensagens separadas (como na retirada).
const intro = isVisit ? 'Pode sim! 😊 Você pode vir conferir os aparelhos pessoalmente.' + (regularHours ? '\\n' + regularHours : '') : '';
const closing = isVisit
  ? 'Se algum modelo te interessou, me diga qual para eu conferir a disponibilidade antes da visita. 😊'
  : 'Se precisar de ajuda para chegar, pode chamar por aqui. 😊';
const pin = hasCoords && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
const messages = [];
if (intro) messages.push({ type: 'text', text: intro, delayMs: 800 });
messages.push({ type: 'text', text: '📍 Nosso endereço: ' + address, delayMs: 1200 });
messages.push(pin
  ? { type: 'location', text: '📍 Localização da loja: ' + mapsLink, latitude: Number(lat), longitude: Number(lng),
    locationName: String(company.name || company.company_name || 'Mercado do Vale'), locationAddress: address, delayMs: 1500 }
  : { type: 'text', text: '📍 Localização da loja: ' + mapsLink, delayMs: 1500 });
messages.push({ type: 'text', text: closing, delayMs: 1500 });
return [{ json: { ...source, messages, output: messages.map((message) => String(message.text).replace(/\\n/g, '[[BR]]')).join('|||') } }];`;

function patchNode(code) {
  if (code.includes(MARK)) return code;
  const start = code.indexOf(OLD_START);
  const end = code.indexOf(OLD_END);
  if (start < 0 || end < start || code.split(OLD_START).length !== 2 || code.split(OLD_END).length !== 2) throw new Error('Loja - Localizacao: âncoras não encontradas');
  return code.slice(0, start) + NEW_TAIL + code.slice(end + OLD_END.length);
}

function patchWorkflow(workflow) {
  const next = JSON.parse(JSON.stringify(workflow));
  const node = next.nodes.find((item) => item.name === NODE);
  if (!node?.parameters?.jsCode) throw new Error(`Nó ausente: ${NODE}`);
  node.parameters.jsCode = patchNode(node.parameters.jsCode);
  return next;
}

module.exports = { MARK, NODES, NODE, patchWorkflow, patchNode };

if (require.main === module) {
  const fs = require('node:fs');
  const [input, output] = process.argv.slice(2);
  fs.writeFileSync(output, JSON.stringify(patchWorkflow(JSON.parse(fs.readFileSync(input, 'utf8')))), { mode: 0o600 });
  console.log('candidato gravado em', output);
}
