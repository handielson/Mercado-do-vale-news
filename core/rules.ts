
import { ClientTypes, PaymentMethods } from '../utils/field-standards';

/**
 * CORE RULES (Business Layer)
 * This folder contains pure functions for complex business logic.
 */

/**
 * Atacado Lock: Wholesale customers can ONLY pay with Pix or Cash.
 */
export const isPaymentMethodAllowed = (clientType: ClientTypes, method: PaymentMethods): boolean => {
  if (clientType === ClientTypes.ATACADO) {
    return [PaymentMethods.PIX, PaymentMethods.CASH].includes(method);
  }
  return true;
};

/**
 * IMEI Standardization: Force UpperCase and Trim
 */
export const formatIMEI = (imei: string): string => {
  return imei.trim().toUpperCase();
};

/**
 * Password Validation: System requires exactly 5 digits for the ERP flow.
 */
export const isValidSystemPassword = (password: string): boolean => {
  return /^\d{5}$/.test(password);
};
