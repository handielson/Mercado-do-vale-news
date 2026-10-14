'use strict';
const hook="require('./services/unitJournalServer.cjs').registerUnitJournalRoutes(fastify, { pool, getBearerAuthContext: getVpsBearerAuthContext });";
function patch(source) {
    if(source.includes(hook))return source;
    const anchor="// ─── Units (inventory de unidades serializadas: 1 linha por aparelho) ──────";
    if(source.split(anchor).length!==2||!source.includes('async function getVpsBearerAuthContext('))throw Error('Unit journal authentication anchor drift');
    const newline=source.includes('\r\n')?'\r\n':'\n';
    return source.replace(anchor,anchor+newline+hook);
}
const deploy=options=>require('./deploy-openai-finance.cjs').deploy({...options,patchSource:patch,
    moduleFiles:['services/unitJournalSchema.cjs','services/unitJournalServer.cjs'],backupSlug:'unit-journal'});
module.exports={patch,deploy};
