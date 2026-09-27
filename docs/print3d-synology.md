# Arquivos privados de fabricação 3D no Synology

Os arquivos de fabricação não são mídias públicas do catálogo. Eles ficam em uma raiz privada do FileStation, configurada no servidor por `MDV_PRINT3D_SYNOLOGY_FOLDER`, e só podem ser enviados, verificados ou baixados por um administrador autenticado.

## Organização

O vínculo operacional continua organizado por produto, SKU, variante e revisão no banco de dados. No Synology, cada conteúdo é armazenado uma única vez pelo SHA-256:

```text
producao-3d/
  arquivos/
    <dois primeiros caracteres do SHA-256>/
      <SHA-256>.<extensão>
```

A tabela `print3d_file_assets` identifica o arquivo físico. `print3d_recipe_files` relaciona esse ativo com uma ficha e informa a finalidade: modelo, projeto, G-code, JSON de impressão, prévia ou instruções. Se várias variantes ou revisões usam o mesmo arquivo, elas apontam para o mesmo ativo sem duplicar o conteúdo no NAS.

## Regras e integridade

- Limite de 50 MB por arquivo.
- Modelos: STL, OBJ, STEP e STP.
- Projetos: 3MF e F3D.
- Máquina: GCODE e GCO, sempre com impressora/perfil associados.
- Dados: JSON com tempo e material compatíveis com a ficha.
- Prévia: PNG, JPG, JPEG e WEBP.
- Instruções: TXT e PDF.
- O caminho é gerado pelo servidor e precisa permanecer dentro de `producao-3d`.
- Nome original, tamanho, hash e responsável são registrados.
- O painel possui **Verificar integridade**, que baixa os ativos da ficha e compara tamanho e SHA-256.
- Revisões são imutáveis depois de aprovadas ou usadas. A chave estrangeira impede remover um ativo ainda referenciado.
- Um upload incompleto ou uma falha do NAS não cria a relação do arquivo com a ficha.

## Backup e restauração

O backup completo exige duas partes tomadas no mesmo período operacional:

1. banco MySQL, com as fichas, revisões e relacionamentos;
2. pasta privada `producao-3d` no Hyper Backup do Synology.

Para restaurar, recuperar primeiro o banco e depois a pasta privada no mesmo caminho. Em seguida, abrir cada ficha piloto no painel e executar **Verificar integridade**. A restauração só pode ser considerada homologada quando o manifesto não apresentar arquivo ausente, tamanho divergente ou hash divergente.

O verificador está implementado. A política do Hyper Backup e um exercício real de restauração ainda precisam ser executados antes da ativação pública.

## Ativação

A configuração do caminho não habilita as rotas. A ativação futura requer publicar o servidor e o painel compatíveis, reiniciar a API em janela controlada, criar uma ficha piloto, enviar os arquivos e validar upload, compartilhamento, download e integridade. Somente depois disso deve ser considerada a flag `MDV_PRINT3D_RECIPES_ENABLED=1`.
