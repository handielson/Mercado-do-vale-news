'use strict';

const path = require('node:path');

async function deployMercadoLivreStockRead({ appDir, apiProc, exec, upload, root = __dirname }) {
  if (apiProc?.name !== 'mdv-api' || appDir !== '/var/www/mdv-api')
    throw new Error('Unexpected API target');

  const relativeFile = 'services/mercadoLivreListingStock.cjs';
  const target = `${appDir}/${relativeFile}`;
  const staged = `${target}.next.cjs`;
  const backupDir = `${appDir}/backups/mercado-livre-stock-read-${Date.now()}`;

  await exec(`mkdir -p ${backupDir}`);
  await exec(`cp -p ${target} ${backupDir}/mercadoLivreListingStock.cjs`);
  let replaced = false;
  try {
    await upload(path.join(root, relativeFile), staged);
    await exec(`node --check ${staged}`);
    await exec(`mv ${staged} ${target}`);
    replaced = true;
    const restart = await exec('pm2 restart mdv-api');
    console.log(String(restart || '').trim());
  } catch (error) {
    if (replaced) {
      try {
        await exec(`cp -p ${backupDir}/mercadoLivreListingStock.cjs ${target}`);
        await exec('pm2 restart mdv-api');
      } catch (rollbackError) {
        throw new Error(`Deploy failed (${error.message}); rollback also failed (${rollbackError.message}); backup: ${backupDir}`);
      }
    }
    throw error;
  } finally {
    await exec(`rm -f ${staged}`);
  }
  console.log(`Mercado Livre stock read module deployed; .env and price/publication modules untouched; backup: ${backupDir}`);
  return { target, backupDir };
}

module.exports = { deployMercadoLivreStockRead };
