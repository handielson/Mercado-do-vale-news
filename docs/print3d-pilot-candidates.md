# Candidatos locais para o piloto 3D

Levantamento feito em 27/09/2026, somente leitura, na pasta sincronizada `Fusion 360/Projetos/Próprio`. Nenhum arquivo foi copiado, alterado ou enviado ao sistema.

## Candidatos recomendados

| Projeto | Arquivos encontrados | Uso sugerido no piloto | O que falta |
|---|---:|---|---|
| Suporte LNB 3x3 | 3× 3MF, 4× STL e 3× F3D | Lote e produto composto | Confirmar a revisão vendável e gerar o JSON final dessa mesa |
| Suporte Carona | 4× 3MF, 3× STL e 1× F3D | Lote de várias unidades | Confirmar quais partes formam uma unidade e gerar o JSON final |
| Suporte para Medidor de Temperatura Xiaomi | 4× STL e 1× F3D | Produto composto com quatro partes | Gerar 3MF/G-code e JSON final |
| NFC Chave Carro | 8× STL e 5× F3D | Produto com personalização/variações | Confirmar modelos autorizados, acessórios NFC e gerar o JSON final |
| Porta Papel Higiênico | 10× STL e 6× F3D | Produto com revisões | Escolher a revisão atual, montar a impressão e gerar o JSON final |
| Suporte Roteador Mesh | 1× 3MF | Produto simples para primeira importação | Confirmar se o 3MF é a revisão vendável e gerar o JSON final |

## Resultado da inspeção dos 3MF

Os projetos 3MF examinados possuem estrutura do Bambu Studio e arquivos como `Metadata/project_settings.config`, `Metadata/model_settings.config` e `Metadata/slice_info.config`. O `slice_info.config` contém apenas identificação e versão do fatiador; não contém estimativa final de peso ou tempo. Por isso, não foi criado um JSON estimado.

O piloto precisa do arquivo real produzido pelo programa no contrato:

```json
{
  "material_gramas": 0,
  "tempo_impressao_minutos": 0
}
```

Os zeros são apenas indicação do formato e não podem ser importados como dados de produção. O arquivo real deve trazer valores positivos do lote completo.

## Critério para escolher o primeiro produto

O primeiro piloto deve ter autoria e venda autorizadas, revisão identificada, quantidade do lote conhecida, composição de peças conhecida e arquivos de fabricação atuais. Depois da escolha, o cadastro ainda exigirá SKU, categoria, variante, preço, dimensões, peso de envio, fotos, vídeo opcional, filamentos/cores, insumos, prazo e limite de encomenda.
