// Compatibilidade: a política antiga de valor mínimo foi substituída.
// A implementação vigente trata DDD 87/74, gratuidade para smartphones,
// bairro, localização do WhatsApp e confirmação do endereço captado.
const implementation = require('./n8n-free-smartphone-location-delivery.cjs');

module.exports = implementation;

if (require.main === module) {
  implementation.main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}
