# Instruções para Agentes

## Gerenciador de Pacotes
Use **npm**: `npm install`, `npm run dev`, `npm run build`

## Comandos por Arquivo
| Tarefa | Comando |
|--------|---------|
| Verificação de Tipos | `npx tsc --noEmit caminho/para/arquivo.ts` |
| Lint | Nenhum linter configurado |
| Teste | Nenhum executor de testes configurado |

## Atribuição de Commit
Commits de IA DEVEM incluir:
```
Co-Authored-By: (o nome do modelo do agente e linha de atribuição)
```
Exemplo: `Co-Authored-By: Claude Sonnet 4 <noreply@example.com>`