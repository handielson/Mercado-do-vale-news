const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.PRINT3D_TEST_BASE_URL||'http://127.0.0.1:3000';

(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try {
    const page=await browser.newPage({viewport:{width:850,height:900}});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    let job={id:'job-1',order_id:'order-1',order_number:'3D-17',order_item_id:'item-1',product_name:'Chaveiro',sku:'CH-1',
      target_quantity:10,approved_quantity:0,reserved_for_order_quantity:0,status:'queued',history:[],
      filaments:[{id:'pla',name:'PLA',color:'Preto',estimated_grams_per_batch:20}],
      supplies:[{id:'argola',name:'Argola',unit_label:'un',estimated_quantity_per_batch:10}],
      primary_file:{id:'file-1',original_name:'CH-1-r2.gcode',revision:'r2',kind:'gcode',printer_profile:'Bambu PLA',sha256:'a'.repeat(64),byte_size:123},
      recipe_summary:{pieces_per_batch:10,material_gramas:20,tempo_impressao_minutos:80}};
    let grams=100,units=20,posted=null;
    await page.route('**/*',route=>{
      const url=new URL(route.request().url());
      if(url.pathname.includes('vps-proxy')||url.pathname.startsWith('/api/')||url.hostname==='api.xiaomipetrolina.com.br') {
        const path=url.searchParams.get('path')||url.pathname+url.search;
        const json=value=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(value)});
        if(path==='/admin/print3d/production') return json({enabled:true,jobs:[job]});
        if(path==='/admin/print3d/materials') return json({materials:[{filament_id:'pla',name_snapshot:'PLA',color_snapshot:'Preto',quantity_grams:grams}]});
        if(path==='/admin/print3d/supplies') return json({supplies:[{supply_id:'argola',name_snapshot:'Argola',unit_snapshot:'un',quantity_units:units}]});
        if(path==='/admin/preferences/print3d.cost.v1') return json({value:{filaments:[{id:'pla',name:'PLA',color:'Preto'}],supplies:[{id:'argola',name:'Argola',unitLabel:'un',unitCostCents:30}],packagingCentsPerPiece:0}});
        if(path==='/admin/print3d/production/job-1/progress'&&route.request().method()==='POST') {
          posted=route.request().postDataJSON();
          grams-=posted.material_consumed_grams;units-=posted.supplies[0].consumed_quantity;
          job={...job,approved_quantity:2,reserved_for_order_quantity:2,status:'in_progress',history:[{id:'event-1',approved_quantity:2,created_at:new Date().toISOString()}]};
          return json({job,replayed:false});
        }
        return route.abort();
      }
      return url.origin===base?route.continue():route.abort();
    });
    await page.goto(base+'/tmp-tests/print3d-production-preview.html?view=admin');
    await page.getByText('20 un',{exact:true}).waitFor();
    await page.getByText('CH-1-r2.gcode · revisão r2').waitFor();
    await page.getByText('G-code pronto para o perfil indicado · Bambu PLA').waitFor();
    await page.getByRole('button',{name:'Baixar arquivo desta ordem'}).waitFor();
    await page.getByLabel('Novas aprovadas',{exact:true}).fill('2');
    await page.getByLabel('Consumo de PLA Preto em gramas').fill('4');
    await page.getByLabel('Consumo de Argola em un').fill('2');
    await page.getByRole('button',{name:'Registrar produção'}).click();
    await page.getByRole('status').filter({hasText:'2 de 10'}).waitFor();
    assert.deepEqual(posted.supplies,[{supply_id:'argola',consumed_quantity:2}]);
    await page.getByText('18 un',{exact:true}).waitFor();
    assert.deepEqual(errors,[]);
    console.log('PASS: apontamento real simulado envia insumo da ficha e atualiza saldo físico; nenhuma API externa chamada.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
