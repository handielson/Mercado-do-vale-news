-- Update warranty template with HTML format
-- This script updates the warranty_template column in company_settings

UPDATE company_settings
SET warranty_template = '<div style="font-family: Arial, sans-serif; font-size: 12px; line-height: 1.5; color: #333; max-width: 800px; margin: 0 auto; border: 1px solid #ddd; padding: 20px;">
    <!-- CABEÇALHO -->
    <div style="display: flex; align-items: center; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px;">
        <div style="flex: 1;">
            <img src="{{logo}}" alt="Logo" style="max-width: 150px; max-height: 80px;" />
        </div>
        <div style="flex: 2; text-align: right;">
            <h2 style="margin: 0; font-size: 18px; text-transform: uppercase;">Termo de Garantia</h2>
            <p style="margin: 5px 0 0; font-weight: bold;">{{nome_loja}}</p>
            <p style="margin: 0; font-size: 11px;">{{cnpj}}</p>
            <p style="margin: 0; font-size: 11px;">{{endereco}}</p>
            <p style="margin: 0; font-size: 11px;">{{telefone}} | {{email}}</p>
            <p style="margin: 10px 0 0; font-size: 14px; font-weight: bold; color: #007bff;">Nº Venda: {{numero_venda}}</p>
        </div>
    </div>

    <!-- DADOS DA VENDA -->
    <div style="background-color: #f9f9f9; padding: 10px; border: 1px solid #eee; margin-bottom: 20px; display: flex; justify-content: space-between;">
        <div style="width: 48%;">
            <p style="margin: 0 0 5px; font-weight: bold; border-bottom: 1px solid #ddd;">DADOS DO CLIENTE</p>
            <p style="margin: 2px 0;"><strong>Nome:</strong> {{nome_cliente}}</p>
            <p style="margin: 2px 0;"><strong>CPF/CNPJ:</strong> {{cpf_cliente}}</p>
        </div>
        <div style="width: 48%; text-align: right;">
            <p style="margin: 0 0 5px; font-weight: bold; border-bottom: 1px solid #ddd;">DETALHES DA COMPRA</p>
            <p style="margin: 2px 0;"><strong>Nº Venda:</strong> {{numero_venda}}</p>
            <p style="margin: 2px 0;"><strong>Data:</strong> {{data_compra}}</p>
        </div>
    </div>

    <!-- PRODUTO -->
    <div style="margin-bottom: 20px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <tr style="background-color: #333; color: #fff;">
                <th style="padding: 8px; text-align: left;">MODELO / RAM / MEMÓRIA</th>
                <th style="padding: 8px; text-align: left;">IMEI 1 / IMEI 2</th>
                <th style="padding: 8px; text-align: center;">COR</th>
            </tr>
            <tr style="border: 1px solid #ddd;">
                <td style="padding: 8px; border: 1px solid #ddd;">{{modelo}}, {{ram}} | {{memoria}}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">
                    <div><strong>IMEI 1:</strong> {{imei1}} | <strong>IMEI 2:</strong> {{imei2}}</div>
                </td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">{{cor}}</td>
            </tr>
        </table>
    </div>

    <!-- CONDIÇÕES LEGAIS (CDC) -->
    <div style="margin-bottom: 20px;">
        <h3 style="font-size: 14px; font-weight: bold; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 10px;">CONDIÇÕES DE GARANTIA (Lei 8.078/90)</h3>
        <ul style="padding-left: 20px; margin: 0; font-size: 11px; text-align: justify;">
            <li style="margin-bottom: 8px;">
                <strong>1. Prazo de Garantia:</strong> O produto possui garantia total de <strong>{{dias_garantia}} dias</strong>, contados da data de entrega. Este prazo já contempla a garantia legal obrigatória de 90 (noventa) dias prevista no Art. 26, inciso II do Código de Defesa do Consumidor (CDC).
            </li>
            <li style="margin-bottom: 8px;">
                <strong>2. Cobertura:</strong> A garantia cobre exclusivamente <strong>vícios de qualidade e defeitos de fabricação</strong> que tornem o produto impróprio para consumo ou diminuam seu valor (Art. 18 do CDC).
            </li>
            <li style="margin-bottom: 8px;">
                <strong>3. Exclusão de Garantia (Art. 12, § 3º do CDC):</strong> A garantia NÃO cobre defeitos resultantes de culpa exclusiva do consumidor ou de terceiro, tais como:
                <ul style="margin-top: 4px; list-style-type: circle;">
                    <li>Mau uso, quedas, colisões, torções ou danos físicos na tela/carcaça;</li>
                    <li>Oxidação ou danos causados por líquidos (água, suor, vapor), independente de certificação IP do fabricante (pois a vedação sofre desgaste natural);</li>
                    <li>Instalação de softwares não originais (Root, Jailbreak) ou esquecimento de senhas (iCloud, Google Account);</li>
                    <li>Rompimento do selo de garantia da loja ou intervenção técnica por terceiros não autorizados.</li>
                </ul>
            </li>
            <li style="margin-bottom: 8px;">
                <strong>4. Bateria e Consumíveis:</strong> Tratando-se de componente sujeito a desgaste natural por uso (vida útil), a garantia da bateria cobre apenas falhas funcionais súbitas e não a degradação normal de capacidade (saúde da bateria), exceto se comprovado vício oculto de fabricação.
            </li>
            <li>
                <strong>5. Política de Troca e Reparo:</strong> Conforme <strong>Art. 18, § 1º do CDC</strong>, a empresa dispõe de até 30 (trinta) dias para sanar o vício. Não sendo o vício sanado neste prazo, o consumidor poderá exigir, alternativamente e à sua escolha: a substituição do produto, a restituição imediata da quantia paga ou o abatimento proporcional do preço.
            </li>
        </ul>
    </div>

    <!-- TERMO DE RECEBIMENTO -->
    <div style="background-color: #f0f8ff; border: 1px dashed #007bff; padding: 10px; margin-bottom: 40px; font-size: 11px;">
        <strong>DECLARAÇÃO DE RECEBIMENTO E CIÊNCIA:</strong><br/>
        {{declaracao_recebimento}} Declaro estar ciente das condições de garantia acima descritas, baseadas na Lei 8.078/90.
    </div>

    <!-- ASSINATURA DO CLIENTE -->
    <div style="margin-top: 50px; text-align: center;">
        <div style="border-bottom: 2px solid #000; width: 400px; margin: 0 auto 10px;"></div>
        <strong>{{nome_cliente}}</strong><br/>
        <small>Assinatura do Cliente</small>
    </div>
</div>'
WHERE TRUE;
