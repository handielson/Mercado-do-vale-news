const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { File } = require('node:buffer');
const { registerProductFormDraftRoutes, validateSnapshot, PREFIX } = require('../services/productFormDraftsServer.cjs');
const ID = '00000000-0000-0000-0000-000000000001';
const FILE_ID = '00000000-0000-0000-0000-000000000002';
const snapshot = () => ({ schemaVersion:1, data:{ name:'', price_retail:0, images:['https://example.com/parent.webp'], specs:{ ncm:'392690' }, is_parent:true }, activeSection:'fiscal', activeSalesChannel:'mercado-livre', familyRows:[{ key:'child', data:{ name:'Roxo', images:['https://example.com/child.webp'], eans:['7891234567895'], price_retail:109000, specs:{ color:'Roxo',ram:'8GB',storage:'256GB' } } }], familyEditor:{ adding:true, attributes:[{ key:'color',value:'Azul' }] }, productionSetups:{}, productionRowKey:'', serialList:[], familyCheckpoint:{parent:null,children:{}} });
function fixture() {
  const records = new Map(); let backup;
  const queries = [];
  const query = async (sql, args) => {
    queries.push(sql);
    assert(sql.includes('admin_preferences') || /^SELECT.*FROM models/.test(sql) || /^SELECT.*FROM products/.test(sql), 'Saving a draft must never write products, units, stock or offers');
    if (sql.includes('FROM models')) return [[{id:args[0],name:'Poco X8 5G',category_id:'phones',brand_name:'Xiaomi'}]];
    if (sql.includes('FROM products')) return [[{id:args[0],model_id:FILE_ID,is_parent:1}]];
    if (sql.startsWith('INSERT')) { if (!records.has(args[0])) records.set(args[0], JSON.parse(args[1])); return [{}]; }
    if (sql.startsWith('UPDATE')) { records.set(args[1], JSON.parse(args[0])); return [{}]; }
    if (sql.includes("$.snapshot.data.model_id")) return [[...[...records.values()].filter(row=>row.status==='pending' && row.snapshot?.data?.is_parent && row.snapshot.data.model_id===args[1]).map(value_json=>({value_json}))]];
    if (sql.includes('$.savedProductId')) return [[...[...records.values()].reverse().filter(row=>row.status==='completed' && row.savedProductId===args[1]).slice(0,1).map(value_json=>({value_json}))]];
    // mysql2 parses JSON-typed columns automatically; CHAR projections stay serialized.
    if (sql.includes('JSON_EXTRACT')) return [[...records.values()].filter(row=>row.status==='pending').map(({snapshot:state,...meta})=>Object.fromEntries(Object.entries({...meta,is_print3d:state.data.is_print3d ?? null,is_parent:state.data.is_parent ?? null}).map(([key,value])=>{
      const jsonPath = ['is_print3d','is_parent'].includes(key) ? 'snapshot.data.'+key : key;
      return [key,sql.includes(`CAST(JSON_EXTRACT(value_json,'$.${jsonPath}') AS CHAR)`) ? JSON.stringify(value) : value];
    })))];
    return [[...(records.has(args[0]) ? [{value_json:records.get(args[0])}] : [])]];
  };
  const connection = { query, async beginTransaction(){backup=structuredClone(records);}, async commit(){}, async rollback(){records.clear();for(const entry of backup)records.set(...entry);}, release(){} };
  return { records, queries, pool:{ query, async getConnection(){return connection;} } };
}
async function appFixture() {
  const db = fixture();
  const app = require('fastify')();
  app.register(require('@fastify/multipart'));
  const root = await fsp.mkdtemp(path.join(os.tmpdir(),'mdv-draft-test-'));
  registerProductFormDraftRoutes(app,{pool:db.pool,filesRoot:root,requireAdminBearerToken:(req,reply)=>{if(req.headers.authorization!=='Bearer test')return reply.code(401).send({error:'Unauthorized'});}});
  await app.ready();
  return {...db,app,root,async close(){await app.close();await fsp.rm(root,{recursive:true,force:true});}};
}
const headers = {authorization:'Bearer test'};

