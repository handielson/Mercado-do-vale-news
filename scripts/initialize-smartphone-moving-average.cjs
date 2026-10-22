'use strict';
// Run after the explicit schema migration and before resuming API traffic.
// No historical sale or unit purchase value is rewritten. Default: dry run.
const prices = require('../services/smartphonePriceGroupsCore.cjs');
const costs = require('../services/smartphoneMovingAverageServer.cjs');
async function initialize(db, { apply = false } = {}) {
  const [models] = await db.query(`SELECT m.id,m.name,m.company_id,m.template_values,c.name category_name
    FROM models m LEFT JOIN categories c ON c.id=m.category_id ORDER BY m.id`);
  let initialized = 0, preserved = 0, configurations = 0, missingCosts = 0;
  for (const model of models.filter(m => prices.isSmartphoneCategory(m.category_name))) {
    await db.beginTransaction();
    try {
      const ledger = await costs.load(db, model, { lock: apply });
      if (ledger.initialized) { preserved++; await db.rollback(); continue; }
      initialized++;
      configurations += Object.keys(ledger.state.groups).length;
      missingCosts += Object.values(ledger.state.groups).reduce((sum,g)=>sum+g.unknown,0);
      if (apply) { await costs.save(db,ledger); await db.commit(); }
      else await db.rollback();
    } catch (error) { await db.rollback(); throw error; }
  }
  return { mode:apply?'apply':'dry-run',initialized,preserved,configurations,missingCosts };
}
module.exports = { initialize };
if (require.main === module) {
  require('dotenv').config({quiet:true});
  require('mysql2/promise').createConnection({host:process.env.DB_HOST,user:process.env.DB_USER,password:process.env.DB_PASS,database:process.env.DB_NAME})
    .then(async db=>{try {console.log(JSON.stringify(await initialize(db,{apply:process.argv.includes('--apply')})));} finally {await db.end();}})
    .catch(error=>{console.error(error.message);process.exitCode=1;});
}
