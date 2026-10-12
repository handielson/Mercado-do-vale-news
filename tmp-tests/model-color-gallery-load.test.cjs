const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm'), ts=require('typescript'), React=require('react');
const code=ts.transpileModule(fs.readFileSync('components/settings/ColorImageManager.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText;
function renderFixture({failure=false}={}) {
  const colors=[{id:'azul',name:'Azul'},{id:'preto',name:'Preto'},{id:'roxo',name:'Roxo'}];
  const rows=colors.map(color=>({color_id:color.id,images:[color.id+'-1.jpg',color.id+'-2.jpg']}));
  const state=[colors.map(color=>({color,images:rows.find(row=>row.color_id===color.id).images})),new Set(colors.map(c=>c.id)),false,'',{}];
  let index=0, effect, reads=0;
  const exports={};
  vm.runInNewContext(code,{exports,console:{error(){}},Map,Set,require:name=> {
    if(name==='react')return {...React,useState:()=>{const i=index++;return[state[i],v=>{state[i]=typeof v==='function'?v(state[i]):v;}];},useEffect:fn=>{effect=fn;}};
    if(name.includes('model-color-images'))return{modelColorImagesService:{getByModel:async id=>{assert.equal(id,'m');reads++;if(failure)throw Error('network');return rows;}}};
    if(name.includes('/colors'))return{colorService:{list:async()=>colors}};
    if(name==='sonner')return{toast:{error(){}}};
    if(name==='lucide-react')return require(name);
    return{};
  }});
  const html=require('react-dom/server').renderToStaticMarkup(React.createElement(exports.ColorImageManager,{modelId:'m'}));
  return{html,state,load:async()=>{effect();await new Promise(resolve=>setImmediate(resolve));},reads:()=>reads};
}
test('one read preserves the six images in all three colors',async()=>{
  const f=renderFixture();await f.load();assert.equal(f.reads(),1);assert.equal(f.state[0].length,3);
  assert.equal(f.state[0].reduce((n,c)=>n+c.images.length,0),6);
  for(const color of ['Azul','Preto','Roxo'])assert.match(f.html,new RegExp(color+' - Foto 1'));
});
test('read failure retains loaded galleries and exposes a retryable error',async()=>{
  const f=renderFixture({failure:true});const before=JSON.stringify(f.state[0]);await f.load();
  assert.equal(JSON.stringify(f.state[0]),before);assert.match(f.state[3],/não foram removidas/);assert.equal(f.state[2],false);
  assert.match(fs.readFileSync('components/settings/ColorImageManager.tsx','utf8'),/Tentar carregar cores novamente/);
});
