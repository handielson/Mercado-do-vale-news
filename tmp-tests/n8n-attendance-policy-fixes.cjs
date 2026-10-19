'use strict';
const assert=require('node:assert/strict');
const MARKER='attendance-policy-fixes-v1';
const SCOPED_NODES=['Parse Classificacao','Resolver Acao de Conversacao','Pagamento - Politica','Agente Geral - Atendimento'];
function payjoyReportedOutcomeV1(raw){
 const text=String(raw||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const mentioned=/\b(?:aprov\w*|reprov\w*|negad[oa]|nao passei|nao consegui)\b/.test(text);
 if(!mentioned)return {status:'other',mentioned:false};
 const first=text.split(/[,.!?;]/)[0].trim();
 const hypothetical=/\b(?:se|caso|talvez|espero|quero|queria|tomara|quando|sera que)\b.{0,70}\b(?:aprov|reprov)/.test(text);
 const pending=/\b(?:ainda|aguardando|pendente|em analise|nao saiu|nao apareceu o resultado)\b/.test(text);
 const affirmative=/\b(?:(?:fui|foi|deu|esta|estou|to|apareceu|saiu|fiquei)\s+aprovad[oa]|me aprovaram|consegui (?:a )?aprovacao|(?:a )?payjoy (?:me )?aprovou)\b/.test(first)
   || /^(?:aprovad[oa]|aprovou)[!.\s]*$/.test(text);
 const negation=/\b(?:nao|nem|sem)\b.{0,35}\b(?:fui|foi|estou|esta|deu|apareceu|consegui|aprov|reprov)/.test(first);
 const negative=/\b(?:reprovad[oa]|negad[oa]|nao passou na analise|nao passei|nao consegui(?: aprovacao)?)\b/.test(first)
   || /\bnao\b.{0,25}\b(?:aprovad[oa]|aprovou)\b/.test(first);
 const affirmationThenQuestion=affirmative && /^(?:fui|estou|to|fiquei|me aprovaram|consegui|a payjoy|payjoy)\b[^?？]*(?:[,.;!]\s*|\s+e\s+)(?:e agora|como|qual|quanto|o que|posso|preciso|pode)\b/.test(text);
 const otherPerson=/\b(?:meu irmao|minha irma|minha esposa|meu esposo|meu marido|minha mae|meu pai|meu amigo|minha amiga|outra pessoa)\b/.test(text);
 const conflictingResult=/\bmas\b.{0,50}\b(?:eu|meu cadastro|minha analise)\b.{0,25}\b(?:nao|negad|reprov)|\b(?:eu|meu cadastro|minha analise)\b.{0,25}\bnao\b.{0,25}\b(?:deu certo|aprov)/.test(text);
 const question=/[?？]/.test(text) && !affirmationThenQuestion;
 if(hypothetical||pending||question||otherPerson||conflictingResult||/\bnao\b.{0,20}\breprovad[oa]\b/.test(first))return {status:'pending',mentioned};
 if(negative)return {status:'denied',mentioned};
 if(affirmative&&!negation)return {status:'approved',mentioned};
 return {status:'pending',mentioned};
}
const helper='// '+MARKER+':reported-result\n'+payjoyReportedOutcomeV1.toString()+'\n';
function once(source,before,after){assert.equal(source.split(before).length,2,'Policy anchor drift: '+before.slice(0,60));return source.replace(before,after);}
function line(source,prefix,replacement){const matches=source.split('\n').filter(x=>x.startsWith(prefix));assert.equal(matches.length,1,'Policy line drift: '+prefix);return once(source,matches[0],replacement);}
function patchWorkflow(input){
 const w=structuredClone(input),node=name=>{const n=w.nodes.find(n=>n.name===name);assert.ok(n,name);return n;};
 const payment=node('Pagamento - Politica');
 if(!payment.parameters.jsCode.includes(MARKER)){
  let s=payment.parameters.jsCode;
  s=line(s,'const approved =',helper+"const payjoyReportedV1 = payjoyReportedOutcomeV1(text);\nconst approved = payjoyReportedV1.status === 'approved';");
  s=line(s,'const denied =',"const denied = payjoyReportedV1.status === 'denied';");
  s=once(s,'const usedPhonePolicyV529 = usedPhoneDescriptorV529 && (usedPhoneDeviceV529 || usedPhoneCommerceV529);',String.raw`const ownedPhoneSaleV1 = usedPhoneDeviceV529 && /\b(?:meu|minha)\b/.test(normalized)
  && /\b(?:compra|compram|compramos|paga|pagam|pagaria|pagariam|avalia|avaliam|vender|vendo)\b/.test(normalized);
const usedPhonePolicyV529 = usedPhoneDescriptorV529 && (usedPhoneDeviceV529 || usedPhoneCommerceV529) || ownedPhoneSaleV1;`);
  s=once(s,'} else if ((contextual || payjoyMention) && denied) {',"} else if ((contextual || payjoyMention) && payjoyReportedV1.status === 'pending') {\n  output = 'Ainda não tenho um resultado confirmado para considerar a análise aprovada. Pode enviar um print legível do resultado da PayJoy ou explicar o que apareceu na tela? 😊';\n} else if ((contextual || payjoyMention) && denied) {");
  payment.parameters.jsCode=s;
 }
 const resolver=node('Resolver Acao de Conversacao');
 if(!resolver.parameters.jsCode.includes(MARKER))resolver.parameters.jsCode=line(resolver.parameters.jsCode,'const payjoyOutcomeV1 =',helper+"const payjoyOutcomeV1 = payjoyReportedOutcomeV1(text).mentioned;");
 const parse=node('Parse Classificacao');
 if(!parse.parameters.jsCode.includes('// '+MARKER+':used')){
  let s=parse.parameters.jsCode;
  const before=s.slice(s.indexOf('const usedCommerceQuestionV161 ='),s.indexOf('const deviceTradeInQuestionV161 ='));
  assert.ok(before.startsWith('const usedCommerceQuestionV161 ='));
  const after=String.raw`// attendance-policy-fixes-v1:used
const usedSaleOfferV1 = deviceMentionV161 && /\b(?:quero|gostaria de|preciso|pretendo)\s+vender\b|\bvendo\s+(?:meu|minha|um|uma)\b|\btenho\b.{0,55}\bpara vender\b/.test(usedPolicyNormalizedV161);
const ownedPhoneSaleQuestionV1 = deviceMentionV161 && /\b(?:meu|minha)\b/.test(usedPolicyNormalizedV161)
  && (/\b(?:compra|compram|compramos|paga|pagam|pagaria|pagariam|avalia|avaliam)\b.{0,55}\b(?:meu|minha)\b/.test(usedPolicyNormalizedV161)
    || /\b(?:meu|minha)\b.{0,55}\b(?:compra|compram|compramos|paga|pagam|pagaria|pagariam|avalia|avaliam)\b/.test(usedPolicyNormalizedV161));
const usedCommerceQuestionV161 = usedSaleOfferV1 || ownedPhoneSaleQuestionV1 || usedDescriptorV161 && (
 (deviceMentionV161 && /\b(?:compra|compram|compramos|pega|pegam|aceita|aceitam|vende|vendem|tem|possui|trabalha|trabalham|paga|pagam|pagaria|pagariam|avalia|avaliam|oferece|oferecem)\b/.test(usedPolicyNormalizedV161))
 || (deviceMentionV161 && usedPolicyNormalizedV161.split(' ').length <= 4)
 || /\bnov[oa]s?\b.{0,30}\busad[oa]s?\b|\busad[oa]s?\b.{0,30}\bnov[oa]s?\b/.test(usedPolicyNormalizedV161)
);
`;
  parse.parameters.jsCode=once(s,before,after);
 }
 const general=node('Agente Geral - Atendimento');
 if(!general.parameters.options.systemMessage.includes(MARKER))general.parameters.options.systemMessage+='\n\n'+MARKER+': O Mercado do Vale não compra aparelhos usados e não aceita usados como entrada ou troca. Se o cliente perguntar quanto pagamos no aparelho dele ou oferecer vender um usado, explique essa política com educação. Não solicite modelo, fotos ou estado de conservação para fazer avaliação de compra, nem ofereça cotação. Perguntas sobre defeito de uma compra anterior continuam sendo pós-venda.';
 for(const name of SCOPED_NODES){const n=node(name);if(n.parameters.jsCode)new Function('$json','$','$getWorkflowStaticData',n.parameters.jsCode);}
 assert.deepEqual(w.connections,input.connections);return w;
}
module.exports={MARKER,SCOPED_NODES,patchWorkflow,payjoyReportedOutcomeV1};
