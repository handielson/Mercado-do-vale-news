'use strict';
// Junta model-token-match-v1 e catalog-finish-send-v1 num deploy só (caso 557488087672, 22/11).
const token = require('./n8n-model-token-match.cjs');
const finish = require('./n8n-catalog-finish-send.cjs');
const NODES = [token.NODE, finish.NODE];
const patchWorkflow = (workflow) => finish.patchWorkflow(token.patchWorkflow(workflow));
module.exports = { NODES, patchWorkflow };
