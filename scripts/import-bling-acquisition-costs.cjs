// Operator importer: reviewed stock ledgers only. Preview is the default.
const fs=require('node:fs'),path=require('node:path'),{Client}=require('ssh2');
const {acquisitionCost,importCosts}=require('../services/blingAcquisitionCost.cjs');
async function run() {
  const args=process.argv.slice(2),file=args.find(a=>!a.startsWith('--'));
  if(!file) throw new Error('Use: node scripts/import-bling-acquisition-costs.cjs HISTORICOS.json [--apply]');
  const entries=JSON.parse(fs.readFileSync(path.resolve(file),'utf8'));
  entries.forEach(acquisitionCost);
  require('dotenv').config({path:path.resolve(__dirname,'../.env.vps.local'),quiet:true});
  require('dotenv').config({path:path.resolve(__dirname,'../.env.local'),quiet:true});
  const privateKeyPath=process.env.VPS_SITE_PRIVATE_KEY||process.env.VPS_PRIVATE_KEY;
  const config={host:process.env.VPS_SITE_HOST||process.env.VPS_HOST,username:process.env.VPS_SITE_USER||process.env.VPS_USER,password:process.env.VPS_SITE_PASSWORD||process.env.VPS_ROOT_PASSWORD||process.env.VPS_PASSWORD,...(privateKeyPath?{privateKey:fs.readFileSync(privateKeyPath)}:{})};
  if(!config.host||!config.username||(!config.password&&!config.privateKey))throw new Error('SSH da VPS não configurado.');
  const source=`require('dotenv').config({quiet:true}); const fs=require('node:fs'); const acquisitionCost=${acquisitionCost.toString()}; const importCosts=${importCosts.toString()}; (async()=>{const db=await require('mysql2/promise').createConnection({host:process.env.DB_HOST,user:process.env.DB_USER,password:process.env.DB_PASS,database:process.env.DB_NAME});try{const dir=require('node:os').homedir()+'/.mdv/cost-imports';fs.mkdirSync(dir,{recursive:true,mode:0o700});const receiptPath=dir+'/'+Date.now()+'-'+require('node:crypto').randomUUID()+'.json';const result=await importCosts(db,${JSON.stringify(entries)},{apply:${args.includes('--apply')},saveReceipt:async products=>fs.writeFileSync(receiptPath,JSON.stringify({status:'prepared',products},null,2),{mode:0o600,flag:'wx'})});fs.writeFileSync(receiptPath,JSON.stringify(result,null,2),{mode:0o600});console.log(JSON.stringify({applied:result.applied,receiptPath,products:result.products.map(p=>({sku:p.sku,previousCostCents:p.previousCostCents,costCents:p.costCents}))}));}finally{await db.end();}})().catch(e=>{console.error(e.message);process.exitCode=1;});`;
  const conn=new Client();
  await new Promise((resolve,reject)=>{conn.once('ready',resolve).once('error',reject).connect(config);});
  try {
    const output=await new Promise((resolve,reject)=>conn.exec(`cd /var/www/mdv-api && node -e "eval(Buffer.from('${Buffer.from(source).toString('base64')}','base64').toString())"`,(error,stream)=>{
      if(error)return reject(error);let out='',err='';stream.on('data',d=>out+=d);stream.stderr.on('data',d=>err+=d);stream.on('close',code=>code?reject(new Error(err||'Importação falhou.')):resolve(out));
    }));
    console.log(output.trim());
  } finally {conn.end();}
}
if(require.main===module)run().catch(e=>{console.error(e.message);process.exitCode=1;});
