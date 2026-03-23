require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkTable() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD || process.env.DB_PASS,
        database: process.env.DB_NAME
    });

    try {
        const [rows] = await conn.query('DESCRIBE customer_favorites');
        console.log("Table exists:", rows);
    } catch (e) {
        if (e.code === 'ER_NO_SUCH_TABLE') {
            console.log("Table customer_favorites does not exist on VPS. Creating it...");
            await conn.query(`
                CREATE TABLE customer_favorites (
                    customer_id VARCHAR(50) NOT NULL,
                    product_id VARCHAR(50) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (customer_id, product_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `);
            console.log("Table created.");
        } else {
            console.error(e);
        }
    } finally {
        await conn.end();
    }
}
checkTable();
