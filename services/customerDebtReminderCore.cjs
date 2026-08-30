'use strict';

/**
 * Core operacional do Dispatcher de Lembretes de Crediário / Venda a Prazo via WhatsApp.
 * Módulo CJS puro projetado para ser testável com mocks e integrado na VPS.
 */

const WHATSAPP_AUTOMATION_TEMPLATE_KEY_CUSTOMER_DEBT_DUE_REMINDER = 'customer_debt_due_reminder';

const WHATSAPP_AUTOMATION_TEMPLATE_CUSTOMER_DEBT_DUE_REMINDER_DEFAULT = {
  template_key: WHATSAPP_AUTOMATION_TEMPLATE_KEY_CUSTOMER_DEBT_DUE_REMINDER,
  category: 'transactional',
  title: 'Lembrete de Vencimento de Parcela a Prazo',
  description: 'Enviado no dia do vencimento da parcela de venda a prazo do cliente com resumo da compra e saldo restante.',
  content: `Olá, {nome}! 💚

Passando para lembrar o vencimento da parcela {parcela}/{total_parcelas} da compra {pedido}.

Vencimento: {vencimento}
Valor da parcela: {valor_parcela}
Valor já pago nesta parcela: {valor_pago_parcela}
Saldo atual: {saldo_parcela}

Histórico desta compra:
{historico_compra}

Você também pode conferir seus pagamentos em:
{portal_link}

Se você acabou de pagar, pode desconsiderar esta mensagem. Qualquer dúvida, estamos por aqui.`,
  enabled: true,
  variables_json: JSON.stringify([
    { key: 'nome', label: 'Nome do Cliente', example: 'Maria Silva' },
    { key: 'pedido', label: 'Código do Pedido/Venda', example: '#12345' },
    { key: 'parcela', label: 'Número da Parcela', example: '1' },
    { key: 'total_parcelas', label: 'Total de Parcelas', example: '3' },
    { key: 'vencimento', label: 'Data de Vencimento', example: '31/01/2027' },
    { key: 'valor_parcela', label: 'Valor da Parcela', example: 'R$ 33,34' },
    { key: 'valor_pago_parcela', label: 'Valor já Pago', example: 'R$ 0,00' },
    { key: 'saldo_parcela', label: 'Saldo Devedor da Parcela', example: 'R$ 33,34' },
    { key: 'historico_compra', label: 'Resumo das Parcelas', example: '1/3: R$ 33,34 (Pendente) | 2/3: R$ 33,33 (Pendente)' },
    { key: 'portal_link', label: 'Link do Portal do Cliente', example: 'https://mercadodovale.com.br/minha-conta' },
  ]),
};

const DEFAULT_CUSTOMER_DEBT_REMINDER_TEMPLATE = WHATSAPP_AUTOMATION_TEMPLATE_CUSTOMER_DEBT_DUE_REMINDER_DEFAULT;

function formatMoneyCentsToBrl(cents) {
  const n = Number(cents) || 0;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n / 100);
}

function formatDateBr(dateIso) {
  if (!dateIso) return '-';
  const parts = String(dateIso).split('T')[0].split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return String(dateIso);
}

function extractEvolutionProviderMessageId(result) {
  if (!result || typeof result !== 'object') return null;
  const body = result.body;
  if (!body || typeof body !== 'object') return null;
  return body.key?.id || body.messageId || body.id || null;
}

/**
 * Monta o bloco de variáveis para preencher o template de lembrete de parcela.
 */
