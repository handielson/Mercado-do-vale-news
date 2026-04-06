import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=([^\r\n]+)/)[1].replace(/["']/g, '');
const key = env.match(/VITE_SUPABASE_ANON_KEY=([^\r\n]+)/)[1].replace(/["']/g, '');

fetch(url + '/rest/v1/company_settings?select=bling_access_token', {
    headers: { apikey: key, 'Authorization': 'Bearer ' + key }
}).then(r => r.json()).then(data => {
    const token = data[0].bling_access_token;

    const tests = [
        { name: "Snake case", q: "data_vencimento_inicial=2025-12-01&data_vencimento_final=2025-12-31" },
        { name: "Short", q: "dataInicial=2025-12-01&dataFinal=2025-12-31" },
        { name: "dataVencimento[] array", q: "dataVencimento[inicial]=2025-12-01&dataVencimento[final]=2025-12-31" },
        { name: "vencimentoInicial", q: "vencimentoInicial=2025-12-01&vencimentoFinal=2025-12-31" }
    ];

    async function runTests() {
        for (const t of tests) {
            console.log(`\n--- Test: ${t.name} ---`);
            const res = await fetch(`https://api.bling.com.br/Api/v3/contas/receber?limite=5&pagina=1&${t.q}`, {
                headers: { 'Authorization': 'Bearer ' + token }
            }).then(r => r.json());

            if (res.data) {
                console.log(`Returned ${res.data.length} items. First item date: ${res.data[0]?.vencimento}`);
            } else {
                console.log("Error:", res);
            }
        }
    }

    runTests();
});
