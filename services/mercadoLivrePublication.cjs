const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

const fail = (message, statusCode = 409) => Object.assign(new Error(message), { statusCode });
const object = v => v && typeof v === 'object' && !Array.isArray(v);
const https = v => { try { const u = new URL(v); return u.protocol === 'https:' && !u.username && !u.password; } catch { return false; } };
const PRODUCT_COLUMNS = `id,sku,name,description,
  (SELECT b.name FROM brands b WHERE CAST(b.id AS CHAR)=products.brand OR b.name=products.brand LIMIT 1) AS brand,
  ean,alternative_eans,images,price_retail,stock_quantity,status,is_parent,parent_id,is_virtual,is_gift,is_combo`;
function publicProduct(row) {
  const jsonArray = value => { try { const v=typeof value==='string'?JSON.parse(value):value;return Array.isArray(v)?v:[]; } catch {return [];} };
  return {...row,images:jsonArray(row.images).filter(https),eans:jsonArray(row.alternative_eans).filter(v=>typeof v==='string')};
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
  for (const def of definitions.filter(d => d.tags?.required || d.tags?.conditionally_required)) {
    if (!attributes[def.id] && !(def.id === 'GTIN' && value('gtin'))) throw fail(`Atributo obrigatório: ${def.name || def.id}.`);
  }
  for (const id of Object.keys(attributes)) {
    if (id !== 'SELLER_SKU' && !definitions.some(d => d.id === id && !d.tags?.read_only)) throw fail(`Atributo não permitido: ${id}.`);
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
  return { site_id:'MLB', category_id:category.id, currency_id:'BRL', buying_mode:'buy_it_now',
    price:value('priceCents')/100, available_quantity:value('quantity'), condition:value('condition'), listing_type_id:policy.listingTypeId,
    [mode === 'legacy' ? 'title' : 'family_name']:title,
    pictures:photos.map(p => ({source:p.url})),
    attributes:Object.entries({...attributes,...(gtin ? {GTIN:gtin} : {}),SELLER_SKU:product.sku}).map(([id,value_name]) => ({id,value_name})),
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
    const [rows]=await pool.query('SELECT id,sku,price_cost FROM products WHERE id=?',[id]);
    if(!rows[0] || rows[0].sku!==draft.sku) throw fail('Produto/SKU mudou.');
    const commercial=draft.fields?.commercialPolicy?.value,categoryId=draft.fields?.categoryId?.value;
    if(!/^MLB\d+$/.test(categoryId || '') || !['gold_special','gold_pro'].includes(commercial?.listingTypeId) || !['me2','custom'].includes(commercial?.shipping?.mode)) throw fail('Defina categoria, tipo do anúncio e modo de envio antes de calcular.');
    const policy=pricingPolicy(chosenPriceCents===undefined ? (body.pricingPolicy || commercial.pricing) : commercial.pricing);
    const pricing=await calculatePrice(Number(rows[0].price_cost),policy,async price=>{
      const query=new URLSearchParams({category_id:categoryId,price:(price/100).toFixed(2),currency_id:'BRL',listing_type_id:commercial.listingTypeId,shipping_mode:commercial.shipping.mode,logistic_type:policy.logisticType,billable_weight:String(policy.billableWeightGrams)});
      const resource=`/sites/MLB/listing_prices?${query}`;
      return officialFees(await request(resource),commercial.listingTypeId,`https://api.mercadolibre.com${resource}`);
    },chosenPriceCents);
    return pricing;
  };
  return {
    async snapshot() {
      const a=await account(); const capturedAt=new Date().toISOString(); const products=await catalog(); const listings=await inventory(a.sellerId);
      const [links]=await pool.query('SELECT product_id,item_id,variation_id FROM mercado_livre_products');
      const latest=await settings(); if(String(latest.user_id)!==a.sellerId) throw fail('Conta mudou durante a consulta.');
      return {schema:'mdv.ml.catalog.v1',...a,capturedAt,complete:true,products,links,listings};
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
module.exports={buildPublication,createPublicationHandlers,createFileJournal,modeOf,publicProduct,pricingPolicy,pricingBreakdown,calculatePrice,officialFees};
