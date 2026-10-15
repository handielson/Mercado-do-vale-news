'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
for(const file of ['vps_server.cjs','vps_server.js']) {
  const source=fs.readFileSync(file,'utf8');
  const fn=name=>{const start=source.indexOf('async function '+name+'(')>=0?source.indexOf('async function '+name+'('):source.indexOf('function '+name+'(');
    assert(start>=0,name);const rest=source.slice(start);const end=rest.slice(1).search(/\n(?:async function |function |const |fastify\.)/);return end<0?rest:rest.slice(0,end+1);};
  test(file+': dashboard returns its period and totals for store and delivery worker',async()=>{
    let handler;const queries=[];
    const context={
      fastify:{get(_path,_options,fn){handler=fn;}},requireSyncKeyOrCustomer(){},
      STORE_DELIVERY_PERSON_ID:'store:delivery',STORE_UNASSIGNED_DELIVERY_PERSON_ID:'store:unassigned',
      pool:{async query(sql,params){
        assert.match(sql.trim(),/^SELECT/);queries.push({sql,params});
        if(sql.includes('is_delivery_worker FROM customers'))return [[{id:'worker',name:'Teste',is_delivery_worker:1}]];
        if(sql.includes('GROUP BY'))return [[{person_id:'worker',person_name:'Teste',jobs_count:2,delivered_count:1,total_amount_cents:3000}]];
        return [[{total_jobs:2,pending_jobs:1,in_route_jobs:0,delivered_jobs:1,cancelled_jobs:0,total_delivery_cents:3000}]];
      }},
    };
    vm.createContext(context);
    const start=source.indexOf("fastify.get('/delivery/app/dashboard'");
    vm.runInContext(fn('buildDeliveryAppDateFilter')+'\n'+source.slice(start,source.indexOf('\n});',start)+5),context);
    for(const isAdmin of [true,false])for(const query of [{},{period:'today'},{period:'all'},{period:'month'},{period:'custom',date_from:'2026-10-14',date_to:'2026-10-14'}]){
      queries.length=0;
      const result=await handler({query,customerAccess:{isAdmin,customerId:'worker'}},{code(status){throw Error('Unexpected HTTP '+status);}});
      assert.equal(result.period,query.period||'today');assert.equal(result.summary.total_jobs,2);
      assert.equal(result.summary.total_delivery_cents,3000);assert.equal(result.by_person.length,isAdmin?1:0);
      const summary=queries.find(q=>q.sql.includes('COUNT(*) as total_jobs'));
      assert.equal(summary.sql.includes('TIMESTAMPADD'),query.period!=='all');
      assert.deepEqual(Array.from(summary.params),isAdmin?[]:['worker']);
    }
  });
  test(file+': store day after 21h keeps both afternoon and late-night deliveries',()=>{
    const build=new Function(fn('buildDeliveryAppDateFilter')+';return buildDeliveryAppDateFilter;')();
    const now=new Date('2026-10-15T01:14:30Z');
    const today=build({period:'today'},'all',now);
    const boundaries=[...today.matchAll(/'(\d{4}-\d{2}-\d{2} [\d:]+)'/g)].map(m=>Date.parse(m[1].replace(' ','T')+'Z'));
    assert.equal(boundaries.length,2);
    const included=t=>Date.parse(t)>=boundaries[0]&&Date.parse(t)<boundaries[1];
    for(const stamp of ['2026-10-14T20:45:57Z','2026-10-15T00:05:06Z','2026-10-15T02:59:59Z'])assert.equal(included(stamp),true,stamp);
    for(const stamp of ['2026-10-14T02:59:59Z','2026-10-15T03:00:00Z'])assert.equal(included(stamp),false,stamp);
    assert.equal(build({period:'all'},'today',now),'');
    assert.match(build({date_from:'2026-10-14',date_to:'2026-10-14'},'all',now),/2026-10-15 03:00:00/);
    assert.match(build({period:'yesterday'},'all',now),/2026-10-13 03:00:00/);
    assert.throws(()=>build({date_from:'2026-02-30'},'all',now),/invalida/);
    assert.throws(()=>build({date_from:'2026-10-15',date_to:'2026-10-14'},'all',now),/invalido/);
    for(const path of ['/delivery/app/jobs','/delivery/app/dashboard']){
      const start=source.indexOf("fastify.get('"+path+"'");const route=source.slice(start,source.indexOf('\n});',start));
      assert.match(route,/buildDeliveryAppDateFilter\(req.query/);assert.doesNotMatch(route,/CURDATE\(\)/);
    }
  });
  function harness(overrides={}) {
    const state={id:'test-job',sale_id:'test-sale',delivery_status:'in_route',payment_status:'not_required',buyer_name:'Teste',buyer_phone:'5587000000000',delivery_person_customer_id:'store:delivery',delivery_address_text:'Rua Teste',delivery_route_url:'https://maps.google.com/?q=teste',delivery_amount:3000,...overrides};
    let locked=false,sends=0,releases=0;
    const query=async(sql,params=[])=>{
      if(sql.includes('GET_LOCK')){if(locked)return [[{acquired:0}]];locked=true;return [[{acquired:1}]];}
      if(sql.includes('RELEASE_LOCK')){locked=false;return [[{released:1}]];}
      if(sql.includes('SELECT * FROM customer_delivery_jobs'))return [[{...state}]];
      if(sql.includes('completion_whatsapp_sent_at = CURRENT_TIMESTAMP'))state.completion_whatsapp_sent_at='2026-01-01';
      if(sql.includes('route_whatsapp_sent_at = CURRENT_TIMESTAMP'))state.route_whatsapp_sent_at='2026-01-01';
      if(sql.includes('SET route_whatsapp_error = ?'))state.route_whatsapp_error=params[0];
      if(sql.includes('SET completion_whatsapp_error = ?'))state.completion_whatsapp_error=params[0];
      return [{affectedRows:1}];
    };
    const context={pool:{query,getConnection:async()=>({query,release(){releases++;}})},console,
      mapCustomerDeliveryJob:r=>r,normalizeDeliveryLedgerAmount:Number,formatDateTimeSql:()=>'',
      isUnassignedStoreDeliveryJob:j=>j.delivery_person_customer_id==='store:unassigned',
      getCustomerDeliverySettings:async()=>({completion_whatsapp_enabled:true}),
      renderCustomerDeliveryTemplate:()=> 'Entrega de teste',
      sendDeliveryWhatsappText:async()=>{sends++;return {ok:true,status:201};},
      logCustomerDeliveryJobEvent:async()=>{},
      notifySaleCompletedWhatsApp:async()=>({status:'already_sent'}),
      STORE_DELIVERY_PERSON_ID:'store:delivery',
      sendWhatsAppAutomationMessageVps:async()=>{sends++;return {status:'sent'};},
      getCustomerDeliveryReceiptOrderNumber:()=> 'TEST',
    };
    vm.createContext(context);
    vm.runInContext(['withCustomerDeliveryNotificationLock','notifyCustomerDeliveryCompleted','notifyCustomerDeliveryOutForDelivery','getCustomerDeliveryCompletionBlockers','completeCustomerDeliveryJob'].map(fn).join('\n'),context);
    return {state,context,sends:()=>sends,releases:()=>releases};
  }
  test(file+': pending cannot complete, route can complete without a photo',()=>{
    const {context,state}=harness();
    assert.equal(context.getCustomerDeliveryCompletionBlockers({...state,delivery_status:'pending'},null).some(s=>s.includes('saida')),true);
    assert.equal(context.getCustomerDeliveryCompletionBlockers(state,null).length,0);
    assert.equal(context.getCustomerDeliveryCompletionBlockers({...state,delivery_status:'pending'},null,{adminOverride:true}).length,0);
  });
  test(file+': starting a route never completes the order and exposes a failed notice',async()=>{
    const h=harness({delivery_status:'pending'});const events=[];let handler;
    const query=async(sql)=>{
      if(sql.includes("SET delivery_status = 'in_route'"))h.state.delivery_status='in_route';
      if(sql.includes('SELECT * FROM customer_delivery_jobs'))return [[{...h.state}]];
      return [{affectedRows:1}];
    };
    Object.assign(h.context,{
      pool:{query,getConnection:async()=>({query,beginTransaction:async()=>{},commit:async()=>{events.push('commit');},rollback:async()=>{},release(){}})},
      logCustomerDeliveryJobEvent:async()=>{events.push('route-log');},
      notifyCustomerDeliveryOutForDelivery:async()=>{events.push('notify');return {status:'failed',error:'provider rejected'};},
      crypto:require('node:crypto'),fastify:{post(_path,_options,fn){handler=fn;}},
    });
    const start=source.indexOf("fastify.post('/delivery/jobs/:token/start-route'");
    vm.runInContext(source.slice(start,source.indexOf('\n});',start)+5),h.context);
    const response=await handler({params:{token:'test-token'}},{code(status){throw Error('Unexpected HTTP '+status);}});
    assert.equal(response.delivery_status,'in_route');assert.equal(response.route_notification.status,'failed');
    assert.deepEqual(events,['commit','route-log','notify']);
  });
  test(file+': duplicate completion preserves timestamp without writes; cancelled is rejected',async()=>{
    const {context,state}=harness();const connection={query(){throw Error('Unexpected database write');}};
    const delivered={...state,delivery_status:'delivered',delivered_at:'original'};
    assert.equal((await context.completeCustomerDeliveryJob(connection,delivered,'')).delivered_at,'original');
    await assert.rejects(context.completeCustomerDeliveryJob(connection,{...state,delivery_status:'cancelled'},''),/cancelada/);
  });
  test(file+': stale copies cannot resend a confirmed completion',async()=>{
    const h=harness({delivery_status:'delivered'});const stale={...h.state};
    await h.context.notifyCustomerDeliveryCompleted(stale);
    const result=await h.context.notifyCustomerDeliveryCompleted(stale);
    assert.equal(h.sends(),1);assert.equal(result.duplicate,true);assert.equal(h.releases(),2);
  });
  test(file+': uncertain completion does not resend and pending cannot emit completion notices',async()=>{
    const h=harness({delivery_status:'delivered'});let calls=0;
    h.context.sendDeliveryWhatsappText=async()=>{calls++;throw Error('Timeout sending');};
    assert.equal((await h.context.notifyCustomerDeliveryCompleted(h.state)).status,'ambiguous');
    assert.match(h.state.completion_whatsapp_error,/^envio_incerto:/);
    assert.equal((await h.context.notifyCustomerDeliveryCompleted(h.state)).status,'ambiguous');assert.equal(calls,1);
    h.state.delivery_status='pending';
    assert.equal((await h.context.notifyCustomerDeliveryCompleted(h.state)).status,'skipped');assert.equal(calls,1);
  });
  test(file+': concurrent sends use one cross-process lock and release it',async()=>{
    const h=harness();let finish;const pending=new Promise(resolve=>{finish=resolve;});let calls=0;
    const first=h.context.withCustomerDeliveryNotificationLock(h.state,'route',async()=>{calls++;await pending;return {status:'sent'};});
    await new Promise(resolve=>setImmediate(resolve));
    const second=await h.context.withCustomerDeliveryNotificationLock(h.state,'route',async()=>{calls++;});
    assert.equal(second.status,'pending');finish();await first;assert.equal(calls,1);
    await assert.rejects(h.context.withCustomerDeliveryNotificationLock(h.state,'route',async()=>{throw Error('failure');}),/failure/);
    let retried=false;await h.context.withCustomerDeliveryNotificationLock(h.state,'route',async()=>{retried=true;});assert.equal(retried,true);
  });
  test(file+': uncertain route send is persisted and never blindly retried',async()=>{
    const h=harness();let calls=0;
    h.context.sendWhatsAppAutomationMessageVps=async()=>{calls++;return {status:'ambiguous',error:'timeout'};};
    assert.equal((await h.context.notifyCustomerDeliveryOutForDelivery(h.state)).status,'ambiguous');
    assert.match(h.state.route_whatsapp_error,/^envio_incerto:/);
    assert.equal((await h.context.notifyCustomerDeliveryOutForDelivery(h.state)).status,'ambiguous');assert.equal(calls,1);
  });
  test(file+': route failure remains visible and can retry, but a delivered job never sends a route notice',async()=>{
    const h=harness();let calls=0;
    h.context.sendWhatsAppAutomationMessageVps=async()=>{calls++;return calls===1?{status:'failed',error:'provider rejected'}:{status:'sent'};};
    assert.equal((await h.context.notifyCustomerDeliveryOutForDelivery(h.state)).status,'failed');
    assert.match(h.state.route_whatsapp_error,/provider rejected/);
    assert.equal((await h.context.notifyCustomerDeliveryOutForDelivery(h.state)).status,'sent');assert.equal(calls,2);
    h.state.delivery_status='delivered';h.state.route_whatsapp_sent_at=null;
    assert.equal((await h.context.notifyCustomerDeliveryOutForDelivery(h.state)).status,'skipped');assert.equal(calls,2);
  });
}
