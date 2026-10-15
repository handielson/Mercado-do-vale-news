'use strict';
const assert=require('node:assert/strict');
const MODEL='gpt-6-luna';
const CHAT_NODES=['OpenAI Chat Model','OpenAI Classificador','OpenAI Vendas'];
const VISION='PayJoy - Ler aprovacao',CALC='PayJoy - Calcular entrada do print';
const SCOPED_NODES=[...CHAT_NODES,VISION,CALC];
const OLD_PARSE="String($json.content||'')";
const PARSER_MARKER='// gpt6-luna-migration-v1:vision-output';
const PARSER=String.raw`// gpt6-luna-migration-v1:vision-output
const payjoyVisionTextV6 = (() => {
 if ($json.error || ($json.status && $json.status !== 'completed')) return '';
 if (typeof $json.content === 'string') return $json.content;
 if ($json.status !== 'completed' || !Array.isArray($json.output)) return '';
 const messages = $json.output.filter(item => item?.type === 'message' && item.role === 'assistant');
 if (messages.some(item => !Array.isArray(item.content))) return '';
 const parts = messages.flatMap(item => item.content);
 if (parts.some(item => item?.type === 'refusal')) return '';
 return parts.filter(item => item?.type === 'output_text' && typeof item.text === 'string').map(item => item.text).join('');
})();
`;
function get(workflow,name){const nodes=workflow.nodes.filter(n=>n.name===name);assert.equal(nodes.length,1,'Missing/ambiguous node '+name);return nodes[0];}
function patchWorkflow(input){
 const w=structuredClone(input);
 for(const name of CHAT_NODES){
  const n=get(w,name);assert.equal(n.type,'@n8n/n8n-nodes-langchain.lmChatOpenAi');
  assert.ok(['gpt-4.1-mini',MODEL].includes(n.parameters.model?.value),'Unexpected model drift: '+name);
  n.parameters.model={__rl:true,value:MODEL,mode:'id'};
  const extra=JSON.parse(n.parameters.options?.extraBody || '{}');
  n.parameters.options={...n.parameters.options,extraBody:JSON.stringify({...extra,reasoning_effort:'none'}),temperature:0};
  delete n.parameters.options.reasoningEffort;
 }
 const vision=get(w,VISION);assert.equal(vision.type,'@n8n/n8n-nodes-langchain.openAi');
 assert.ok([1.8,2.3].includes(vision.typeVersion),'Unexpected vision version');
 assert.equal(vision.parameters.resource,'image');assert.equal(vision.parameters.operation,'analyze');
 assert.ok(['gpt-4.1-mini',MODEL].includes(vision.parameters.modelId?.value),'Unexpected vision model');
 vision.typeVersion=2.3;
 vision.parameters={...vision.parameters,modelId:{__rl:true,value:MODEL,mode:'id'},simplify:false,
  options:{...vision.parameters.options,maxTokens:1600}};
 const calc=get(w,CALC);let code=calc.parameters.jsCode;
 if(!code.includes(PARSER_MARKER)){
  assert.equal(code.split(OLD_PARSE).length,2,'PayJoy output parser drift');
  assert.equal(code.split('let result;try{').length,2,'PayJoy parse boundary drift');
  code=code.replace('let result;try{',PARSER+'let result;try{').replace(OLD_PARSE,'payjoyVisionTextV6');
 }
 calc.parameters.jsCode=code;
 validate(w);return w;
}
function validate(w){
 for(const name of CHAT_NODES){const n=get(w,name);assert.equal(n.parameters.model.value,MODEL);assert.equal(JSON.parse(n.parameters.options.extraBody).reasoning_effort,'none');assert.equal(n.parameters.options.temperature,0);}
 const v=get(w,VISION);assert.equal(v.typeVersion,2.3);assert.equal(v.parameters.modelId.value,MODEL);
 assert.equal(v.parameters.inputType,'base64');assert.equal(v.parameters.binaryPropertyName,'payjoy');
 assert.equal(v.parameters.simplify,false);assert.equal(v.parameters.options.maxTokens,1600);
 assert.ok(get(w,CALC).parameters.jsCode.includes(PARSER));
 const names=new Set(w.nodes.map(n=>n.name));assert.equal(names.size,w.nodes.length);
 for(const [name,outs]of Object.entries(w.connections)){assert.ok(names.has(name));for(const groups of Object.values(outs))for(const group of groups)for(const edge of group)assert.ok(names.has(edge.node));}
 for(const n of w.nodes)if(n.parameters?.jsCode)new Function('$json','$','$getWorkflowStaticData','$input',n.parameters.jsCode);
 return {model:MODEL,chatNodes:CHAT_NODES.length,nativeVisionVersion:v.typeVersion,legacyContentAccepted:true,responsesContentAccepted:true};
}
module.exports={MODEL,CHAT_NODES,SCOPED_NODES,patchWorkflow,validate};
