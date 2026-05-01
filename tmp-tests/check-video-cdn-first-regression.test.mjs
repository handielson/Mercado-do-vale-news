import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');
  const routeStart = source.indexOf("fastify.get('/check-video'");
  assert.notEqual(routeStart, -1, `${file} should define /check-video`);

  const nextSection = source.indexOf('\n\n//', routeStart + 1);
  const routeSource = source.slice(routeStart, nextSection === -1 ? undefined : nextSection);
  const firstHead = routeSource.indexOf("method: 'HEAD'");
  const firstSynologyLogin = routeSource.indexOf('synoLogin(2500)');

  assert.ok(firstHead > -1, `${file} should check the video CDN with HEAD`);
  assert.ok(firstSynologyLogin > -1, `${file} should keep only a short Synology fallback`);
  assert.ok(
    firstHead < firstSynologyLogin,
    `${file} should check CDN before Synology so product lists do not wait on 15s Synology timeouts`
  );
  assert.match(
    source,
    /function synoHttpGet\(urlObj, path, timeoutMs = 15000\)/,
    `${file} should allow short Synology timeouts for check-video`
  );
}

console.log('check-video cdn-first regression ok');
