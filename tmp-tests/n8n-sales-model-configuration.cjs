'use strict';
const assert=require('node:assert/strict');
const MARKER='sales-model-configuration-v1';
const SCOPED_NODES=['Vendas - Preparar Busca','Vendas - Contexto Produtos','Vendas - Compor Resposta IA'];
function once(s,a,b){assert.equal(s.split(a).length-1,1,'Missing/ambiguous configuration anchor: '+a.slice(0,100));return s.replace(a,b);}
function networkFromText(value){
 const text=String(value||'').replace(/\b\d{1,3}\s*(?:gb|g)\s*(?:de\s*)?(?:ram|memoria\s+ram)\b/gi,' ').replace(/\b(?:ram|memoria\s+ram)\s*(?:de|com)?\s*\d{1,3}\s*(?:gb|g)\b/gi,' ');
 return (text.match(/\b([45])\s*g\b/i)||[])[1]||'';
}
// Shared by the raw catalog pool and the final grouped catalog. Memory is a
// configuration, while Pro/Plus/S/Ultra and explicit network belong to identity.
function matchesModel(product,query,network='',brand='',family=''){
 const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const clean=value=>normalize(value).replace(/\+/g,' plus ').replace(/\b\d+(?:[.,]\d+)?\s*(?:gb|tb|t)\b/g,' ').replace(/\b(\d+)\s*g\b/g,(all,n)=>['4','5'].includes(n)?all:' ').replace(/\b(?:ram|memoria|interna|armazenamento|storage|de|com|xiaomi|apple|samsung|motorola)\b/g,' ').replace(/\b[45]\s*g\b/g,' ').replace(/[^a-z0-9]/g,'');
 const rawName=product.modelName||product.model_name||product.name||'';
 const requested=clean(query),actual=clean(rawName);
 const contextualPrefixes=family?[normalize(family)]:({xiaomi:['redmi','poco'],samsung:['galaxy'],motorola:['moto'],realme:['realme']}[brand]||(/^(?:m|x|c)\d/.test(requested)?['poco']:[]));
 if(!requested || (requested!==actual && !contextualPrefixes.some(prefix=>actual===prefix+requested)))return false;
 const requestedNetwork=networkFromText(query)||String(network||'').replace(/[^45]/g,'');
 if(!requestedNetwork)return true;
 const specs=product.specs||{},custom=product.custom_fields||{};
 const nameNetwork=(normalize(rawName).match(/\b([45])\s*g\b/)||[])[1];
 const technicalNetwork=normalize(specs.rede_operadora||specs.network||custom.rede_operadora||custom.network||'');
 if(nameNetwork&&nameNetwork!==requestedNetwork)return false;
 return nameNetwork===requestedNetwork || new RegExp('\\b'+requestedNetwork+'\\s*g\\b').test(technicalNetwork);
}
function patchWorkflow(input){
 const w=structuredClone(input),node=name=>{const n=w.nodes.find(n=>n.name===name);assert(n,name);return n;};
 if(node(SCOPED_NODES[0]).parameters.jsCode.includes(MARKER)){for(const name of SCOPED_NODES)assert(node(name).parameters.jsCode.includes(MARKER),'Incomplete configuration patch');return w;}
 const prepare=node(SCOPED_NODES[0]);let s=prepare.parameters.jsCode;
 s=once(s,"if (!gb || (gb === 5 && unitV338 === 'g')) continue;","// "+MARKER+": network generations are not RAM.\n    if (!gb || ([4,5].includes(gb) && unitV338 === 'g')) continue;");
 s=once(s,'// Bare 5G is network. Explicit "5 GB de RAM" was already collected and masked above.','// Bare 4G/5G is network. Explicit GB de RAM was already collected and masked above.');
 s=once(s,"const requestedNetworkV338 = String(source.requestedNetwork || source.salesNetworkFilter || mergedSalesFiltersV288.network || mergedSalesFiltersV288.rede || '').toLowerCase().replace(/\\s+/g, '') === '5g' || (directPhone5gMentionV338 && !explicitFiveGbRamV338) ? '5g' : '';",`const explicitNetworkV1=(${networkFromText.toString()})([rawText,classifiedSearchQuery].join(' '));
const ramUsesNetworkTokenV1=!explicitNetworkV1 && /\\b[45]\\s*g\\b/i.test([rawText,classifiedSearchQuery].join(' ')) && phoneMemoryFiltersV155.requestedRamGb.length>0;
const inheritedNetworkV1=String((ramUsesNetworkTokenV1?'':source.requestedNetwork||source.salesNetworkFilter)||mergedSalesFiltersV288.network||mergedSalesFiltersV288.rede||'').toLowerCase().replace(/\\s+/g,'');
const requestedNetworkV338=explicitNetworkV1?explicitNetworkV1+'g':(['4g','5g'].includes(inheritedNetworkV1)?inheritedNetworkV1:'');`);
 // The superseded 5G-only detector is no longer an independent owner.
 s=s.split('\n').filter(line=>!line.startsWith('const explicitFiveGbRamV338 =')&&!line.startsWith('const directPhone5gMentionV338 =')).join('\n');
 s=once(s,".filter((value) => !(phone5gFilterRequestV338 && Number(value) === 5 && !explicitFiveGbRamV338));",".filter((value) => Number(value)>0);");
 for(const name of ['requestedRamGb','requestedStorageGb','phoneMemoryFilterRequest','memoryFilterLabel'])s=once(s,'const '+name+' =','let '+name+' =');
 s=once(s,'// catalog-direct-response-v366:brand',`// ${MARKER}: a fresh named-model request without capacities re-evaluates inherited memory only.
if(specificDeviceModelRequest && phoneMemoryFiltersV155.requestedRamGb.length===0 && phoneMemoryFiltersV155.requestedStorageGb.length===0){
 requestedRamGb=[];requestedStorageGb=[];phoneMemoryFilterRequest=false;memoryFilterLabel='';
 for(const key of ['ramGb','storageGb','ramMinGb','storageMinGb'])delete mergedSalesFiltersV288[key];
}
// catalog-direct-response-v366:brand`);
 prepare.parameters.jsCode=s;
 const context=node(SCOPED_NODES[1]);s=context.parameters.jsCode;
 s=once(s,"const requestedNetworkV338 = String(base.requestedNetwork || base.salesFilters?.network || base.salesFilters?.rede || '').toLowerCase().replace(/\\s+/g, '') === '5g' ? '5g' : '';","const requestedNetworkV338 = ['4g','5g'].includes(String(base.requestedNetwork || base.salesFilters?.network || base.salesFilters?.rede || '').toLowerCase().replace(/\\s+/g,'')) ? String(base.requestedNetwork || base.salesFilters?.network || base.salesFilters?.rede).toLowerCase().replace(/\\s+/g,'') : '';");
 s=once(s,'const requestedRamGbV155 =',`// ${MARKER}: use the same identity owner before and after memory filtering.
const networkFromText=${networkFromText.toString()};
const matchesRequestedModelIdentityV1=${matchesModel.toString()};
const sameRequestedModelV1=product=>matchesRequestedModelIdentityV1({...product,name:withoutColorSuffix(product.name,getColor(product))},base.requestedDeviceModelQuery,base.requestedNetwork,base.requestedDeviceBrand,base.requestedDeviceFamily);
const requestedRamGbV155 =`);
 s=once(s,'return ramMatches && storageMatches;','return (ramMatches && storageMatches) || sameRequestedModelV1(product);');
 s=once(s,".map((match) => memoryCapacityToGbV155(match[1] + match[2])).filter((value) => value > 0);",".filter(match=>!(['4','5'].includes(match[1])&&match[2].toLowerCase()==='g'))\n  .map((match) => memoryCapacityToGbV155(match[1] + match[2])).filter((value) => value > 0);");
 const a=s.indexOf('const requestedModelTextV246 ='),b=s.indexOf('  const parsedPartsV248 = getPhysicalMemoryPartsV155(product);',a);assert(a>=0&&b>a);
 s=s.slice(0,a)+`const productMatchesRequestedModel = (product) => {
  if (!sameRequestedModelV1(product)) return false;
`+s.slice(b);
 s=once(s,"const compactModelText = (value) => normalize(value).replace(/\\s+/g, '');\n",'');
 s=once(s,'const unavailableRequestedModel = Boolean(requestedDeviceModelQuery && matchingRequestedModelProducts.length === 0);',`const sameModelProductsV1=requestedDeviceModelQuery?primaryDeviceProducts.filter(sameRequestedModelV1):[];
const sameModelConfigurationAlternativeV1=Boolean(requestedDeviceModelQuery && matchingRequestedModelProducts.length===0 && sameModelProductsV1.length>0);
const unavailableRequestedModel = Boolean(requestedDeviceModelQuery && matchingRequestedModelProducts.length === 0 && !sameModelConfigurationAlternativeV1);`);
 s=once(s,'(matchingRequestedModelProducts.length > 0 ? matchingRequestedModelProducts : primaryDeviceProducts)','(matchingRequestedModelProducts.length > 0 ? matchingRequestedModelProducts : (sameModelConfigurationAlternativeV1?sameModelProductsV1:primaryDeviceProducts))');
 s=once(s,"String(base.memoryFilterLabel || '').trim()","sameModelConfigurationAlternativeV1?'':String(base.memoryFilterLabel || '').trim()");
 s=once(s,": (products.length > 0 ? 'confirmed_products_available' : 'search_inconclusive')",": (sameModelConfigurationAlternativeV1 ? 'requested_configuration_unavailable_with_same_model' : (products.length > 0 ? 'confirmed_products_available' : 'search_inconclusive'))");
 s=once(s,"const fallbackCatalogIntroV1 = suppressRepeatedCatalogV342",`const fallbackCatalogIntroV1 = sameModelConfigurationAlternativeV1
  ? 'A configuração solicitada'+(base.memoryFilterLabel?' ('+base.memoryFilterLabel+')':'')+' está sem estoque. Temos o mesmo modelo em outra configuração disponível:'
  : suppressRepeatedCatalogV342`);
 s=once(s,'    stockAssistantContext: \'\',',`    requestedConfigurationUnavailable: sameModelConfigurationAlternativeV1,
    stockAssistantContext: '',`);
 s=once(s,"    aiResponseGuidance: '',","    aiResponseGuidance: sameModelConfigurationAlternativeV1?'Explique que a configuração pedida está sem estoque, mas há outra configuração do mesmo modelo. Apresente somente os dados confirmados desta alternativa e aguarde a escolha do cliente. Não confirme reserva, compra ou troca automática.':'',");
 context.parameters.jsCode=s;
 const composer=node(SCOPED_NODES[2]);composer.parameters.jsCode=once(composer.parameters.jsCode,'const prependNaturalIntroV1 = !priceInIntroExactV1 && catalogReadyV366',`// ${MARKER}: the confirmed configuration notice owns this answer, including when AI drifts.
const prependNaturalIntroV1 = source.specificDeviceModelRequest!==true && source.requestedConfigurationUnavailable!==true && !priceInIntroExactV1 && catalogReadyV366`);
 for(const name of SCOPED_NODES)new Function('$json','$input','$','$getWorkflowStaticData',node(name).parameters.jsCode);
 assert.deepEqual(w.connections,input.connections);return w;
}
module.exports={MARKER,SCOPED_NODES,matchesModel,networkFromText,patchWorkflow};
