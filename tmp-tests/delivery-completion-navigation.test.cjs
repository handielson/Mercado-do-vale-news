const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('pages/delivery/DeliveryOperationPage.tsx','utf8');
const start=source.indexOf('    const handleComplete = async () => {');
const handler=source.slice(start,source.indexOf('\n    };',start)+7);
function setup(complete,bridge=true){
  const events=[];
  const context={canComplete:true,token:'synthetic-token',note:'',setBusy:v=>events.push(['busy',v]),setErrorMessage:v=>events.push(['error',v]),
    setJob:v=>events.push(['job',v.delivery_status]),completeDeliveryJob:complete,
    getDeliveryErrorMessage:(error)=>error.message,
    window:{MdvDelivery:bridge?{stopTracking(){events.push(['stop']);},closeDelivery(){events.push(['close']);}}:undefined},
    toast:{success(){events.push(['success']);},error(){events.push(['failure']);}},
  };
  vm.createContext(context);vm.runInContext(handler+'\nthis.handleComplete = handleComplete;',context);
  return {events,run:context.handleComplete};
}
test('closes only after the API confirms delivered and stops GPS before returning home',async()=>{
  let resolve;const pending=new Promise(r=>{resolve=r;});const h=setup(()=>pending);
  const task=h.run();assert.equal(h.events.some(e=>e[0]==='close'),false);
  resolve({delivery_status:'delivered'});await task;
  assert.deepEqual(h.events.filter(e=>['job','stop','success','close'].includes(e[0])),[['job','delivered'],['stop'],['success'],['close']]);
  assert.deepEqual(h.events.at(-1),['busy',false]);
});
test('API errors leave details open with an error and allow retry',async()=>{
  const h=setup(async()=>{throw Error('Falha de teste');});await h.run();
  assert.equal(h.events.some(e=>e[0]==='close'||e[0]==='job'||e[0]==='success'),false);
  assert.equal(h.events.some(e=>e[0]==='error'&&e[1]==='Falha de teste'),true);
  assert.deepEqual(h.events.at(-1),['busy',false]);
});
test('an unconfirmed delivery response never closes or announces success',async()=>{
  const h=setup(async()=>({delivery_status:'in_route'}));await h.run();
  assert.equal(h.events.some(e=>e[0]==='close'||e[0]==='success'),false);
  assert.equal(h.events.some(e=>e[0]==='failure'),true);
});
test('web or older clients without the native bridge still save successfully',async()=>{
  const h=setup(async()=>({delivery_status:'delivered'}),false);await h.run();
  assert.equal(h.events.some(e=>e[0]==='failure'),false);
});
test('Android return clears the operation, disposes WebView and reloads the existing dashboard',()=>{
  const activity=fs.readFileSync('android/entregas/app/src/main/java/br/com/mercadodovale/entregas/MainActivity.kt','utf8');
  const method=activity.slice(activity.indexOf('        fun closeDelivery()'),activity.indexOf('        fun openExternalUrl'));
  assert.match(activity,/@JavascriptInterface\s+fun closeDelivery\(\)/);
  for(const part of ['runOnUiThread','stopLocationTracking()','currentTab = "dashboard"','operationWebView = null','showMainScreen()','completedWebView.destroy()'])assert.equal(method.includes(part),true,part);
  assert.equal(method.indexOf('operationWebView = null')<method.indexOf('showMainScreen()'),true);
  assert.equal(method.indexOf('showMainScreen()')<method.indexOf('completedWebView.destroy()'),true);
  for(const feature of ['renderDashboardTab','renderJobsTab','currentPeriod','customDate','openTrustedExternalUrl'])assert.equal(activity.includes(feature),true,feature);
});
