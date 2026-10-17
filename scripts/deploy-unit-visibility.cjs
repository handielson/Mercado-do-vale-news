'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { deployProductReadPrivacy } = require('./deploy-product-read-privacy.cjs');

const ENTRIES = ['server.js', 'vps_server.js', 'vps_server.cjs'];
const HELPERS = ['services/unitVisibility.cjs', 'services/unitStatusSchema.cjs'];
const START = "fastify.put('/units/:id', { preHandler: requireSyncKey }, async (req, reply) => {";
const END = '  const allowed = [';
const HANDLER = `  if ('visibility_action' in u) {
    try {
      return await require('./services/unitVisibility.cjs').setUnitVisibility({
        pool, syncProductStock, id: req.params.id, action: u.visibility_action, reason: u.reason,
      });
    } catch (error) {
      if (!error.statusCode) throw error;
      return reply.code(error.statusCode).send({ error: 'unit_visibility', message: error.message });
    }
  }
`;

function patch(remote) {
  const crlf = remote.includes('\r\n');
  const source = remote.replace(/\r\n/g, '\n');
  if (source.split(START).length !== 2) throw new Error('Unit visibility route missing or ambiguous');
  const route = source.indexOf(START);
  const start = source.indexOf('  const u = req.body || {};\n', route);
  const end = source.indexOf(END, start);
  if (start < 0 || end < 0 || source.slice(route, start).includes(END)) throw new Error('Unit visibility route shape changed');
  const body = source.slice(start + '  const u = req.body || {};\n'.length, end);
  if (body && body !== HANDLER) throw new Error('Unit visibility handler drift');
  const updated = body ? source : source.slice(0, end) + HANDLER + source.slice(end);
  return crlf ? updated.replace(/\n/g, '\r\n') : updated;
}

async function deploy(options) {
  return deployProductReadPrivacy({
    ...options,
    files: [...ENTRIES, ...HELPERS],
    backupPrefix: 'unit-visibility',
    patchFile: (remote, file) => {
      const local = fs.readFileSync(path.join(options.root, file), 'utf8');
      if (ENTRIES.includes(file)) {
        const updated = patch(remote);
        if (patch(local).replace(/\r\n/g, '\n') !== local.replace(/\r\n/g, '\n')) {
          throw new Error(`Local unit visibility handler missing in ${file}`);
        }
        return updated;
      }
      if (remote && remote.replace(/\r\n/g, '\n') !== local.replace(/\r\n/g, '\n')) {
        throw new Error(`Remote unit visibility helper drift: ${file}`);
      }
      return local;
    },
  });
}

module.exports = { ENTRIES, HELPERS, patch, deploy };
