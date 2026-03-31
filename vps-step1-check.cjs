const { Client } = require('ssh2');

const conn = new Client();

console.log('Iniciando conexão com a VPS (76.13.232.162)...');

conn.on('ready', () => {
  console.log('Conexão SSH estabelecida. Buscando esquema do banco de dados e arquivos da API...');
  
  // 1. Mostrar as colunas da tabela products do banco de dados
  // (Assuming database name is what the API uses, we'll just search for databases and look for one like `mercado`, `api`, etc, or `xiaomi`)
  const cmd = `
    echo "=== Bancos de Dados MySQL ==="
    mysql -u root -e "SHOW DATABASES;"
    
    echo "=== API Caminho Local ==="
    find /var/www -maxdepth 2 -name "package.json" 2>/dev/null
    find /home -maxdepth 3 -name "package.json" 2>/dev/null
    
    echo "=== Tabela Products (se existir num BD provável) ==="
    for db in $(mysql -u root -e "SHOW DATABASES;" | awk '{print $1}' | grep -v 'Database' | grep -v 'information_schema' | grep -v 'performance_schema' | grep -v 'mysql' | grep -v 'sys'); do
      mysql -u root -e "DESCRIBE $db.products;" 2>/dev/null | awk '{print $1, $2}' | sed "s/^/[$db] /"
    done
  `;

  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    let output = '';
    stream.on('close', (code, signal) => {
      console.log('Comando finalizado.');
      console.log('----------------RESULTADOS----------------');
      console.log(output);
      console.log('------------------------------------------');
      console.log('Por favor, copie o resultado acima e cole no nosso chat para eu analisar e preparar o script de adequação do banco.');
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
