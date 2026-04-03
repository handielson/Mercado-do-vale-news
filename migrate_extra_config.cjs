/**
 * Migration: Adiciona coluna extra_config JSON na tabela shipping_settings
 * Executar uma única vez na VPS MySQL.
 * 
 * Uso: node migrate_extra_config.cjs
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

async function run() {
    const pool = await mysql.createPool({
        host:     process.env.VPS_DB_HOST     || 'localhost',
        user:     process.env.VPS_DB_USER     || 'root',
        password: process.env.VPS_DB_PASSWORD || '',
        database: process.env.VPS_DB_NAME     || 'mdv',
    });

    console.log('🔧 Verificando coluna extra_config...');

    const [cols] = await pool.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'shipping_settings'
           AND COLUMN_NAME  = 'extra_config'`
    );

    if (cols.length > 0) {
        console.log('✅ Coluna extra_config já existe. Nada a fazer.');
    } else {
        await pool.query(
            `ALTER TABLE shipping_settings ADD COLUMN extra_config JSON NULL COMMENT 'Configurações adicionais genéricas (ex: fast_delivery_config)'`
        );
        console.log('✅ Coluna extra_config adicionada com sucesso!');
    }

    await pool.end();
}

run().catch(err => { console.error('❌ Erro:', err); process.exit(1); });
