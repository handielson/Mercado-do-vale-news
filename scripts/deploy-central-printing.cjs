const path = require('path');

// Selective publication preserves unrelated routes and production environment values.
module.exports = async function deployCentralPrinting({ appDir, apiProc, exec, upload, root }) {
  if (apiProc.name !== 'mdv-api' || appDir !== '/var/www/mdv-api') throw new Error('Unexpected API target');
  const backup = `${appDir}/backups/central-printing-${Date.now()}`;
  await exec(`mkdir -p ${backup}/services ${appDir}/migrations`);
  for (const file of ['server.js', 'vps_server.js', 'vps_server.cjs', '.env', 'services/centralPrintingCore.cjs', 'services/centralPrintingServer.cjs']) {
    await exec(`if test -f ${appDir}/${file}; then cp -p ${appDir}/${file} ${backup}/${file}; fi`);
  }
  await exec(`chmod 700 ${backup}`);
  for (const file of ['services/centralPrintingCore.cjs', 'services/centralPrintingServer.cjs', 'migrations/018_central_printing.sql']) {
    await upload(path.join(root, file), `${appDir}/${file}`);
  }
  const source = `
    const fs = require('fs');
    require('dotenv').config();
    require.resolve('pdf-lib');
    (async () => {
      const db = await require('mysql2/promise').createConnection({host:process.env.DB_HOST,user:process.env.DB_USER,password:process.env.DB_PASS,database:process.env.DB_NAME});
      const [[limits]] = await db.query('SELECT @@max_allowed_packet AS packet');
      if (Number(limits.packet) < 9*1024*1024) throw new Error('MySQL max_allowed_packet must be at least 9 MiB');
      const sql = fs.readFileSync('migrations/018_central_printing.sql','utf8');
      for (const statement of sql.split(';').map(x=>x.trim()).filter(Boolean)) await db.query(statement);
      const [tables] = await db.query("SHOW TABLES LIKE 'central_print_%'");
      if(tables.length !== 3) throw new Error('Migration table validation failed');
      await db.end();
      const registration = "require('./services/centralPrintingServer.cjs').registerCentralPrintingRoutes(fastify, { pool, getBearerAuthContext: getVpsBearerAuthContext });";
      const anchor = 'registerMercadoLivreRoutes(fastify, { pool, requireSyncKey, requireSyncKeyOrAdmin });';
      for(const file of ['server.js','vps_server.js','vps_server.cjs']) {
        if(!fs.existsSync(file)) continue;
        let content=fs.readFileSync(file,'utf8');
        if(!content.includes(registration)) {
          if(content.split(anchor).length!==2) throw new Error('Unexpected route anchor: '+file);
          content=content.replace(anchor,anchor+'\\n'+registration);
          fs.writeFileSync(file,content);
        }
      }
      let env=fs.readFileSync('.env','utf8');
      env=env.replace(/^MDV_CENTRAL_PRINT_ENABLED=.*(?:\\r?\\n|$)/gm,'');
      fs.writeFileSync('.env',env.replace(/\\s*$/,'')+'\\nMDV_CENTRAL_PRINT_ENABLED=1\\n');
      console.log('Central printing schema and release switch ready; tables='+tables.length);
    })().catch(e=>{console.error(e.message);process.exit(1)});
  `;
  await exec(`cd ${appDir} && node -e "eval(Buffer.from('${Buffer.from(source).toString('base64')}','base64').toString())"`).then(console.log);
  await exec(`cd ${appDir} && node --check server.js && node --check vps_server.cjs && node --check services/centralPrintingServer.cjs`);
  await exec('pm2 restart mdv-api --update-env');
  console.log(`Central printing deployed; backup: ${backup}`);
};
