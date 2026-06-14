import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const files = ['vps_server.js', 'vps_server.cjs'];

for (const file of files) {
  const source = readFileSync(file, 'utf8');

  assert.match(
    source,
    /function normalizeDeliveryAddress/,
    `${file} deve normalizar o endereco completo do cliente para a entrega`
  );

  assert.match(
    source,
    /address\.zipCode \|\| address\.zip_code \|\| address\.cep \|\| address\.postal_code/,
    `${file} deve aceitar zipCode do cadastro do cliente como CEP da entrega`
  );

  assert.match(
    source,
    /address_street[\s\S]*address_number[\s\S]*address_neighborhood[\s\S]*address_city[\s\S]*address_state[\s\S]*address_zip_code/,
    `${file} deve buscar tambem colunas address_* do cliente`
  );

  assert.match(
    source,
    /const jobData = await buildCustomerDeliveryJobData\(connection, sale\)/,
    `${file} deve montar os dados completos da entrega antes de inserir ou atualizar o job`
  );

  assert.match(
    source,
    /UPDATE customer_delivery_jobs[\s\S]*buyer_name = \?[\s\S]*buyer_phone = \?[\s\S]*delivery_address_text = \?[\s\S]*delivery_route_url = \?[\s\S]*receipt_snapshot_json = \?/,
    `${file} deve reparar jobs existentes com os dados completos do cliente`
  );

  assert.doesNotMatch(
    source,
    /hasNumber \? buildDeliveryRouteUrl\(addressText, cepLookup\) : null/,
    `${file} nao deve bloquear rota quando o cadastro tem endereco sem numero`
  );
}

console.log('delivery job complete customer address static checks passed');
