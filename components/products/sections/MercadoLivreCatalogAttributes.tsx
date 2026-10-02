import React,{useEffect,useRef,useState} from 'react';
import {mercadoLivreService} from '../../../services/mercadoLivreService';
import {MercadoLivreAttributeInput,ML_NOT_APPLICABLE,mlAttributeRequired} from '../../ui/MercadoLivreAttributeInput';

export default function MercadoLivreCatalogAttributes({categoryConfig,watch,setValue,productId}:{categoryConfig:any;watch:any;setValue:any;productId?:string}) {
  const namespace=watch('specs.mercado_livre') || {}, configured=categoryConfig?.mercado_livre;
  const categoryId=String(namespace.category_id || configured?.category_id || '');
  const attributes=namespace.attributes || {};
  const [data,setData]=useState<any>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [saveFamily,setSaveFamily]=useState(false),[saveModel,setSaveModel]=useState(true),[saveSchema,setSaveSchema]=useState(true);
  const [searching,setSearching]=useState(false),[searchNotice,setSearchNotice]=useState(''),[suggestions,setSuggestions]=useState<Array<{id:string;name:string}>>([]),[manual,setManual]=useState(false),[branches,setBranches]=useState<Array<{id:string;name:string}>>([]),[trail,setTrail]=useState<Array<{id:string;name:string}>>([]);
  const discoveryRequest=useRef(0),browseRequest=useRef(0),lastQuery=useRef('');
  const isParent=!!watch('is_parent'),modelId=watch('model_id');
  const title=String(watch('name') || '').trim(),localCategory=watch('category_id');
  const selectCategory=(id:string,name:string,source='manual')=>{
    discoveryRequest.current++;setSearching(false);setSuggestions([]);setSearchNotice(`Categoria selecionada: ${name}. Será guardada ao salvar o produto.`);
    setValue('specs.mercado_livre',{category_id:id,attributes:id===categoryId?attributes:{},remember_model:saveModel,selection_source:source,prediction_title:source==='prediction'?title:undefined},{shouldDirty:true});
  };
  const discover=async()=>{
    if(title.length<5)return;
    const requestId=++discoveryRequest.current;lastQuery.current=`${title}|${modelId || ''}|${localCategory || ''}`;
    setSearching(true);setSearchNotice('');setSuggestions([]);
    try{const result=await mercadoLivreService.discoverCategory(title);if(requestId!==discoveryRequest.current)return;
      if(result.suggestions.length===1)selectCategory(result.suggestions[0].id,result.suggestions[0].name,'prediction');
      else{setSuggestions(result.suggestions);setSearchNotice(result.suggestions.length?'Há mais de uma categoria possível. Escolha a que descreve este produto.':'Nenhuma categoria encontrada. Escolha manualmente abaixo.');if(!result.suggestions.length)await browse();}
    }catch{if(requestId===discoveryRequest.current){setSearchNotice('Não foi possível localizar a categoria. Você pode escolher manualmente.');setManual(true);}}
    finally{if(requestId===discoveryRequest.current)setSearching(false);}
  };
  const browse=async(path:Array<{id:string;name:string}>=[])=>{
    const requestId=++browseRequest.current;
    setManual(true);setError('');
    try{const result=await mercadoLivreService.browseCategories(path.at(-1)?.id);if(requestId!==browseRequest.current)return;setTrail(path);setBranches(result.categories);if(path.length && !result.categories.length)selectCategory(path.at(-1)!.id,path.at(-1)!.name);}
    catch{if(requestId===browseRequest.current)setError('Lista indisponível. Tente novamente ou informe o código da categoria.');}
  };
  useEffect(()=>{
    if((categoryId && !(namespace.selection_source==='prediction' && namespace.prediction_title!==title)) || title.length<5 || lastQuery.current===`${title}|${modelId || ''}|${localCategory || ''}`)return;
    const timer=setTimeout(()=>{void discover();},1800);
    return ()=>{clearTimeout(timer);discoveryRequest.current++;setSearching(false);};
  },[title,modelId,localCategory,categoryId]);
  useEffect(()=>()=>{discoveryRequest.current++;browseRequest.current++;},[]);
  useEffect(()=>{
    let cancelled=false;setData(null);setError('');setNotice('');
    if(!/^MLB\d+$/.test(categoryId))return;
    if(!namespace.category_id)setValue('specs.mercado_livre',{category_id:categoryId,attributes},{shouldDirty:false});
    if(configured?.category_id===categoryId && Array.isArray(configured.attributes)){setData({category:{id:categoryId,name:configured.category_name},attributes:configured.attributes});return;}
    mercadoLivreService.getCategoryRequirements(categoryId).then(result=>{if(!cancelled && result.category?.id===categoryId)setData(result);}).catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:'Falha na ficha.');});
    return ()=>{cancelled=true;};
  },[categoryId,configured?.category_id,configured?.fetched_at]);
  const change=(id:string,value:string)=>{const next={...attributes};if(value)next[id]=value;else delete next[id];setValue('specs.mercado_livre',{...namespace,category_id:categoryId,attributes:next,remember_model:saveModel},{shouldDirty:true});setNotice('');};
  const save=async()=>{
    if(!productId)return;
    setBusy(true);setError('');setNotice('');
    try{const result=await mercadoLivreService.saveCatalogAttributes(productId,{categoryId,attributes,saveForFamily:isParent && saveFamily,saveForModel:!!modelId && saveModel,saveCategorySchema:saveSchema,expectedCategoryId:watch('category_id'),expectedModelId:modelId});setValue('specs.mercado_livre',{category_id:categoryId,attributes:result.attributes},{shouldDirty:true});setNotice(`Atributos salvos no sistema para ${result.affectedProducts} produto(s)${result.savedForModel?' e no modelo para novos produtos iguais':''}${result.savedCategorySchema?'. Ficha da categoria guardada':''}. Os próximos rascunhos usarão esses dados.`);}catch(e){setError(e instanceof Error?e.message:'Falha ao salvar.');}finally{setBusy(false);}
  };
  const render=(a:any)=>{
    const managed:Record<string,string>={GTIN:String(watch('eans')?.[0] || ''),SELLER_SKU:String(watch('sku') || ''),COLOR:String(watch('specs.color') || ''),ITEM_CONDITION:String(watch('condition') || '')};
    const internal=!!(a.tags?.read_only || a.tags?.inferred || a.tags?.fixed),canonical=Object.prototype.hasOwnProperty.call(managed,a.id) || a.id.startsWith('SELLER_PACKAGE_') || a.id.startsWith('PACKAGE_');
    const value=canonical?managed[a.id] || '':String(attributes[a.id] || ''),required=mlAttributeRequired(a,watch('condition'));
    return <div key={a.id} className="border rounded p-3 space-y-1"><p className="text-sm font-medium">{a.name} • {internal?'Gerenciado pelo Mercado Livre':canonical?'Campo do cadastro':required?'Obrigatório':'Opcional/condicional'}</p><MercadoLivreAttributeInput attribute={a} value={value===ML_NOT_APPLICABLE?'':value} onChange={value=>change(a.id,value)} disabled={busy || internal || canonical || value===ML_NOT_APPLICABLE}/>{!internal && !canonical && !required && !a.tags?.allow_variations && <label className="block text-xs"><input type="checkbox" checked={value===ML_NOT_APPLICABLE} disabled={busy} onChange={e=>change(a.id,e.target.checked?ML_NOT_APPLICABLE:'')}/> Não se aplica — somente quando verdadeiro</label>}{!internal && !canonical && !value && <p className="text-xs text-amber-800">Informação pendente</p>}{canonical && <p className="text-xs text-slate-500">Preencha no campo correspondente do cadastro.</p>}</div>;
  };
  return <section className="bg-white p-6 rounded-xl border border-yellow-300 space-y-3" aria-label="Atributos Mercado Livre no cadastro"><h3 className="font-semibold">Atributos Mercado Livre • Cadastro do produto</h3><p className="text-sm">Estas informações ficam no nosso sistema e alimentam os próximos anúncios. A categoria guarda os campos; o produto guarda seus valores. Para produtos iguais, salve os atributos comuns no modelo.</p><div className="space-y-2"><p className="text-sm">{categoryId?'Categoria reaproveitada do cadastro. Confira se corresponde ao produto.':'Ao preencher o nome, o sistema busca a categoria automaticamente.'}</p><button type="button" disabled={busy || searching || title.length<5} onClick={discover} className="rounded bg-yellow-400 p-2 font-semibold">{searching?'Localizando categoria…':'Buscar categoria pelo nome do produto'}</button><button type="button" disabled={busy} onClick={()=>browse()} className="border rounded p-2 ml-2">Escolher categoria manualmente</button>{searchNotice && <p role="status" className="text-sm">{searchNotice}</p>}{suggestions.map(option=><button type="button" key={option.id} className="block border rounded p-2" onClick={()=>selectCategory(option.id,option.name)}>{option.name} ({option.id})</button>)}{manual && <div className="border rounded p-3 space-y-2"><p>{['Categorias Mercado Livre',...trail.map(row=>row.name)].join(' → ')}</p>{trail.length>0 && <button type="button" onClick={()=>browse(trail.slice(0,-1))}>Voltar um nível</button>}{branches.map(option=><button type="button" key={option.id} className="block text-left border rounded p-2" onClick={()=>browse([...trail,option])}>{option.name}</button>)}</div>}</div><details><summary>Informar código da categoria (opcional)</summary><label className="block text-sm">Categoria oficial Mercado Livre<input className="border rounded p-2 block" value={categoryId} placeholder="Ex.: MLB5095" onChange={e=>selectCategory(e.target.value.trim().toUpperCase(),e.target.value.trim().toUpperCase())}/></label></details>{data?.category?.id===categoryId && <><p>{data.category.name} • {data.attributes.length} atributos oficiais</p><div className="grid gap-3 sm:grid-cols-2">{data.attributes.filter((a:any)=>!a.tags?.read_only).map(render)}</div><details><summary>Campos gerenciados pelo Mercado Livre ({data.attributes.filter((a:any)=>a.tags?.read_only).length})</summary><div className="grid gap-3 sm:grid-cols-2">{data.attributes.filter((a:any)=>a.tags?.read_only).map(render)}</div></details></>}{productId && <fieldset disabled={busy} className="space-y-2"><label className="block text-sm"><input type="checkbox" checked={saveSchema} onChange={e=>setSaveSchema(e.target.checked)}/> Guardar a ficha oficial na categoria local para os próximos cadastros</label>{isParent && <label className="block text-sm"><input type="checkbox" checked={saveFamily} onChange={e=>setSaveFamily(e.target.checked)}/> Salvar atributos comuns no pai e em todas as variações desta família</label>}{modelId && <label className="block text-sm"><input type="checkbox" checked={saveModel} onChange={e=>{setSaveModel(e.target.checked);setValue('specs.mercado_livre',{...namespace,category_id:categoryId,attributes,remember_model:e.target.checked},{shouldDirty:true});}}/> Usar atributos comuns como padrão do modelo para novos produtos iguais</label>}<p className="text-xs">Cor, GTIN, SKU e outros dados específicos de variação não são copiados como padrão. Salvar aqui atualiza apenas esta ficha no cadastro; anúncios existentes têm revisão própria.</p><button type="button" disabled={!data || data.category.id!==categoryId} onClick={save} className="rounded bg-yellow-400 p-3 font-semibold">{busy?'Salvando…':'Salvar atributos no nosso sistema'}</button></fieldset>}{!productId && <p className="text-sm">Salvar Produto guarda a categoria e os atributos. A escolha também será lembrada no modelo para os próximos produtos iguais.</p>}{error && <p role="alert" className="text-red-700">{error}</p>}{notice && <p role="status" className="text-green-700">{notice}</p>}</section>;
}
