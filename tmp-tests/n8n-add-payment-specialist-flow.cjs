const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';

function shQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function dollar(value, tag) {
  return `$${tag}$${String(value).replace(new RegExp(`\\$${tag}\\$`, 'g'), '')}$${tag}$`;
}

function runRemote(conn, command) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('close', (code) => (
        code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `Remote command failed: ${code}`))
      ));
      stream.on('data', (chunk) => { stdout += chunk; });
      stream.stderr.on('data', (chunk) => { stderr += chunk; });
    });
  });
}

function psql(conn, dbContainer, sql) {
  return new Promise((resolve, reject) => {
    conn.exec(`docker exec -i ${shQuote(dbContainer)} psql -U postgres -d n8n -X -q -t -A`, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('close', (code) => (
        code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `psql failed: ${code}`))
      ));
      stream.on('data', (chunk) => { stdout += chunk; });
      stream.stderr.on('data', (chunk) => { stderr += chunk; });
      stream.end(sql);
    });
  });
}

async function waitServiceReplicas(conn, serviceName, expected, timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const replicas = (await runRemote(
      conn,
      `docker service ls --filter name=${shQuote(serviceName)} --format '{{.Replicas}}' | head -n 1`,
    )).trim();
    if (replicas === `${expected}/${expected}`) return replicas;
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error(`Timed out waiting for ${serviceName} replicas ${expected}/${expected}`);
}

function readJson(conn, dbContainer, sql) {
  return psql(conn, dbContainer, `COPY (${sql}) TO STDOUT;`).then((text) => JSON.parse(text.trim()));
}

const paymentPolicyHelpersCode = `const paymentPolicyNormalizeText = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\\u0300-\\u036f]/g, '')
  .toLowerCase();

const paymentPolicyReply = (message) => {
  const normalized = paymentPolicyNormalizeText(message);
  const accepted = 'A gente recebe por Pix, transferencia bancaria, dinheiro, cartao de debito e cartao de credito. 💳';
  const cardNote = 'Pagamento no cartao e feito somente presencialmente, no ato da entrega ou retirada.';

  if (/\\bboleto\\b/.test(normalized)) {
    return [
      'No boleto a gente nao trabalha, tudo bem? 🙏',
      accepted,
      'Tambem nao fazemos pagamento por link.',
    ].join('||');
  }

  if (/\\b(usado|usados|troca|entrada)\\b/.test(normalized) && !/\\b(dinheiro|pix|valor|r\\$|real|reais)\\b/.test(normalized)) {
    return [
      'A gente trabalha somente com produtos novos 😊',
      'Por isso nao aceitamos aparelho usado como entrada.',
      accepted,
    ].join('||');
  }

  if (/\\b(link de pagamento|pagamento por link|link)\\b/.test(normalized)) {
    return [
      'Por seguranca, nao trabalhamos com pagamento por link. 🔒',
      cardNote,
      accepted,
    ].join('||');
  }

  if (/\\b(divide|dividir|parcela|parcelas|parcelamento|quantas vezes|ate quantas vezes)\\b/.test(normalized)) {
    return [
      'No cartao de credito, dividimos em ate 12x. 💳',
      'As parcelas seguem a tabela da maquininha e eu te passo tudo certinho antes de finalizar.',
      cardNote,
    ].join('||');
  }

  return [
    'Nossas formas de pagamento sao:',
    'Pix, transferencia bancaria, dinheiro, cartao de debito e cartao de credito. 💳',
    'No credito, dividimos em ate 12x.',
    'Nao trabalhamos com boleto, pagamento por link ou usado como entrada. 🙏',
  ].join('||');
};`;

const paymentPolicyNodeCode = `${paymentPolicyHelpersCode}
const source = $json || {};
return [{ json: { ...source, output: paymentPolicyReply(source.mensagem || source.text || source.message || '') } }];`;

