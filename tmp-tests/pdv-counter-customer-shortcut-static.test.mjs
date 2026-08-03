import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const customerSection = readFileSync('components/pdv/CustomerSection.tsx', 'utf8');
const pdvPage = readFileSync('pages/pdv/PDVPage.tsx', 'utf8');
const customerService = readFileSync('services/customers.ts', 'utf8');
const customerTypes = readFileSync('types/customer.ts', 'utf8');

assert.match(
  customerSection,
  /import \{[\s\S]*Zap[\s\S]*\} from 'lucide-react';/,
  'PDV customer section must expose the walk-in quick-sale button with the Zap icon.',
);

assert.match(
  customerSection,
  /onSelectWalkInCustomer\?: \(\) => void \| Promise<void>;/,
  'PDV customer section must receive a walk-in selection callback.',
);

assert.match(
  customerSection,
  /title="Venda rápida para Cliente Balcão"/,
  'PDV must render the Cliente Balcão quick-sale action.',
);

assert.match(
  customerSection,
  /selectedCustomer\.is_walk_in_customer[\s\S]*Venda rápida sem cadastro/,
  'Selected Cliente Balcão must be visibly marked as a quick sale without registration.',
);

assert.match(
  pdvPage,
  /const customer = await customerService\.getWalkInCustomer\(\);/,
  'PDV page must select the existing Cliente Balcão from the customer service.',
);

assert.match(
  pdvPage,
  /onSelectWalkInCustomer=\{handleSelectWalkInCustomer\}/,
  'PDV page must wire the quick-sale button to the walk-in customer selector.',
);

assert.match(
  customerService,
  /normalizeCustomerName\(customer\.name\) === 'cliente balcao'/,
  'Customer service must find the registered Cliente Balcão by normalized name.',
);

assert.match(
  customerService,
  /async getWalkInCustomer\(\): Promise<Customer> \{[\s\S]*throw new Error\('Cliente Balcão não encontrado/,
  'Customer service must fail clearly when the existing Cliente Balcão is missing.',
);

assert.doesNotMatch(
  customerService,
  /getOrCreateWalkInCustomer|name:\s*['"]Cliente Balc[aã]o['"][\s\S]*this\.create\(/,
  'Customer service must not create a duplicate Cliente Balcão record.',
);

assert.match(
  customerTypes,
  /is_walk_in_customer\?: boolean;/,
  'Shared customer types must include the walk-in marker.',
);

console.log('ok - PDV selects the existing Cliente Balcão without creating duplicates');
