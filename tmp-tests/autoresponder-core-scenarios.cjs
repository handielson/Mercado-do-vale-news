const fs = require('fs');

function readEnv(name) {
  for (const file of ['.env.vps.local', '.env.local', '.env', '.env.production']) {
    if (!fs.existsSync(file)) continue;
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      if (!line || line.trim().startsWith('#') || !line.includes('=')) continue;
      const [key, ...rest] = line.split('=');
      if (key.trim() === name) return rest.join('=').trim().replace(/^"|"$/g, '');
    }
  }
  return process.env[name] || '';
}

const apiBase = process.env.AUTORESPONDER_TEST_API || 'https://api.xiaomipetrolina.com.br';
const syncKey = process.env.SYNC_SECRET || readEnv('SYNC_SECRET');

if (!syncKey) throw new Error('Missing SYNC_SECRET for /autoresponder/test-flow');

const scenarios = [
  {
    name: 'product search footer',
    messages: ['redmi note 15'],
    assert: (result) => {
      const text = JSON.stringify(result);
      if (!text.includes('vamos ficar com qual deles hoje?')) {
        throw new Error('product footer did not include new choice prompt');
      }
    },
  },
  {
    name: 'standalone delivery cep',
    messages: ['faz entrega?', '56320690'],
    assert: (result) => {
      const text = JSON.stringify(result);
      if (!text.includes('Atendemos esse CEP') && !text.includes('Encontrei este endereco')) {
        throw new Error('delivery CEP was not consulted');
      }
      if (text.includes('instabilidade')) {
        throw new Error('delivery CEP scenario returned instability fallback');
      }
    },
  },
];

async function runScenario(scenario) {
  const response = await fetch(`${apiBase}/autoresponder/test-flow`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Sync-Key': syncKey,
    },
    body: JSON.stringify({
      sender: `scenario-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      messages: scenario.messages,
      cleanup: true,
    }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`${scenario.name} failed HTTP ${response.status}: ${JSON.stringify(body)}`);
  scenario.assert(body);
  console.log(`PASS ${scenario.name}`);
}

(async () => {
  for (const scenario of scenarios) await runScenario(scenario);
})();
