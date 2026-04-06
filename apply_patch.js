import fs from 'fs';
import pg from 'pg';

const dotenv = fs.readFileSync('.env', 'utf-8');

// Acha a String de Conexão com o Postgres
const urlPgMatch = dotenv.match(/DATABASE_URL=(['"]?)(.*?)\1/);
if (!urlPgMatch) {
    console.error("Nenhuma DATABASE_URL encontrada no .env");
    process.exit(1);
}
const urlPg = urlPgMatch[2];

const sql = fs.readFileSync('supabase/migrations/20260226_promotions_rls_fix.sql', 'utf8');

const { Client } = pg;
const client = new Client({ connectionString: urlPg });

client.connect()
    .then(() => {
        console.log("Conectado ao DB. Executando Patch das Políticas RLS...");
        return client.query(sql);
    })
    .then(() => {
        console.log("Patch Executado com Sucesso! RLS de Promoções Corrigido.");
        process.exit(0);
    })
    .catch((err) => {
        console.error("Erro ao aplicar Patch:", err);
        process.exit(1);
    });
