import React from 'react';

export const ML_NOT_APPLICABLE = '__ML_NOT_APPLICABLE__';
export const mlAttributeRequired = (a:any, condition:unknown) => !!(a.tags?.required || (condition==='new' && a.tags?.new_required));

export function MercadoLivreAttributeInput({attribute:a,value,onChange,disabled=false}:{attribute:any;value:string;onChange:(value:string)=>void;disabled?:boolean}) {
  const options=a.values || [], units=a.allowed_units || [];
  const common={className:'border rounded p-2 block w-full',disabled,'aria-label':a.name};
  if(a.value_type==='boolean') return <select {...common} value={value} onChange={e=>onChange(e.target.value)}><option value="">Selecione</option>{value && !options.some((v:any)=>v.name===value) && <option value={value}>{value}</option>}{options.map((v:any)=><option key={v.id} value={v.name}>{v.name}</option>)}</select>;
  if(a.value_type==='number_unit' && units.length) {
    const match=value.match(/^(.*?)\s+([^\s]+)$/), amount=match?match[1]:value, unit=match?match[2]:(a.default_unit || units[0].id);
    return <div className="flex gap-2"><input {...common} type="text" inputMode="decimal" value={amount} placeholder="Valor" onChange={e=>onChange(e.target.value?`${e.target.value} ${unit}`:'')} /><select className="border rounded p-2" aria-label={`Unidade de ${a.name}`} disabled={disabled} value={unit} onChange={e=>onChange(amount?`${amount} ${e.target.value}`:'')}>{!units.some((u:any)=>u.id===unit) && <option value={unit}>{unit}</option>}{units.map((u:any)=><option key={u.id} value={u.id}>{u.name}</option>)}</select></div>;
  }
  return <><input {...common} type="text" inputMode={a.value_type==='number'?'decimal':undefined} maxLength={a.value_max_length} value={value} list={options.length?`ml-attribute-${a.id}`:undefined} placeholder={a.tags?.multivalued?'Valores separados por vírgula':'Preencher com informação comprovada'} onChange={e=>onChange(e.target.value)} />{options.length>0 && <datalist id={`ml-attribute-${a.id}`}>{options.map((v:any)=><option key={v.id} value={v.name}/>)}</datalist>}</>;
}
