'use strict';

/**
 * Utilitário canônico de cálculo e validação de parcelamento civil (A Prazo / Crediário).
 * Módulo puro CommonJS compartilhado entre backend (Node.js) e frontend (Vite/TypeScript).
 */

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function getDaysInMonth(year, month) {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }
  if (month === 4 || month === 6 || month === 9 || month === 11) {
    return 30;
  }
  return 31;
}

function parseCivilDate(dateStr) {
  if (typeof dateStr !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (month < 1 || month > 12) return null;
  const maxDay = getDaysInMonth(year, month);
  if (day < 1 || day > maxDay) return null;

  return { year, month, day };
}

function formatCivilDate(year, month, day) {
  const y = String(year).padStart(4, '0');
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Calcula a data de vencimento civil para a parcela N, avançando (N - 1) meses a partir de firstDueDate.
 * Preserva o dia âncora original aplicando clamp no último dia válido do mês de destino.
 */
function calculateCivilMonthlyDueDate(firstDueDateStr, installmentNumber) {
  const parsed = parseCivilDate(firstDueDateStr);
  if (!parsed) {
    throw new Error(`Data inicial de vencimento invalida: ${firstDueDateStr}`);
  }
  const n = parseInt(installmentNumber, 10);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`Numero de parcela invalido: ${installmentNumber}`);
  }

  // Parcela 1 é exatamente a data de primeiro vencimento informada
  if (n === 1) {
    return formatCivilDate(parsed.year, parsed.month, parsed.day);
  }

  const anchorDay = parsed.day;
  const monthOffset = n - 1;
  const totalMonths = (parsed.month - 1) + monthOffset;
  const targetYear = parsed.year + Math.floor(totalMonths / 12);
  const targetMonth = (totalMonths % 12) + 1;
  const maxDays = getDaysInMonth(targetYear, targetMonth);
  const targetDay = Math.min(anchorDay, maxDays);

  return formatCivilDate(targetYear, targetMonth, targetDay);
}

function toSafeIntegerCents(val) {
  if (val === null || val === undefined || typeof val === 'boolean') return null;
  if (typeof val === 'number') {
    if (!Number.isFinite(val) || !Number.isInteger(val)) return null;
    return val;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!/^-?\d+$/.test(trimmed)) return null;
    const parsed = Number(trimmed);
    if (!Number.isSafeInteger(parsed)) return null;
    return parsed;
  }
  return null;
}

/**
 * Gera o cronograma completo de parcelas a prazo com divisão exata em centavos e vencimentos civis.
 * Distribuição do resto: as primeiras "resto" parcelas recebem base + 1 centavo; as demais recebem base.
 */
function generatePaymentInstallmentSchedule(totalCents, count, firstDueDate) {
  const total = toSafeIntegerCents(totalCents);
  const n = toSafeIntegerCents(count);

  if (total === null || total <= 0) {
    throw new Error(`Valor total invalido para parcelamento: ${totalCents}`);
  }
  if (n === null || n < 1 || n > 12) {
    throw new Error(`Quantidade de parcelas deve ser entre 1 e 12 (recebido: ${count})`);
  }
  if (n > total) {
    throw new Error(`Quantidade de parcelas (${n}) excede o total de centavos disponiveis (${total})`);
  }

  const parsedDate = parseCivilDate(firstDueDate);
  if (!parsedDate) {
    throw new Error(`Data de primeiro vencimento invalida: ${firstDueDate}`);
  }

  const base = Math.floor(total / n);
  const resto = total % n;
  const schedule = [];

  for (let i = 1; i <= n; i++) {
    const amount = i <= resto ? base + 1 : base;
    const dueDate = calculateCivilMonthlyDueDate(firstDueDate, i);
    schedule.push({
      installment_number: i,
      installment_count: n,
      amount,
      due_date: dueDate,
    });
  }

  return schedule;
}

/**
 * Valida se um cronograma de parcelas obedece a todas as regras de integridade.
 */
