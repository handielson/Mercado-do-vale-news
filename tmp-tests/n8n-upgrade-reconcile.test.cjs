'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {remoteProgram, summarize} = require('../scripts/n8n-upgrade-reconcile.cjs');

test('overlap keeps preexisting missing IDs separate from new missing IDs', () => {
  const baseline = {evolution:[{waId:'old'}]};
  const current = {evolution:[{waId:'old'},{waId:'new'},{waId:'logged'}],loggedWaIds:['logged'],metaEvents:[]};
  const result = summarize(baseline,current);
  assert.deepEqual(result.newEvolution.map(row=>row.waId),['new','logged']);
  assert.deepEqual(result.newMissing.map(row=>row.waId),['new']);
  assert.deepEqual(result.oldMissing.map(row=>row.waId),['old']);
});

test('Meta missing jobs and unresolved states remain visible', () => {
  const current = {evolution:[],loggedWaIds:[],metaEvents:[
    {id:1,job_status:null},{id:2,job_status:'ready'},
    {id:3,job_status:'completed'},{id:4,job_status:'suppressed'},
  ]};
  const result = summarize({evolution:[]},current);
  assert.deepEqual(result.missingMetaJobs.map(row=>row.id),[1]);
  assert.deepEqual(result.unresolvedMetaJobs.map(row=>row.id),[2]);
});

test('remote code uses only read-only queries and has valid generated syntax', () => {
  const vm = require('node:vm');
  for (const [mode, baseline] of [['baseline',null],['reconcile',{overlapStart:123,metaMaxEventId:5}]]) {
    const program = remoteProgram(mode,baseline);
    new vm.Script(program);
    assert.match(program,/SELECT DISTINCT wa_message_id/);
    assert.doesNotMatch(program,/\b(?:INSERT|UPDATE|DELETE|REPLACE)\s+(?:INTO|FROM|[a-z_])/i);
    assert.doesNotMatch(program,/webhook\/set|sendText|sendMedia/i);
  }
});
