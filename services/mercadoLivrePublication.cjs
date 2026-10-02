const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

const fail = (message, statusCode = 409) => Object.assign(new Error(message), { statusCode });
const object = v => v && typeof v === 'object' && !Array.isArray(v);
function catalogMeasures(product) {
  let dimensions=product.dimensions;
  if(typeof dimensions==='string') {try{dimensions=JSON.parse(dimensions);}catch{dimensions=null;}}
  const positive=v=>Number.isFinite(Number(v)) && Number(v)>0;
  return {
    ...(positive(product.weight_kg)?{grams:Math.ceil(Number(product.weight_kg)*1000)}:{}),
    ...(object(dimensions) && ['height_cm','width_cm','depth_cm'].every(k=>positive(dimensions[k]))?{height:Math.ceil(Number(dimensions.height_cm)),width:Math.ceil(Number(dimensions.width_cm)),length:Math.ceil(Number(dimensions.depth_cm))}:{})
  };
}
const https = v => { try { const u = new URL(v); return u.protocol === 'https:' && !u.username && !u.password; } catch { return false; } };
const PRODUCT_COLUMNS = `id,sku,name,description,
  (SELECT b.name FROM brands b WHERE CAST(b.id AS CHAR)=products.brand OR b.name=products.brand LIMIT 1) AS brand,
  (SELECT m.name FROM models m WHERE m.id=products.model_id LIMIT 1) AS model_name,
  warranty_type,
  CASE warranty_type
    WHEN 'brand' THEN (SELECT b.warranty_days FROM brands b WHERE CAST(b.id AS CHAR)=products.brand OR b.name=products.brand LIMIT 1)
    WHEN 'category' THEN (SELECT c.warranty_days FROM categories c WHERE c.id=products.category_id LIMIT 1)
  END AS warranty_days,
  JSON_UNQUOTE(JSON_EXTRACT(specs,'$.color')) AS color,
  products.\`condition\`,weight_kg,dimensions,
  products.category_id,products.model_id,
  JSON_EXTRACT(specs,'$.mercado_livre') AS ml_product,
  (SELECT JSON_EXTRACT(p.specs,'$.mercado_livre') FROM products p WHERE p.id=products.parent_id LIMIT 1) AS ml_parent,
  (SELECT JSON_EXTRACT(m.template_values,'$.mercado_livre') FROM models m WHERE m.id=products.model_id LIMIT 1) AS ml_model,
  (SELECT JSON_OBJECT('category_id',JSON_UNQUOTE(JSON_EXTRACT(c.config,'$.mercado_livre.category_id'))) FROM categories c WHERE c.id=products.category_id LIMIT 1) AS ml_category,
  ean,alternative_eans,images,price_retail,stock_quantity,status,is_parent,parent_id,is_virtual,is_gift,is_combo`;
function publicProduct(row) {
  const jsonArray = value => { try { const v=typeof value==='string'?JSON.parse(value):value;return Array.isArray(v)?v:[]; } catch {return [];} };
  const {ml_product,ml_parent,ml_model,ml_category,...product}=row;
  const own=jsonObject(ml_product),parent=jsonObject(ml_parent),model=jsonObject(ml_model),category=jsonObject(ml_category);
  const categoryId=own.category_id || parent.category_id || model.category_id || category.category_id;
  const attrs=data=>data.category_id===categoryId && object(data.attributes)?Object.fromEntries(Object.entries(data.attributes).filter(([id,value])=>/^[A-Z][A-Z0-9_]*$/.test(id) && typeof value==='string')):{};
  const definitions=Array.isArray(category.attributes)?category.attributes:[];
  const attributes={...reusableAttributes(attrs(model),definitions),...reusableAttributes(attrs(parent),definitions),...attrs(own)};
  return {...product,images:jsonArray(row.images).filter(https),eans:jsonArray(row.alternative_eans).filter(v=>typeof v==='string'),...(/^MLB\d+$/.test(categoryId || '')?{mercado_livre:{categoryId,attributes}}:{})};
}
function jsonObject(value) {try{const parsed=typeof value==='string'?JSON.parse(value):value;return object(parsed)?parsed:{};}catch{return {};}}
const managedAttribute=id=>['GTIN','SELLER_SKU','ITEM_CONDITION'].includes(id) || id.startsWith('SELLER_PACKAGE_') || id.startsWith('PACKAGE_');
function reusableAttributes(attributes,definitions) {
  return Object.fromEntries(Object.entries(attributes || {}).filter(([id])=>{
    const def=definitions.find(a=>a.id===id);
    return !managedAttribute(id) && !['COLOR','MAIN_COLOR','PATTERN_NAME','SIZE'].includes(id) && !/ANATEL|INMETRO/i.test(id) && !def?.tags?.read_only && !def?.tags?.allow_variations && !def?.tags?.variation_attribute;
  }));
}
function serializeAttribute(id,value_name,definitions,condition) {
  const def=definitions.find(d=>d.id===id);
  if(value_name==='__ML_NOT_APPLICABLE__') {
    if(!def || def.tags?.allow_variations || def.tags?.required || (condition==='new' && def.tags?.new_required)) throw fail(`Não se aplica não permitido: ${def?.name || id}.`);
    return {id,value_id:'-1',value_name:null};
  }
  if(def?.value_max_length && value_name.length>def.value_max_length) throw fail(`Valor excede o limite: ${def.name || id}.`);
  const option=def?.values?.find(v=>v.name===value_name);
  if(def?.value_type==='boolean' && !option) throw fail(`Selecione uma opção oficial: ${def.name || id}.`);
  if(def?.value_type==='number' && !/^-?\d+(?:[.,]\d+)?$/.test(value_name)) throw fail(`Informe um número: ${def.name || id}.`);
  if(def?.value_type==='number_unit') {
    const parts=value_name.match(/^(-?\d+(?:[.,]\d+)?)\s+(.+)$/);
    if(!parts || !def.allowed_units?.some(u=>u.id===parts[2])) throw fail(`Confira valor e unidade: ${def.name || id}.`);
  }
  return {id,...(option?{value_id:option.id}:{}),value_name};
}
const modeOf = profile => { if (!Array.isArray(profile.tags)) throw fail('Modelo da conta indisponível.'); return profile.tags.includes('user_product_seller') ? 'user_products' : 'legacy'; };

