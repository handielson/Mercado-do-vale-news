import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const api = fs.readFileSync('services/marketingCampaignApi.cjs', 'utf8');
const start = api.indexOf('function metaReviewState');
const end = api.indexOf('\n}\n\nfunction adsManagerUrl', start) + 2;

assert.ok(start >= 0 && end > start, 'metaReviewState must remain discoverable');
const metaReviewState = vm.runInNewContext(`(${api.slice(start, end)})`);

assert.equal(metaReviewState({ status: 'ACTIVE', effective_status: 'ADSET_PAUSED' }), 'attention');
assert.equal(metaReviewState(
    { status: 'ACTIVE', effective_status: 'ADSET_PAUSED' },
    { securityReviewConfirmed: true },
), 'approved');
assert.equal(metaReviewState(
    { status: 'ACTIVE', effective_status: 'CAMPAIGN_PAUSED' },
    { securityReviewConfirmed: true },
), 'approved');
assert.equal(metaReviewState(
    { status: 'ACTIVE', effective_status: 'DISAPPROVED' },
    { securityReviewConfirmed: true },
), 'rejected');
assert.equal(metaReviewState(
    { status: 'ACTIVE', effective_status: 'IN_PROCESS' },
    { securityReviewConfirmed: true },
), 'in_review');
assert.equal(metaReviewState({ status: 'PAUSED', effective_status: 'ADSET_PAUSED' }), 'approved');
assert.equal(metaReviewState({ status: 'ACTIVE', effective_status: 'ACTIVE' }), 'active');

console.log('marketing Meta review state: OK');
