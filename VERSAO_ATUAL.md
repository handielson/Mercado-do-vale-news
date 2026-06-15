# Versao Atual

```text
version: v1.1.26-pdv-delivery-worker-job
date: 2026-06-15
status: published
release_vps: /var/www/mdv-site/releases/20260615-190702-v1126-pdv-delivery-worker-job
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- PDV passa a resolver entregadores vindos de clientes (`customer:<id>`) para `delivery_person_customer_id`.
- `services/saleService.ts` cria `customer_delivery_jobs` para entregadores-clientes e evita gravar `customer:<id>` na coluna legada `delivery_person_id`.
- Reparo aplicado na venda `cc27f233-5f8e-4e3e-b06f-79d43f876de4`: criado o job de entrega `8518f812-8985-41e7-8ce5-e3df2fc21642` para o entregador-cliente `d7b3a361-bd99-4e98-b056-1bec27695b97`.

## Como Recuperar

Use a tag/versao `v1.1.26-pdv-delivery-worker-job` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-15-v1.1.26-pdv-delivery-worker-job.md
```

## Publicacao

- Release VPS planejada/publicada: `/var/www/mdv-site/releases/20260615-190702-v1126-pdv-delivery-worker-job`.
- Esta versao altera frontend/servico do PDV; a API VPS ja suporta `delivery_person_customer_id` e `/delivery/jobs/from-sale`.
