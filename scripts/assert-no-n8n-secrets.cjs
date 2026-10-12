'use strict';
const fs=require('node:fs'),cp=require('node:child_process');
function inspect(file,content){
 const findings=[];
 if(file.replace(/\\/g,'/')==='.cursor/mcp.json')findings.push('private_mcp_config_tracked');
 const pattern=/\bN8N_(?:API_KEY|MCP_ACCESS_TOKEN)\b["']?\s*[:=]\s*["'](eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)["']/g;
 if(pattern.test(content))findings.push('literal_n8n_token');
 return findings;
}
function audit(staged=false){
 const names=cp.execFileSync('git',staged?['diff','--cached','--name-only','--diff-filter=ACMR','-z']:['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
 const result=[];for(const file of names){if(!/\.(?:json|[cm]?js|tsx?|toml|ya?ml|md|txt|env)$/i.test(file)&&file!=='.cursor/mcp.json')continue;
 let content;try{content=staged?cp.execFileSync('git',['show',':'+file],{encoding:'utf8',maxBuffer:10000000}):fs.readFileSync(file,'utf8');}catch{continue;}
 for(const reason of inspect(file,content))result.push({file,reason});}
 return result;
}
if(require.main===module){const findings=audit(process.argv.includes('--staged'));if(findings.length){for(const x of findings)process.stderr.write(x.file+': '+x.reason+'\n');process.exitCode=1;}else console.log('n8n secret guard passed');}
module.exports={inspect,audit};
