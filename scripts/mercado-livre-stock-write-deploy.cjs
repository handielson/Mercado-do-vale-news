const ENABLE_FLAG = '--enable-erp-stock-write';
const SELECTIVE_DEPLOY_FLAG = '--mercado-livre-only';

function mercadoLivreStockWriteDeployEnv(args = process.argv, env = process.env) {
  const requested = args.includes(ENABLE_FLAG);
  const selectiveDeploy = args.includes(SELECTIVE_DEPLOY_FLAG);
  if (requested && !selectiveDeploy) {
    throw new Error(`${ENABLE_FLAG} requires ${SELECTIVE_DEPLOY_FLAG}`);
  }
  if (!requested) return { MDV_ERP_STOCK_WRITE_ENABLED: '0' };

  const key = String(env.MDV_ERP_WRITE_KEY || '').trim();
  const keyBytes = Buffer.byteLength(key, 'utf8');
  if (keyBytes < 32 || keyBytes > 256) {
    throw new Error('MDV_ERP_WRITE_KEY must contain 32 to 256 bytes when ERP stock write is explicitly enabled');
  }
  return {
    MDV_ERP_WRITE_KEY: key,
    MDV_ERP_STOCK_WRITE_ENABLED: '1',
  };
}

module.exports = { mercadoLivreStockWriteDeployEnv };
