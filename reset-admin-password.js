/**
 * Script para resetar a senha do usuário admin
 * Execute com: node reset-admin-password.js
 */

const PocketBase = require('pocketbase');

const pb = new PocketBase('http://127.0.0.1:8090');

async function resetAdminPassword() {
    try {
        console.log('🔄 Conectando ao PocketBase...');

        // Admin user ID
        const adminId = '09e2a74b-b0b4-4706-b91d-c410fc2fec3b';
        const newPassword = '@@Jsj2865@@';

        // Primeiro, precisamos autenticar como admin do PocketBase
        // Se você tiver credenciais de admin do PocketBase, use aqui
        // await pb.admins.authWithPassword('admin@email.com', 'admin-password');

        console.log('📝 Atualizando senha do usuário...');

        // Atualizar a senha do usuário
        await pb.collection('users').update(adminId, {
            password: newPassword,
            passwordConfirm: newPassword
        });

        console.log('✅ Senha atualizada com sucesso!');
        console.log('');
        console.log('📋 Credenciais do Admin:');
        console.log('   Email: handielson@example.com');
        console.log('   CPF: 06329092427');
        console.log('   Senha: @@Jsj2865@@');
        console.log('');

    } catch (error) {
        console.error('❌ Erro ao resetar senha:', error.message);
        console.log('');
        console.log('💡 Alternativa: Resetar senha pelo PocketBase Admin UI');
        console.log('   1. Acesse: http://127.0.0.1:8090/_/');
        console.log('   2. Faça login como admin do PocketBase');
        console.log('   3. Vá em Collections > users');
        console.log('   4. Encontre o usuário com ID: 09e2a74b-b0b4-4706-b91d-c410fc2fec3b');
        console.log('   5. Clique em editar e atualize a senha');
        console.log('');
    }
}

resetAdminPassword();
