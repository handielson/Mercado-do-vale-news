'use strict';

// greeting-courtesy-v2 (nó "Dividir mensagens"), caso 558781132777 (22/11 14h12): depois da saudação e da lista,
// o cliente disse "Boa tarde, tudo bem!" e o robô respondeu "Boa tarde Tudo bem, obrigado! 😊" + "Sou a Val, da equipe…"
// (apresentação repetida, sem vírgula). Agora, no meio da conversa (já respondemos nas últimas 6 h):
// - cliente só cumprimentou → uma mensagem curta ("Tudo ótimo por aqui, e com você? 😊" / "Boa tarde! 😊");
// - a apresentação "Sou a Val…" não se repete se já foi feita nas últimas 6 h;
// - "Boa tarde Nome" ganha a vírgula.
const MARK = 'greeting-courtesy-v2';
const NODE = 'Dividir mensagens';
const NODES = [NODE];
const OLD = '  if (!courtesyFirstReplyV1 || !Array.isArray(items) || !items.length) return items;';
const NEW = `  if (!Array.isArray(items) || !items.length) return items;
  if (!courtesyFirstReplyV1) return courtesyMidV2(items);`;

const BLOCK = `
// ${MARK}: no meio da conversa, cumprimento só ganha resposta curta; "Sou a Val" não se repete; vírgula depois da saudação.
const courtesyOnlyV2 = !courtesyClientTextV1.replace(/\\b(?:oi+|ola|opa|e ai|eai|bom dia|boa tarde|boa noite|tudo bem|td bem|tudo bom|td bom|tudo certo|tudo joia|como vai|como (?:voce|vc) (?:esta|ta)|beleza|blz|amigo|amiga|amigao|meu querido|querida|val)\\b/g, ' ')
  .replace(/[^a-z0-9]/g, '');
const courtesyIntroducedV2 = (courtesyRecentV1 || []).some((row) => String(row?.direction || '').toLowerCase() === 'outbound'
  && /\\b(?:eu )?sou a val\\b/i.test(String(row?.text ?? row?.message_text ?? ''))
  && Date.now() - (Date.parse(String(row?.created_at || '')) || 0) < 6 * 60 * 60 * 1000);
const courtesyCommaV2 = (text) => String(text || '').replace(/^(\\s*(?:Bom dia|Boa tarde|Boa noite))\\s+(?=[A-ZÀ-Ú])/, '$1, ');
const courtesyMidV2 = (items) => {
  let out = items.map((item) => ({ json: { ...item.json } }));
  if (courtesyOnlyV2 && courtesyClientTextV1.trim() && out.every((item) => item.json.messageType === 'text')) {
    const line = courtesyAskedV1 ? 'Tudo ótimo por aqui, e com você? 😊' : currentGreeting + '! 😊';
    const single = toItem('courtesy-v2', 0, out);
    single.json = { ...single.json, messageType: 'text', message: line, caption: line, mediaUrl: '' };
    for (const key of Object.keys(single.json)) { if (single.json[key] === 'courtesy-v2') single.json[key] = line; }
    out = [single];
  } else {
    if (courtesyIntroducedV2) {
      out = out.flatMap((item) => {
        if (item.json.messageType !== 'text') return [item];
        const msg = String(item.json.message || '');
        const rest = msg.replace(/(?:^|\\s)(?:eu )?sou a val, da equipe do mercado do vale[.!]?\\s*/i, ' ').trim();
        if (rest === msg.trim()) return [item];
        if (!rest || /^(?:como|em que) posso (?:te )?ajudar\\??$/i.test(rest)) return [];
        return [{ json: { ...item.json, message: rest, caption: rest } }];
      });
      if (!out.length) return items;
    }
    if (out[0].json.messageType === 'text') { const fixed = courtesyCommaV2(out[0].json.message); out[0].json.message = fixed; out[0].json.caption = fixed; }
  }
  return out.map((item, index, all) => ({ json: { ...item.json, messageIndex: index + 1, totalMessages: all.length } }));
};
`;

function patchDividir(code) {
  if (code.includes(MARK)) return code;
  if (!code.includes('greeting-courtesy-v1')) throw new Error(`${MARK}: precisa do greeting-courtesy-v1`);
  if (code.split(OLD).length !== 2) throw new Error(`${MARK}: início do courtesyV1 não encontrado`);
  const ANCHOR = 'const courtesyV1 = (items) => {';
  return code.replace(OLD, () => NEW).replace(ANCHOR, () => `${BLOCK}${ANCHOR}`);
}
function patchWorkflow(workflow) {
  const next = JSON.parse(JSON.stringify(workflow));
  const node = next.nodes.find((n) => n.name === NODE);
  node.parameters.jsCode = patchDividir(node.parameters.jsCode);
  return next;
}
module.exports = { MARK, NODE, NODES, patchWorkflow, patchDividir };
