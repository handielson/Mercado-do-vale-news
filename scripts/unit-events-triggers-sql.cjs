#!/usr/bin/env node
'use strict';
// Imprime o SQL dos triggers que deixam unit_events só-inclusão.
// Roda como root na VPS (binlog ligado exige SUPER para CREATE TRIGGER):
//   node scripts/unit-events-triggers-sql.cjs | mysql -uroot mercadodovale
const { unitEventsMigration } = require('../services/unitLocation.cjs');
const steps = unitEventsMigration();
const out = [steps[0].sql + ';'];
for (const step of steps.slice(1)) out.push(`DROP TRIGGER IF EXISTS \`${step.name}\`;`, step.sql + ';');
process.stdout.write(out.join('\n') + '\n');
