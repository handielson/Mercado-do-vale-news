const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{execFileSync}=require('node:child_process');
const {BASELINE,patch}=require('../scripts/deploy-sales-delivery.cjs');
for(const file of ['vps_server.cjs','vps_server.js']){
  const old=execFileSync('git',['show',BASELINE+':'+file],{encoding:'utf8',maxBuffer:15e6}),current=fs.readFileSync(file,'utf8');
  test(file+': complete delta is scoped and preserves remote integrations',()=>{
    const remote='// remote integration retained\n'+old;
    const result=patch(remote,old,current);
    assert.equal(result.replace(/\r\n/g,'\n'),'// remote integration retained\n'+current.replace(/\r\n/g,'\n'));
    assert.equal(patch(result,old,current),result);
  });
  test(file+': rejects drift in changed code and unaccounted local edits',()=>{
    assert.throws(()=>patch(old.replace("if (currentRevision !== expectedRevision && !eventVersionProvided)","if (currentRevision > expectedRevision && !eventVersionProvided)"),old,current),/drift/);
    assert.throws(()=>patch(old,old,current+'\n// extra unauthorized change\n'),/Unaccounted/);
  });
}
