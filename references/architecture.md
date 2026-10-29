# Arquitetura atual

Este documento e um mapa de navegacao; codigo carregado e configuracao do ambiente sao a fonte de verdade do comportamento.

- Frontend: React e TypeScript, compilado com Vite (`package.json`, `vite.config.ts`, `App.tsx`, `pages/`, `components/`).
- API: Fastify em `server.js`, com rotas e servicos separados em `services/`.
- Dados operacionais da API: MySQL por `mysql2/promise`; o schema efetivo e o banco conectado, nao os mapas historicos `CODEBASE.md` ou `PROJECT_MAP.md`.
- Integracao Mercado Livre: registro em `services/mercadoLivreServer.cjs`; implementacoes de leitura/escrita de preco e estoque em `services/mercadoLivreListingPrice.cjs` e `services/mercadoLivreListingStock.cjs`; chamadas externas passam por `mlRequest`.
- Publicacao e versao: `publicar.md`, os scripts atuais de deploy, `public/VERSION.json`, release ativa e verificacao no dominio.

`CODEBASE.md` e `PROJECT_MAP.md` sao inventarios historicos extensos. Confirmar cada afirmacao no codigo, schema ou runtime antes de usa-la para decidir uma mudanca.