// Percentages use basis points, money uses integer cents. All deductions round up.
function pricingPolicy(input) {
  if (!object(input)) throw fail('Configure a política de margem líquida.');
  const result={};
  for(const key of ['marginBps','taxBps','adsBps','otherBps','packagingCents','shippingCents','otherFixedCents']) {
    if(!Number.isSafeInteger(input[key]) || input[key]<0 || input[key]>1000000000) throw fail(`Configure ${key}; despesas ausentes não serão tratadas como zero.`);
    result[key]=input[key];
  }
  if(result.marginBps+result.taxBps+result.adsBps+result.otherBps>=10000) throw fail('Margem e despesas percentuais precisam somar menos de 100%.');
  if(!['fulfillment','cross_docking','drop_off','xd_drop_off','self_service','custom'].includes(input.logisticType)) throw fail('Informe a modalidade logística usada na cotação.');
  if(!Number.isSafeInteger(input.billableWeightGrams) || input.billableWeightGrams<1 || input.billableWeightGrams>1000000) throw fail('Informe o peso faturável em gramas, incluindo o peso volumétrico aplicável.');
  return {...result,logisticType:input.logisticType,billableWeightGrams:input.billableWeightGrams};
}
const roundedRatio=(amount,numerator,denominator)=>{
  const result=(BigInt(amount)*BigInt(numerator)+BigInt(denominator)-1n)/BigInt(denominator);
  if(result>BigInt(Number.MAX_SAFE_INTEGER)) throw fail('Preço excede o limite seguro.');
  return Number(result);
};
function pricingBreakdown(priceCents,costCents,policy,fees) {
  if(!Number.isSafeInteger(costCents) || costCents<=0) throw fail('Cadastre um custo de compra positivo antes de calcular o anúncio.');
  if(!Number.isSafeInteger(priceCents) || priceCents<1) throw fail('Preço inválido.');
  const result={priceCents,costCents,saleFeeCents:fees.saleFeeCents,listingFeeCents:fees.listingFeeCents,
    packagingCents:policy.packagingCents,shippingCents:policy.shippingCents,otherFixedCents:policy.otherFixedCents,
    taxCents:roundedRatio(priceCents,policy.taxBps,10000),adsCents:roundedRatio(priceCents,policy.adsBps,10000),otherPercentCents:roundedRatio(priceCents,policy.otherBps,10000)};
  for(const key of ['saleFeeCents','listingFeeCents']) if(!Number.isSafeInteger(result[key]) || result[key]<0) throw fail('Tarifas oficiais indisponíveis.');
  result.profitCents=priceCents-Object.entries(result).filter(([key])=>key!=='priceCents').reduce((sum,[,v])=>sum+v,0);
  result.marginBps=Math.floor(result.profitCents/priceCents*10000);
  result.meetsTarget=BigInt(result.profitCents)*10000n>=BigInt(priceCents)*BigInt(policy.marginBps);
  return result;
}
async function calculatePrice(costCents,input,quote,chosenPriceCents) {
  const policy=pricingPolicy(input);
  if(!Number.isSafeInteger(costCents) || costCents<=0) throw fail('Cadastre um custo de compra positivo antes de calcular o anúncio.');
  const denominator=10000-policy.marginBps-policy.taxBps-policy.adsBps-policy.otherBps;
  const fixed=costCents+policy.packagingCents+policy.shippingCents+policy.otherFixedCents;
  let price=chosenPriceCents ?? roundedRatio(fixed,10000,denominator);
  for(let iteration=0;iteration<50;iteration++) {
    const fees=await quote(price,policy),breakdown=pricingBreakdown(price,costCents,policy,fees);
    if(breakdown.meetsTarget) return {...breakdown,targetMarginBps:policy.marginBps,policy,quotedAt:new Date().toISOString(),feeReference:fees.reference};
    if(chosenPriceCents!==undefined) throw fail('O preço revisado ficou abaixo da margem líquida configurada. Calcule novamente antes de publicar.');
    // Separate percentage deductions can each round up by one cent.
    price=Math.max(price+1,roundedRatio(fixed+fees.saleFeeCents+fees.listingFeeCents+3,10000,denominator));
  }
  throw fail('Não foi possível atingir a margem com as tarifas atuais. Revise a política.');
}
function officialFees(response,listingTypeId,reference) {
  const rows=Array.isArray(response)?response:[response];
  const matches=rows.filter(r=>r?.listing_type_id===listingTypeId);
  if(matches.length!==1 || matches[0].currency_id!=='BRL') throw fail('Cotação oficial de tarifas incompleta ou ambígua.');
  const cents=value=>{
    if(typeof value!=='number' || !Number.isFinite(value) || value<0) throw fail('Tarifa oficial ausente.');
    const amount=Math.ceil(Number((value*100).toFixed(6)));
    if(!Number.isSafeInteger(amount)) throw fail('Tarifa fora do limite.'); return amount;
  };
  // sale_fee_amount already includes sale_fee_details.fixed_fee.
  return {saleFeeCents:cents(matches[0].sale_fee_amount),listingFeeCents:cents(matches[0].listing_fee_amount),reference};
}

