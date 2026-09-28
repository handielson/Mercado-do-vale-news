# Piloto — Suporte LNB 3x3

Produto piloto escolhido para a primeira homologação da loja 3D.

## Revisão identificada

- SKU provisório: `3D-SUP-LNB-3X3-V2`.
- Revisão: `flange-3x3-v2-2026-08-19`.
- Projeto da mesa: `Suporte Flange 3x3 v2 (mesa com 11 pares).3mf`.
- Lote: 11 unidades completas.
- Cada unidade é formada por uma Parte 1 e uma Parte 2.
- O 3MF contém 11 ocorrências de cada parte.
- A prévia interna foi extraída do próprio 3MF, sem alterar o arquivo original.

## Dimensões dos modelos

| Peça | X | Y | Z |
|---|---:|---:|---:|
| Parte 1 | 66 mm | 40 mm | 50,06 mm |
| Parte 2 | 66 mm | 20 mm | 30,63 mm |

Essas são dimensões geométricas individuais dos STL. Elas não substituem as dimensões do produto montado nem da embalagem usadas no frete.

## Próxima entrada necessária

Gerar no programa de impressão o JSON correspondente exatamente à mesa de 11 pares:

```json
{
  "material_gramas": 123.45,
  "tempo_impressao_minutos": 678
}
```

Os números acima ilustram somente o formato. Não devem ser usados no cadastro. Depois do JSON real, ainda serão preenchidos manualmente material, cor, impressora, perfil, insumos e custos.

O manifesto técnico está em `manifest.json`. Nenhum produto foi criado no banco e nenhum arquivo foi enviado ao NAS, pois as rotas 3D continuam desligadas até a publicação e a homologação controlada.
