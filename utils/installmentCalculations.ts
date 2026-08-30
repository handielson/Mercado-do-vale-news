import installmentCalculationsCjs from './installmentCalculations.cjs';
import type { PaymentInstallmentScheduleItem } from '../types/sale';

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export interface InstallmentModuleType {
  isLeapYear: (year: number) => boolean;
  getDaysInMonth: (year: number, month: number) => number;
  parseCivilDate: (dateStr: string) => { year: number; month: number; day: number } | null;
  formatCivilDate: (year: number, month: number, day: number) => string;
  calculateCivilMonthlyDueDate: (firstDueDateStr: string, installmentNumber: number) => string;
  toSafeIntegerCents: (val: unknown) => number | null;
  generatePaymentInstallmentSchedule: (
    totalCents: number,
    count: number,
    firstDueDate: string
  ) => PaymentInstallmentScheduleItem[];
  validatePaymentInstallmentSchedule: (
    totalCents: number,
    schedule: PaymentInstallmentScheduleItem[]
  ) => ValidationResult;
  recalculateAPrazoPayment: (
    payments: any[],
    saleTotal: number,
    defaultDueDate?: string
  ) => any[];
}

const mod = installmentCalculationsCjs as unknown as InstallmentModuleType;

export const isLeapYear = mod.isLeapYear;
export const getDaysInMonth = mod.getDaysInMonth;
export const parseCivilDate = mod.parseCivilDate;
export const formatCivilDate = mod.formatCivilDate;
export const calculateCivilMonthlyDueDate = mod.calculateCivilMonthlyDueDate;
export const toSafeIntegerCents = mod.toSafeIntegerCents;
export const generatePaymentInstallmentSchedule = mod.generatePaymentInstallmentSchedule;
export const validatePaymentInstallmentSchedule = mod.validatePaymentInstallmentSchedule;
export const recalculateAPrazoPayment = mod.recalculateAPrazoPayment;

export default mod;
