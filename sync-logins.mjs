import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Função para ler o .env.local na mão
function getEnv(key) {
  const content = fs.readFileSync('.env.local', 'utf-8');
  const match = content.match(new RegExp(`${key}="([^"]+)"`));
  return match ? match[1] : null;
}

const url = getEnv('VITE_SUPABASE_URL');
const serviceKey = getEnv('VITE_SUPABASE_SERVICE_ROLE_KEY');

if (!url || !serviceKey) {
  console.error("ERRO: Não achei as chaves no .env.local! Tem certeza que está salvo?");
  process.exit(1);
}

const supabaseAdmin = createClient(url, serviceKey);

async function sync() {
  console.log("Iniciando varredura Master para criar contas de Auth...");
  
  // Buscar todos os clientes do banco de dados (que ainda não tem user_id)
  const { data: customers, error } = await supabaseAdmin
    .from('customers')
    .select('*')
    .is('user_id', null);

  if (error) {
    console.error("Erro ao buscar clientes:", error);
    return;
  }

  console.log(`Encontrados ${customers.length} clientes sem sincronização de login.`);

  let successCount = 0;
  let errorCount = 0;

  for (const c of customers) {
    const cpfDigits = (c.cpf_cnpj || '').replace(/\D/g, '');
    if (!cpfDigits) continue;

    const placeholderEmail = `${cpfDigits}@cliente.mercadodovale.com.br`;
    // Senha = primeiros 5 digitos do CPF
    const tempPassword = cpfDigits.substring(0, 5);

    try {
      const { data, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email: placeholderEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { name: c.name, cpf_cnpj: cpfDigits }
      });

      if (authErr && !authErr.message.includes("already registered")) {
         console.error(`Erro no CPF ${cpfDigits}:`, authErr.message);
         errorCount++;
         continue;
      }

      // Se a conta já for registrada ou acabou de ser criada, pegamos o ID
      let finalUserId = data?.user?.id;
      
      if (!finalUserId) {
         // Se deu already registered, vamos caçar o usuário na lista
         const { data: searchUser } = await supabaseAdmin.auth.admin.listUsers();
         const matched = searchUser.users.find(u => u.email === placeholderEmail);
         if (matched) finalUserId = matched.id;
      }

      if (finalUserId) {
        // Amarra o ID da Auth na tabela de customers
        await supabaseAdmin.from('customers').update({ user_id: finalUserId }).eq('id', c.id);
        console.log(`✅ Sucesso: CPF ${cpfDigits} sincronizado.`);
        successCount++;
      }

    } catch (e) {
      console.error(`Erro trágico no CPF ${cpfDigits}:`, e.message);
      errorCount++;
    }
  }

  console.log("\n=========================");
  console.log(`🚀 RESULTADO FINAL: ${successCount} contas sincronizadas. ${errorCount} erros.`);
  console.log("=========================\n");
  console.log("FEITO! Você pode testar o login lá na loja agora!");
}

sync();
