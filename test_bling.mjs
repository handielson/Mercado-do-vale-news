import { supabase } from './services/supabase.js';

// Fetch Bling settings from Supabase
const { data, error } = await supabase
  .from('settings')
  .select('bling_access_token, bling_client_id, bling_client_secret')
  .single();

if (error) {
  console.error('❌ Erro ao buscar configurações do Bling:', error);
  process.exit(1);
}

console.log('✅ Configurações do Bling encontradas:');
console.log('   - bling_client_id:', data.bling_client_id?.slice(0, 10) + '...');
console.log('   - bling_client_secret:', data.bling_client_secret ? '✓' : '✗');
console.log('   - bling_access_token:', data.bling_access_token ? data.bling_access_token.slice(0, 20) + '...' : '✗ (vazio)');

// Test Bling API
if (!data.bling_access_token) {
  console.error('\n⚠️  Token do Bling está vazio! Tentando renovar...');
  process.exit(0);
}

try {
  const res = await fetch('https://bling.com.br/Api/v3/produtos', {
    headers: { Authorization: `Bearer ${data.bling_access_token}` }
  });
  
  if (res.status === 401) {
    console.error('\n❌ Erro 401: Token expirado ou inválido no Bling');
  } else if (res.ok) {
    const json = await res.json();
    console.log('\n✅ Conexão com Bling OK, retornou:', json.data?.length || 0, 'produtos');
  } else {
    console.error('\n❌ Erro:', res.status, await res.text());
  }
} catch (err) {
  console.error('\n❌ Erro na requisição:', err.message);
}
