# Credenciais MCP do n8n

Nunca versionar .cursor/mcp.json ou colocar tokens literais em arquivos do repositorio. Use .cursor/mcp.example.json somente como estrutura sem segredo; configure autenticacao em arquivo privado/local ou no cliente. Prefira OAuth quando suportado. O token da antiga conta Cloud foi exposto e deve ser tratado como comprometido; indisponibilidade da conta nao prova revogacao.

Protecao local: git config core.hooksPath .githooks. O pre-commit verifica somente arquivos staged e nao exibe valores. npm run check:n8n-secrets verifica arquivos rastreados; o prebuild executa a mesma guarda. Esses controles nao substituem secret scanning/push protection no GitHub e nao removem historico anterior.

Limpeza historica exige copia isolada, backup privado, inventario atualizado de branches/tags/PRs e conferencia de que apenas os arquivos sensiveis sairam de todas as arvores. Reescrever historico muda hashes e pode invalidar assinaturas. Nao usar force-push amplo nem apagar worktrees com trabalho pendente para contornar isso. Depois, colaboradores devem realinhar/reclonar sem mesclar o historico contaminado. Caches, forks e refs de PRs podem exigir GitHub Support.

Fontes: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository e https://docs.n8n.io/connect/connect-to-n8n-mcp-server/#rotating-your-token.
