const ENABLE_FLAG = '--enable-erp-stock-write';
const ENABLE_PRICE_FLAG = '--enable-erp-price-write';
const SELECTIVE_DEPLOY_FLAG = '--mercado-livre-only';

function mercadoLivreStockWriteDeployEnv(args = process.argv, env = process.env) {
  const requested = args.includes(ENABLE_FLAG);
  const requestedPrice = args.includes(ENABLE_PRICE_FLAG);
  const selectiveDeploy = args.includes(SELECTIVE_DEPLOY_FLAG);
  if ((requested || requestedPrice) && !selectiveDeploy) {
    throw new Error(`${requestedPrice ? ENABLE_PRICE_FLAG : ENABLE_FLAG} requires ${SELECTIVE_DEPLOY_FLAG}`);
  }
  if (!requested && !requestedPrice) return {
    MDV_ERP_STOCK_WRITE_ENABLED: '0',
    MDV_ERP_PRICE_WRITE_ENABLED: '0',
  };

  const key = String(env.MDV_ERP_WRITE_KEY || '').trim();
  const keyBytes = Buffer.byteLength(key, 'utf8');
  if (keyBytes < 32 || keyBytes > 256) {
    throw new Error('MDV_ERP_WRITE_KEY must contain 32 to 256 bytes when ERP write is explicitly enabled');
  }
  return {
    MDV_ERP_WRITE_KEY: key,
    MDV_ERP_STOCK_WRITE_ENABLED: requested ? '1' : '0',
    MDV_ERP_PRICE_WRITE_ENABLED: requestedPrice ? '1' : '0',
  };
}

module.exports = { mercadoLivreStockWriteDeployEnv };
