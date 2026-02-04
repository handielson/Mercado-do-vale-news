-- Update warranty template with the new default format
-- This script updates the warranty_template column in company_settings

UPDATE company_settings
SET warranty_template = 'TERMO DE GARANTIA

{{nome_loja}}
{{endereco}}
{{telefone}} | {{email}}

═══════════════════════════════════════════════════════

DADOS DO CLIENTE                                    DETALHES DA COMPRA

Nome: {{nome_cliente}}                              Nº Venda: {{numero_venda}}
CPF/CNPJ: {{cpf_cliente}}                          Data: {{data_compra}}

═══════════════════════════════════════════════════════

MODELO / RAM / MEMÓRIA          IMEI 1 / IMEI 2                    COR

{{produto}}                     IMEI 1: {{imei1}} | IMEI 2: {{imei2}}    {{cor}}

═══════════════════════════════════════════════════════

CONDIÇÕES DE GARANTIA (Lei 8.078/90)

1. Prazo de Garantia: O produto possui garantia total de {{dias_garantia}} dias, contados da data de entrega. Este prazo já contempla a garantia legal obrigatória de 90 (noventa) dias prevista no Art. 26, inciso II do Código de Defesa do Consumidor (CDC).

2. Cobertura: A garantia cobre exclusivamente vícios de qualidade e defeitos de fabricação que tornem o produto impróprio para consumo ou diminuam seu valor (Art. 18 do CDC).

3. Exclusão de Garantia (Art. 12, § 3º do CDC): A garantia NÃO cobre defeitos resultantes de culpa exclusiva do consumidor ou de terceiro, tais como:
   • Mau uso, quedas, colisões, torções ou danos físicos na tela/carcaça;
   • Oxidação ou danos causados por líquidos (água, suor, vapor), independente de certificação IP do fabricante (pois a vedação sofre desgaste natural);
   • Instalação de softwares não originais (Root, Jailbreak) ou desbloqueio de senhas (iCloud, Google Account);
   • Rompimento do selo de garantia da loja ou intervenção técnica por terceiros não autorizados.

4. Bateria e Consumíveis: Tratando-se de componente sujeito a desgaste natural por uso (vida útil), a garantia da bateria cobre apenas falhas funcionais súbitas e não a degradação normal de capacidade (saúde da bateria), exceto se comprovado vício oculto de fabricação.

5. Política de Troca e Reparo: Conforme Art. 18, § 1º do CDC, a empresa dispõe de até 30 (trinta) dias para sanar o vício. Não sendo o vício sanado neste prazo, o consumidor poderá exigir, alternativamente e à sua escolha: a substituição do produto, a restituição imediata da quantia paga ou o abatimento proporcional do preço.

═══════════════════════════════════════════════════════

DECLARAÇÃO DE RECEBIMENTO E CIÊNCIA:

{{declaracao_recebimento}}

Declaro estar ciente das condições de garantia acima descritas, baseadas na Lei 8.078/90.


___________________________          ___________________________
{{nome_loja}}                        {{nome_cliente}}
Vendedor Responsável                 Assinatura do Cliente'
WHERE slug = 'mercado-do-vale';