const installmentResolverCode = `const source = $('Vendas - Verificar Pos Lista').first().json || {};
const feeInputs = $input.all().map((item) => item.json);
const fees = feeInputs.length === 1 && Array.isArray(feeInputs[0]) ? feeInputs[0] : feeInputs;
const staticData = $getWorkflowStaticData('global');
staticData.salesPostList = staticData.salesPostList || {};

const remoteJid = String(source.remoteJid || '');
const activeState = remoteJid ? staticData.salesPostList[remoteJid] : null;
const lineBreak = '||';
const paymentInstallments = 12;

const toNumber = (value) => {
  const parsed = Number(String(value ?? '0').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};
const centsToBRL = (cents) => (Math.round(cents) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const parseMoneyToCents = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return 0;
  const match = raw.match(/(\\d{1,3}(?:\\.\\d{3})*,\\d{2}|\\d+[,.]\\d{2}|\\d+)/);
  if (!match) return 0;
  let text = match[1];
  if (text.includes(',')) text = text.replace(/\\./g, '').replace(',', '.');
  const amount = Number(text);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
};
const getOrderTotalCents = (draft) => {
  const unitCents = Number(draft?.unitPriceCents || 0) || parseMoneyToCents(draft?.price || draft?.pricePix || draft?.total || '');
  const quantity = Math.max(1, Number(draft?.quantity || 1));
  return Math.max(0, unitCents * quantity);
};
const buildInstallmentOptions = (baseCents, feeRows) => {
  const presencialFees = (Array.isArray(feeRows) ? feeRows : [])
    .filter((fee) => String(fee?.channel || '') === 'presencial')
    .filter((fee) => Number(fee?.installments) >= 1 && Number(fee?.installments) <= paymentInstallments)
    .sort((a, b) => toNumber(a?.applied_fee_pct) - toNumber(b?.applied_fee_pct));

  return Array.from({ length: paymentInstallments }, (_, index) => {
    const installments = index + 1;
    const fee = presencialFees.find((item) => Number(item?.installments) === installments) || { applied_fee_pct: 0 };
    const feePct = toNumber(fee.applied_fee_pct);
    const totalCents = Math.round(baseCents * (1 + feePct / 100));
    const installmentCents = Math.round(totalCents / installments);
    return {
      installments,
      feePct,
      totalCents,
      installmentCents,
      label: installments + 'x de ' + centsToBRL(installmentCents) + ' = ' + centsToBRL(totalCents),
    };
  });
};

if (!activeState) {
  return [{ json: { ...source, salesPostListHandled: true, output: 'Me confirma o item do pedido para eu calcular o parcelamento no cartao.' } }];
}

const draft = { ...(activeState.orderDraft || {}), ...(source.orderDraft || {}) };
const orderTotalCents = getOrderTotalCents(draft);
const downPaymentCents = Math.min(Math.max(0, Number(source.downPaymentCents || draft.downPaymentCents || 0)), orderTotalCents);
const cardBaseCents = Math.max(0, orderTotalCents - downPaymentCents);
const options = buildInstallmentOptions(cardBaseCents, fees);

activeState.step = 'awaiting_card_installment';
activeState.orderDraft = {
  ...draft,
  paymentMethod: 'card',
  paymentLabel: 'cartao',
  downPaymentCents,
  downPaymentMethod: source.downPaymentMethod || draft.downPaymentMethod || '',
  cardBaseCents,
  cardInstallmentOptions: options,
};
activeState.updatedAt = new Date().toISOString();

const intro = 'Certo \\uD83D\\uDE0A|||Deixa eu lhe passar as opcoes de parcelamento no cartao.';
const downPaymentLine = downPaymentCents > 0
  ? 'Entrada ' + (activeState.orderDraft.downPaymentMethod || 'informada') + ': ' + centsToBRL(downPaymentCents) + lineBreak + 'Saldo para o cartao: ' + centsToBRL(cardBaseCents) + lineBreak
  : '';
const list = downPaymentLine + 'Opcoes no cartao:' + lineBreak
  + options.map((option, index) => (index + 1) + '. ' + option.label).join(lineBreak)
  + lineBreak + lineBreak + 'Qual opcao voce prefere?';

return [{ json: {
  ...source,
  needsPaymentOptionsLookup: false,
  salesPostListHandled: true,
  salesPostListStep: activeState.step,
  orderDraft: activeState.orderDraft,
  output: intro + '|||' + list,
} }];`;

