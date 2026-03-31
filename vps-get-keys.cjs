const { Client } = require('ssh2');
const fs = require('fs');

const sshConfig = {
    host: '76.13.232.162',
    port: 22,
    username: 'root',
    password: '@@@@Jsj2865@@@@'
};

const conn = new Client();
console.log('Iniciando conexão com a VPS para buscar a SYNC_KEY...');

conn.on('ready', () => {
    console.log('Conexão SSH estabelecida. Lendo .env da API...');

    conn.exec('cat /var/www/mdv-api/.env', (err, stream) => {
        if (err) throw err;

        let data = '';
        stream.on('data', (chunk) => {
            data += chunk.toString();
        }).on('close', () => {
            conn.end();
            // Procura SYNC_SECRET (nome real no .env da VPS)
            const match = data.match(/SYNC_SECRET=([^\n\r]+)/);
            if (match && match[1]) {
                const key = match[1].trim();
                console.log('Chave SYNC_SECRET encontrada na VPS: ' + key);
                
                // Injetar no .env.local e no .env
                let envLocal = '';
                if (fs.existsSync('.env.local')) {
                    envLocal = fs.readFileSync('.env.local', 'utf-8');
                }
                
                if (!envLocal.includes('VITE_VPS_SYNC_KEY=')) {
                    fs.appendFileSync('.env.local', `\nVITE_VPS_SYNC_KEY=${key}\n`);
                    console.log('✅ VITE_VPS_SYNC_KEY injetada com sucesso no arquivo .env.local local!');
                } else {
                    console.log('⚠️ A chave VITE_VPS_SYNC_KEY já existe no seu .env.local local. Confira se o valor bate: ' + key);
                    fs.writeFileSync('.env.local', envLocal.replace(/VITE_VPS_SYNC_KEY=[^\n\r]+/, `VITE_VPS_SYNC_KEY=${key}`));
                    console.log('✅ A chave foi substituída pela correnta da VPS.');
                }
                
                console.log('\nPor favor, rode agora o comando: node vps-step3-migrate.cjs');
            } else {
                console.error('SYNC_KEY não encontrada no .env da VPS. A API pode estar usando outro nome.');
            }
        });
    });
}).connect(sshConfig);
