import ts from 'typescript';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
// Compare in memory; never replace the user's working files.
const files=['pages/admin/settings/MarketingPage.tsx','pages/admin/settings/marketing/ProductMarketingCard.tsx','pages/admin/settings/marketing/productCommercialCopy.ts'];
const baseline=new Map(files.map(file=>[path.resolve(file).replaceAll('\\','/'),execFileSync('git',['show',`HEAD:${file}`],{encoding:'utf8'})]));
const config=ts.readConfigFile('tsconfig.json',ts.sys.readFile);const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,process.cwd());
function diagnostics(useBaseline){const host=ts.createCompilerHost(parsed.options),read=host.readFile;host.readFile=file=>useBaseline && baseline.has(file.replaceAll('\\','/'))?baseline.get(file.replaceAll('\\','/')):read(file);const program=ts.createProgram(parsed.fileNames,parsed.options,host);return ts.getPreEmitDiagnostics(program).map(d=>({file:d.file?path.relative(process.cwd(),d.file.fileName).replaceAll('\\','/'):'',code:d.code,message:ts.flattenDiagnosticMessageText(d.messageText,' ')}));}
const before=diagnostics(true),after=diagnostics(false);const counts=new Map();for(const d of before){const key=JSON.stringify(d);counts.set(key,(counts.get(key)||0)+1)}const added=after.filter(d=>{const key=JSON.stringify(d),count=counts.get(key)||0;if(count){counts.set(key,count-1);return false}return true});
const report={baselineErrors:before.length,currentErrors:after.length,newDiagnostics:added};writeFileSync('tmp-tests/marketing-scenes-type-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(added.length)process.exitCode=1;