const postListInsertHelpers = `
${paymentPolicyHelpersCode}
const paymentPolicyQuestion = () => /\\b(formas? de pagamento|forma de pagar|como posso pagar|aceita pix|aceita cartao|cartao de credito|cartao de debito|debito|credito|boleto|usado|usados|troca|entrada|link de pagamento|pagamento por link|divide|dividir|parcela|parcelas|parcelamento|quantas vezes|ate quantas vezes)\\b/.test(normalized)
  && !/\\b(resto|restante|sobra|parcelar|parcelado|parcelas?|\\d{1,3}\\s*(?:reais|real|r\\$)?\\s*(?:no pix|pix|dinheiro))\\b/.test(normalized);
const formatMoney = (cents) => (Math.round(cents) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const parseMoneyToCents = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return 0;
  const match = raw.match(/(\\d{1,3}(?:\\.\\d{3})*,\\d{2}|\\d+[,.]\\d{2}|\\d+)/);
  if (!match) return 0;
  let text = match[1];
  if (text.includes(',')) text = text.replace(/\\./g, '').replace(',', '.');
  const amount = Number(text);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
};
const getOrderTotalCents = (draft) => {
  const unitCents = Number(draft?.unitPriceCents || 0) || parseMoneyToCents(draft?.price || draft?.pricePix || draft?.total || '');
  const quantity = Math.max(1, Number(draft?.quantity || 1));
  return Math.max(0, unitCents * quantity);
};
const parseDownPayment = () => {
  const method = /\\bpix\\b/.test(normalized) ? 'Pix' : (/\\b(dinheiro|especie)\\b/.test(normalized) ? 'dinheiro' : '');
  const downMatch = String(text || '').match(/(?:entrada|dou|dar|darei|vou dar|adiantar|sinal)[^0-9]{0,20}(\\d{1,3}(?:\\.\\d{3})*,\\d{2}|\\d+[,.]\\d{2}|\\d+)/i)
    || String(text || '').match(/(\\d{1,3}(?:\\.\\d{3})*,\\d{2}|\\d+[,.]\\d{2}|\\d+)\\s*(?:no\\s*)?(pix|dinheiro)/i);
  return {
    amountCents: downMatch ? parseMoneyToCents(downMatch[1]) : 0,
    method: method || (downMatch?.[2] ? titleCase(downMatch[2]) : ''),
  };
};
const parseInstallmentChoice = () => {
  const match = normalized.match(/\\b(1[0-2]|[1-9])\\s*x\\b/)
    || normalized.match(/\\b(?:opcao|opcao numero|numero|em|faz em|quero em)?\\s*(1[0-2]|[1-9])\\b/);
  const installments = Number(match?.[1] || 0);
  return installments >= 1 && installments <= 12 ? installments : 0;
};
const orderSummary = (draft) => {
  const parts = [
    'Resumo do pedido:',
    'Produto: ' + [draft.name, draft.memory, draft.color].filter(Boolean).join(' '),
    'Quantidade: ' + (draft.quantity || 1),
  ];
  if (draft.fulfillment === 'delivery') {
    const address = draft.deliveryAddress || {};
    parts.push('Entrega: ' + [
      [address.street, draft.deliveryNumberComplement].filter(Boolean).join(', '),
      address.neighborhood,
      [address.city, address.state].filter(Boolean).join('/'),
    ].filter(Boolean).join(' - '));
  }
  if (draft.fulfillment === 'pickup') {
    parts.push('Retirada: ' + (draft.pickupTime ? 'por volta de ' + draft.pickupTime : 'na loja'));
  }
  if (draft.downPaymentCents > 0) parts.push('Entrada ' + (draft.downPaymentMethod || '') + ': ' + formatMoney(draft.downPaymentCents));
  if (draft.selectedCardInstallment) {
    const option = draft.selectedCardInstallment;
    parts.push('Cartao: ' + option.installments + 'x de ' + formatMoney(option.installmentCents) + ' = ' + formatMoney(option.totalCents));
    parts.push('Total final: ' + formatMoney(Number(draft.downPaymentCents || 0) + Number(option.totalCents || 0)));
  } else if (draft.paymentMethod === 'pix' || draft.paymentMethod === 'cash') {
    parts.push('Pagamento: ' + (draft.paymentLabel || draft.paymentMethod));
  }
  return parts.filter(Boolean).join(lineBreak) + lineBreak + lineBreak + 'Me confirma se esta tudo certo?';
};
`;

