'use strict';

const { Client } = require('ssh2');
const fs = require('node:fs');
const path = require('node:path');
const { auditPrint3dSku } = require('./audit-print3d-sku.cjs');

for (const file of ['.env.vps.local', '.env.local']) {
  require('dotenv').config({ path: path.join(__dirname, '..', file), quiet: true });
}

const host = process.env.VPS_SITE_HOST || process.env.VPS_HOST;
const username = process.env.VPS_SITE_USER || process.env.VPS_USER;
const password = process.env.VPS_SITE_PASSWORD || process.env.VPS_ROOT_PASSWORD || process.env.VPS_PASSWORD;
const privateKeyPath = process.env.VPS_SITE_PRIVATE_KEY || process.env.VPS_PRIVATE_KEY;
const privateKey = privateKeyPath ? fs.readFileSync(privateKeyPath) : undefined;
const expectedAppDir = '/var/www/mdv-api';

if (!host || !username || (!password && !privateKey)) throw new Error('Missing VPS SSH configuration');

const quote = value => `'${String(value).replace(/'/g, `'\\''`)}'`;
const connection = new Client();

function exec(command) {
  return new Promise((resolve, reject) => {
    connection.exec(command, (error, stream) => {
      if (error) return reject(error);
      let stdout = '';
      let stderr = '';
      stream.on('data', chunk => { stdout += chunk.toString(); });
      stream.stderr.on('data', chunk => { stderr += chunk.toString(); });
      stream.on('close', code => code === 0 ? resolve(stdout) : reject(new Error(stderr || `Remote command failed (${code})`)));
    });
  });
}

function nodeCommand(appDir, source) {
  const encoded = Buffer.from(source).toString('base64');
  return `cd ${quote(appDir)} && node -e ${quote(`eval(Buffer.from('${encoded}','base64').toString())`)}`;
}

function remoteSource() {
  const migrationMarkers = {
    '028': ['table:print3d_recipe_revisions'],
    '029': ['table:print3d_recipe_files'],
    '030': ['table:print3d_active_recipes'],
    '031': ['column:products.is_print3d', 'column:products.print3d_preorder_enabled', 'column:products.print3d_preorder_limit'],
    '032': ['table:product_storefront_offers'],
    '033': ['column:orders.storefront'],
    '034': ['table:print3d_customers', 'table:print3d_customer_auth', 'table:print3d_customer_tokens', 'column:orders.print3d_customer_id'],
    '035': ['column:print3d_customers.phone_verified_at', 'table:print3d_phone_verifications', 'table:print3d_phone_verification_limits'],
    '036': ['table:print3d_login_limits'],
    '037': ['table:customer_login_limits'],
    '038': ['table:print3d_customer_google', 'table:print3d_google_handoffs'],
    '039': ['column:banners.storefront'],
    '040': ['table:print3d_production_jobs', 'table:print3d_production_events'],
    '041': ['table:print3d_order_plans', 'table:print3d_order_item_plans', 'table:print3d_order_payment_receipts'],
    '042': ['table:print3d_checkout_requests', 'table:print3d_order_shipping', 'table:print3d_order_stock_reservations'],
    '043': ['table:print3d_payment_charges'],
    '044': ['column:print3d_order_plans.payment_terms_version'],
    '045': ['table:print3d_order_cancellation_events'],
    '046': ['table:print3d_production_outputs'],
    '047': ['column:print3d_production_events.material_consumed_grams'],
    '048': ['table:print3d_filament_stock', 'table:print3d_filament_movements'],
    '049': ['table:print3d_order_dispatches'],
    '050': ['table:print3d_supply_stock', 'table:print3d_supply_movements'],
    '051': ['column:print3d_order_item_plans.variant_snapshot'],
    '052': ['table:print3d_file_assets', 'column:print3d_recipe_files.asset_id'],
  };

  const fs = require('node:fs');
  const env = require('dotenv').parse(fs.readFileSync('.env'));
  const mysql = require('mysql2/promise');
  const auditPrint3dSku = AUDIT_FUNCTION;

  (async () => {
    const db = await mysql.createConnection({ host:env.DB_HOST, user:env.DB_USER, password:env.DB_PASS, database:env.DB_NAME });
    try {
      const [tableRows] = await db.query('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()');
      const [columnRows] = await db.query('SELECT TABLE_NAME,COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()');
      const tables = new Set(tableRows.map(row => row.TABLE_NAME));
      const columns = new Set(columnRows.map(row => `${row.TABLE_NAME}.${row.COLUMN_NAME}`));
      const markerExists = marker => marker.startsWith('table:') ? tables.has(marker.slice(6)) : columns.has(marker.slice(7));
      const migrations = Object.fromEntries(Object.entries(migrationMarkers).map(([number, markers]) => [number, {
        present: markers.every(markerExists),
        partial: markers.some(markerExists) && !markers.every(markerExists),
      }]));
      const sku = await auditPrint3dSku(db);
      const [[legacySku]] = await db.query(`SELECT
        SUM(CASE WHEN sku IS NULL OR TRIM(sku)='' THEN 1 ELSE 0 END) missing_sku,
        (SELECT COUNT(*) FROM (SELECT TRIM(sku) sku_key FROM products WHERE sku IS NOT NULL AND TRIM(sku)<>'' GROUP BY TRIM(sku) HAVING COUNT(*)>1) duplicated) duplicate_groups
        FROM products`);
      sku.legacy_counts = { missing_sku:Number(legacySku.missing_sku || 0), duplicate_groups:Number(legacySku.duplicate_groups || 0) };
      if (tables.has('units')) {
        const [[duplicateKinds]] = await db.query(`SELECT
          SUM(CASE WHEN products_with_units=product_count THEN 1 ELSE 0 END) all_serialized_groups,
          SUM(CASE WHEN products_with_units=0 THEN 1 ELSE 0 END) no_serialized_groups,
          SUM(CASE WHEN products_with_units>0 AND products_with_units<product_count THEN 1 ELSE 0 END) mixed_groups
          FROM (SELECT TRIM(p.sku) sku_key,COUNT(*) product_count,
            SUM(CASE WHEN EXISTS(SELECT 1 FROM units u WHERE u.product_id=p.id) THEN 1 ELSE 0 END) products_with_units
            FROM products p WHERE p.sku IS NOT NULL AND TRIM(p.sku)<>''
            GROUP BY TRIM(p.sku) HAVING COUNT(*)>1) duplicated`);
        sku.legacy_counts.duplicate_group_kinds = {
          all_products_serialized:Number(duplicateKinds.all_serialized_groups || 0),
          no_products_serialized:Number(duplicateKinds.no_serialized_groups || 0),
          mixed:Number(duplicateKinds.mixed_groups || 0),
        };
      }
      const [[products]] = await db.query(`SELECT COUNT(*) total,
        SUM(CASE WHEN is_print3d=1 THEN 1 ELSE 0 END) print3d,
        SUM(CASE WHEN stock_quantity<0 THEN 1 ELSE 0 END) negative_stock
        FROM products`);
      let stockLocations = null;
      if (tables.has('product_stock_locations')) {
        const [[summary]] = await db.query(`SELECT COUNT(*) rows_total,
          SUM(CASE WHEN quantity<0 OR reserved_quantity<0 OR reserved_quantity>quantity THEN 1 ELSE 0 END) invalid_rows
          FROM product_stock_locations`);
        const [[undistributed]] = await db.query(`SELECT COUNT(*) total FROM products p
          LEFT JOIN (SELECT product_id,SUM(quantity) quantity FROM product_stock_locations GROUP BY product_id) located ON located.product_id=p.id
          WHERE COALESCE(p.stock_quantity,0)>0 AND COALESCE(located.quantity,0)=0`);
        const [[mismatch]] = await db.query(`SELECT COUNT(*) total FROM products p
          LEFT JOIN (SELECT product_id,SUM(quantity) quantity FROM product_stock_locations GROUP BY product_id) located ON located.product_id=p.id
          WHERE COALESCE(p.stock_quantity,0)<>COALESCE(located.quantity,0)`);
        const [[reconciliation]] = await db.query(`SELECT
          SUM(CASE WHEN COALESCE(p.stock_quantity,0)>COALESCE(located.quantity,0) THEN 1 ELSE 0 END) central_higher_products,
          SUM(CASE WHEN COALESCE(p.stock_quantity,0)<COALESCE(located.quantity,0) THEN 1 ELSE 0 END) locations_higher_products,
          SUM(CASE WHEN COALESCE(p.stock_quantity,0)>COALESCE(located.quantity,0) THEN COALESCE(p.stock_quantity,0)-COALESCE(located.quantity,0) ELSE 0 END) central_higher_units,
          SUM(CASE WHEN COALESCE(p.stock_quantity,0)<COALESCE(located.quantity,0) THEN COALESCE(located.quantity,0)-COALESCE(p.stock_quantity,0) ELSE 0 END) locations_higher_units,
          SUM(CASE WHEN COALESCE(p.stock_quantity,0)>0 AND COALESCE(located.quantity,0)=0 THEN COALESCE(p.stock_quantity,0) ELSE 0 END) positive_undistributed_units
          FROM products p LEFT JOIN (SELECT product_id,SUM(quantity) quantity FROM product_stock_locations GROUP BY product_id) located ON located.product_id=p.id`);
        const [negativeRefs] = await db.query(`SELECT LEFT(SHA2(p.id,256),12) reference,
          p.stock_quantity central_quantity,COALESCE(located.quantity,0) location_quantity
          FROM products p LEFT JOIN (SELECT product_id,SUM(quantity) quantity FROM product_stock_locations GROUP BY product_id) located ON located.product_id=p.id
          WHERE p.stock_quantity<0 ORDER BY p.stock_quantity,p.id`);
        let serializedReconciliation = null;
        if (tables.has('units')) {
          const [[serialized]] = await db.query(`SELECT
            SUM(CASE WHEN COALESCE(units.total,0)>0 AND COALESCE(p.stock_quantity,0)<>COALESCE(located.quantity,0) THEN 1 ELSE 0 END) mismatch_with_units,
            SUM(CASE WHEN COALESCE(units.total,0)=0 AND COALESCE(p.stock_quantity,0)<>COALESCE(located.quantity,0) THEN 1 ELSE 0 END) mismatch_without_units,
            SUM(CASE WHEN COALESCE(units.total,0)>0 AND COALESCE(p.stock_quantity,0)<>COALESCE(units.available,0) THEN 1 ELSE 0 END) central_vs_available_units_mismatch,
            SUM(CASE WHEN COALESCE(units.total,0)>0 AND COALESCE(located.quantity,0)<>COALESCE(units.available,0) THEN 1 ELSE 0 END) locations_vs_available_units_mismatch
            FROM products p
            LEFT JOIN (SELECT product_id,SUM(quantity) quantity FROM product_stock_locations GROUP BY product_id) located ON located.product_id=p.id
            LEFT JOIN (SELECT product_id,COUNT(*) total,SUM(CASE WHEN status='available' THEN 1 ELSE 0 END) available FROM units GROUP BY product_id) units ON units.product_id=p.id`);
          serializedReconciliation = Object.fromEntries(Object.entries(serialized).map(([key,value]) => [key,Number(value || 0)]));
        }
        stockLocations = {
          rows:Number(summary.rows_total), invalid_rows:Number(summary.invalid_rows || 0),
          products_with_positive_undistributed_stock:Number(undistributed.total),
          products_with_total_location_mismatch:Number(mismatch.total),
          reconciliation: {
            central_higher_products:Number(reconciliation.central_higher_products || 0),
            locations_higher_products:Number(reconciliation.locations_higher_products || 0),
            central_higher_units:Number(reconciliation.central_higher_units || 0),
            locations_higher_units:Number(reconciliation.locations_higher_units || 0),
            positive_undistributed_units:Number(reconciliation.positive_undistributed_units || 0),
          },
          negative_products:negativeRefs.map(row => ({ reference:row.reference, central_quantity:Number(row.central_quantity), location_quantity:Number(row.location_quantity) })),
          serialized_reconciliation:serializedReconciliation,
        };
      }
      const featureKeys = ['MDV_PRINT3D_CUSTOMERS_ENABLED','MDV_PRINT3D_PHONE_ENABLED','MDV_PRINT3D_GOOGLE_ENABLED',
        'MDV_PRINT3D_SHIPPING_ENABLED','MDV_PRINT3D_CHECKOUT_ENABLED','MDV_PRINT3D_PRODUCTION_ENABLED',
        'MDV_PRINT3D_PAYMENTS_ENABLED','MDV_PRINT3D_EXPIRY_ENABLED','MDV_PRINT3D_DISPATCH_ENABLED','MDV_PRINT3D_RECIPES_ENABLED'];
      const features = Object.fromEntries(featureKeys.map(key => [key, env[key] === '1']));
      const storage = {
        synology_url_configured:Boolean(env.SYNOLOGY_URL),
        synology_credentials_configured:Boolean(env.SYNOLOGY_USER && env.SYNOLOGY_PASS),
        print3d_folder_configured:Boolean(env.MDV_PRINT3D_SYNOLOGY_FOLDER),
        print3d_folder_valid:/^\/(?:home|volume\d+)\/[A-Za-z0-9._/-]+\/producao-3d$/.test(String(env.MDV_PRINT3D_SYNOLOGY_FOLDER || '')),
      };
      let company = null;
      if (tables.has('company_settings')) {
        const [[settings]] = await db.query(`SELECT COUNT(*) total,
          SUM(CASE WHEN id IS NULL OR TRIM(id)='' THEN 1 ELSE 0 END) missing_id,
          SUM(CASE WHEN cnpj IS NULL OR TRIM(cnpj)='' THEN 1 ELSE 0 END) missing_cnpj
          FROM company_settings`);
        const [primaryRows] = await db.query('SELECT id FROM company_settings ORDER BY id LIMIT 2');
        const primaryId = primaryRows.length === 1 ? String(primaryRows[0].id || '') : '';
        const operationalId = String(env.COMPANY_ID || env.VITE_COMPANY_ID || '9717131e-7b14-4aec-84a4-4317c0489985');
        const [[productCompanies]] = await db.query(`SELECT COUNT(DISTINCT company_id) total,
          SUM(CASE WHEN company_id=? THEN 1 ELSE 0 END) products_in_primary,
          SUM(CASE WHEN company_id=? THEN 1 ELSE 0 END) products_in_operational,
          SUM(CASE WHEN company_id IS NULL OR TRIM(company_id)='' THEN 1 ELSE 0 END) products_without_company
          FROM products`, [primaryId, operationalId]);
        const [companyGroups] = await db.query(`SELECT company_id,COUNT(*) products FROM products
          WHERE company_id IS NOT NULL AND TRIM(company_id)<>'' GROUP BY company_id ORDER BY products DESC`);
        let payment = { configured:false, active:false };
        if (tables.has('payment_integrations')) {
          const [[payments]] = await db.query(`SELECT COUNT(*) configured,
            SUM(CASE WHEN is_active=1 THEN 1 ELSE 0 END) active
            FROM payment_integrations WHERE company_id=?`, [operationalId]);
          payment = { configured:Number(payments.configured || 0) > 0, active:Number(payments.active || 0) > 0 };
        }
        let fiscal = null;
        if (tables.has('company_fiscal_profiles')) {
          const [[profiles]] = await db.query(`SELECT COUNT(*) total,
            SUM(CASE WHEN settings_id=? THEN 1 ELSE 0 END) primary_links
            FROM company_fiscal_profiles`, [primaryId]);
          let certificate = { configured:false, verified_locally:false, valid:false };
          if (tables.has('company_certificate_settings')) {
            const [[cert]] = await db.query(`SELECT COUNT(*) configured,
              SUM(CASE WHEN c.verified_locally=1 THEN 1 ELSE 0 END) verified_locally,
              SUM(CASE WHEN c.verified_locally=1 AND c.valid_until>=CURRENT_DATE THEN 1 ELSE 0 END) valid
              FROM company_certificate_settings c
              JOIN company_fiscal_profiles p ON p.id=c.profile_id WHERE p.settings_id=?`, [primaryId]);
            certificate = { configured:Number(cert.configured || 0) === 1,
              verified_locally:Number(cert.verified_locally || 0) === 1, valid:Number(cert.valid || 0) === 1 };
          }
          let taxValidation = { configured:false, approved:false };
          if (tables.has('company_fiscal_tax_validations')) {
            const [[tax]] = await db.query(`SELECT COUNT(*) configured,
              SUM(CASE WHEN v.status='approved' THEN 1 ELSE 0 END) approved
              FROM company_fiscal_tax_validations v
              JOIN company_fiscal_profiles p ON p.id=v.profile_id WHERE p.settings_id=?`, [primaryId]);
            taxValidation = { configured:Number(tax.configured || 0) === 1, approved:Number(tax.approved || 0) === 1 };
          }
          fiscal = { profiles:Number(profiles.total || 0), primary_links:Number(profiles.primary_links || 0),
            certificate, tax_validation:taxValidation };
        }
        company = {
          settings_rows:Number(settings.total || 0), settings_missing_id:Number(settings.missing_id || 0),
          settings_missing_cnpj:Number(settings.missing_cnpj || 0), exactly_one_primary:Boolean(primaryId),
          reference:primaryId ? require('node:crypto').createHash('sha256').update(primaryId).digest('hex').slice(0,12) : null,
          product_company_count:Number(productCompanies.total || 0), products_in_primary:Number(productCompanies.products_in_primary || 0),
          operational_reference:require('node:crypto').createHash('sha256').update(operationalId).digest('hex').slice(0,12),
          products_in_operational:Number(productCompanies.products_in_operational || 0),
          product_company_groups:companyGroups.map(row => ({ reference:require('node:crypto').createHash('sha256').update(String(row.company_id)).digest('hex').slice(0,12), products:Number(row.products) })),
          products_without_company:Number(productCompanies.products_without_company || 0),
          print3d_company_configured:String(env.MDV_PRINT3D_COMPANY_ID || '') === operationalId,
          payment,
          fiscal,
        };
      }
      const dbHost = String(env.DB_HOST || '').trim().toLowerCase();
      const connectionConfig = {
        host_kind: ['localhost','127.0.0.1','::1'].includes(dbHost) ? 'loopback' : dbHost.startsWith('/') ? 'socket' : 'network',
        port_configured: Boolean(env.DB_PORT),
        socket_configured: Boolean(env.DB_SOCKET || env.DB_SOCKET_PATH),
      };
      const backupRoot = '.deploy-backups';
      const backups = fs.existsSync(backupRoot) ? fs.readdirSync(backupRoot)
        .filter(name => /^print3d-db-preflight-[0-9]+-[a-f0-9]{6}$/.test(name))
        .sort()
        .map(name => {
          const directory = `${backupRoot}/${name}`;
          const manifestPath = `${directory}/manifest.json`;
          let manifest = null;
          try { manifest = JSON.parse(fs.readFileSync(manifestPath,'utf8')); } catch {}
          return {
            directory:`/var/www/mdv-api/${directory}`,
            complete:Boolean(manifest && manifest.full && manifest.schema),
            full_bytes:Number(manifest?.full?.bytes || 0),
            schema_bytes:Number(manifest?.schema?.bytes || 0),
          };
        }) : [];
      console.log(JSON.stringify({
        database: { products:Number(products.total), print3d_products:Number(products.print3d || 0), negative_product_stock:Number(products.negative_stock || 0) },
        sku, stock_locations:stockLocations, migrations, features, storage, company, connection:connectionConfig, backups,
      }));
    } finally { await db.end(); }
  })().catch(error => { console.error(error.code || error.message); process.exit(1); });
}

async function main() {
  await new Promise((resolve, reject) => {
    connection.on('ready', resolve);
    connection.on('error', reject);
    connection.connect({ host, port:22, username, password, privateKey, readyTimeout:20000 });
  });
  const processes = JSON.parse(await exec('pm2 jlist'));
  const api = processes.filter(item => item.name === 'mdv-api');
  if (api.length !== 1 || api[0].pm2_env?.pm_cwd !== expectedAppDir) throw new Error('Unexpected API target');
  const source = `(${remoteSource.toString()})()`
    .replace('AUDIT_FUNCTION', auditPrint3dSku.toString());
  const result = JSON.parse((await exec(nodeCommand(expectedAppDir, source))).trim());
  console.log(JSON.stringify(result, null, 2));
}

main().finally(() => connection.end()).catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
