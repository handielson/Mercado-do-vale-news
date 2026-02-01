
import { ClientTypes, ProductStatus } from '../utils/field-standards';

export interface User {
  id: string;
  cpf: string;
  name: string;
  type: ClientTypes;
  email: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  eans: string[]; // Multi-EAN support
  imeis?: string[]; // Serial tracking
  status: ProductStatus;
  prices: {
    retail: number;   // Varejo
    reseller: number; // Revenda
    wholesale: number; // Atacado
  };
}

export interface Order {
  id: string;
  clientId: string;
  items: Array<{
    productId: string;
    quantity: number;
    priceApplied: number;
  }>;
  total: number;
  paymentMethod: string;
  shippingType: string;
}
