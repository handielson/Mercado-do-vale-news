import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');
  const planStart = source.indexOf('function buildBlingReconcilePlanVps(');
  const planEnd = source.indexOf('function summarizeBlingReconcilePlanDetailsVps(');
  assert.ok(planStart >= 0 && planEnd > planStart, `${file} must expose buildBlingReconcilePlanVps before the details summarizer`);

  const planSource = source.slice(planStart, planEnd);
  assert.doesNotMatch(planSource, /nameChanges\.push/, `${file} reconcile must not plan Bling name inheritance for linked products`);
  assert.match(planSource, /nameChanges:\s*\[\]/, `${file} reconcile must report zero name changes explicitly`);
  assert.match(planSource, /stockChanges\.push/, `${file} reconcile must still plan stock changes`);

  const routeStart = source.indexOf("if (resource === 'reconcile') {");
  const routeEnd = source.indexOf("if (resource === 'serial-sales-sync')");
  assert.ok(routeStart >= 0 && routeEnd > routeStart, `${file} must expose the reconcile route before serial-sales-sync`);
  const routeSource = source.slice(routeStart, routeEnd);
  assert.doesNotMatch(routeSource, /applyReconcileNameChangesVps\(/, `${file} reconcile apply must not write local product names from Bling`);
}

console.log('vps Bling reconcile preserves linked product names static ok');
