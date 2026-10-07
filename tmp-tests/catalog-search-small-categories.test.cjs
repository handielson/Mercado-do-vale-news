const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');

const source=fs.readFileSync('pages/catalog/index.tsx','utf8');
const callback=source.split('const searchCategorySections = useMemo(() => {')[1]
  .split('}, [hasActiveSearch, filters.categories, productGroups, filterStats?.categories]);')[0];
const js=ts.transpileModule(callback,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const buildSections=new Function('hasActiveSearch','filters','productGroups','filterStats',js);
const group=(id,category)=>({id,representativeProduct:{category_id:category}});

test('busca preserva Redmi 15 e categorias com um ou dois modelos entre acessorios',()=>{
  const groups=[group('capa1','capas'),group('capa2','capas'),group('capa3','capas'),
    group('pelicula1','peliculas'),group('pelicula2','peliculas'),group('pelicula3','peliculas'),
    group('redmi15','celulares'),group('redmi15c','celulares'),group('carregador','fontes')];
  const sections=buildSections(true,{categories:[]},groups,{categories:[{id:'celulares',name:'Celulares'}]});
  assert.deepEqual(sections.flatMap(section=>section.groups.map(g=>g.id)),groups.map(g=>g.id));
  assert.equal(sections.find(s=>s.categoryId==='celulares').categoryName,'Celulares');
  assert.equal(sections.find(s=>s.categoryId==='fontes').groups.length,1);
});

test('busca preserva produto sem categoria em secao de produtos',()=>{
  const sections=buildSections(true,{categories:[]},[group('sem-categoria',null)],{categories:[]});
  assert.equal(sections.length,1);
  assert.equal(sections[0].groups[0].id,'sem-categoria');
});

test('sem busca ou com categoria selecionada mantem a grade existente',()=>{
  assert.deepEqual(buildSections(false,{categories:[]},[],{}),[]);
  assert.deepEqual(buildSections(true,{categories:['celulares']},[],{}),[]);
});
