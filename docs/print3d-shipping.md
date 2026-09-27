# Frete da loja 3D

Implementação local. Reutiliza `handleShippingApiVps` do servidor MDV para cotar Melhor Envio e Frenet; não compra etiquetas. Produto e carrinho usam a mesma rota pública POST `/storefronts/loja_3d/shipping/quote`. O cliente envia somente CEP e IDs/quantidades; valor, publicação, disponibilidade, peso e dimensões são conferidos no servidor.

Configurar no ambiente privado da API, antes de ativar:

- `MDV_PRINT3D_SHIPPING_ENABLED=1`
- `MDV_PRINT3D_SHIPPING_PACKAGE_TARE_G`: peso da embalagem em gramas, somado uma vez ao pacote.
- `MDV_PRINT3D_SHIPPING_PACKAGE_PADDING_CM`: folga total acrescentada a cada eixo do pacote.
- `MDV_PRINT3D_SHIPPING_HANDLING_DAYS`: dias úteis de preparação após produção.

Conforme decisão do operador, o CEP de origem principal e as transportadoras são os mesmos do Mercado do Vale. A API lê diretamente o cadastro central `shipping_settings`, respeitando os provedores habilitados, tokens, sandbox e filtro de serviços do Melhor Envio. Alterações nesse cadastro passam a valer para ambos os sites, sem duplicar credenciais. As antigas variáveis 3D de CEP/token não são usadas. Os tokens permanecem no servidor.

Ativação, embalagem e preparação continuam próprias do 3D. Frete grátis, descontos e entrega local do MDV não são herdados. Não há gravação no cadastro MDV durante a cotação; nenhuma origem secundária é selecionada automaticamente.

Fonte das medidas: cadastro central do SKU, `weight_kg` (peso líquido) e `dimensions.height_cm/width_cm/depth_cm`. É obrigatório preencher todos. O empilhamento segue o cálculo existente no FreightCalculator: soma alturas por quantidade e usa a maior largura e profundidade. Soma tara e folga configuradas. É uma estimativa de pacote único e envio conjunto: conferir fisicamente a embalagem e a compatibilidade das peças antes da abertura da loja. Não permite cotação com peso fictício quando o cadastro está incompleto.

O retorno tem frete em centavos e dias úteis de transporte. Prazo de produção é o maior prazo entre as encomendas do carrinho, exibido separadamente, sem assumir que dias de produção são dias úteis. O checkout local valida a cotação assinada, origem, disponibilidade e modalidade, preservando o retrato no pedido. O cliente escolhe o frete posterior, inteiro na entrada ou proporcional ao percentual escolhido (50%–100%). A cotação sozinha não reserva nem cobra. Ativação depende da homologação descrita em `print3d-checkout.md`.

Limites: 10 tentativas/minuto por IP por processo da API; validar identificação de IP atrás do proxy no piloto. Timeout de transportadoras de 15 segundos. Falha parcial mantém modalidades válidas; falha total não vira frete grátis. Nenhum detalhe de erro do provedor ou token é devolvido ao cliente.

Pendentes para operação: configurar ativação/embalagem/preparação 3D, conferir dados reais, testar origem/CEP/embalagem com transportadoras, publicar mediante solicitação e integrar ao checkout. Entrega local, retirada, subsídios, múltiplas origens e emissão de etiquetas precisam de regras próprias e não fazem parte desta primeira calculadora 3D. A prévia demo não consulta transportadoras.
