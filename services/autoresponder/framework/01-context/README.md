# 01 - Context

Gerencia o estado e o contexto de cada atendimento de forma estruturada.
Este módulo carrega e persiste o contexto composto pelas subestruturas:
- `conversation_context`: Estado da conversa, etapas, tempo de expiração e dados de auditoria.
- `order_context`: Carrinho de produtos, formas de entrega/frete e pagamento do pedido atual.
- `customer_context`: Dados cadastrais e histórico persistente do cliente.