const paymentMethodBlock = `if (activeState?.step === 'awaiting_payment_method') {
  if (paymentPolicyQuestion()) {
    return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: activeState.step, output: withGreeting(paymentPolicyReply(text)) } }];
  }
  const method = paymentChoice();
  const settings = await getCompanySettings();
  if (!method) {
    return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: activeState.step, output: withGreeting(paymentPrompt()) } }];
  }
  if (method === 'card') {
    const downPayment = parseDownPayment();
    activeState.step = 'awaiting_card_installment';
    activeState.orderDraft = {
      ...activeState.orderDraft,
      paymentMethod: 'card',
      paymentLabel: 'cartao',
      downPaymentCents: downPayment.amountCents,
      downPaymentMethod: downPayment.method,
    };
    activeState.updatedAt = new Date(now).toISOString();
    return [{ json: {
      ...source,
      salesPostListHandled: true,
      salesPostListStep: activeState.step,
      needsPaymentOptionsLookup: true,
      downPaymentCents: downPayment.amountCents,
      downPaymentMethod: downPayment.method,
      orderDraft: activeState.orderDraft,
    } }];
  }
  activeState.step = 'awaiting_order_confirmation';
  activeState.orderDraft = { ...activeState.orderDraft, paymentMethod: method, paymentLabel: paymentMethodLabels[method] || method };
  activeState.updatedAt = new Date(now).toISOString();
  return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: activeState.step, orderDraft: activeState.orderDraft, output: withGreeting(paymentReply(method, settings) + lineBreak + lineBreak + orderSummary(activeState.orderDraft)) } }];
}

if (activeState?.step === 'awaiting_card_installment') {
  if (paymentPolicyQuestion()) {
    return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: activeState.step, output: withGreeting(paymentPolicyReply(text)) } }];
  }
  const selectedInstallments = parseInstallmentChoice();
  const options = activeState.orderDraft?.cardInstallmentOptions || [];
  const selected = options.find((option) => Number(option.installments) === selectedInstallments);
  if (!selected) {
    if (options.length > 0) {
      return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: activeState.step, output: withGreeting('Me diz qual opcao de parcelamento voce prefere. Pode responder assim: 1x, 2x ou 12x.') } }];
    }
    return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: activeState.step, needsPaymentOptionsLookup: true, orderDraft: activeState.orderDraft } }];
  }
  activeState.step = 'awaiting_order_confirmation';
  activeState.orderDraft = { ...activeState.orderDraft, selectedCardInstallment: selected };
  activeState.updatedAt = new Date(now).toISOString();
  return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: activeState.step, orderDraft: activeState.orderDraft, output: withGreeting(orderSummary(activeState.orderDraft)) } }];
}

if (activeState?.step === 'awaiting_order_confirmation') {
  return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: activeState.step, orderDraft: activeState.orderDraft, output: withGreeting('Perfeito. Agora vou seguir com seus dados para cadastrar o pedido no sistema.') } }];
}`;

function patchClassifierSystemMessage(message) {
  let next = String(message || '');
  if (!next.includes('- formas_pagamento')) {
    next = next.replace('- pedido_humano\n- fallback', '- pedido_humano\n- formas_pagamento\n- fallback');
  }
  if (!next.includes('usados como entrada')) {
    next = next.replace(
      '- Pedido para falar com atendente, vendedor ou humano: pedido_humano.\n',
      '- Pedido para falar com atendente, vendedor ou humano: pedido_humano.\n- Perguntas sobre formas de pagamento, boleto, link de pagamento, cartao, Pix, dinheiro, transferencia bancaria ou usados como entrada: formas_pagamento.\n',
    );
  }
  return next;
}

