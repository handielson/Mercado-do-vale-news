'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const MODULES=['smartphoneModelFamily.cjs','physicalRamCore.cjs','smartphonePhotoIntakeCore.cjs','smartphonePhotoIntakeServer.cjs','smartphonePriceGroupsCore.cjs','smartphonePriceGroupsServer.cjs','smartphoneModelSpecs.mjs','modelBlingMapping.mjs','serializedSaleFinalization.cjs','smartphoneMovingAverageCore.cjs','smartphoneMovingAverageServer.cjs'].map(n=>'services/'+n);
const FILES=[...MODULES,'scripts/initialize-smartphone-moving-average.cjs','scripts/smartphone-moving-average-deploy-core.cjs','migrations/vps-smartphone-moving-average.sql'];
const hash=s=>crypto.createHash('sha256').update(s.replaceAll('\r','')).digest('hex');
async function deploy({exec,upload,appDir}) {
  if(appDir!=='/var/www/mdv-api') throw Error('Unexpected moving average API target');
  const expected={};for(const file of MODULES){
    const current=fs.readFileSync(path.join(__dirname,'..',file),'utf8');
    let baseline=null;
    if(!file.includes('smartphoneMovingAverage')) baseline=hash(execFileSync('git',['show','v1.2.671-origem-versao-global:'+file],{encoding:'utf8'}));
    expected[file]={baseline,next:hash(current)};
  }
  const backup=appDir+'/backups/moving-average-'+Date.now();
  await exec(`mkdir -p ${backup}/staged/services ${backup}/staged/scripts ${backup}/staged/migrations && chmod 700 ${backup}`);
  for(const file of FILES) await upload(path.join(__dirname,'..',file),backup+'/staged/'+file);
  const program=`(${install.toString()})(${JSON.stringify({appDir,backup,expected,modules:MODULES})}).catch(e=>{console.error(JSON.stringify({error:e.code||e.message}));process.exitCode=1;});`;
  const result=await exec(`cd ${appDir} && node -e "eval(Buffer.from('${Buffer.from(program).toString('base64')}','base64').toString())"`);
  console.log(result.trim());
  console.log('Moving average backup: '+backup);
}
async function install({appDir,backup,expected,modules}) {
  const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
  const {execFileSync}=require('node:child_process');
  require('dotenv').config({path:appDir+'/.env',quiet:true});
  const hash=s=>crypto.createHash('sha256').update(s.replaceAll(String.fromCharCode(13),'')).digest('hex');
  const stage=backup+'/staged';
  const {patchStockSync}=require(stage+'/scripts/smartphone-moving-average-deploy-core.cjs');
  const entries=['vps_server.cjs','vps_server.js','server.js'];
  const beforeCode={};
  for(const file of modules) {
    const target=appDir+'/'+file,old=fs.existsSync(target)?fs.readFileSync(target,'utf8'):null;
    const actual=old==null?null:hash(old);
    if(actual!==expected[file].baseline&&actual!==expected[file].next) throw Error('Unexpected remote module drift: '+file);
    beforeCode[file]=actual;
    execFileSync(process.execPath,['--check',stage+'/'+file],{stdio:'pipe'});
  }
  for(const file of entries) {
    const text=fs.readFileSync(appDir+'/'+file,'utf8');beforeCode[file]=hash(text);
    fs.writeFileSync(stage+'/'+file+'.next.cjs',patchStockSync(text));
    execFileSync(process.execPath,['--check',stage+'/'+file+'.next.cjs'],{stdio:'pipe'});
  }
  const db=await require('mysql2/promise').createConnection({user:'root',socketPath:'/var/run/mysqld/mysqld.sock',database:process.env.DB_NAME});
  let stopped=false,started=false,completed=false;
  const database=process.env.DB_NAME;
  if(!/^[a-zA-Z0-9_]+$/.test(database))throw Error('Invalid database');
  try {
    const [[version]]=await db.query('SELECT VERSION() version');if(!version.version.startsWith('8.0.'))throw Error('MySQL 8 required');
    const [[triggers]]=await db.query("SELECT COUNT(*) n FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND TRIGGER_NAME IN ('mdv_unit_journal_insert','mdv_unit_journal_update','mdv_unit_journal_delete','mdv_unit_journal_product_update','mdv_unit_journal_product_delete')");
    if(Number(triggers.n)!==5)throw Error('Unit journal incomplete');
    const status=JSON.parse(execFileSync('pm2',['jlist'],{encoding:'utf8'})).find(p=>p.name==='mdv-api');
    if(status?.pm2_env?.status!=='online')throw Error('API is not online');
    execFileSync('pm2',['stop','mdv-api'],{stdio:'ignore'});stopped=true;
    await new Promise(resolve=>setTimeout(resolve,1000));
    const [writers]=await db.query("SELECT ID FROM information_schema.PROCESSLIST WHERE DB=? AND ID<>CONNECTION_ID() AND COMMAND<>'Sleep'",[database]);
    if(writers.length)throw Error('Other active database writers');
    const dump=backup+'/before.sql';const fd=fs.openSync(dump,'wx',0o600);
    try{execFileSync('mysqldump',['--socket=/var/run/mysqld/mysqld.sock','--user=root','--single-transaction','--routines','--triggers','--events','--set-gtid-purged=OFF','--databases',database],{stdio:['ignore',fd,'pipe']});}finally{fs.closeSync(fd);}
    if(fs.statSync(dump).size<100)throw Error('Empty backup');
    execFileSync('gzip',[dump]);execFileSync('gzip',['-t',dump+'.gz']);
    const protectedTables=['products','units','sales','sale_items'];
    const readProtected=async()=>{
      const result={};for(const table of protectedTables){const [rows]=await db.query('SELECT * FROM '+table+' ORDER BY id');result[table]={count:rows.length,hash:hash(JSON.stringify(rows))};}return result;
    };
    const before=await readProtected();
    fs.writeFileSync(backup+'/protected-before.json',JSON.stringify(before),{mode:0o600});
    for(const file of [...modules,...entries]) {
      const target=appDir+'/'+file;
      if((fs.existsSync(target)?hash(fs.readFileSync(target,'utf8')):null)!==beforeCode[file])throw Error('Code changed during deploy: '+file);
      if(fs.existsSync(target)){fs.mkdirSync(path.dirname(backup+'/original/'+file),{recursive:true,mode:0o700});fs.copyFileSync(target,backup+'/original/'+file);}
    }
    started=true;
    const sql=fs.readFileSync(stage+'/migrations/vps-smartphone-moving-average.sql','utf8');
    for(const statement of sql.split(';').map(s=>s.trim()).filter(Boolean))await db.query(statement);
    const {initialize}=require(stage+'/scripts/initialize-smartphone-moving-average.cjs');
    const preview=await initialize(db);console.log(JSON.stringify({baselinePreview:preview}));
    const initialized=await initialize(db,{apply:true});
    const after=await readProtected();
    if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Operational rows changed during migration');
    fs.writeFileSync(backup+'/protected-after.json',JSON.stringify(after),{mode:0o600});
    for(const file of modules){fs.mkdirSync(path.dirname(appDir+'/'+file),{recursive:true});fs.copyFileSync(stage+'/'+file,appDir+'/'+file);}
    for(const file of entries)fs.copyFileSync(stage+'/'+file+'.next.cjs',appDir+'/'+file);
    for(const file of [...modules,...entries])execFileSync(process.execPath,['--check',appDir+'/'+file],{stdio:'pipe'});
    const report={mysql:version.version,backup:dump+'.gz',backupVerified:true,initialized,protectedRowsPreserved:true,protectedTables:after,entrypointsPatched:entries};
    fs.writeFileSync(backup+'/result.json',JSON.stringify(report,null,2),{mode:0o600});
    completed=true;console.log(JSON.stringify(report));
  } finally {
    await db.end();
    if(stopped&&(!started||completed)){execFileSync('pm2',['restart','mdv-api'],{stdio:'ignore'});console.log(JSON.stringify({apiResumed:true}));}
    else if(stopped)console.error('Maintenance incomplete: API remains stopped until repaired. Backup: '+backup);
  }
}
module.exports={deploy,install};
