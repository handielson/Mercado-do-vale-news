'use strict';

// store-visit-status-v1 (nó "Loja - Localizacao"), caso 558798172019 (22/11, domingo 13h43):
// - "manda o endereço que a gente vai agora": o robô mandou o endereço sem avisar que a loja estava fechada no domingo;
//   o cliente foi até a loja à toa.
// - "Tô indo": o robô repetiu o endereço inteiro (3 mensagens) em vez de só confirmar.
// Agora: toda resposta de endereço diz se a loja está aberta agora (fechada hoje / antes de abrir / almoço / já encerrou)
// e quando abre; "tô indo / vou agora / a caminho" com endereço enviado há pouco vira uma confirmação curta.
const MARK = 'store-visit-status-v1';
const NODE = 'Loja - Localizacao';
const NODES = [NODE];

function once(text, search, replacement, label) {
  const count = text.split(search).length - 1;
  if (count !== 1) throw new Error(`${MARK}: trecho "${label}" encontrado ${count}x`);
  return text.replace(search, replacement);
}

const STATUS = `
// ${MARK}: situação da loja agora (horário de Recife) e próxima abertura.
const nowPartsV1 = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Recife', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  .formatToParts(new Date()).map((p) => [p.type, p.value]));
const nowMinV1 = Number(nowPartsV1.hour) * 60 + Number(nowPartsV1.minute);
const toMinV1 = (value) => { const [h, m] = String(value || '').split(':').map(Number); return h * 60 + m; };
const DAYS_V1 = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_PT_V1 = { sunday: 'domingo', monday: 'segunda', tuesday: 'terça', wednesday: 'quarta', thursday: 'quinta', friday: 'sexta', saturday: 'sábado' };
const openDayV1 = (day) => day?.isOpen === true && validTime(day.openTime) && validTime(day.closeTime);
const lunchV1 = (day) => day?.hasLunchBreak === true && validTime(day.lunchStart) && validTime(day.lunchEnd);
const nextOpeningV1 = () => {
  const index = DAYS_V1.indexOf(weekday);
  for (let i = 1; i <= 7; i += 1) {
    const key = DAYS_V1[(index + i) % 7];
    if (openDayV1(schedule?.[key])) return (i === 1 ? 'amanhã (' + DAY_PT_V1[key] + ')' : DAY_PT_V1[key]) + ' às ' + schedule[key].openTime;
  }
  return '';
};
let storeStatusV1 = 'desconhecido';
let storeStatusLineV1 = '';
if (schedule) {
  const next = nextOpeningV1();
  if (!openDayV1(today)) {
    storeStatusV1 = 'fechada_hoje';
    storeStatusLineV1 = '⚠️ Hoje (' + (DAY_PT_V1[weekday] || 'hoje') + ') a loja está fechada.' + (next ? ' Abrimos ' + next + '.' : '');
  } else if (nowMinV1 < toMinV1(today.openTime)) {
    storeStatusV1 = 'antes_de_abrir';
    storeStatusLineV1 = '⚠️ A loja ainda não abriu: hoje abrimos às ' + today.openTime + '.';
  } else if (nowMinV1 >= toMinV1(today.closeTime)) {
    storeStatusV1 = 'encerrada';
    storeStatusLineV1 = '⚠️ Já encerramos por hoje (fechamos às ' + today.closeTime + ').' + (next ? ' Abrimos ' + next + '.' : '');
  } else if (lunchV1(today) && nowMinV1 >= toMinV1(today.lunchStart) && nowMinV1 < toMinV1(today.lunchEnd)) {
    storeStatusV1 = 'almoco';
    storeStatusLineV1 = '⚠️ Agora estamos na pausa do almoço; voltamos às ' + today.lunchEnd + '.';
  } else {
    storeStatusV1 = 'aberta';
    storeStatusLineV1 = '🕒 Estamos abertos agora, até ' + (lunchV1(today) && nowMinV1 < toMinV1(today.lunchStart) ? today.lunchStart + ' (pausa para almoço até ' + today.lunchEnd + ') e depois até ' + today.closeTime : today.closeTime) + '.';
  }
}
const storeClosedNowV1 = ['fechada_hoje', 'antes_de_abrir', 'encerrada', 'almoco'].includes(storeStatusV1);
let recentMessagesV1 = [];
try { recentMessagesV1 = $('Controle Bot - Aplicar Controle').first().json.recentMessages || []; } catch (_) {}
const addressSentRecentlyV1 = recentMessagesV1.some((m) => String(m?.direction || '') === 'outbound'
  && String(m?.text ?? m?.message_text ?? '').includes('Nosso endereço')
  && Date.now() - (Date.parse(String(m?.created_at || '')) || 0) < 3 * 60 * 60 * 1000);
const onTheWayV1 = /^(?:(?:ja |entao |ok |blz |beleza |certo |pronto |show )?(?:to|tou|estou|t[oô]|tamo|estamos|ja estou|vou|vamos|indo|chegando|a caminho)\\b.{0,40})$/.test(normalized.trim())
  && /\\b(?:indo|agora|ja vou|a caminho|chegando|saindo|vou ai|vamos ai|estou indo|to indo|tou indo|tamo indo|em \\d+ ?min)/.test(normalized);
`;

function patchLocation(code) {
  if (code.includes(MARK)) return code;
  let next = once(code, "if (!address || !mapsLink) {", `${STATUS}\nif (!address || !mapsLink) {`, 'antes do endereço');
  next = once(next, "// visit-split-messages-v1: endereço, localização e pergunta final em mensagens separadas (como na retirada).",
    `// ${MARK}: "tô indo" depois do endereço: só confirma (e avisa se estiver fechada), sem repetir o endereço.
if (onTheWayV1 && addressSentRecentlyV1) {
  const text = storeClosedNowV1
    ? storeStatusLineV1 + ' Melhor vir quando estivermos abertos para não perder a viagem. 🙏'
    : 'Combinado! Te esperamos aqui na loja. 😊' + (storeStatusLineV1 ? '\\n' + storeStatusLineV1 : '');
  return [{ json: { ...source, storeStatusV1, messages: [{ type: 'text', text, delayMs: 800 }], output: text.replace(/\\n/g, '[[BR]]') } }];
}
// visit-split-messages-v1: endereço, localização e pergunta final em mensagens separadas (como na retirada).`, 'início das mensagens');
  // Fechada: o aviso vai primeiro. Aberta: o horário de agora entra na visita (substitui o "horário regular").
  next = once(next, "const intro = isVisit ? 'Pode sim! 😊 Você pode vir conferir os aparelhos pessoalmente.' + (regularHours ? '\\n' + regularHours : '') : '';",
    "const intro = storeClosedNowV1 ? storeStatusLineV1\n  : (isVisit ? 'Pode sim! 😊 Você pode vir conferir os aparelhos pessoalmente.' + (storeStatusLineV1 ? '\\n' + storeStatusLineV1 : (regularHours ? '\\n' + regularHours : '')) : (onTheWayV1 && storeStatusLineV1 ? storeStatusLineV1 : ''));",
    'intro');
  next = once(next, "return [{ json: { ...source, messages, output:", "return [{ json: { ...source, storeStatusV1, messages, output:", 'retorno');
  return next;
}

function patchWorkflow(workflow) {
  const next = JSON.parse(JSON.stringify(workflow));
  for (const node of next.nodes) if (node.name === NODE) node.parameters.jsCode = patchLocation(node.parameters.jsCode);
  return next;
}

module.exports = { MARK, NODE, NODES, patchWorkflow, patchLocation };
