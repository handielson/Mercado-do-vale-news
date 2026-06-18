# Versao Atual

```text
version: v1.1.65-pdv-mp-auto-response
date: 2026-06-18
status: published
release_vps: /var/www/mdv-site/releases/20260618-171838-v1165-pdv-mp-auto-response
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- A resposta automatica de nova venda do PDV agora usa o JSON detalhado `payment_methods` quando existir.
- Pix Mercado Pago aprovado no PDV aparece no campo `{pagamento}` como `Pago via Mercado Pago - dd/mm/aaaa hh:mm`.
- O PDV grava `pix_paid_at` quando adiciona o Pix aprovado ao pagamento da venda.
- Pagamentos que nao sao Pix Mercado Pago continuam usando os rotulos existentes.
- Guardas estaticas protegem a resposta automatica do PDV e o horario de aprovacao do Pix.

## Como Recuperar

Use a tag/versao `v1.1.65-pdv-mp-auto-response` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-18-v1.1.65-pdv-mp-auto-response.md
```

## Publicacao

- Release VPS publicada: `/var/www/mdv-site/releases/20260618-171838-v1165-pdv-mp-auto-response`.
- Esta versao altera `public/VERSION.json`; site VPS publicado para refletir a versao.
- Esta versao altera `vps_server.js` e `vps_server.cjs`; API VPS publicada e reiniciada.