function patchParseClassifier(code) {
  let next = String(code || '');
  next = next.replace(
    "const allowed = new Set(['saudacao', 'vendas_produtos', 'cadastro_contato', 'pos_venda', 'pedido_humano', 'horario_loja', 'fallback']);",
    "const allowed = new Set(['saudacao', 'vendas_produtos', 'cadastro_contato', 'pos_venda', 'pedido_humano', 'horario_loja', 'formas_pagamento', 'fallback']);",
  );
  if (!next.includes('const paymentPolicyIntent =')) {
    next = next.replace(
      "const storeHoursIntent = /\\b(horario|funcionamento|abre|abrem|abrir|aberto|aberta|fechado|fechada|fecha|fecham|expediente|almoco|almoço)\\b/.test(normalizedMessageForIntent)\n  && /\\b(loja|voces|voce|mercado do vale|agora|hoje|que horas|hora)\\b/.test(normalizedMessageForIntent);\nconst intencao = storeHoursIntent\n  ? 'horario_loja'\n  : (allowed.has(String(parsed.intencao || '').trim()) ? String(parsed.intencao).trim() : 'fallback');",
      "const storeHoursIntent = /\\b(horario|funcionamento|abre|abrem|abrir|aberto|aberta|fechado|fechada|fecha|fecham|expediente|almoco|almoço)\\b/.test(normalizedMessageForIntent)\n  && /\\b(loja|voces|voce|mercado do vale|agora|hoje|que horas|hora)\\b/.test(normalizedMessageForIntent);\nconst paymentPolicyIntent = /\\b(formas? de pagamento|forma de pagar|como posso pagar|aceita pix|aceita cartao|cartao de credito|cartao de debito|debito|credito|boleto|usado|usados|troca|entrada|link de pagamento|pagamento por link|divide|dividir|parcela|parcelas|parcelamento|quantas vezes|ate quantas vezes)\\b/.test(normalizedMessageForIntent);\nconst intencao = storeHoursIntent\n  ? 'horario_loja'\n  : (paymentPolicyIntent ? 'formas_pagamento' : (allowed.has(String(parsed.intencao || '').trim()) ? String(parsed.intencao).trim() : 'fallback'));",
    );
  }
  next = next.replace(
    /const paymentPolicyIntent = \/\\b\([^;]+\.test\(normalizedMessageForIntent\);/,
    "const paymentPolicyIntent = /\\b(formas? de pagamento|forma de pagar|como posso pagar|aceita pix|aceita cartao|cartao de credito|cartao de debito|debito|credito|boleto|usado|usados|troca|entrada|link de pagamento|pagamento por link|divide|dividir|parcela|parcelas|parcelamento|quantas vezes|ate quantas vezes)\\b/.test(normalizedMessageForIntent);",
  );
  new Function('$json', next);
  return next;
}

function patchPostListCode(code) {
  let next = String(code || '');
  next = next.replace(
    /const paymentPolicyMessage = .*?;\nconst paymentPolicyQuestion =/s,
    paymentPolicyHelpersCode + "\nconst paymentPolicyQuestion =",
  );
  if (!next.includes('const paymentPolicyReply =')) {
    next = next.replace(
      "const paymentReply = (method, settings) => {\n  if (method === 'pix') {\n    return [\n      'Perfeito, pagamento no Pix.',\n      settings.pix_key ? 'Chave Pix: ' + settings.pix_key : 'Vou te enviar a chave Pix da loja.',\n      settings.pix_beneficiary_name ? 'Beneficiario: ' + settings.pix_beneficiary_name : '',\n      'Depois me manda o comprovante por aqui, por favor. 😊',\n    ].filter(Boolean).join(lineBreak);\n  }\n  if (method === 'card') return 'Perfeito, pagamento no cartao.' + lineBreak + 'A equipe finaliza as condicoes e parcelas com voce.';\n  if (method === 'cash') return 'Perfeito, pagamento em dinheiro.' + lineBreak + 'A equipe confirma o troco, se precisar.';\n  return paymentPrompt();\n};",
      "const paymentReply = (method, settings) => {\n  if (method === 'pix') {\n    return [\n      'Perfeito, pagamento no Pix.',\n      settings.pix_key ? 'Chave Pix: ' + settings.pix_key : 'Vou te enviar a chave Pix da loja.',\n      settings.pix_beneficiary_name ? 'Beneficiario: ' + settings.pix_beneficiary_name : '',\n      'Depois me manda o comprovante por aqui, por favor. 😊',\n    ].filter(Boolean).join(lineBreak);\n  }\n  if (method === 'card') return 'Perfeito, pagamento no cartao.' + lineBreak + 'A equipe finaliza as condicoes e parcelas com voce.';\n  if (method === 'cash') return 'Perfeito, pagamento em dinheiro.' + lineBreak + 'A equipe confirma o troco, se precisar.';\n  return paymentPrompt();\n};\n" + postListInsertHelpers.trim(),
    );
  }
  next = next.replace(
    /const paymentPolicyNormalizeText = \(value\) => String\(value \|\| ''\)[\s\S]*?const paymentPolicyQuestion =/s,
    paymentPolicyHelpersCode + "\nconst paymentPolicyQuestion =",
  );
  next = next.replace(
    /const paymentPolicyQuestion = \(\) => \/\\b\([^;]+?\.test\(normalized\)\n  && !\/\\b\(resto\|restante\|sobra\|parcelar\|parcelado\|parcelas\?\|\\d\{1,3\}\\s\*\(\?:reais\|real\|r\\\$\)\?\\s\*\(\?:no pix\|pix\|dinheiro\)\)\\b\/\.test\(normalized\);/s,
    "const paymentPolicyQuestion = () => /\\b(formas? de pagamento|forma de pagar|como posso pagar|aceita pix|aceita cartao|cartao de credito|cartao de debito|debito|credito|boleto|usado|usados|troca|entrada|link de pagamento|pagamento por link|divide|dividir|parcela|parcelas|parcelamento|quantas vezes|ate quantas vezes)\\b/.test(normalized)\n  && !/\\b(resto|restante|sobra|\\d{1,3}\\s*(?:reais|real|r\\$)?\\s*(?:no pix|pix|dinheiro))\\b/.test(normalized);",
  );
  if (!next.includes("activeState?.step === 'awaiting_card_installment'")) {
    const start = next.indexOf("if (activeState?.step === 'awaiting_payment_method') {");
    const end = next.indexOf("\n\nif (requestedQuantity > 0) {", start);
    if (start === -1 || end === -1) throw new Error('Payment method block not found');
    next = next.slice(0, start) + paymentMethodBlock + next.slice(end);
  }
  if (!next.includes('paymentPolicyQuestion()) {\n  return [{ json: { ...source, salesPostListHandled: true')) {
    next = next.replace(
      "const normalized = normalize(text);\nconst wantsPhoto =",
      "const normalized = normalize(text);\nif (activeState && paymentPolicyQuestion()) {\n  return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: activeState.step, output: withGreeting(paymentPolicyMessage) } }];\n}\nconst wantsPhoto =",
    );
  }
  next = next.replaceAll('withGreeting(paymentPolicyMessage)', 'withGreeting(paymentPolicyReply(text))');
  new Function('$json', '$getWorkflowStaticData', '$env', next);
  return next;
}

function ensureSwitchOutput(nodes, connections) {
  const switchNode = nodes.find((node) => node.name === 'Switch Especialistas');
  if (!switchNode) throw new Error('Switch Especialistas not found');
  const values = switchNode.parameters?.rules?.values || [];
  const exists = values.some((rule) => rule.outputKey === 'formas_pagamento' || JSON.stringify(rule).includes('formas_pagamento'));
  if (!exists) {
    const fallbackIndex = values.findIndex((rule) => rule.outputKey === 'fallback');
    const rule = {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 3 },
        combinator: 'and',
        conditions: [{
          id: 'intent-formas-pagamento',
          operator: { type: 'string', operation: 'equals' },
          leftValue: '={{$json.intencao}}',
          rightValue: 'formas_pagamento',
        }],
      },
      renameOutput: true,
      outputKey: 'formas_pagamento',
    };
    if (fallbackIndex >= 0) values.splice(fallbackIndex, 0, rule);
    else values.push(rule);
  }

  const fallbackTarget = [{ node: 'Agente Geral - Atendimento', type: 'main', index: 0 }];
  const main = connections['Switch Especialistas']?.main || [];
  const desiredIndex = values.findIndex((rule) => rule.outputKey === 'formas_pagamento');
  while (main.length < values.length) main.push(fallbackTarget);
  main[desiredIndex] = [{ node: 'Pagamento - Politica', type: 'main', index: 0 }];
  connections['Switch Especialistas'] = { main };
}

