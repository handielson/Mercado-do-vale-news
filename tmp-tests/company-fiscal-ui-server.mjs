// Isolated browser fixture: no database, credentials or external API requests.
import { createServer } from 'vite';
const fixture = `import React from 'react';
import { createRoot } from 'react-dom/client';
import '/index.css';
import { CompanyFiscalPanel } from '/components/company/CompanyFiscalPanel.tsx';
const rows = [{id:'primary',primary:true,name:'Empresa de demonstração',cnpj:'11222333000181',legalName:'Empresa de demonstração Ltda',stateRegistration:'032141840',municipalRegistration:'IM-123',suframaRegistration:'',cnae:'4751201',companySize:'Micro',mainActivity:'Comércio',segments:['comercio'],annualRevenueBand:'',employeesBand:'',contactPerson:'',phone:'',mobilePhone:'',email:'',billingEmail:'',website:'',substituteStateRegistrations:[],uf:'PE',municipalityCode:'2611101',address:{zipCode:'56300000',street:'Rua de exemplo',number:'1',complement:'',neighborhood:'Centro',city:'Petrolina'},regime:'simples_nacional',crt:'1',effectiveFrom:'2026-01-01',notes:'Dados fictícios para demonstração local.',version:1,lookup:null}];
const api = {
 list: async () => ({enabled:true,companies:structuredClone(rows)}),
 save: async c => { const saved={...structuredClone(c),id:c.id==='new'?'fixture-b':c.id,version:c.version+1}; const i=rows.findIndex(r=>r.id===saved.id); if(i<0)rows.push(saved);else rows[i]=saved; return structuredClone(saved); },
 refresh: async c => {const saved={...c,version:c.version+1,lookup:{cnpj:c.cnpj,source:'Fonte simulada',consultedAt:new Date().toISOString(),simples:true,mei:false,suggestedRegime:'simples_nacional',municipalityCode:'2611101'}};rows[rows.findIndex(r=>r.id===c.id)]=saved;return structuredClone(saved);},
 readiness: async () => ({ready:false,missing:['certificado'],municipality:{status:'confirmed',officialName:'Petrolina',officialUf:'PE'}})
};
createRoot(document.getElementById('root')).render(React.createElement(CompanyFiscalPanel,{api}));`;
const server = await createServer({ configFile:false, envDir:false, optimizeDeps:{entries:[],include:['react','react-dom/client','react/jsx-dev-runtime']}, server:{host:'127.0.0.1',port:4197,strictPort:true}, plugins:[{
 name:'fiscal-fixture', configureServer(s){s.middlewares.use(async(req,res,next)=>{
  if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml('/', '<html lang="pt-BR"><meta charset="utf-8"><title>Cadastro fiscal — demonstração local</title><body class="bg-slate-100"><main class="mx-auto max-w-5xl p-6"><p class="mb-4 rounded-lg bg-amber-100 p-3 text-sm text-amber-900">Demonstração local com dados fictícios. Alterações permanecem apenas nesta sessão.</p><div id="root"></div></main><script type="module" src="/fiscal-fixture.jsx"></script></body></html>'));return;}
  next();
 });}, resolveId(id){if(id==='/fiscal-fixture.jsx')return '\0fiscal-fixture.jsx';}, load(id){if(id==='\0fiscal-fixture.jsx')return fixture;}
}] });
await server.listen();
console.log('Fiscal fixture: http://127.0.0.1:4197');
