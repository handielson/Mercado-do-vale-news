'use strict';
function patch(source) {
  const oldAccounts='  publicUrl: process.env.MDV_PRINT3D_PUBLIC_URL,';
  const newAccounts="  publicUrl: process.env.MDV_PRINT3D_PUBLIC_URL || 'https://www.gcode3d.com.br',";
  const replacements = [
    ["'https://www.3dmv.com.br'", "'https://www.gcode3d.com.br'", 2],
    ["'https://3dmv.com.br'", "'https://gcode3d.com.br'", 1],
    ['/(^|\\.)3dmv\\.com\\.br$/i', '/(^|\\.)gcode3d\\.com\\.br$/i', 1],
  ];
  let next=source;
  for(const [oldValue,newValue,count] of replacements) {
    const oldCount=next.split(oldValue).length-1;
    const newCount = count + (newValue === "'https://www.gcode3d.com.br'" && next.includes(newAccounts) ? 1 : 0);
    if(oldCount===0&&next.split(newValue).length-1===newCount)continue;
    if(oldCount!==count)throw new Error('Print3D domain anchor drift');
    next=next.split(oldValue).join(newValue);
  }
  if(next.includes(oldAccounts)) {
    if(next.split(oldAccounts).length!==2)throw new Error('Print3D account origin anchor drift');
    next=next.replace(oldAccounts,newAccounts);
  }else if(!next.includes(newAccounts))throw new Error('Print3D account origin anchor drift');
  return next;
}
const deploy=options=>require('./deploy-openai-finance.cjs').deploy({...options,patchSource:patch,
  moduleFiles:['services/print3dStorefrontSettingsServer.cjs'],backupSlug:'print3d-domain'});
module.exports={patch,deploy};