function addOrReplaceNode(nodes, node) {
  const index = nodes.findIndex((item) => item.name === node.name);
  if (index >= 0) nodes[index] = { ...nodes[index], ...node };
  else nodes.push(node);
}

function patchWorkflow(nodes, connections) {
  const classifier = nodes.find((node) => node.name === 'Agente Inicial - Classificador');
  const parse = nodes.find((node) => node.name === 'Parse Classificacao');
  const postList = nodes.find((node) => node.name === 'Vendas - Verificar Pos Lista');
  if (!classifier || !parse || !postList) throw new Error('Required nodes not found');

  if (classifier.parameters?.options?.systemMessage) {
    classifier.parameters.options.systemMessage = patchClassifierSystemMessage(classifier.parameters.options.systemMessage);
  }
  parse.parameters.jsCode = patchParseClassifier(parse.parameters.jsCode);
  postList.parameters.jsCode = patchPostListCode(postList.parameters.jsCode);

  addOrReplaceNode(nodes, {
    id: 'payment-policy-specialist-001',
    name: 'Pagamento - Politica',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [2080, 16],
    parameters: { jsCode: paymentPolicyNodeCode },
  });
  new Function('$json', paymentPolicyNodeCode);

  addOrReplaceNode(nodes, {
    id: 'sales-payment-needs-fees-001',
    name: 'Vendas - Precisa calcular parcelamento?',
    type: 'n8n-nodes-base.if',
    typeVersion: 2.2,
    position: [2336, 520],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [{
          id: 'sales-payment-needs-fees-condition',
          leftValue: '={{$json.needsPaymentOptionsLookup}}',
          rightValue: true,
          operator: { type: 'boolean', operation: 'true', singleValue: true },
        }],
        combinator: 'and',
      },
      options: {},
    },
  });

  addOrReplaceNode(nodes, {
    id: 'sales-payment-fees-installments-001',
    name: 'Vendas - Buscar Taxas Parcelamento',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [2576, 464],
    parameters: {
      url: 'https://api.xiaomipetrolina.com.br/payment-fees',
      options: {},
    },
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 1500,
    continueOnFail: true,
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
  });

  addOrReplaceNode(nodes, {
    id: 'sales-payment-resolve-installments-001',
    name: 'Vendas - Resolver Parcelamento',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [2816, 464],
    parameters: { jsCode: installmentResolverCode },
  });
  new Function('$json', '$getWorkflowStaticData', installmentResolverCode);

  ensureSwitchOutput(nodes, connections);
  connections['Pagamento - Politica'] = { main: [[{ node: 'Dividir mensagens', type: 'main', index: 0 }]] };

  connections['Vendas - Precisa buscar CEP?'] = {
    main: [
      [{ node: 'Vendas - Buscar CEP ViaCEP', type: 'main', index: 0 }],
      [{ node: 'Vendas - Precisa calcular parcelamento?', type: 'main', index: 0 }],
    ],
  };
  connections['Vendas - Precisa calcular parcelamento?'] = {
    main: [
      [{ node: 'Vendas - Buscar Taxas Parcelamento', type: 'main', index: 0 }],
      [{ node: 'Vendas - Pos Lista resolvido?', type: 'main', index: 0 }],
    ],
  };
  connections['Vendas - Buscar Taxas Parcelamento'] = {
    main: [[{ node: 'Vendas - Resolver Parcelamento', type: 'main', index: 0 }]],
  };
  connections['Vendas - Resolver Parcelamento'] = {
    main: [[{ node: 'Dividir mensagens', type: 'main', index: 0 }]],
  };
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve).on('error', reject).connect(getVpsSshConfig());
  });

  let servicesStopped = false;
  try {
    const dbContainer = (await runRemote(
      conn,
      "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1",
    )).trim();
    if (!dbContainer) throw new Error('n8n Postgres container not found');

    await runRemote(conn, 'docker service scale n8n_n8n-runner=0 >/dev/null');
    await waitServiceReplicas(conn, 'n8n_n8n-runner', 0);
    await runRemote(conn, 'docker service scale n8n_n8n=0 >/dev/null');
    await waitServiceReplicas(conn, 'n8n_n8n', 0);
    servicesStopped = true;

    const entity = await readJson(conn, dbContainer, `
      SELECT json_build_object(
        'nodesHex', encode(convert_to(nodes::text, 'UTF8'), 'hex'),
        'connectionsHex', encode(convert_to(connections::text, 'UTF8'), 'hex'),
        'versionId', "versionId",
        'activeVersionId', "activeVersionId"
      )::text
      FROM workflow_entity
      WHERE id = ${shQuote(WORKFLOW_ID)}
    `);

    const nodes = JSON.parse(Buffer.from(entity.nodesHex, 'hex').toString('utf8'));
    const connections = JSON.parse(Buffer.from(entity.connectionsHex, 'hex').toString('utf8'));
    patchWorkflow(nodes, connections);

    const versionIds = Array.from(new Set([entity.versionId, entity.activeVersionId])).filter(Boolean);
    const versionList = versionIds.map(shQuote).join(',');

    const updateSql = `
\\set ON_ERROR_STOP on

UPDATE workflow_entity
SET nodes = ${dollar(JSON.stringify(nodes), 'nodesjson')}::json,
    connections = ${dollar(JSON.stringify(connections), 'connjson')}::json,
    "versionId" = "activeVersionId",
    "updatedAt" = NOW()
WHERE id = ${shQuote(WORKFLOW_ID)};

UPDATE workflow_history
SET nodes = ${dollar(JSON.stringify(nodes), 'histnodesjson')}::json,
    connections = ${dollar(JSON.stringify(connections), 'histconnjson')}::json,
    "updatedAt" = NOW()
WHERE "workflowId" = ${shQuote(WORKFLOW_ID)}
  AND "versionId" IN (${versionList});

COPY (
  SELECT json_build_object(
    'versionAligned', (SELECT "versionId" = "activeVersionId" FROM workflow_entity WHERE id=${shQuote(WORKFLOW_ID)}),
    'paymentPolicyIntent', EXISTS(SELECT 1 FROM workflow_entity, jsonb_array_elements(nodes::jsonb) node WHERE id=${shQuote(WORKFLOW_ID)} AND node->>'name'='Parse Classificacao' AND node->'parameters'->>'jsCode' LIKE '%formas_pagamento%'),
    'paymentPolicyNode', EXISTS(SELECT 1 FROM workflow_entity, jsonb_array_elements(nodes::jsonb) node WHERE id=${shQuote(WORKFLOW_ID)} AND node->>'name'='Pagamento - Politica'),
    'paymentFeesNode', EXISTS(SELECT 1 FROM workflow_entity, jsonb_array_elements(nodes::jsonb) node WHERE id=${shQuote(WORKFLOW_ID)} AND node->>'name'='Vendas - Buscar Taxas Parcelamento'),
    'cardStep', EXISTS(SELECT 1 FROM workflow_entity, jsonb_array_elements(nodes::jsonb) node WHERE id=${shQuote(WORKFLOW_ID)} AND node->>'name'='Vendas - Verificar Pos Lista' AND node->'parameters'->>'jsCode' LIKE '%awaiting_card_installment%')
  )::text
) TO STDOUT;
`;
    const result = JSON.parse((await psql(conn, dbContainer, updateSql)).trim());

    await runRemote(conn, 'docker service scale n8n_n8n=1 >/dev/null');
    await waitServiceReplicas(conn, 'n8n_n8n', 1);
    await runRemote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null');
    await waitServiceReplicas(conn, 'n8n_n8n-runner', 1);
    servicesStopped = false;

    console.log(JSON.stringify(result, null, 2));
  } finally {
    if (servicesStopped) {
      await runRemote(conn, 'docker service scale n8n_n8n=1 >/dev/null').catch(() => {});
      await runRemote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null').catch(() => {});
    }
    conn.end();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