function validatePaymentInstallmentSchedule(totalCents, schedule) {
  const total = toSafeIntegerCents(totalCents);
  if (total === null || total <= 0) {
    return { valid: false, reason: `Valor total invalido: ${totalCents}`, error: `Valor total invalido: ${totalCents}` };
  }

  if (!Array.isArray(schedule) || schedule.length === 0 || schedule.length > 12) {
    return { valid: false, reason: 'Cronograma deve ter entre 1 e 12 parcelas', error: 'Cronograma deve ter entre 1 e 12 parcelas' };
  }

  const n = schedule.length;
  let sum = 0;
  let lastDate = '';

  for (let i = 0; i < n; i++) {
    const item = schedule[i];
    const expectedNumber = i + 1;

    if (!item || typeof item !== 'object') {
      return { valid: false, reason: `Item da parcela ${expectedNumber} invalido`, error: `Item da parcela ${expectedNumber} invalido` };
    }
    const itemNum = toSafeIntegerCents(item.installment_number);
    if (itemNum !== expectedNumber) {
      return { valid: false, reason: `Sequencia incorreta na parcela ${expectedNumber}`, error: `Sequencia incorreta na parcela ${expectedNumber}` };
    }
    const itemCount = toSafeIntegerCents(item.installment_count);
    if (itemCount !== n) {
      return { valid: false, reason: `installment_count divergente na parcela ${expectedNumber}`, error: `installment_count divergente na parcela ${expectedNumber}` };
    }

    const rawAmount = item.amount !== undefined ? item.amount : item.valor_total;
    const amount = toSafeIntegerCents(rawAmount);
    if (amount === null || amount <= 0) {
      return { valid: false, reason: `Valor invalido na parcela ${expectedNumber}`, error: `Valor invalido na parcela ${expectedNumber}` };
    }
    sum += amount;

    const dueDateStr = String(item.due_date || item.data_vencimento || '').trim();
    const parsed = parseCivilDate(dueDateStr);
    if (!parsed) {
      return { valid: false, reason: `Data de vencimento invalida na parcela ${expectedNumber}`, error: `Data de vencimento invalida na parcela ${expectedNumber}` };
    }
    if (lastDate && dueDateStr <= lastDate) {
      return { valid: false, reason: `Data da parcela ${expectedNumber} deve ser posterior a anterior`, error: `Data da parcela ${expectedNumber} deve ser posterior a anterior` };
    }
    lastDate = dueDateStr;
  }

  if (sum !== total) {
    return { valid: false, reason: `Soma das parcelas (${sum}) diferente do total (${total})`, error: `Soma das parcelas (${sum}) diferente do total (${total})` };
  }

  return { valid: true };
}

/**
 * Recalcula o pagamento a prazo dentro de uma lista de pagamentos, distribuindo o saldo restante
 * da venda e preservando a primeira data de vencimento e a quantidade de parcelas.
 */
function recalculateAPrazoPayment(payments, saleTotal, defaultDueDate) {
  if (!Array.isArray(payments) || payments.length === 0) return payments || [];

  const aPrazoIndex = payments.findIndex(p => p && p.method === 'a_prazo');
  if (aPrazoIndex < 0) return payments;

  const total = toSafeIntegerCents(saleTotal);
  if (total === null || total < 0) return payments;

  const paidWithoutAPrazo = payments.reduce((sum, p, idx) => {
    if (idx === aPrazoIndex) return sum;
    const rawAmount = p?.total_with_fee !== undefined ? p.total_with_fee : p?.amount;
    const amount = toSafeIntegerCents(rawAmount);
    return sum + (amount || 0);
  }, 0);

  const nextAPrazoAmount = Math.max(0, total - paidWithoutAPrazo);

  return payments.map((p, idx) => {
    if (idx !== aPrazoIndex) return p;

    const count = p.installment_schedule?.length || p.installments || 1;
    const feePercentage = Math.max(0, Number(p.fee_percentage || 0));
    const feeAmount = Math.round(nextAPrazoAmount * (feePercentage / 100));
    const totalWithFee = nextAPrazoAmount + feeAmount;
    const dueDate = p.installment_schedule?.[0]?.due_date || p.due_date || defaultDueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    let nextSchedule;

    if (totalWithFee > 0) {
      try {
        nextSchedule = generatePaymentInstallmentSchedule(totalWithFee, count, dueDate);
      } catch {
        nextSchedule = undefined;
      }
    }

    return {
      ...p,
      amount: nextAPrazoAmount,
      fee_percentage: feePercentage,
      fee_amount: feeAmount,
      total_with_fee: totalWithFee,
      due_date: dueDate,
      installment_schedule: nextSchedule,
    };
  });
}

module.exports = {
  isLeapYear,
  getDaysInMonth,
  parseCivilDate,
  formatCivilDate,
  calculateCivilMonthlyDueDate,
  toSafeIntegerCents,
  generatePaymentInstallmentSchedule,
  validatePaymentInstallmentSchedule,
  recalculateAPrazoPayment,
};
