const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync('pages/admin/products/ProductListPage.tsx','utf8');
const header = source.slice(source.indexOf('            {/* Header */}'),source.indexOf('            {/* Refreshing banner'));
const jsx = (type,props) => ({type,props});
const walk = node => !node || typeof node !== 'object' ? [] : [node,...[node.props?.children].flat().flatMap(walk)];
const text = node => typeof node === 'string' ? node : !node || typeof node !== 'object' ? '' : [node.props?.children].flat().map(text).join('');
function render(overrides={}) {
  const calls=[];
  const context={exports:{}, require:()=>({jsx,jsxs:jsx,Fragment:'fragment'}),productActionClass:'neutral',
    Plus:'icon',Package:'icon',Share2:'icon',Images:'icon',RefreshCw:'icon',Video:'icon',CheckSquare:'icon',XSquare:'icon',Barcode:'icon',Store:'icon',Camera:'icon',FileText:'icon',Print3dProductEntry:'3d-entry',
    selectionMode:false,isRefreshing:false,isGeneratingVideos:false,cacheAge:null,
    navigate:path=>calls.push(path),setIsExportModalOpen:()=>calls.push('export'),handleNewProduct:()=>calls.push('new'),handleRefresh:()=>calls.push('refresh'),handleBulkRegistration:()=>calls.push('bulk'),handleAutoGenerateVideos:()=>calls.push('video'),handleExitSelection:()=>calls.push('exit-selection'),setSelectionMode:()=>calls.push('selection'),...overrides};
  const code=ts.transpileModule('exports.tree=(<>'+header+'</>);',{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,context); return {tree:context.exports.tree,calls};
}
test('product action groups keep every route and existing handler reachable',()=>{
  const f=render(),nodes=walk(f.tree),groups=nodes.filter(n=>n.type==='section');
  assert.equal(groups.length,3);
  assert.deepEqual(groups.map(g=>text(walk(g).find(n=>n.type==='h2'))),['Cadastro','Sites e vendas','Mídia e impressão']);
  assert(walk(groups[0]).some(n=>n.type==='3d-entry' && n.props.className==='neutral'));
  for(const [label,target] of Object.entries({'Rascunhos de anúncios':'/admin/products/drafts','Cadastro em Massa':'bulk','Smartphones por Foto':'/admin/products/photo-intake','Sites e preços':'/admin/products/storefronts','Ofertas':'/admin/products/offers','Combos':'/admin/products/combos','Etiquetas':'/admin/products/labels','Exportar Catálogo':'export','Banco de Imagens':'/admin/products/image-bank','Gerar Links de Vídeo':'video','Novo Produto':'new','Atualizar':'refresh','Selecionar':'selection'})) {
    const button=nodes.find(n=>n.type==='button' && text(n).trim()===label); assert(button,label); button.props.onClick(); assert.equal(f.calls.at(-1),target);
  }
});
test('busy actions and exit-selection behavior survive the menu reorganization',()=>{
  const f=render({isRefreshing:true,isGeneratingVideos:true,selectionMode:true}),nodes=walk(f.tree);
  assert(nodes.find(n=>n.type==='button' && text(n).includes('Atualizando')).props.disabled);
  assert(nodes.find(n=>n.type==='button' && text(n).includes('Gerando links')).props.disabled);
  const exit=nodes.find(n=>n.type==='button' && text(n)==='Cancelar seleção');exit.props.onClick();assert.equal(f.calls.at(-1),'exit-selection');
});