function buildPublication(draft, product, mode, category, definitions) {
  if (!draft || draft.productId !== product.id || draft.sku !== product.sku || !product.sku) throw fail('Produto/SKU mudou. Recarregue o catálogo.');
  if (Number(product.is_parent) || Number(product.is_virtual) || Number(product.is_gift) || Number(product.is_combo) || product.status !== 'active') throw fail('Selecione um produto ativo ou uma variante individual vendável. Kits com estoque composto precisam de revisão específica.');
  const fields = draft.fields || {};
  const value = name => fields[name]?.value;
  const confirmed = name => {
    const f = fields[name];
    if (!f?.confirmed || f.conflict || !Array.isArray(f.sources) || !f.sources.length || f.sources.some(s => !s?.reference)) throw fail(`Confira o campo ${name} e suas fontes.`);
    return f.value;
  };
  for (const name of ['description','categoryId','condition','priceCents','quantity','photos','attributes','commercialPolicy',mode === 'legacy' ? 'title' : 'familyName']) confirmed(name);
  if (!category || category.id !== value('categoryId') || category.settings?.listing_allowed !== true) throw fail('Categoria indisponível para publicação.');
  if (!Array.isArray(definitions)) throw fail('Atributos oficiais indisponíveis.');
  if (!['new','used','not_specified'].includes(value('condition')) || (Array.isArray(category.settings?.item_conditions) && !category.settings.item_conditions.includes(value('condition')))) throw fail('Condição inválida para esta categoria.');
  if (!Number.isSafeInteger(value('priceCents')) || value('priceCents') < 1 || !Number.isSafeInteger(value('quantity')) || value('quantity') < 1 || !Number.isSafeInteger(Number(product.stock_quantity)) || value('quantity') > Number(product.stock_quantity)) throw fail('Preço ou estoque inválido; quantidade excede o saldo atual.');
  if (value('variations')?.length) throw fail('Publique cada variante individualmente nesta etapa.');
  const photos = value('photos');
  if (!Array.isArray(photos) || !photos.length || photos.some(p => !https(p?.url) || !['own','authorized'].includes(p.rights) || !p.evidence)) throw fail('Confira fotos próprias ou autorizadas.');
  const attributes = value('attributes');
  if (!object(attributes) || Object.values(attributes).some(v => typeof v !== 'string' || !v.trim())) throw fail('Preencha os atributos com valores de texto verificados.');
  for (const def of definitions.filter(d => d.tags?.required || (value('condition')==='new' && d.tags?.new_required))) {
    if (!attributes[def.id] && !(def.id === 'GTIN' && value('gtin'))) throw fail(`Atributo obrigatório: ${def.name || def.id}.`);
  }
  for (const id of Object.keys(attributes)) {
    if (id !== 'SELLER_SKU' && !definitions.some(d => d.id === id && !d.tags?.read_only && !d.tags?.fixed && !d.tags?.inferred)) throw fail(`Atributo não permitido: ${id}.`);
    if (/ANATEL|INMETRO/i.test(id)) {
      const cert = confirmed('certificates')?.[id];
      if (!cert?.number || cert.number !== attributes[id] || !https(cert.evidence) || !fields.certificates.sources.some(s => ['official_document','official_catalog','manufacturer'].includes(s.kind))) throw fail(`Certificação oficial pendente: ${id}.`);
    }
  }
  const gtin = value('gtin') || attributes.GTIN;
  if (gtin) {
    if (confirmed('gtin') !== gtin || (attributes.GTIN && attributes.GTIN !== gtin) || !fields.gtin.sources.some(s => ['catalog','manufacturer','official_catalog','official_document'].includes(s.kind))) throw fail('GTIN exige cadastro conferido ou fonte oficial.');
    if (!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(gtin)) throw fail('GTIN inválido.');
    let sum=0; for(let i=gtin.length-2,w=3;i>=0;i--,w=w===3?1:3) sum+=Number(gtin[i])*w;
    if ((10-sum%10)%10 !== Number(gtin.at(-1))) throw fail('Dígito do GTIN inválido.');
  }
  const policy = value('commercialPolicy');
  if (!object(policy) || !policy.listingTypeId || !policy.warranty || !policy.shipping?.mode || typeof policy.shipping.freeShipping !== 'boolean' || !['seller','buyer'].includes(policy.shipping.payer)) throw fail('Confira tipo de anúncio, frete e garantia.');
  if (policy.shipping.freeShipping !== (policy.shipping.payer === 'seller')) throw fail('Regra de frete inconsistente.');
  const title = confirmed(mode === 'legacy' ? 'title' : 'familyName');
  if (typeof title !== 'string' || !title.trim() || title.length > (Number(category.settings?.max_title_length) || 60)) throw fail('Título/nome da família excede o limite da categoria.');
  if (typeof value('description') !== 'string' || !value('description').trim() || value('description').length > 50000) throw fail('Descrição inválida.');
  const measures=catalogMeasures(product),packageAttributes={};
  for(const [id,key,unit] of [['SELLER_PACKAGE_HEIGHT','height','cm'],['SELLER_PACKAGE_WIDTH','width','cm'],['SELLER_PACKAGE_LENGTH','length','cm'],['SELLER_PACKAGE_WEIGHT','grams','g']]) {
    if(measures[key] && definitions.some(d=>d.id===id && !d.tags?.read_only)) packageAttributes[id]=`${measures[key]} ${unit}`;
  }
  return { site_id:'MLB', category_id:category.id, currency_id:'BRL', buying_mode:'buy_it_now',
    price:value('priceCents')/100, available_quantity:value('quantity'), condition:value('condition'), listing_type_id:policy.listingTypeId,
    [mode === 'legacy' ? 'title' : 'family_name']:title,
    pictures:photos.map(p => ({source:p.url})),
    attributes:Object.entries({...attributes,...packageAttributes,...(gtin ? {GTIN:gtin} : {}),SELLER_SKU:product.sku}).map(([id,value_name]) => serializeAttribute(id,value_name,definitions,value('condition'))),
    sale_terms:[{id:'WARRANTY_TYPE',value_name:policy.warranty},...(policy.warrantyTime ? [{id:'WARRANTY_TIME',value_name:policy.warrantyTime}] : [])], shipping:{mode:policy.shipping.mode,free_shipping:policy.shipping.freeShipping} };
}

