import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const guardPath = 'tools/audit-supabase-operational-dependencies.mjs';

assert.ok(
  existsSync(guardPath),
  'Supabase migration must have a static guard script for operational dependencies',
);

const source = readFileSync(guardPath, 'utf8');

assert.match(
  source,
  /MAX_BASELINE_FROM_CALLS\s*=\s*0/,
  'guard should pin the current .from(...) baseline so new operational dependencies fail review',
);

assert.match(
  source,
  /MAX_BASELINE_RPC_CALLS\s*=\s*0/,
  'guard should pin the reduced rpc(...) baseline so removed Supabase RPC dependencies do not return',
);

assert.match(
  source,
  /MAX_BASELINE_STORAGE_CALLS\s*=\s*0/,
  'guard should pin the zero Supabase Storage baseline so removed storage dependencies do not return',
);

assert.match(
  source,
  /MAX_UNCLASSIFIED_OPERATIONAL_MATCHES\s*=\s*0/,
  'guard should fail when a new operational dependency is not classified by the temporary allowlist',
);

assert.match(
  source,
  /supabase\.storage|storage\\\.from/,
  'guard should scan Supabase Storage usage as part of the migration',
);

assert.match(
  source,
  /ALLOWED_OPERATIONAL_DEPENDENCIES\s*=\s*\[/,
  'guard should keep an explicit temporary allowlist for operational Supabase dependencies',
);

assert.doesNotMatch(
  source,
  /admin-config-temporary|company_settings|catalog_settings|catalog_banners/,
  'admin config allowlist must not remain after operational Supabase dependencies reach zero',
);

assert.doesNotMatch(
  source,
  /increment_banner_(?:clicks|views)/,
  'removed banner telemetry RPCs must not remain allowlisted',
);

assert.match(
  source,
  /authMatches/,
  'guard should report Supabase Auth separately from operational table dependencies',
);

assert.match(
  source,
  /allowedOperationalMatches/,
  'guard should separate allowlisted operational dependencies from unclassified dependencies',
);

assert.doesNotMatch(
  source,
  /telegram_settings/,
  'telegram_settings must not remain allowlisted after moving to VPS table-data',
);

assert.doesNotMatch(
  source,
  /payment_integrations/,
  'payment_integrations must not remain allowlisted after moving to VPS table-data',
);

assert.doesNotMatch(
  source,
  /products-catalog-migration-temporary/,
  'products catalog allowlist must be removed after operational .from(...) reaches zero',
);

assert.doesNotMatch(
  source,
  /shopee_templates|shopee-templates-temporary/,
  'shopee_templates must not remain allowlisted after moving to VPS table-data',
);

assert.doesNotMatch(
  source,
  /system_tags/,
  'system_tags must not remain allowlisted after moving to VPS table-data',
);

assert.doesNotMatch(
  source,
  /customer_type_requests/,
  'customer_type_requests must not remain allowlisted after moving to VPS table-data',
);

assert.doesNotMatch(
  source,
  /coin_promotions|increment_coin_promo_uses/,
  'coin_promotions and its old increment RPC must not remain allowlisted after moving to VPS table-data',
);

assert.doesNotMatch(
  source,
  /model_eans/,
  'model_eans must not remain allowlisted after retiring the orphaned model-eans Supabase service',
);

assert.doesNotMatch(
  source,
  /catalog_sections/,
  'catalog_sections must not remain allowlisted after moving section CRUD to VPS table-data',
);

assert.doesNotMatch(
  source,
  /product_reviews/,
  'product_reviews must not remain allowlisted after moving reviews to VPS table-data',
);

assert.doesNotMatch(
  source,
  /model_variants|model_variant_images/,
  'model variant tables must not remain allowlisted after retiring the unused variants manager',
);

assert.doesNotMatch(
  source,
  /colors|battery_healths|catalog-taxonomy-temporary/,
  'color and battery taxonomy tables must not remain allowlisted after moving to VPS services',
);

assert.doesNotMatch(
  source,
  /category_display_config/,
  'category_display_config must not remain allowlisted after moving category display config to VPS table-data',
);

assert.doesNotMatch(
  source,
  /product-variant-taxonomy-temporary|'rams'|'storages'/,
  'rams and storages must not remain allowlisted after confirming their VPS services are the active path',
);

assert.doesNotMatch(
  source,
  /checkin_logs/,
  'checkin_logs must not remain allowlisted after moving check-in logs to VPS table-data',
);

assert.doesNotMatch(
  source,
  /coin_transactions|customer-engagement-temporary/,
  'coin_transactions must not remain allowlisted after moving transaction reads to VPS table-data',
);

assert.doesNotMatch(
  source,
  /coin_balances/,
  'coin_balances must not remain allowlisted after moving balance reads to VPS table-data',
);

assert.doesNotMatch(
  source,
  /cashback_settings/,
  'cashback_settings must not remain allowlisted after moving settings to VPS table-data',
);

assert.doesNotMatch(
  source,
  /add_coins|add_pending_coins|confirm_pending_coins|cancel_pending_coins|spend_coins|refund_coins|refund_referral_coins|process_referral_reward|cashback-rpc-temporary|dynamic-rpc-temporary/,
  'cashback RPC allowlists must not remain after moving the coin/referral ledger to VPS table-data',
);

assert.doesNotMatch(
  source,
  /customer_benefits|customer-benefits-temporary/,
  'customer_benefits must not remain allowlisted after moving benefits to VPS table-data',
);

assert.doesNotMatch(
  source,
  /benefit_redemptions/,
  'benefit_redemptions must not remain allowlisted after moving redemption workflow to VPS table-data',
);

assert.doesNotMatch(
  source,
  /warranty_templates/,
  'warranty_templates must not remain allowlisted after moving warranty templates to VPS table-data',
);

assert.doesNotMatch(
  source,
  /warranty_documents|warranty-temporary/,
  'warranty_documents must not remain allowlisted after moving warranty documents to VPS table-data',
);

assert.doesNotMatch(
  source,
  /delivery_credits/,
  'delivery_credits must not remain allowlisted after moving delivery credits to VPS table-data',
);

assert.doesNotMatch(
  source,
  /company_documents/,
  'company_documents must not remain allowlisted after moving document metadata to VPS table-data',
);

assert.doesNotMatch(
  source,
  /team_members|admin-team-temporary/,
  'team_members must not remain allowlisted after moving teamService to VPS table-data',
);

assert.doesNotMatch(
  source,
  /product_price_history/,
  'product_price_history must not remain allowlisted after moving price history to VPS table-data',
);

assert.doesNotMatch(
  source,
  /promotions/,
  'promotions must not remain allowlisted after moving promotionService to VPS table-data',
);

assert.doesNotMatch(
  source,
  /product_views|increment_product_views|catalog-analytics-(?:rpc|tables)-temporary/,
  'product view analytics must not remain allowlisted after moving view tracking to the VPS',
);

assert.doesNotMatch(
  source,
  /stock_location_divergences|inventory-audit-temporary/,
  'stock location divergence view must not remain allowlisted after moving divergence reads to the VPS',
);

assert.doesNotMatch(
  source,
  /stock_movements|stock_locations|stock_deposits|product_units|shipping_settings|product_stock_locations|stock_location_movements|inventory-and-operations-temporary/,
  'inventory table dependencies must not remain allowlisted after active adjustment/history paths moved to VPS',
);

assert.doesNotMatch(
  source,
  /inventory-rpc-temporary|decrement_stock|increment_stock|decrement_product_stock_by_priority|reserve_product_stock_by_priority|consume_order_stock_reservations|release_order_stock_reservations|restore_product_stock_from_(?:sale|order)_movements/,
  'inventory RPC allowlists must not remain after moving stock flows to VPS endpoints',
);

assert.doesNotMatch(
  source,
  /shipping_price_ranges|shipping_zones|shipping-config-temporary/,
  'shipping zone/range tables must not remain allowlisted after shippingService moved to VPS endpoints',
);

assert.doesNotMatch(
  source,
  /bling_settings|shopee_settings|mercadopago_settings|google_contacts_settings|integration-settings-temporary/,
  'integration settings must not remain allowlisted after moving settings services to VPS endpoints',
);

assert.doesNotMatch(
  source,
  /system_logs|performance_metrics|operations-observability-temporary|app-versioning-temporary|'versions'/,
  'observability and versions tables must not remain allowlisted after active callers moved to VPS paths',
);

assert.doesNotMatch(
  source,
  /storage-temporary|named-storage-buckets-temporary|'customer-avatars'|'product-images'/,
  'Supabase Storage buckets must not remain allowlisted after moving files to VPS/Synology',
);

assert.doesNotMatch(
  source,
  /custom_fields/,
  'custom_fields must not remain allowlisted after moving the field library to VPS table-data',
);

assert.doesNotMatch(
  source,
  /model_color_images/,
  'model_color_images must not remain allowlisted after moving model/color galleries to VPS table-data',
);

assert.doesNotMatch(
  source,
  /orders-temporary|'orders'|'order_items'|'order_status_history'/,
  'orders tables must not remain allowlisted after moving online orders to VPS table-data',
);

assert.doesNotMatch(
  source,
  /customer-core-temporary/,
  'customer-core-temporary must not remain allowlisted after moving auth and legacy customer flows to VPS services',
);

assert.doesNotMatch(
  source,
  /shopee-products-crossmodule-temporary/,
  'shopee-products-crossmodule-temporary must not remain allowlisted after shared Shopee link readers moved to VPS',
);

assert.doesNotMatch(
  source,
  /shopee_products/,
  'shopee_products must not remain allowlisted after Shopee admin link metadata moved to the VPS service',
);

assert.doesNotMatch(
  source,
  /sales-customers-finance-temporary|'sales'|'sale_items'|'customers'|'cashback_transactions'|'receivables'|'payables'|'payment_methods'/,
  'sales/customer/finance tables must not remain allowlisted after active sales analytics moved to VPS services',
);

assert.doesNotMatch(
  source,
  /legacy-users-table-temporary|'users'/,
  'legacy users table must not remain allowlisted after inventory company lookup moved to VPS table-data',
);

assert.doesNotMatch(
  source,
  /user_permissions/,
  'user_permissions must not remain allowlisted after permissions management moved to VPS table-data',
);

assert.doesNotMatch(
  source,
  /auth-and-profile-temporary|company-alias-temporary|'profiles'|'companies'|'company'/,
  'company/profile allowlists must not remain after active company lookup moved to VPS table-data',
);

assert.match(
  source,
  /process\.exitCode\s*=\s*1/,
  'guard should fail CI/terminal when the baseline grows',
);

console.log('supabase operational dependency guard static checks passed');
