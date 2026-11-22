'use strict';

// store-questions-v1 (nó "Loja - Localizacao"), caso 558798261431 (22/11 09h13):
// "Juazeiro ou petrolina" e "Dias de fucionamentos" caíram no nó de localização e receberam endereço + mapa
// pela 2ª e 3ª vez. Agora, no mesmo nó:
// - pergunta de horário/dias (sem pedir endereço) → horário da semana do cadastro + situação de agora;
// - pergunta de cidade ("Juazeiro ou Petrolina?", "é aqui em Juazeiro") → "Nossa loja fica em Petrolina-PE…";
//   o endereço só vai junto se ainda não foi mandado nas últimas 3 h;
// - pedido explícito de endereço/localização continua mandando endereço e mapa.
// Depende do store-visit-status-v1 (situação de agora e endereço recente).
const MARK = 'store-questions-v1';
const NODE = 'Loja - Localizacao';
const NODES = [NODE];
const ANCHOR = '// visit-split-messages-v1: endereço, localização e pergunta final em mensagens separadas (como na retirada).';

const BLOCK = `// ${MARK}: horário e cidade respondidos sem repetir o endereço.
const addressAskedV2 = /\\b(?:endereco|localiza\\w*|onde (?:fica|e|eh|fic\\w*)|como (?:chego|chegar)|mapa|pino|rua)\\b/.test(normalized);
const hoursAskedV2 = /\\b(?:dias? de (?:fu|fun|fum)\\w*|funciona\\w*|horario\\w*|que horas|hora que|abre\\w*|fecha\\w*|aberto|aberta|domingo|sabado|feriado|expediente)\\b/.test(normalized);
const cityAskedV2 = /\\b(?:juazeiro|petrolina|qual cidade|que cidade|em que cidade|cidade)\\b/.test(normalized);
const titleV2 = (value) => String(value || '').toLowerCase().replace(/(^|\\s)(\\p{L})/gu, (m, s, c) => s + c.toUpperCase());
const cityV2 = company.address_city ? titleV2(company.address_city) + (company.address_state ? '-' + String(company.address_state).toUpperCase() : '') : '';
const DAY_ORDER_V2 = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_NAME_V2 = { monday: 'Segunda', tuesday: 'Terça', wednesday: 'Quarta', thursday: 'Quinta', friday: 'Sexta', saturday: 'Sábado', sunday: 'Domingo' };
const dayTextV2 = (day) => !openDayV1(day) ? 'fechado'
  : (lunchV1(day) ? day.openTime + '–' + day.lunchStart + ' e ' + day.lunchEnd + '–' + day.closeTime : day.openTime + '–' + day.closeTime);
const weekLinesV2 = () => {
  const groups = [];
  for (const key of DAY_ORDER_V2) {
    const text = dayTextV2(schedule?.[key]);
    const last = groups[groups.length - 1];
    if (last && last.text === text) last.to = key; else groups.push({ from: key, to: key, text });
  }
  return groups.map((g) => (g.from === g.to ? DAY_NAME_V2[g.from] : DAY_NAME_V2[g.from] + ' a ' + DAY_NAME_V2[g.to].toLowerCase()) + ': ' + g.text);
};
if (schedule && hoursAskedV2 && !addressAskedV2) {
  const text = '🕒 Nosso horário de atendimento:\\n' + weekLinesV2().join('\\n') + (storeStatusLineV1 ? '\\n\\n' + storeStatusLineV1 : '') + '\\nEm feriados, confirme conosco antes de vir. 😊';
  return [{ json: { ...source, storeStatusV1, storeQuestionV2: 'horario', messages: [{ type: 'text', text, delayMs: 800 }], output: text.replace(/\\n/g, '[[BR]]') } }];
}
if (cityV2 && cityAskedV2 && !addressAskedV2) {
  const neighborhood = company.address_neighborhood ? ', no bairro ' + titleV2(company.address_neighborhood) : '';
  const line = 'Nossa loja fica em ' + cityV2 + neighborhood + '. 😊';
  if (addressSentRecentlyV1) {
    const text = line + (storeClosedNowV1 ? '\\n' + storeStatusLineV1 : '');
    return [{ json: { ...source, storeStatusV1, storeQuestionV2: 'cidade', messages: [{ type: 'text', text, delayMs: 800 }], output: text.replace(/\\n/g, '[[BR]]') } }];
  }
  cityIntroV2 = line;
}
`;

function patchLocation(code) {
  if (code.includes(MARK)) return code;
  if (!code.includes('store-visit-status-v1')) throw new Error(`${MARK}: precisa do store-visit-status-v1 no nó`);
  if (code.split(ANCHOR).length !== 2) throw new Error(`${MARK}: âncora não encontrada`);
  let next = code.replace(ANCHOR, () => `let cityIntroV2 = '';\n${BLOCK}${ANCHOR}`);
  // primeira vez com pergunta de cidade: a linha da cidade abre a resposta, antes do endereço.
  const INTRO = "const intro = storeClosedNowV1 ? storeStatusLineV1";
  if (next.split(INTRO).length !== 2) throw new Error(`${MARK}: intro não encontrada`);
  next = next.replace(INTRO, () => "const intro = cityIntroV2 ? cityIntroV2 + (storeClosedNowV1 ? '\\n' + storeStatusLineV1 : '') : storeClosedNowV1 ? storeStatusLineV1");
  return next;
}

function patchWorkflow(workflow) {
  const next = JSON.parse(JSON.stringify(workflow));
  const node = next.nodes.find((n) => n.name === NODE);
  node.parameters.jsCode = patchLocation(node.parameters.jsCode);
  return next;
}

module.exports = { MARK, NODE, NODES, patchWorkflow, patchLocation };
