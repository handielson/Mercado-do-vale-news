'use strict';
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
module.exports=async function verifyProductionJourney({page,base,app,pool,orderId,phone}){
 const [[job]]=await pool.query('SELECT id FROM print3d_production_jobs WHERE order_id=?',[orderId]);
 const [[customer]]=await pool.query('SELECT id FROM print3d_customers WHERE phone=?',[phone]);
 const body={idempotency_key:randomUUID(),approved_quantity:1,rejected_quantity:0,material_consumed_grams:10,
  filaments:[{filament_id:'pla',consumed_grams:10}],supplies:[],note:'Observação interna que não deve aparecer ao cliente'};
 const record=()=>app.inject({method:'POST',url:`/admin/print3d/production/${job.id}/progress`,headers:{authorization:'Bearer local-production-admin'},payload:body});
 assert.equal((await record()).statusCode,409,'production must await verified entry');
 await page.goto(base+'/loja-3d/conta/producao');
 const bar=page.getByRole('progressbar');await bar.waitFor();
 assert.equal(await bar.count(),1,'customer must see only their own production');
 assert.equal(await bar.getAttribute('aria-valuenow'),'0');
 await page.getByText('Aguardando entrada',{exact:true}).waitFor();
 // Only the provider is simulated. Canonical payment settlement releases the job.
 const {createCharge}=require('../services/print3dPayments.cjs');
 const paid=await createCharge(pool,{orderId,customer,body:{stage:'initial',payer_email:'local-payer@example.test',idempotency_key:randomUUID()},collectorId:'123',
  adapter:{create:async charge=>({id:'991001',collector_id:'123',currency_id:'BRL',payment_method_id:'pix',
   external_reference:`print3d:${charge.id}`,transaction_amount:Number(charge.amount_cents)/100,status:'approved',date_approved:new Date().toISOString()})}});
 assert.equal(paid.coverage.initial_payment_covered,true);assert.equal(paid.coverage.fully_paid,false);
 await require('../services/print3dMaterialStock.cjs').receivePrint3dFilament(pool,{actorId:'local-test-admin',body:{filament_id:'pla',quantity_grams:20,idempotency_key:randomUUID()}});
 const progress=await record();assert.equal(progress.statusCode,200,progress.body);
 const repeated=await record();assert.equal(repeated.statusCode,200,repeated.body);assert.equal(repeated.json().replayed,true);
 const updated=page.waitForResponse(r=>r.url().includes(encodeURIComponent('/print3d/production'))&&r.request().method()==='GET');
 await page.getByRole('button',{name:'Atualizar',exact:true}).click();
 const result=await updated;assert.equal(result.status(),200);
 const jobs=(await result.json()).jobs;assert.equal(jobs.length,1);assert.equal(jobs[0].id,job.id);
 assert.equal(jobs[0].approved_quantity,1);assert.equal(jobs[0].reserved_for_order_quantity,1);assert.equal(jobs[0].history.length,1);
 for(const key of ['recipe_id','primary_file','filaments','supplies','material_consumed_grams','rejected_quantity'])assert.equal(jobs[0][key],undefined);
 assert.equal(jobs[0].history[0].note,undefined);assert.equal(jobs[0].history[0].actor_id,undefined);
 await page.getByText('Em produção',{exact:true}).waitFor();
 assert.equal(await bar.getAttribute('aria-valuenow'),'1');assert.equal(await bar.getAttribute('aria-valuemax'),'2');
 await page.getByText('Faltam 1 unidades para concluir a produção.',{exact:true}).waitFor();
 assert.equal(await page.getByText(body.note,{exact:true}).count(),0);
 assert.equal(await page.getByRole('alert').count(),0);
 const [[events]]=await pool.query('SELECT COUNT(*) total FROM print3d_production_events WHERE job_id=?',[job.id]);assert.equal(events.total,1);
 body.idempotency_key=randomUUID();
 const finished=await record();assert.equal(finished.statusCode,200,finished.body);
 // Leave the page untouched: its normal 30-second polling must show completion.
 await page.getByText('Produção concluída',{exact:true}).waitFor({timeout:35000});
 assert.equal(await bar.getAttribute('aria-valuenow'),'2');
 await page.getByText('Todas as unidades foram produzidas e aprovadas.',{exact:true}).waitFor();
 const [[unpaidBalance]]=await pool.query('SELECT payment_status FROM orders WHERE id=?',[orderId]);
 assert.notEqual(unpaidBalance.payment_status,'paid','production completion does not settle the remaining balance');
 const [[receipts]]=await pool.query('SELECT SUM(amount_cents) paid FROM print3d_order_payment_receipts WHERE order_id=?',[orderId]);
 assert.equal(Number(receipts.paid),1750);
 console.log('PASS: real customer session sees only own partial production via standalone proxy; verified simulated entry releases production, repeated progress stays unique and internal data is hidden.');
 console.log('PASS: customer production page refreshes completion automatically while the unpaid balance remains outstanding.');
};
