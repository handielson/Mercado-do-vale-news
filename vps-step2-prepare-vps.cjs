const { Client } = require('ssh2');

const conn = new Client();

console.log('Analisando o código da API na VPS e atualizando MySQL...');

conn.on('ready', () => {
  const cmd = `
    echo "=== Alterando Banco de Dados para Inserir Novas Colunas (ignorando erros se já existirem) ==="
    mysql -u root -e "
      USE mercadodovale;
      SET @dbname = 'mercadodovale';
      SET @tablename = 'products';
      
      -- Helper procedure to add column if not exists
      DROP PROCEDURE IF EXISTS AddCol;
      DELIMITER //
      CREATE PROCEDURE AddCol(IN colName VARCHAR(255), IN colDef VARCHAR(255))
      BEGIN
          IF NOT EXISTS (
              SELECT * FROM information_schema.COLUMNS 
              WHERE table_schema = @dbname 
              AND table_name = @tablename 
              AND column_name = colName
          ) THEN
              SET @ddl = CONCAT('ALTER TABLE ', @dbname, '.', @tablename, ' ADD COLUMN ', colName, ' ', colDef);
              PREPARE stmt FROM @ddl;
              EXECUTE stmt;
              DEALLOCATE PREPARE stmt;
          END IF;
      END //
      DELIMITER ;
      
      CALL AddCol('images', 'JSON');
      CALL AddCol('specs', 'JSON');
      CALL AddCol('technical_specifications', 'TEXT');
      CALL AddCol('video_url', 'VARCHAR(1000)');
      CALL AddCol('exclude_from_seo', 'TINYINT(1) DEFAULT 0');
      CALL AddCol('is_combo', 'TINYINT(1) DEFAULT 0');
      CALL AddCol('kits', 'JSON');
      CALL AddCol('tags', 'JSON');
      CALL AddCol('updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
      
      DROP PROCEDURE AddCol;
    " 2>&1
    
    echo "=== Colunas Finais ==="
    mysql -u root -e "DESCRIBE mercadodovale.products;"
    
    echo "=== Procurando rotas/controllers de Update de Produtos ==="
    find /var/www/mdv-api -type f -name "*product*.js" -o -name "*product*.ts" | grep -v node_modules | grep -v build
    
    echo "=== Código de um arquivo (batch / upsert) ==="
    # Lendo o arquivo mais provável de conter o batch upsert para checar as query strings
    FILE=$(grep -rl "batch" /var/www/mdv-api/src/ | grep -v node_modules | head -n 1)
    if [ ! -z "$FILE" ]; then
      echo "Lendo: $FILE"
      cat "$FILE"
    else
      echo "Não foi encontrado rota de batch. Procurando código SQL de produtos:"
      grep -r -A 5 -B 5 "INSERT INTO products" /var/www/mdv-api/src/ | grep -v node_modules | head -n 30
    fi
  `;

  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    let output = '';
    stream.on('close', (code, signal) => {
      console.log('Resultados finais obtidos.');
      console.log('--------------------------------------------------');
      console.log(output);
      console.log('--------------------------------------------------');
      console.log('Por favor, copie os resultados e envie para o chat!');
      conn.end();
    }).on('data', (data) => {
      output += data;
    }).stderr.on('data', (data) => {
      console.error('STDERR: ' + data);
    });
  });
}).connect({
  host: '76.13.232.162',
  port: 22,
  username: 'root',
  password: '@@@@Jsj2865@@@@',
  readyTimeout: 30000
});

conn.on('error', (err) => {
  console.error('Erro de conexão SSH:', err);
});
