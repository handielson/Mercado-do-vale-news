const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8').split('\n');
let url = '', key = '';
env.forEach(line => {
    line = line.trim();
    if(line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].replace(/['"]/g, '').trim();
    if(line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].replace(/['"]/g, '').trim();
});

(async () => {
    try {
        const res = await fetch(`${url}/rest/v1/products?name=ilike.*Capa*&select=id,name,model_id`, {
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`
            }
        });
        const data = await res.json();
        
        let note60Id = null;
        let c360Id = null;

        for (const p of data) {
            if (p.name.includes('Note 60')) {
                console.log('NOTE 60:', p.name, 'MODEL_ID:', p.model_id);
                note60Id = p.model_id;
            }
            if (p.name.includes('360')) {
                console.log('360:', p.name, 'MODEL_ID:', p.model_id);
                c360Id = p.model_id;
            }
        }
    } catch (e) {
        console.error(e);
    }
})();