function buildDebtReminderTemplateVariables({ customer, debt, allSaleDebts, portalBaseUrl = 'https://mercadodovale.com.br' }) {
  const customerName = String(customer?.name || 'Cliente').trim();
  const saleCode = debt.sale_id ? `#${String(debt.sale_id).slice(0, 8).toUpperCase()}` : '#AVULSO';
  const installmentNumber = debt.installment_number || 1;
  const installmentCount = debt.installment_count || 1;
  const valorTotal = Number(debt.valor_total) || 0;
  const saldoDevedor = Number(debt.saldo_devedor) || 0;
  const valorPago = Math.max(0, valorTotal - saldoDevedor);

  const debtsList = Array.isArray(allSaleDebts) && allSaleDebts.length > 0 ? allSaleDebts : [debt];
  debtsList.sort((a, b) => (Number(a.installment_number) || 1) - (Number(b.installment_number) || 1));

  const historicoLines = debtsList.map(d => {
    const num = `${d.installment_number || 1}/${d.installment_count || 1}`;
    const valor = formatMoneyCentsToBrl(d.valor_total);
    const st = d.status === 'paid' ? 'Pago' : d.status === 'partial' ? `Parcial (Resta ${formatMoneyCentsToBrl(d.saldo_devedor)})` : 'Pendente';
    const venc = formatDateBr(d.data_vencimento);
    return `• Parcela ${num}: ${valor} — Venc: ${venc} [${st}]`;
  });

  return {
    nome: customerName,
    pedido: saleCode,
    parcela: String(installmentNumber),
    total_parcelas: String(installmentCount),
    vencimento: formatDateBr(debt.data_vencimento),
    valor_parcela: formatMoneyCentsToBrl(valorTotal),
    valor_pago_parcela: formatMoneyCentsToBrl(valorPago),
    saldo_parcela: formatMoneyCentsToBrl(saldoDevedor),
    historico_compra: historicoLines.join('\n'),
    portal_link: `${String(portalBaseUrl).replace(/\/+$/, '')}/minha-conta`,
  };
}

const buildCustomerDebtReminderVariables = buildDebtReminderTemplateVariables;

/**
 * Cancela atomicamente lembretes pendentes vinculados a um débito quitado ou cancelado.
 */
async function cancelPendingRemindersForDebt(connection, debtId) {
  if (!connection || !debtId) return 0;
  const [result] = await connection.query(
    `UPDATE customer_debt_reminders
        SET status = 'skipped',
            last_error = 'debt_already_paid_or_cancelled',
            updated_at = CURRENT_TIMESTAMP
      WHERE debt_id = ?
        AND status IN ('pending', 'failed', 'processing')`,
    [debtId]
  );
  return result?.affectedRows || 0;
}

/**
 * Processador do Dispatcher de Lembretes.
 * Suporta chamada como objeto único desestruturado:
 * processCustomerDebtReminders({ pool, sendWhatsAppMessage, dryRun, limit, referenceDate, logger })
 */
