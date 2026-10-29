# Operacao e release

`publicar.md` e a fonte operacional canonica. Este indice nao autoriza publicar.

- A API Fastify roda na VPS sob PM2 como `mdv-api`; o site usa releases completas e symlink `current`.
- Cada comportamento publicado precisa de versao registrada em `public/VERSION.json`, `VERSAO_ATUAL.md` e `docs/versoes/` conforme `publicar.md`.
- O roteiro completo inclui preflight, regressao, revisao de diff, stage explicito, commit/tag, push, deploy seletivo, validacao externa e auditoria de estado final.
- Nunca publicar mudanca que possa alterar estoque, preco ou anuncio sem autorizacao explicita para esse efeito, mesmo que o codigo tenha sido implementado ou protegido por feature flag.
- Para deploy usar a skill `publish-vps` e ler `publicar.md` integralmente. Uma resposta HTTP ou um push isolado nao prova que a release esta ativa.
