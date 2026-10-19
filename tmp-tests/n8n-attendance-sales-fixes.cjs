'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const SCOPED_NODES=['Vendas - Verificar Pos Lista'];
const MARKER='attendance-sales-validation-v2';
function replace(code,before,after){assert.equal(code.split(before).length,2,'Missing/ambiguous attendance anchor: '+before.slice(0,90));return code.replace(before,after);}
function canonicalHelpers(){
 const cpfFile=fs.readFileSync(path.join(__dirname,'../utils/cpfCnpjValidation.ts'),'utf8');
 const cpf=cpfFile.match(/export function validateCPF\(cpf: string\): boolean \{[\s\S]*?\n\}/)?.[0];
 assert.ok(cpf,'Canonical CPF function missing');
 const phoneFile=fs.readFileSync(path.join(__dirname,'../services/customerPhoneVerificationServer.cjs'),'utf8');
 const ddd=phoneFile.match(/^const DDD = .*;$/m)?.[0];
 const phone=phoneFile.match(/function normalizeVerificationPhone\(value\) \{[\s\S]*?\n\}/)?.[0];
 assert.ok(ddd&&phone,'Canonical phone validation missing');
 return `// ${MARKER}: canonical CPF and phone validators embedded for the isolated n8n Code runtime.\n`
  +cpf.replace('export function validateCPF(cpf: string): boolean','function validateAttendanceCpfV2(cpf)')+'\n'
  +ddd.replace('const DDD =','const attendanceDddV2 =')+'\n'
  +phone.replace('normalizeVerificationPhone','normalizeAttendancePhoneV2').replace('DDD.has','attendanceDddV2.has')+'\n';
}
function patchWorkflow(input){
 const w=structuredClone(input),matches=w.nodes.filter(n=>n.name===SCOPED_NODES[0]);assert.equal(matches.length,1);
 const node=matches[0];let code=node.parameters.jsCode;
 if(code.includes('// '+MARKER+': canonical'))return w;
 code=replace(code,"const formatCpf = (value) => {",canonicalHelpers()+"const formatCpf = (value) => {");
 code=replace(code,"const local = digits.startsWith('55') ? digits.slice(2) : digits;", "const canonical = normalizeAttendancePhoneV2(digits);\n  const local = canonical ? canonical.slice(2) : '';\n  if (!local) return '';");
 code=replace(code,
  "const isYes = /\\b(sim|isso|esse mesmo|pode ser|correto|certo|confirmo|ok|ta certo|esta certo)\\b/.test(normalized);",
  "const isYes = /\\b(sim|isso|esse mesmo|pode ser|correto|certo|confirmo|ok|ta certo|esta certo)\\b/.test(normalized) && !/\\b(?:nao|nunca|outro|outra|diferente)\\b/.test(normalized);");
 code=replace(code,
  "const deliveryChoice = () => /\\b(entrega|entregar|delivery|motoboy|mandar|enviar)\\b/.test(normalized);",
  String.raw`const fulfillmentChoiceV2 = terms => {
  const term = '(?:' + terms + ')';
  const present = new RegExp('\\b' + term + '\\b');
  const deniedBefore = new RegExp('\\b(?:nao\\s+(?:(?:quero|preciso|precisa|vou|vou querer|sera|vai ser)\\s+)?(?:de\\s+)?|sem\\s+)(?:a\\s+)?' + term + '\\b');
  const deniedAfter = new RegExp('\\b' + term + '\\s+(?:eu\\s+)?nao\\b');
  return (String(source.conversation || source.text || '').match(/[^,;.!?]+\??/g) || [])
    .filter(clause => !clause.trim().endsWith('?'))
    .map(normalize).some(clause => present.test(clause) && !deniedBefore.test(clause) && !deniedAfter.test(clause));
};
const deliveryChoice = () => fulfillmentChoiceV2('entrega|entregar|delivery|motoboy|mandar|enviar')
  && !fulfillmentChoiceV2('retirada|retirar|busco|buscar|pego|pegar|loja');`);
 code=replace(code,
  "const pickupChoice = () => /\\b(retirada|retirar|busco|buscar|pego|pegar|loja)\\b/.test(normalized);",
  "const pickupChoice = () => fulfillmentChoiceV2('retirada|retirar|busco|buscar|pego|pegar|loja')\n  && !fulfillmentChoiceV2('entrega|entregar|delivery|motoboy|mandar|enviar');");
 code=replace(code,
  "const collectionIsInterruptionV1 = collectingFieldV1 && !collectionHasLocationV1\n  && (collectionQuestionV1 || collectionCommerceV1 || (collectionSemanticValidV1 && collectionSemanticV1.decision !== 'field_value'));",
  String.raw`const collectionTrustedAddressV2 = /^(?:awaiting_delivery_neighborhood|awaiting_delivery_address_text|awaiting_delivery_number_complement)$/.test(String(activeState?.step || ''))
  && collectionSemanticValidV1 && collectionSemanticV1.decision === 'field_value'
  && !/\b(?:aceita|aceitam|tem|quero|manda|mandar|envia|enviar|pagar|pagamento|cartao|credito|debito|pix|boleto|payjoy|parcelas?|parcelamento|preco|valor|quanto|lista|catalogo|opcoes|modelos|atendente|humano|vendedor)\b/.test(normalized);
const collectionNameControlV2 = activeState?.step === 'awaiting_customer_full_name'
  && (/\b(?:cancelar|cancela|desisti|desistir|nao quero|nao vou|nao preciso|nao desejo|vou pensar|deixa pra la)\b/.test(normalized)
    || /^(?:(?:oi|ola)(?: tudo bem| bom dia| boa tarde| boa noite)?|bom dia|boa tarde|boa noite|tudo bem|obrigad[oa]|sim|nao|nao obrigado|prefiro nao|ok|pode|pode ser)$/.test(normalized));
const collectionIsInterruptionV1 = collectingFieldV1 && !collectionHasLocationV1
  && (collectionNameControlV2 || collectionQuestionV1 || (collectionCommerceV1 && !collectionTrustedAddressV2) || (collectionSemanticValidV1 && collectionSemanticV1.decision !== 'field_value'));`);
 code=replace(code,'if (warrantyQuestionV1) {','if (warrantyQuestionV1 && !collectionTrustedAddressV2) {');
 code=replace(code,
  "if (digits.length !== 11) return ask(activeState.step, 'Esse CPF nao ficou completo. Me manda os 11 numeros, por favor.');",
  "if (!validateAttendanceCpfV2(digits)) return ask(activeState.step, 'Esse CPF não é válido. Confira os 11 números e me envie novamente, por favor.');");
 code=replace(code,
  "if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;",
  "if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;\n  const todayPartsV2 = new Intl.DateTimeFormat('en-CA', {timeZone:'America/Recife',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());\n  const partV2 = type => Number(todayPartsV2.find(item => item.type === type).value);\n  const todayV2 = Date.UTC(partV2('year'), partV2('month') - 1, partV2('day'));\n  const ageV2 = partV2('year') - year - (partV2('month') < month || (partV2('month') === month && partV2('day') < day) ? 1 : 0);\n  if (date.getTime() > todayV2 || ageV2 > 120) return null;");
 code=replace(code,
  "if (digits.length < 10 || digits.length > 13) return ask(activeState.step, 'Esse numero nao ficou completo. Me manda com DDD, por favor.');",
  "if (!normalizeAttendancePhoneV2(text)) return ask(activeState.step, 'Esse telefone não é válido. Confira o DDD e o número e me envie novamente, por favor.');");
 node.parameters.jsCode=code;
 new Function('$json','$','$getWorkflowStaticData',code);
 return w;
}
module.exports={patchWorkflow,SCOPED_NODES};
