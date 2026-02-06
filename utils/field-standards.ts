
/**
 * FIELD STANDARDS
 * Central source of truth for all enums and static constants.
 * Part of the "Antigravity Protocol" for absolute data consistency.
 */

export enum ClientTypes {
  VAREJO = 'varejo',
  REVENDA = 'revenda',
  ATACADO = 'atacado',
  ADMIN = 'admin',
}

export enum ProductStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  OUT_OF_STOCK = 'out_of_stock',
  DISCONTINUED = 'discontinued',
}

export enum PaymentMethods {
  PIX = 'pix',
  CASH = 'dinheiro',
  CREDIT_CARD = 'cartao_credito',
  DEBIT_CARD = 'cartao_debito',
  BANK_SLIP = 'boleto',
}

export enum ShippingTypes {
  STANDARD = 'standard',
  EXPRESS = 'express',
  PICKUP = 'retirada',
  LOCAL_COURIER = 'moto_boy',
}

export enum UnitStatus {
  AVAILABLE = 'available',
  RESERVED = 'reserved',
  SOLD = 'sold',
  RMA = 'rma',
}

export enum ProductCondition {
  NEW = 'new',
  USED = 'used',
  OPEN_BOX = 'open_box',
}

export enum ProductCategory {
  PHONES = 'phones',
  TABLETS = 'tablets',
  ACCESSORIES = 'accessories',
}

// Financial Standards
export const CURRENCY_PRECISION = 2; // Representing as integer: R$ 10,00 -> 1000
export const IMEI_MAX_LENGTH = 15;