function createFileJournal(directory = process.env.MERCADO_LIVRE_PUBLICATION_DIR || path.join(os.homedir(),'.mdv','mercado-livre-publications')) {
  const filename = key => path.join(directory,`${crypto.createHash('sha256').update(key).digest('hex')}.json`);
  return {
    async read(key) { try { return JSON.parse(await fs.readFile(filename(key),'utf8')); } catch(e) { if(e.code==='ENOENT') return null; throw e; } },
    async write(key,value) { await fs.mkdir(directory,{recursive:true}); const temp=`${filename(key)}.${crypto.randomUUID()}.tmp`; await fs.writeFile(temp,JSON.stringify(value),{mode:0o600}); await fs.rename(temp,filename(key)); },
  };
}

function createPublicationHandlers({pool,settings,request,listingRows,journal=createFileJournal()}) {
  const snapshots=new Map();
  const account = async () => { const s=await settings(); if(!/^\d+$/.test(String(s.user_id || ''))) throw fail('Conecte a conta Mercado Livre.'); const p=await request(`/users/${s.user_id}`); if(String(p.id)!==String(s.user_id)) throw fail('Conta não corresponde à conexão.'); return {sellerId:String(p.id),nickname:p.nickname,mode:modeOf(p)}; };
  const inventory = async seller => {
    const rows=[]; let cursor='',seen=0,expected=null; const cursors=new Set(),itemIds=new Set();
    for(let page=0;page<1000;page++) {
      const query=new URLSearchParams({search_type:'scan',limit:'100'}); if(cursor) query.set('scroll_id',cursor);
      const search=await request(`/users/${seller}/items/search?${query}`);
      if(!Array.isArray(search.results) || !Number.isSafeInteger(Number(search.paging?.total))) throw fail('Inventário remoto incompleto.');
      if(expected===null) expected=Number(search.paging.total); else if(expected!==Number(search.paging.total)) throw fail('Inventário mudou durante a consulta. Recarregue.');
      for(let offset=0;offset<search.results.length;offset+=5) {
        const ids=search.results.slice(offset,offset+5);
        for(const id of ids) {if(!/^MLB\d+$/.test(id) || itemIds.has(id)) throw fail('ID remoto inválido ou repetido.');itemIds.add(id);}
        const items=await Promise.all(ids.map(id=>request(`/items/${id}?include_attributes=all`)));
        for(let index=0;index<items.length;index++) {const item=items[index];if(String(item.seller_id)!==seller || item.id!==ids[index]) throw fail('Anúncio de outra conta ou identidade divergente.'); rows.push(...listingRows(item));seen++;}
      }
      if(seen===expected) return rows;
      if(seen>expected || !search.results.length || !search.scroll_id || cursors.has(search.scroll_id)) throw fail('Inventário incompleto.');
      cursor=search.scroll_id; cursors.add(cursor);
    }
    throw fail('Inventário excedeu o limite de consulta.');
  };
  const catalog = async () => { const [rows]=await pool.query(`SELECT ${PRODUCT_COLUMNS} FROM products ORDER BY sku,id`); return rows.map(publicProduct); };
  const categoryData = async id => { if(!/^MLB\d+$/.test(id)) throw fail('Categoria inválida.',400); const [category,attributes]=await Promise.all([request(`/categories/${id}`),request(`/categories/${id}/attributes`)]); return {category,attributes}; };
  const live = async body => {
    const a=await account(); if(body.sellerId!==a.sellerId) throw fail('Conta mudou. Recarregue o catálogo.');
    const id=body.draft?.productId; if(!/^[a-f0-9-]{36}$/i.test(id || '')) throw fail('Produto inválido.',400);
    const [products]=await pool.query(`SELECT ${PRODUCT_COLUMNS} FROM products WHERE id=?`,[id]); if(!products.length) throw fail('Produto não encontrado.');
    const product=products[0]; const [sameSku]=await pool.query('SELECT id FROM products WHERE sku=?',[product.sku]); if(sameSku.length!==1) throw fail('SKU local ambíguo.');
    const [links]=await pool.query('SELECT item_id FROM mercado_livre_products WHERE product_id=? OR seller_sku=?',[id,product.sku]);
    if(links.length) throw fail('Produto já vinculado. Revise o anúncio existente.');
    const listings=await inventory(a.sellerId); if(listings.some(l=>l.sku===product.sku)) throw fail('SKU já anunciado, inclusive pausado ou encerrado.');
    const {category,attributes}=await categoryData(body.draft.fields?.categoryId?.value);
    const payload=buildPublication(body.draft,product,a.mode,category,attributes);
    return {...a,product,payload};
  };
  const validate = payload => request('/items/validate',{method:'POST',body:JSON.stringify(payload)});
  const priceFor = async (body,chosenPriceCents) => {
    const a=await account(); if(body.sellerId!==a.sellerId) throw fail('Conta mudou. Recarregue o catálogo.');
    const draft=body.draft,id=draft?.productId;
    if(!/^[a-f0-9-]{36}$/i.test(id || '')) throw fail('Produto inválido.',400);
    const [rows]=await pool.query('SELECT id,sku,price_cost,weight_kg,dimensions FROM products WHERE id=?',[id]);
    if(!rows[0] || rows[0].sku!==draft.sku) throw fail('Produto/SKU mudou.');
    const commercial=draft.fields?.commercialPolicy?.value,categoryId=draft.fields?.categoryId?.value;
    if(!/^MLB\d+$/.test(categoryId || '') || !['gold_special','gold_pro'].includes(commercial?.listingTypeId) || !['me2','custom'].includes(commercial?.shipping?.mode)) throw fail('Defina categoria, tipo do anúncio e modo de envio antes de calcular.');
    const policy=pricingPolicy(chosenPriceCents===undefined ? (body.pricingPolicy || commercial.pricing) : commercial.pricing);
    const measures=catalogMeasures(rows[0]);
    if(measures.grams) policy.billableWeightGrams=measures.grams;
    const pricing=await calculatePrice(Number(rows[0].price_cost),policy,async price=>{
      const query=new URLSearchParams({category_id:categoryId,price:(price/100).toFixed(2),currency_id:'BRL',listing_type_id:commercial.listingTypeId,shipping_mode:commercial.shipping.mode,logistic_type:policy.logisticType,billable_weight:String(policy.billableWeightGrams)});
      const resource=`/sites/MLB/listing_prices?${query}`;
      return officialFees(await request(resource),commercial.listingTypeId,`https://api.mercadolibre.com${resource}`);
    },chosenPriceCents);
    return pricing;
  };
  const snapshot = async () => {
      const a=await account(); const capturedAt=new Date().toISOString(); const products=await catalog(); const listings=await inventory(a.sellerId);
      const [links]=await pool.query('SELECT product_id,item_id,variation_id FROM mercado_livre_products');
      const latest=await settings(); if(String(latest.user_id)!==a.sellerId) throw fail('Conta mudou durante a consulta.');
      return {schema:'mdv.ml.catalog.v1',...a,capturedAt,complete:true,products,links,listings};
  };
  return {
    async discoverCategory(req) {
      const title=req.body?.title;
      if(typeof title!=='string' || title.trim().length<5 || title.length>300)throw fail('Preencha o nome do produto para localizar a categoria.',400);
      const result=await request(`/sites/MLB/domain_discovery/search?${new URLSearchParams({q:title.trim(),limit:'3'})}`);
      if(!Array.isArray(result))throw fail('Preditor de categorias indisponível. Escolha manualmente.');
      const seen=new Set();
      const suggestions=result.filter(row=>/^MLB\d+$/.test(row?.category_id || '') && typeof row.category_name==='string' && !seen.has(row.category_id) && seen.add(row.category_id)).map(row=>({id:row.category_id,name:row.category_name}));
      return {suggestions};
    },
    async browseCategories(req) {
      const parent=req.query?.parentId;
      if(parent!==undefined && !/^MLB\d+$/.test(parent))throw fail('Categoria inválida.',400);
      const result=await request(parent?`/categories/${parent}`:'/sites/MLB/categories');
      if(parent && result?.id!==parent)throw fail('Categoria consultada diverge da seleção.');
      const rows=parent?result?.children_categories:result;
      if(!Array.isArray(rows))throw fail('Lista de categorias indisponível.');
      return {categories:rows.filter(row=>/^MLB\d+$/.test(row?.id || '') && typeof row.name==='string').map(row=>({id:row.id,name:row.name})),parent:parent?{id:result.id,name:result.name}:null};
    },
    async saveCatalogAttributes(req) {
      const id=String(req.params?.productId || ''),body=req.body || {};
      if(!/^[a-f0-9-]{36}$/i.test(id) || !object(body.attributes) || Object.entries(body.attributes).some(([key,value])=>! /^[A-Z][A-Z0-9_]*$/.test(key) || typeof value!=='string' || !value.trim() || value.length>5000)) throw fail('Atributos do cadastro inválidos.',400);
      for(const key of ['saveForFamily','saveForModel','saveCategorySchema']) if(body[key]!==undefined && typeof body[key]!=='boolean') throw fail('Escopo do cadastro inválido.',400);
      const data=await categoryData(body.categoryId);
      const definitions=data.attributes;
      if(!Array.isArray(definitions)) throw fail('Ficha oficial indisponível.');
      for(const [key,value] of Object.entries(body.attributes)) {
        const def=definitions.find(a=>a.id===key);
        if(!def || def.tags?.read_only || def.tags?.fixed || def.tags?.inferred || managedAttribute(key)) throw fail(`Campo do cadastro não permitido: ${key}.`);
        serializeAttribute(key,value,definitions,'new');
      }
      const connection=await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [products]=await connection.query('SELECT id,sku,category_id,model_id,is_parent,specs FROM products WHERE id=? FOR UPDATE',[id]);
        const product=products[0];if(!product) throw fail('Produto não encontrado.',404);
        if(body.saveCategorySchema && body.expectedCategoryId!==undefined && body.expectedCategoryId!==product.category_id) throw fail('Salve primeiro a alteração da categoria local do produto.');
        if(body.saveForModel && body.expectedModelId!==product.model_id) throw fail('Salve primeiro a associação correta do modelo do produto.');
        if(body.saveForFamily && !Number(product.is_parent)) throw fail('Selecione o produto pai para salvar na família.');
        if(body.saveForModel && !product.model_id) throw fail('Associe um modelo para reutilizar em outros produtos iguais.');
        const common=reusableAttributes(body.attributes,definitions);
        const selected=body.saveForFamily?common:body.attributes;
        const writeProduct=async(row,attributes,merge)=>{
          const current=jsonObject(jsonObject(row.specs).mercado_livre);
          const existing=merge && current.category_id===data.category.id?current.attributes || {}:{};
          const oldCommon=new Set(Object.keys(reusableAttributes(existing,definitions)));
          const namespace={category_id:data.category.id,attributes:{...Object.fromEntries(Object.entries(existing).filter(([key])=>!oldCommon.has(key))),...attributes}};
          await connection.query("UPDATE products SET specs=JSON_SET(COALESCE(specs,JSON_OBJECT()),'$.mercado_livre',JSON_EXTRACT(?,'$')) WHERE id=?",[JSON.stringify(namespace),row.id]);
        };
        await writeProduct(product,selected,false);
        let affected=1;
        if(body.saveForFamily) {
          const [children]=await connection.query('SELECT id,specs FROM products WHERE parent_id=? ORDER BY id FOR UPDATE',[id]);
          for(const child of children) await writeProduct(child,common,true);
          affected+=children.length;
        }
        if(body.saveForModel) await connection.query("UPDATE models SET template_values=JSON_SET(COALESCE(template_values,JSON_OBJECT()),'$.mercado_livre',JSON_EXTRACT(?,'$')) WHERE id=?",[JSON.stringify({category_id:data.category.id,attributes:common}),product.model_id]);
        if(body.saveCategorySchema) {
          if(!product.category_id) throw fail('Associe uma categoria local antes de salvar a ficha.');
          await connection.query("UPDATE categories SET config=JSON_SET(COALESCE(config,JSON_OBJECT()),'$.mercado_livre',JSON_EXTRACT(?,'$')) WHERE id=?",[JSON.stringify({category_id:data.category.id,category_name:data.category.name,attributes:definitions,fetched_at:new Date().toISOString()}),product.category_id]);
        }
        await connection.commit();
        return {ok:true,affectedProducts:affected,savedForModel:!!body.saveForModel,savedCategorySchema:!!body.saveCategorySchema,categoryId:data.category.id,attributes:selected};
      }catch(e){await connection.rollback();throw e;}finally{connection.release();}
    },
    snapshot,
    async startSnapshot() {
      const a=await account();
      for(const [id,job] of snapshots) {
        if(job.status==='running' && job.sellerId===a.sellerId) return {id,status:'running'};
        if(job.status!=='running' && Date.now()-job.createdAt>3600000) snapshots.delete(id);
      }
      const id=crypto.randomUUID(),job={sellerId:a.sellerId,status:'running',createdAt:Date.now()};
      snapshots.set(id,job);
      snapshot().then(result=>Object.assign(job,{status:'complete',result})).catch(error=>Object.assign(job,{status:'failed',error:error.statusCode?error.message:'Não foi possível concluir a consulta do catálogo e anúncios.'}));
      return {id,status:'running'};
    },
    async snapshotStatus(req) {
      const job=snapshots.get(req.params.jobId);
      if(!job) throw fail('Consulta não encontrada. Recarregue o catálogo.',404);
      if(String((await settings()).user_id)!==job.sellerId) throw fail('Conta mudou durante a consulta.');
      return {status:job.status,...(job.result?{result:job.result}:{}),...(job.error?{error:job.error}:{})};
    },
    category: req => categoryData(req.params.categoryId),
    pricing: req => priceFor(req.body || {}),
    async preview(req) { const body=req.body || {},ctx=await live(body); const pricing=await priceFor(body,body.draft.fields.priceCents.value); const validation=await validate(ctx.payload); return {payload:ctx.payload,pricing,validation,sellerId:ctx.sellerId,mode:ctx.mode}; },
    async publish(req) {
      const body=req.body || {}; if(body.confirmPublication!==true) throw fail('Confirme a publicação após revisar a prévia.',400);
      const id=body.draft?.productId; if(!/^[a-f0-9-]{36}$/i.test(id || '') || !/^\d+$/.test(body.sellerId || '')) throw fail('Publicação inválida.',400);
      const key=`${body.sellerId}:${id}`,lock=`ml-publish-${body.sellerId}`;
      const connection=await pool.getConnection(); let locked=false;
      try {
        const [locks]=await connection.query('SELECT GET_LOCK(?,0) AS acquired',[lock]); locked=Number(locks[0]?.acquired)===1; if(!locked) throw fail('Outra publicação está em andamento. Aguarde.');
        if(String((await settings()).user_id)!==body.sellerId) throw fail('Conta mudou. Recarregue a integração.');
        let state=await journal.read(key);
        if(body.resumeOnly===true && !state) throw fail('Não há envio anterior para retomar. Valide a prévia antes de publicar.');
        if(state?.status==='complete') return {itemId:state.itemId,alreadyPublished:true};
        if(state && !state.itemId) throw fail('Envio anterior sem resposta conclusiva. Confira a conta antes de tentar outro anúncio.');
        if(!state) {
          const ctx=await live(body); await validate(ctx.payload);
          const pricing=await priceFor(body,body.draft.fields.priceCents.value);
          // Repeat account and stock immediately before the irreversible request.
          if(String((await settings()).user_id)!==ctx.sellerId) throw fail('Conta mudou antes do envio.');
          const [stock]=await pool.query('SELECT sku,stock_quantity,status,price_cost FROM products WHERE id=?',[id]);
          if(stock[0]?.sku!==ctx.product.sku || stock[0]?.status!=='active' || stock[0]?.stock_quantity==null || !Number.isSafeInteger(Number(stock[0]?.stock_quantity)) || Number(stock[0]?.stock_quantity)<ctx.payload.available_quantity) throw fail('Produto/estoque mudou antes do envio.');
          if(Number(stock[0]?.price_cost)!==pricing.costCents) throw fail('Custo mudou antes do envio. Recalcule o preço.');
          state={status:'sending',sellerId:ctx.sellerId,productId:id,sku:ctx.product.sku,pricing,description:body.draft.fields.description.value,createdAt:new Date().toISOString()};
          await journal.write(key,state); // A crash or timeout now cannot trigger an automatic second POST.
          const result=await request('/items',{method:'POST',body:JSON.stringify(ctx.payload)});
          if(!/^MLB\d+$/.test(result.id || '') || String(result.seller_id)!==ctx.sellerId) throw fail('Resposta inconclusiva do envio. Confira a conta.');
          state={...state,itemId:result.id,status:'created'}; await journal.write(key,state);
        }
        if(String((await settings()).user_id)!==state.sellerId) throw fail('Conta mudou; anúncio criado permanece registrado para recuperação.');
        const remote=await request(`/items/${state.itemId}?include_attributes=all`);
        if(String(remote.seller_id)!==state.sellerId || !listingRows(remote).some(l=>l.sku===state.sku)) throw fail('Identidade do anúncio criado não confere.');
        await connection.beginTransaction();
        const [accounts]=await connection.query('SELECT user_id FROM mercado_livre_settings WHERE id=1 FOR UPDATE');
        if(String(accounts[0]?.user_id)!==state.sellerId) throw fail('Conta mudou ao salvar o vínculo.');
        const [products]=await connection.query('SELECT sku FROM products WHERE id=? FOR UPDATE',[id]); if(products[0]?.sku!==state.sku) throw fail('SKU mudou ao salvar o vínculo.');
        const [links]=await connection.query('SELECT product_id,item_id FROM mercado_livre_products WHERE product_id=? OR (item_id=? AND variation_id=\'\') FOR UPDATE',[id,state.itemId]);
        if(links.some(l=>l.product_id!==id || l.item_id!==state.itemId)) throw fail('Vínculo concorrente encontrado; anúncio criado permanece registrado.');
        if(!links.length) await connection.query('INSERT INTO mercado_livre_products (product_id,item_id,variation_id,seller_sku) VALUES (?,?,?,?)',[id,state.itemId,'',state.sku]);
        await connection.commit();
        if(state.status!=='description_saved') {
          // GET before POST makes retries after a lost description response safe.
          let description=null; try { description=await request(`/items/${state.itemId}/description`); } catch(e) { if(e.remoteStatus!==404) throw e; }
          if(description?.plain_text!==state.description) await request(`/items/${state.itemId}/description`,{method:description?.plain_text ? 'PUT' : 'POST',body:JSON.stringify({plain_text:state.description})});
          state={...state,status:'description_saved'}; await journal.write(key,state);
        }
        await journal.write(key,{...state,status:'complete'});
        return {itemId:state.itemId,alreadyPublished:false};
      } catch(e) { await connection.rollback().catch(()=>{}); throw e; }
      finally { if(locked) await connection.query('SELECT RELEASE_LOCK(?)',[lock]).catch(()=>{}); connection.release(); }
    },
  };
}
module.exports={buildPublication,createPublicationHandlers,createFileJournal,modeOf,publicProduct,reusableAttributes,pricingPolicy,pricingBreakdown,calculatePrice,officialFees,catalogMeasures};