async function processCustomerDebtReminders(args, legacyOptions, legacyDeps) {
  let pool;
  let sendWhatsAppMessage;
  let dryRun = true; // Por padrão dry-run ativo para segurança
  let limit = 50;
  let referenceDate = null;
  let logger = console;

  if (args && typeof args === 'object' && args.pool) {
    pool = args.pool;
    sendWhatsAppMessage = args.sendWhatsAppMessage || args.sendWhatsApp;
    dryRun = args.dryRun !== undefined ? Boolean(args.dryRun) : (args.dry_run !== undefined ? Boolean(args.dry_run) : true);
    limit = args.limit || 50;
    referenceDate = args.referenceDate || args.reference_date || null;
    logger = args.logger || console;
  } else if (args && args.query) {
    // Assinatura legada positional: (pool, options, deps)
    pool = args;
    const opts = legacyOptions || {};
    const deps = legacyDeps || {};
    sendWhatsAppMessage = deps.sendWhatsAppMessage || deps.sendWhatsApp;
    dryRun = opts.dryRun !== undefined ? Boolean(opts.dryRun) : (opts.dry_run !== undefined ? Boolean(opts.dry_run) : true);
    limit = opts.limit || 50;
    referenceDate = opts.referenceDate || opts.reference_date || null;
    logger = deps.logger || console;
  }

  const safeLimit = Math.min(Math.max(1, parseInt(limit, 10) || 50), 200);

  // 1. Tratar locks antigos em 'processing' (> 10 min) movendo para 'ambiguous' (at-most-once)
  try {
    const [staleResult] = await pool.query(
      `UPDATE customer_debt_reminders
          SET status = 'ambiguous',
              last_error = 'stale_processing_lock_timeout_needs_reconciliation',
              updated_at = CURRENT_TIMESTAMP
        WHERE status = 'processing'
          AND updated_at < (NOW() - INTERVAL 10 MINUTE)`
    );
    if (staleResult?.affectedRows > 0) {
      logger.warn?.(`[reminder-dispatcher] ${staleResult.affectedRows} lembretes em processing expirado movidos para ambiguous`);
    }
  } catch (err) {
    logger.error?.('[reminder-dispatcher] Erro ao tratar processing expirado:', err);
  }

  // 2. Definir data de referência (somente permitida em dry_run ou teste)
  let effectiveDateSql = 'CURRENT_DATE()';
  const queryParams = [];

  if (dryRun && referenceDate && /^\d{4}-\d{2}-\d{2}$/.test(referenceDate)) {
    effectiveDateSql = '?';
    queryParams.push(referenceDate);
  }

  // 3. Buscar lembretes elegíveis (pending ou failed com tentativas < 3)
  // Utiliza scheduled_date como nome unificado canônico
  const [eligibleRows] = await pool.query(
    `SELECT r.*, d.customer_id, d.sale_id, d.valor_total, d.saldo_devedor, d.descricao, d.data_vencimento, d.status AS debt_status, d.installment_number, d.installment_count
       FROM customer_debt_reminders r
       JOIN customer_debts d ON d.id = r.debt_id
      WHERE r.status IN ('pending', 'failed')
        AND r.attempts < 3
        AND r.scheduled_date <= ${effectiveDateSql}
      ORDER BY r.scheduled_date ASC, r.created_at ASC
      LIMIT ?`,
    [...queryParams, safeLimit]
  );

  const stats = {
    processed: eligibleRows.length,
    sent: 0,
    skipped: 0,
    failed: 0,
    ambiguous: 0,
    dry_run: Boolean(dryRun),
  };

  for (const reminder of eligibleRows) {
    // Se for dry_run, apenas simula sem alterar status nem chamar Evolution
    if (dryRun) {
      if (Number(reminder.saldo_devedor) <= 0 || reminder.debt_status === 'paid' || reminder.debt_status === 'cancelled') {
        stats.skipped++;
      } else {
        stats.sent++;
      }
      continue;
    }

    // 4. Reserva atômica da linha
    const [lockResult] = await pool.query(
      `UPDATE customer_debt_reminders
          SET status = 'processing',
              attempts = attempts + 1,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND status IN ('pending', 'failed')`,
      [reminder.id]
    );

    if (lockResult.affectedRows === 0) {
      // Outro worker reservou concorrentemente
      continue;
    }

    // 5. Re-leitura atômica de saldo e status da parcela com FOR UPDATE
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [[currentDebt]] = await connection.query(
        'SELECT * FROM customer_debts WHERE id = ? FOR UPDATE',
        [reminder.debt_id]
      );

      if (!currentDebt || Number(currentDebt.saldo_devedor) <= 0 || currentDebt.status === 'paid' || currentDebt.status === 'cancelled') {
        await connection.query(
          `UPDATE customer_debt_reminders
              SET status = 'skipped',
                  last_error = 'debt_already_paid_or_cancelled',
                  updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
          [reminder.id]
        );
        await connection.commit();
        stats.skipped++;
        continue;
      }

      // Buscar cliente
      const [[customer]] = await connection.query(
        'SELECT id, name, phone, phone_country, cpf_cnpj FROM customers WHERE id = ? LIMIT 1',
        [currentDebt.customer_id]
      );

      // Buscar todas as parcelas da mesma venda para o histórico
      let allSaleDebts = [currentDebt];
      if (currentDebt.sale_id) {
        const [saleDebts] = await connection.query(
          'SELECT * FROM customer_debts WHERE sale_id = ? ORDER BY installment_number ASC',
          [currentDebt.sale_id]
        );
        if (saleDebts.length > 0) allSaleDebts = saleDebts;
      }
      await connection.commit();

      // Validação prévia de destinatário (falha pré-envio comprovada)
      if (!customer || !customer.phone) {
        await pool.query(
          `UPDATE customer_debt_reminders
              SET status = 'failed',
                  last_error = 'customer_phone_missing',
                  updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
          [reminder.id]
        );
        stats.failed++;
        continue;
      }

      const variables = buildDebtReminderTemplateVariables({
        customer,
        debt: currentDebt,
        allSaleDebts,
      });

      // 6. Envio via disparador WhatsApp
      let sendResult;
      let isUncertainError = false;

      try {
        if (typeof sendWhatsAppMessage !== 'function') {
          throw new Error('sendWhatsAppMessage function not provided');
        }
        sendResult = await sendWhatsAppMessage({
          templateKey: WHATSAPP_AUTOMATION_TEMPLATE_KEY_CUSTOMER_DEBT_DUE_REMINDER,
          phone: customer.phone,
          variables,
          entityType: 'customer_debt_reminder',
          entityId: reminder.id,
        });
      } catch (sendErr) {
        const errMsg = String(sendErr?.message || sendErr || '');
        // Erros de timeout ou incerteza de rede durante/apos transmissao: classificar como ambiguous
        const isTimeout = /timeout|etimedout|econnreset|socket|eai_again|gateway/i.test(errMsg) || sendErr?.code === 'ETIMEDOUT';
        if (isTimeout) {
          isUncertainError = true;
          await pool.query(
            `UPDATE customer_debt_reminders
                SET status = 'ambiguous',
                    last_error = ?,
                    updated_at = CURRENT_TIMESTAMP
              WHERE id = ?`,
            [`network_timeout_or_uncertain: ${errMsg}`.slice(0, 500), reminder.id]
          );
          stats.ambiguous++;
          continue;
        } else {
          // Falha estritamente prévia
          await pool.query(
            `UPDATE customer_debt_reminders
                SET status = 'failed',
                last_error = ?,
                updated_at = CURRENT_TIMESTAMP
              WHERE id = ?`,
            [errMsg.slice(0, 500), reminder.id]
          );
          stats.failed++;
          continue;
        }
      }

      if (sendResult?.status === 'sent') {
        const providerMessageId = extractEvolutionProviderMessageId(sendResult.result);
        await pool.query(
          `UPDATE customer_debt_reminders
              SET status = 'sent',
                  provider_message_id = ?,
                  sent_at = CURRENT_TIMESTAMP,
                  last_error = NULL,
                  updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
          [providerMessageId, reminder.id]
        );
        stats.sent++;
      } else if (sendResult?.status === 'skipped') {
        await pool.query(
          `UPDATE customer_debt_reminders
              SET status = 'skipped',
                  last_error = ?,
                  updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
          [String(sendResult?.reason || 'skipped_by_template_policy').slice(0, 500), reminder.id]
        );
        stats.skipped++;
      } else if (sendResult?.status === 'ambiguous' || sendResult?.status === 'timeout') {
        await pool.query(
          `UPDATE customer_debt_reminders
              SET status = 'ambiguous',
                  last_error = ?,
                  updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
          [String(sendResult?.error || sendResult?.reason || 'provider_uncertain_timeout').slice(0, 500), reminder.id]
        );
        stats.ambiguous++;
      } else {
        // Falha reportada prévia
        await pool.query(
          `UPDATE customer_debt_reminders
              SET status = 'failed',
                  last_error = ?,
                  updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
          [String(sendResult?.error || 'send_failed').slice(0, 500), reminder.id]
        );
        stats.failed++;
      }
    } catch (err) {
      try { await connection.rollback(); } catch {}
      logger.error?.(`[reminder-dispatcher] Erro ao processar lembrete ${reminder.id}:`, err);
      await pool.query(
        `UPDATE customer_debt_reminders
            SET status = 'ambiguous',
                last_error = ?,
                updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
        [`processing_exception: ${String(err?.message || 'unknown_error')}`.slice(0, 500), reminder.id]
      );
      stats.ambiguous++;
    } finally {
      connection.release();
    }
  }

  return { ok: true, stats };
}

function evaluateDebtsIdempotency(existingDebts, payload = {}) {
  const { customer_id, valor_total, installments, data_vencimento } = payload;
  const { toSafeIntegerCents } = require('../utils/installmentCalculations.cjs');
  const valor = toSafeIntegerCents(valor_total);

  let installmentList = [];
  if (Array.isArray(installments) && installments.length > 0) {
    installmentList = installments.map((inst, idx) => ({
      installment_number: toSafeIntegerCents(inst.installment_number) || (idx + 1),
      installment_count: toSafeIntegerCents(inst.installment_count) || installments.length,
      amount: toSafeIntegerCents(inst.amount !== undefined ? inst.amount : inst.valor_total),
      due_date: String(inst.due_date || inst.data_vencimento || '').trim(),
    }));
  } else {
    installmentList = [{
      installment_number: 1,
      installment_count: 1,
      amount: valor,
      due_date: String(data_vencimento || '').trim(),
    }];
  }

  if (!existingDebts || existingDebts.length === 0) {
    return { isMatch: false, reason: 'no_existing_debts' };
  }

  const sameCustomer = String(existingDebts[0].customer_id) === String(customer_id);
  const existingSum = existingDebts.reduce((sum, d) => sum + Number(d.valor_total || 0), 0);
  const sameTotal = existingSum === valor;
  const sameCount = existingDebts.length === installmentList.length;

  let allMatch = sameCustomer && sameTotal && sameCount;
  if (allMatch) {
    for (let i = 0; i < existingDebts.length; i++) {
      const ex = existingDebts[i];
      const req = installmentList[i];
      const exDate = String(ex.data_vencimento || '').split('T')[0];
      const reqDate = String(req.due_date || '').split('T')[0];
      if (
        Number(ex.installment_number) !== Number(req.installment_number) ||
        Number(ex.installment_count) !== Number(req.installment_count) ||
        Number(ex.valor_total) !== Number(req.amount) ||
        exDate !== reqDate
      ) {
        allMatch = false;
        break;
      }
    }
  }

  return {
    isMatch: allMatch,
    details: {
      existingCount: existingDebts.length,
      requestedCount: installmentList.length,
      existingTotal: existingSum,
      requestedTotal: valor,
      existingCustomer: existingDebts[0]?.customer_id,
      requestedCustomer: customer_id,
    },
  };
}

/**
 * Cria ou recupera parcelas de venda a prazo sob conexao/transacao com idempotencia estrita.
 */
async function createOrGetDebtsFromSale(connection, payload = {}) {
  const { customer_id, sale_id, valor_total, descricao, data_vencimento, installments } = payload;

  if (!customer_id) return { status: 400, error: 'customer_id obrigatorio' };
  if (!sale_id) return { status: 400, error: 'sale_id obrigatorio' };

  const { toSafeIntegerCents, validatePaymentInstallmentSchedule, parseCivilDate } = require('../utils/installmentCalculations.cjs');

  const valor = toSafeIntegerCents(valor_total);
  if (valor === null || valor <= 0) {
    return { status: 400, error: 'valor_total invalido' };
  }
  if (!descricao || typeof descricao !== 'string' || !descricao.trim()) {
    return { status: 400, error: 'descricao obrigatoria' };
  }

  let installmentList = [];
  if (Array.isArray(installments) && installments.length > 0) {
    installmentList = installments.map((inst, idx) => ({
      installment_number: toSafeIntegerCents(inst.installment_number) || (idx + 1),
      installment_count: toSafeIntegerCents(inst.installment_count) || installments.length,
      amount: toSafeIntegerCents(inst.amount !== undefined ? inst.amount : inst.valor_total),
      due_date: String(inst.due_date || inst.data_vencimento || '').trim(),
    }));

    const validation = validatePaymentInstallmentSchedule(valor, installmentList);
    if (!validation.valid) {
      return { status: 400, error: validation.error || validation.reason || 'Plano de parcelamento invalido' };
    }
  } else {
    if (!data_vencimento || !/^\d{4}-\d{2}-\d{2}$/.test(data_vencimento) || !parseCivilDate(data_vencimento)) {
      return { status: 400, error: 'data_vencimento invalida (YYYY-MM-DD)' };
    }
    installmentList = [{
      installment_number: 1,
      installment_count: 1,
      amount: valor,
      due_date: data_vencimento,
    }];
  }

  // 1. Verificar registros existentes
  const [existing] = await connection.query(
    'SELECT * FROM customer_debts WHERE sale_id = ? ORDER BY installment_number ASC',
    [sale_id]
  );

  if (existing && existing.length > 0) {
    const check = evaluateDebtsIdempotency(existing, payload);
    if (check.isMatch) {
      return {
        status: 200,
        isRetry: true,
        debts: existing,
        debt: existing.length === 1 ? existing[0] : undefined,
      };
    } else {
      return {
        status: 409,
        error: 'Divergência detectada com parcelamento anterior desta venda',
        details: check.details,
      };
    }
  }

  // 2. Criar novos débitos e lembretes
  const createdDebts = [];
  const cryptoMod = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto : require('crypto');

  for (const inst of installmentList) {
    const debtId = cryptoMod.randomUUID();
    const instDesc = installmentList.length > 1
      ? `${descricao.trim()} (Parcela ${inst.installment_number}/${inst.installment_count})`
      : descricao.trim();

    await connection.query(
      `INSERT INTO customer_debts (id, customer_id, sale_id, installment_number, installment_count, valor_total, saldo_devedor, descricao, data_vencimento, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [debtId, customer_id, sale_id, inst.installment_number, inst.installment_count, inst.amount, inst.amount, instDesc, inst.due_date]
    );

    const reminderId = cryptoMod.randomUUID();
    await connection.query(
      `INSERT INTO customer_debt_reminders (id, debt_id, status, scheduled_date, attempts)
       VALUES (?, ?, 'pending', ?, 0)`,
      [reminderId, debtId, inst.due_date]
    );

    createdDebts.push({
      id: debtId,
      customer_id,
      sale_id,
      installment_number: inst.installment_number,
      installment_count: inst.installment_count,
      valor_total: inst.amount,
      saldo_devedor: inst.amount,
      descricao: instDesc,
      data_vencimento: inst.due_date,
      status: 'pending',
    });
  }

  return {
    status: 201,
    debts: createdDebts,
    debt: createdDebts.length === 1 ? createdDebts[0] : undefined,
  };
}

/**
 * Registra evento de automação WhatsApp no log com suporte canônico ao ENUM ('sent','skipped','failed','ambiguous').
 */
async function logWhatsAppAutomationEventCore(pool, input) {
  const allowedStatuses = ['sent', 'skipped', 'failed', 'ambiguous'];
  const rawStatus = String(input.status || 'failed').toLowerCase().trim();
  const status = allowedStatuses.includes(rawStatus) ? rawStatus : 'failed';

  const cryptoMod = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto : require('crypto');
  const id = cryptoMod.randomUUID();

  try {
    await pool.query(
      `INSERT INTO whatsapp_automation_logs
        (id, template_key, entity_type, entity_id, customer_id, phone, status, message, rendered_text, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        String(input.templateKey || '').slice(0, 120),
        input.entityType || null,
        input.entityId || null,
        input.customerId || null,
        input.phone || null,
        status,
        String(input.message || '').slice(0, 1000),
        input.renderedText || null,
        input.errorMessage ? String(input.errorMessage).slice(0, 1000) : null,
      ]
    );
    return { ok: true, id, status };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Garante que a coluna status da tabela whatsapp_automation_logs inclua 'ambiguous'.
 * Consulta o INFORMATION_SCHEMA antes e executa ALTER TABLE somente se necessario.
 */
async function ensureWhatsAppAutomationLogsStatusEnum(pool) {
  const [rows] = await pool.query(`
    SELECT COLUMN_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'whatsapp_automation_logs'
       AND COLUMN_NAME = 'status'
  `);

  if (!rows || rows.length === 0) {
    return { status: 'table_not_found', altered: false };
  }

  const colType = String(rows[0].COLUMN_TYPE || rows[0].column_type || '').toLowerCase();
  if (colType.includes("'ambiguous'") || colType.includes('"ambiguous"')) {
    return { status: 'already_up_to_date', altered: false };
  }

  try {
    await pool.query(`
      ALTER TABLE whatsapp_automation_logs
      MODIFY COLUMN status ENUM('sent','skipped','failed','ambiguous') NOT NULL DEFAULT 'failed'
    `);
    return { status: 'migrated', altered: true };
  } catch (err) {
    const errorMsg = `[whatsapp-automation-logs-migration] Falha ao atualizar ENUM da coluna status: ${err?.message || String(err)}`;
    console.error(errorMsg);
    const customErr = new Error(errorMsg);
    customErr.code = 'MIGRATION_ENUM_FAILED';
    throw customErr;
  }
}

module.exports = {
  WHATSAPP_AUTOMATION_TEMPLATE_KEY_CUSTOMER_DEBT_DUE_REMINDER,
  WHATSAPP_AUTOMATION_TEMPLATE_CUSTOMER_DEBT_DUE_REMINDER_DEFAULT,
  DEFAULT_CUSTOMER_DEBT_REMINDER_TEMPLATE,
  formatMoneyCentsToBrl,
  formatDateBr,
  extractEvolutionProviderMessageId,
  buildDebtReminderTemplateVariables,
  buildCustomerDebtReminderVariables,
  cancelPendingRemindersForDebt,
  processCustomerDebtReminders,
  evaluateDebtsIdempotency,
  createOrGetDebtsFromSale,
  logWhatsAppAutomationEventCore,
  ensureWhatsAppAutomationLogsStatusEnum,
};
