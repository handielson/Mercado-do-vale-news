const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
  console.log('SSH conectado sucesso!');
  
  const endpoint = `
fastify.patch('/products/:id/seo', { preHandler: requireSyncKey }, async (req, reply) => {
  const { exclude_from_seo } = req.body;
  await pool.query(
    'UPDATE products SET exclude_from_seo=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
    [exclude_from_seo ? 1 : 0, req.params.id]
  );
  return { ok: true };
});
`;

  conn.exec(`cat << 'EOF' >> /var/www/mdv-api/server.js
${endpoint}
EOF
pm2 restart mdv-api
`, (e, s) => {
       let out2 = '';
       s.on('data', d => out2 += d).on('close', () => {
           console.log("PATCH RES:\\n", out2);
           conn.exec('pm2 logs mdv-api --lines 10 --nostream', (e3, s3) => {
               s3.pipe(process.stdout);
               s3.on('close', () => conn.end());
           });
       });
   });
}).connect({
  host: '76.13.232.162',
  port: 22,
  username: 'root',
  password: '@@@@Jsj2865@@@@'
});