test('todos os entrypoints da API registram a rota de rascunhos exatamente uma vez',()=>{
  const hook = "require('./services/productFormDraftsServer.cjs').registerProductFormDraftRoutes(fastify, { pool, requireAdminBearerToken });";
  for (const file of ['server.js','vps_server.js','vps_server.cjs']) {
    const source = fs.readFileSync(file,'utf8');
    assert.equal(source.split(hook).length - 1,1,`${file} precisa registrar GET e PUT dos rascunhos`);
  }
});

test('lista leve preserva UUID, textos semelhantes a JSON, booleanos e revisao com mysql2',async()=>{
  const ctx=await appFixture();try {
    for (const title of ['Produto 3D','123','true','null','"Texto entre aspas"','[1,2]','Peça azul 🟦']) {
      const state=snapshot();state.data.name=title;state.data.is_print3d=true;
      const previous=ctx.records.get(PREFIX+ID);
      const saved=await ctx.app.inject({method:'PUT',url:`/admin/product-form-drafts/${ID}`,headers,payload:{revision:previous?.revision || 0,snapshot:state}});
      assert.equal(saved.statusCode,200);
      const list=await ctx.app.inject({url:'/admin/product-form-drafts',headers});
      assert.equal(list.statusCode,200);
      const draft=list.json().drafts[0];
      assert.equal(draft.id,ID);assert.equal(draft.title,title);assert.equal(draft.status,'pending');
      assert.equal(draft.revision,saved.json().revision);assert.equal(draft.is_print3d,true);assert.equal(draft.is_parent,true);
      assert.equal(draft.updated_at,saved.json().updated_at);assert.equal(draft.snapshot,undefined);
    }
    const record=ctx.records.get(PREFIX+ID);record.snapshot.data.is_print3d=false;delete record.snapshot.data.is_parent;
    const draft=(await ctx.app.inject({url:'/admin/product-form-drafts',headers})).json().drafts[0];
    assert.equal(draft.is_print3d,false);assert.equal(draft.is_parent,null);
  }finally{await ctx.close();}
});
test('base do pai fica privada, é retomada após concluir e pode ser removida numa nova confirmação',async()=>{
  const ctx=await appFixture();try {
    const state = snapshot();state.activeSection='files';state.productionSetups.parent={sourceUrl:'https://makerworld.com/model',pieces:10,plates:[]};
    await ctx.app.inject({method:'PUT',url:`/admin/product-form-drafts/${ID}`,headers,payload:{revision:0,snapshot:state}});
    const url=`/admin/product-form-drafts/templates/${ID}`;
    assert.equal((await ctx.app.inject({url,headers})).json().setup,null,'Pending drafts are not the confirmed parent base');
    await ctx.app.inject({method:'PATCH',url:`/admin/product-form-drafts/${ID}`,headers,payload:{revision:1,status:'completed',savedProductId:ID}});
    assert.deepEqual((await ctx.app.inject({url,headers})).json().setup,state.productionSetups.parent);
    assert.equal((await ctx.app.inject({url})).statusCode,401);
    await ctx.app.inject({method:'PUT',url:`/admin/product-form-drafts/${FILE_ID}`,headers,payload:{revision:0,snapshot:snapshot()}});
    await ctx.app.inject({method:'PATCH',url:`/admin/product-form-drafts/${FILE_ID}`,headers,payload:{revision:1,status:'completed',savedProductId:ID}});
    assert.equal((await ctx.app.inject({url,headers})).json().setup,null,'Clearing the base must not resurrect an older template');
  }finally{await ctx.close();}
});
test('cadastro incompleto e família são salvos fora do catálogo e retomados sem validar campos de publicação',async()=>{
  const ctx=await appFixture();
  try {
    let result=await ctx.app.inject({method:'PUT',url:`/admin/product-form-drafts/${ID}`,headers,payload:{revision:0,snapshot:snapshot()}});
    assert.equal(result.statusCode,200);assert.equal(result.json().revision,1);
    result=await ctx.app.inject({url:`/admin/product-form-drafts/${ID}`,headers});
    assert.deepEqual(result.json().snapshot,snapshot());
    assert.deepEqual(result.json().snapshot.data.images,['https://example.com/parent.webp']);
    assert.deepEqual(result.json().snapshot.familyRows[0].data.images,['https://example.com/child.webp']);
    assert.equal(result.json().snapshot.familyRows[0].data.price_retail,109000);
    result=await ctx.app.inject({url:'/admin/product-form-drafts',headers});
    assert.equal(result.json().drafts[0].title,'Anúncio sem título');assert.equal(result.json().drafts[0].is_parent,true);
    assert.equal(result.json().drafts[0].snapshot,undefined,'List does not return heavy snapshots or private identifiers');
    assert(ctx.records.has(PREFIX+ID));
    result=await ctx.app.inject({method:'PUT',url:`/admin/product-form-drafts/${ID}`,headers,payload:{revision:0,snapshot:{...snapshot(),data:{name:'stale'}}}});
    assert.equal(result.statusCode,409);assert.equal(ctx.records.get(PREFIX+ID).snapshot.data.name,'');
  } finally {await ctx.close();}
});
test('salvamento automático mantém a URL recuperável sem remontar o formulário durante a edição',()=>{
  const page=fs.readFileSync('pages/admin/products/ProductFormPage.tsx','utf8');
  const form=fs.readFileSync('components/products/ProductForm.tsx','utf8');
  assert.match(form,/window\.setTimeout\(\(\) => \{/);
  assert.match(form,/void persistDraft\(snapshot, signature\)/);
  assert.match(form,/familyMediaBusy \|\| isCompressing \|\| familyLoading \|\| familyPhotoLoading/);
  assert.match(form,/draftSaveStatus === 'error'/);
  assert.match(page,/draftSaveQueue\.current\.then/);
  assert.match(page,/search\.set\('draft', draft\.id\)/);
  assert.match(page,/window\.history\.replaceState/);
  assert.match(form,/setImagePreviews\(initialData\.images \|\| \[\]\)/);
  assert.doesNotMatch(form, /onInputCapture=\{markDraftEdited\}/, 'Capturar input antes de onChange apaga o EAN controlado a cada tecla');
});

test('todos os atalhos resolvem o mesmo cadastro por ID, sem procurar pelo nome', async () => {
  const calls = [];
  let parents=[];
  const client = { post: async (path,body) => { calls.push({path,body}); return {draftId:ID}; } };
  const context={exports:{},File,Blob,crypto:require('node:crypto').webcrypto,FormData,console,fetch:()=>{throw Error('Nao baixar arquivos');},require:name=>{
    if(name.endsWith('/vpsClient'))return {vpsClient:client};
    if(name.endsWith('/authSession'))return {getAuthSessionToken:async()=> 'test'};
    if(name.endsWith('/vpsProxyBase'))return {buildVpsUrl:value=>value};
    if(name.endsWith('/products'))return {productService:{listParentsByModel:async()=>parents}};
    throw Error(name);
  }};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('services/productFormDrafts.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
  const service=context.exports.productFormDraftsService;
  assert.equal(await service.resolveFamilyWorkspace(FILE_ID),`/admin/products/new?draft=${ID}#variations`);
  assert.equal(calls[0].path,`/admin/product-form-drafts/family/${FILE_ID}`);
  parents=[{id:ID}]; client.post=async()=>({parentId:ID});
  assert.equal(await service.resolveFamilyWorkspace(FILE_ID),`/admin/products/${ID}#variations`);
  parents=[{id:ID},{id:FILE_ID}];
  await assert.rejects(service.resolveFamilyWorkspace(FILE_ID),/mais de um pai/);
  parents=[];client.post=async()=>{throw Error('offline');};
  await assert.rejects(service.resolveFamilyWorkspace(FILE_ID),/offline/);
});

test('cadastro único reutiliza o rascunho e cria sob trava do modelo sem escrever no catálogo', async()=>{
  const ctx=await appFixture(); try {
    const url=`/admin/product-form-drafts/family/${FILE_ID}`;
    assert.equal((await ctx.app.inject({method:'POST',url,payload:{}})).statusCode,401);
    const first=await ctx.app.inject({method:'POST',url,headers,payload:{}});
    assert.equal(first.statusCode,200,first.body);
    const again=await ctx.app.inject({method:'POST',url,headers,payload:{}});
    assert.equal(again.json().draftId,first.json().draftId);
    assert.equal(ctx.records.size,1);
    const row=ctx.records.get(PREFIX+first.json().draftId);
    assert.equal(row.canonical_model_id,FILE_ID); assert.equal(row.snapshot.data.model_id,FILE_ID);
    assert.equal(row.snapshot.data.track_inventory,false);
    assert(ctx.queries.some(sql=>sql.includes('FROM models')&&sql.includes('FOR UPDATE')));
    assert(!ctx.queries.some(sql=>/^(UPDATE|INSERT).*products\b/.test(sql)));
    const saved=await ctx.app.inject({method:'PUT',url:`/admin/product-form-drafts/${row.id}`,headers,payload:{revision:row.revision,snapshot:{...row.snapshot,data:{...row.snapshot.data,images:['https://example.com/pai.webp'],specs:{unit:'UN',production:'third_party'}}}}});
    assert.equal(saved.statusCode,200,saved.body);
    const restored=(await ctx.app.inject({url:`/admin/product-form-drafts/${row.id}`,headers})).json();
    assert.equal(restored.snapshot.data.specs.unit,'UN');assert.equal(restored.snapshot.data.images.length,1);
    assert.equal((await ctx.app.inject({method:'PATCH',url:`/admin/product-form-drafts/${row.id}`,headers,payload:{revision:saved.json().revision,status:'completed',savedProductId:ID}})).statusCode,200);
  }finally{await ctx.close();}
});

test('duplicados antigos exigem base explícita, preservam histórico e links antigos retomam a fonte única', async()=>{
  const ctx=await appFixture();try {
    const source={id:ID,revision:1,title:'Poco',status:'pending',snapshot:snapshot()};source.snapshot.data.model_id=FILE_ID;
    const old={...structuredClone(source),id:FILE_ID};
    ctx.records.set(PREFIX+ID,source);ctx.records.set(PREFIX+FILE_ID,old);
    const url=`/admin/product-form-drafts/family/${FILE_ID}`;
    assert.equal((await ctx.app.inject({method:'POST',url,headers,payload:{}})).statusCode,409);
    assert.equal((await ctx.app.inject({method:'POST',url,headers,payload:{sourceDraftId:ID,expectedRevision:0}})).statusCode,409);
    const result=await ctx.app.inject({method:'POST',url,headers,payload:{sourceDraftId:ID,expectedRevision:1}});
    assert.equal(result.statusCode,200,result.body);assert.equal(result.json().draftId,ID);
    assert.equal(ctx.records.get(PREFIX+FILE_ID).status,'archived');
    assert.deepEqual(ctx.records.get(PREFIX+FILE_ID).snapshot,old.snapshot);
    assert.equal((await ctx.app.inject({url:`/admin/product-form-drafts/${FILE_ID}`,headers})).json().id,ID);
    const stale=await ctx.app.inject({method:'PUT',url:`/admin/product-form-drafts/${FILE_ID}`,headers,payload:{revision:2,snapshot:old.snapshot}});
    assert.equal(stale.statusCode,409);
    assert.deepEqual(ctx.records.get(PREFIX+ID).snapshot,source.snapshot);
  }finally{await ctx.close();}
});
test('rascunhos e arquivos exigem administrador; concluir/arquivar remove apenas da fila e preserva conteúdo',async()=>{
  const ctx=await appFixture();try {
    for(const url of ['/admin/product-form-drafts',`/admin/product-form-drafts/${ID}`,`/admin/product-form-drafts/${ID}/files/${FILE_ID}`])assert.equal((await ctx.app.inject({url})).statusCode,401);
    assert.equal((await ctx.app.inject({method:'PUT',url:`/admin/product-form-drafts/${ID}`,payload:{revision:0,snapshot:snapshot()}})).statusCode,401);
    await ctx.app.inject({method:'PUT',url:`/admin/product-form-drafts/${ID}`,headers,payload:{revision:0,snapshot:snapshot()}});
    let result=await ctx.app.inject({method:'PATCH',url:`/admin/product-form-drafts/${ID}`,headers,payload:{revision:1,status:'completed',savedProductId:FILE_ID}});
    assert.equal(result.statusCode,200);assert.equal(result.json().status,'completed');
    assert.deepEqual((await ctx.app.inject({url:'/admin/product-form-drafts',headers})).json().drafts,[]);
    assert(ctx.records.get(PREFIX+ID).snapshot);
    assert.equal((await ctx.app.inject({method:'PUT',url:`/admin/product-form-drafts/${ID}`,headers,payload:{revision:2,snapshot:snapshot()}})).statusCode,409);
    assert.throws(()=>validateSnapshot({...snapshot(),schemaVersion:2}),/inválido/);
    assert.equal((await ctx.app.inject({url:'/admin/product-form-drafts/not-a-uuid',headers})).statusCode,400);
  }finally{await ctx.close();}
});
test('arquivos privados sobrevivem ao rascunho; referências ausentes e acesso a arquivos de outra família falham',async()=>{
  const ctx=await appFixture();try {
    const body=Buffer.from(`--draft-boundary\r\nContent-Disposition: form-data; name="file"; filename="plate.stl"\r\nContent-Type: application/octet-stream\r\n\r\nsolid test\r\n--draft-boundary--\r\n`);
    const state=snapshot();state.productionSetups.single={plates:[{files:[{file:{__productDraftFile:FILE_ID,name:'plate.stl',type:'',size:10,lastModified:1}}]}]};
    assert.equal((await ctx.app.inject({method:'PUT',url:`/admin/product-form-drafts/${ID}`,headers,payload:{revision:0,snapshot:state}})).statusCode,409);
    const uploaded=await ctx.app.inject({method:'POST',url:`/admin/product-form-drafts/${ID}/files/${FILE_ID}`,headers:{...headers,'content-type':'multipart/form-data; boundary=draft-boundary'},payload:body});
    assert.equal(uploaded.statusCode,200);
    const uploadAgain = payload => ctx.app.inject({method:'POST',url:`/admin/product-form-drafts/${ID}/files/${FILE_ID}`,headers:{...headers,'content-type':'multipart/form-data; boundary=draft-boundary'},payload});
    assert.equal((await uploadAgain(body)).statusCode,200,'Retrying the same upload must be safe');
    assert.equal((await uploadAgain(Buffer.from(body.toString().replace('solid test','other data')))).statusCode,409,'A second tab must not replace an immutable draft file');
    await ctx.app.inject({method:'PUT',url:`/admin/product-form-drafts/${ID}`,headers,payload:{revision:0,snapshot:state}});
    const downloaded=await ctx.app.inject({url:`/admin/product-form-drafts/${ID}/files/${FILE_ID}`,headers});
    assert.equal(downloaded.statusCode,200);assert.equal(downloaded.body,'solid test');
    assert.equal((await ctx.app.inject({url:`/admin/product-form-drafts/${ID}/files/${ID}`,headers})).statusCode,404);
    assert.equal((await ctx.app.inject({url:`/admin/product-form-drafts/${ID}/files/${FILE_ID}`})).statusCode,401);
    state.productionSetups.parent = state.productionSetups.single;
    await ctx.app.inject({method:'PUT',url:`/admin/product-form-drafts/${ID}`,headers,payload:{revision:1,snapshot:state}});
    await ctx.app.inject({method:'PATCH',url:`/admin/product-form-drafts/${ID}`,headers,payload:{revision:2,status:'completed',savedProductId:ID}});
    assert.deepEqual((await ctx.app.inject({url:`/admin/product-form-drafts/templates/${ID}`,headers})).json().setup,state.productionSetups.parent);
    assert.equal((await ctx.app.inject({url:`/admin/product-form-drafts/${ID}/files/${FILE_ID}`,headers})).body,'solid test','Parent files remain available after completing the registration');
  }finally{await ctx.close();}
});
test('File é serializado separado do JSON e reconstituído em outro computador sem perder tipo, nome ou conteúdo',async()=>{
  const context={exports:{},File,Blob,crypto:require('node:crypto').webcrypto,FormData,fetch,console,require:name=>{
    if(name.endsWith('/vpsClient'))return {vpsClient:{}};
    if(name.endsWith('/authSession'))return {getAuthSessionToken:async()=> 'test'};
    if(name.endsWith('/vpsProxyBase'))return {buildVpsUrl:value=>value};
    if(name.endsWith('/products'))return {productService:{}};
    throw Error(name);
  }};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('services/productFormDrafts.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
  const {encodeDraftFiles,decodeDraftFiles}=context.exports;
  const file=new File(['solid test'],'plate.stl',{type:'application/octet-stream',lastModified:42});
  const uploaded=new Map();let calls=0;
  const upload=async(id,file)=>{calls++;uploaded.set(id,file);};
  const encoded=await encodeDraftFiles({production:{plates:[{files:[{file}]}]},videoFile:file},upload,ID);
  assert.equal(calls,1);assert(encoded.production.plates[0].files[0].file.__productDraftFile);
  const restored=await decodeDraftFiles(JSON.parse(JSON.stringify(encoded)),async id=>uploaded.get(id),ID);
  assert(restored.videoFile instanceof File);assert.equal(await restored.videoFile.text(),'solid test');assert.equal(restored.videoFile.lastModified,42);
  await encodeDraftFiles(restored,upload,ID);assert.equal(calls,1,'Resume and save should not reupload unchanged files');
  await encodeDraftFiles(restored,upload,FILE_ID);assert.equal(calls,3,'A different draft gets its own file namespace');
  await assert.rejects(decodeDraftFiles(encoded,async()=>new Blob(['x']),ID),/incompleto/);
});
test('UI permite salvar sem submit, captura variação não incluída e mantém a validação normal ao concluir',()=>{
  const form=fs.readFileSync('components/products/ProductForm.tsx','utf8'),page=fs.readFileSync('pages/admin/products/ProductFormPage.tsx','utf8');
  assert.match(form,/type="button" onClick=\{\(\) => void saveDraft\(\)\}/);
  const save=form.slice(form.indexOf('const saveDraft = async'),form.indexOf('return (',form.indexOf('const saveDraft = async')));
  assert(!save.includes('handleSubmit'));assert(!save.includes('productService'));
  assert.match(form,/familyEditor: familyEditorDraftRef.current\?\.\(\)/);
  assert.match(form,/initialDraft\?\.productionSetups/);assert.match(form,/initialDraft\?\.familyCheckpoint/);
  assert.match(page,/productFormDraftsService.get\(resumeDraftId\)/);
  assert.match(page,/await handleSaveDraft\(snapshot\)[\s\S]*?setStatus/);
  const completionRetry = form.slice(form.indexOf('if (registrationCompletedRef.current)'), form.indexOf("console.log('🔍 [ProductForm] Form data received:"));
  assert.match(completionRetry,/await onBatchComplete/);assert(!completionRetry.includes('productService'));assert(!completionRetry.includes('unitService'));
  assert.match(page,/loadedDraft\?\.snapshot.completion/);
  const route=fs.readFileSync('routes/index.tsx','utf8');assert.match(route,/path: "\/admin\/products\/drafts"[\s\S]*?ProtectedRoute requireAdmin=\{true\}/);
});
