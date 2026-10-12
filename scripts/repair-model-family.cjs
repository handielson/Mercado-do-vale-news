'use strict';
const {createHash}=require('node:crypto');
const {configuration,object}=require('../services/smartphonePriceGroupsCore.cjs');
function planModelFamilyRepair({model,products,parentId,unitCounts,referenceCounts={}}){
 const parent=products.find(p=>p.id===parentId);
 if(!parent||parent.parent_id||products.some(p=>p.model_id!==model.id||p.company_id!==model.company_id))throw Error('Family scope mismatch');
 if(Number(parent.stock_quantity)!==0||Number(unitCounts[parentId]?.total||0)!==0||Number(referenceCounts[parentId]||0)!==0)throw Error('Parent contains operational history or stock');
 const groups=new Map();
 for(const p of products.filter(p=>p.id!==parentId)){
  if(Number(p.is_parent)||p.parent_id&&p.parent_id!==parentId||p.is_print3d||p.is_combo||p.offer_type)throw Error('Incompatible child or second parent');
  const c=configuration(p,model);const color=String(object(p.specs).color||p.color||'').trim().toLowerCase();
  if(!c||!c.ram||!c.storage||!color)throw Error('Missing variation identity');
  const key=[c.ram,c.storage,color].join('|');const rows=groups.get(key)||[];rows.push(p);groups.set(key,rows);
 }
 const active=[],archived=[];
 for(const rows of groups.values()){
  rows.sort((a,b)=>Number(unitCounts[b.id]?.available||0)-Number(unitCounts[a.id]?.available||0)||Number(unitCounts[b.id]?.total||0)-Number(unitCounts[a.id]?.total||0)||String(a.id).localeCompare(String(b.id)));
  active.push(rows[0].id);archived.push(...rows.slice(1).map(p=>p.id));
 }
 const specs={...object(parent.specs)};
 for(const field of ['ram','ram_fisica','physical_ram','memoria_ram','memoria_ram_fisica','memory_ram','storage','armazenamento','memoria','capacity','color','cor','colour','color_id','imei1','imei2','imei_1','imei_2','serial','_inherit_parent_images','_inherit_parent_video'])delete specs[field];
 const sku='MODELO-'+createHash('sha256').update(`${model.company_id}:${model.id}`).digest('hex').slice(0,20).toUpperCase();
 return {modelId:model.id,parentId,parent:{name:model.name,sku,is_parent:1,parent_id:null,track_inventory:0,specs},activeChildren:active,archivedChildren:archived,allChildren:products.filter(p=>p.id!==parentId).map(p=>p.id)};
}
module.exports={planModelFamilyRepair};
