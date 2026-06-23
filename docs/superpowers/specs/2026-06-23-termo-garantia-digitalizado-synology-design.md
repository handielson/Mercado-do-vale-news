# Termo de garantia digitalizado no Synology

Data: 23 de junho de 2026

## Objetivo

Permitir que o termo de garantia de uma venda presencial, depois de impresso e assinado pelo cliente, seja fotografado pelo celular ou pela webcam, armazenado no Synology e disponibilizado em PDF para o administrador e para o cliente autenticado dono da venda.

O envio não bloqueia a conclusão da venda. Ele acontece posteriormente, sempre dentro da venda específica, para evitar associação com o cliente ou com a venda errada.

## Decisões aprovadas

- O termo possui uma única página.
- A captura pode usar câmera do celular, webcam ou arquivo existente.
- O documento é anexado depois da conclusão da venda.
- O vínculo é feito com uma venda específica.
- O cliente vê o documento automaticamente, sem aprovação administrativa adicional.
- O acesso do cliente exige autenticação e propriedade da venda.
- O administrador pode visualizar, baixar e imprimir.
- A imagem original é preservada como evidência.
- O cliente visualiza somente o PDF.
- A informação de destruição do papel aparece somente nas telas do sistema, não dentro do PDF.
- O registro automático será: `Documento físico digitalizado, destruído e descartado em DD/MM/AAAA às HH:mm.`
- A pasta exclusiva no Synology será `termos-garantia`.
- Também será aceito o envio direto de uma imagem para essa pasta.

## Arquitetura recomendada

A VPS será o ponto central de processamento e autorização. Isso mantém o mesmo resultado para os dois meios de entrada:

1. upload pela tela da venda;
2. imagem colocada diretamente na pasta do Synology.

Em ambos os casos, a entrada canônica é uma imagem JPEG ou PNG. A VPS valida a imagem, corrige sua orientação, gera um PDF A4 de uma página, calcula os hashes dos dois arquivos e grava os metadados no banco.

O Synology guarda os arquivos privados. Eles não devem ser expostos por uma URL pública permanente. A visualização e o download passam por uma rota autenticada da VPS.

## Nomes e organização dos arquivos

Pasta lógica:

`termos-garantia`

Imagem original:

`termo-garantia-venda-{NUMERO_DA_VENDA}-original.jpg`

PDF:

`termo-garantia-venda-{NUMERO_DA_VENDA}.pdf`

Para envio manual direto ao Synology, também serão reconhecidos:

- `termo-garantia-venda-{NUMERO_DA_VENDA}.jpg`
- `termo-garantia-venda-{NUMERO_DA_VENDA}.jpeg`
- `termo-garantia-venda-{NUMERO_DA_VENDA}.png`

O número da venda será normalizado para comparação sem diferenças de maiúsculas, espaços ou caracteres de formatação. O vínculo somente será realizado quando houver exatamente uma venda correspondente.

Depois do processamento, a imagem recebe o nome canônico com o sufixo `-original`. O PDF recebe o nome canônico sem o sufixo.

## Fluxo pela tela da venda

Na venda específica, o administrador terá a ação `Digitalizar termo assinado`.

A interface permitirá:

- abrir a câmera traseira no celular;
- usar a webcam no computador;
- escolher uma imagem da galeria ou do disco;
- revisar a imagem antes do envio;
- substituir uma digitalização existente.

Ao confirmar:

1. a tela envia a imagem associada ao ID da venda;
2. a VPS confirma que a venda existe;
3. a imagem é validada e enviada ao Synology;
4. a VPS gera e envia o PDF;
5. os metadados são gravados no banco;
6. o documento passa a aparecer para o administrador e para o cliente dono da venda;
7. o sistema registra automaticamente a data e a hora da digitalização, destruição e descarte.

A mensagem de sucesso só aparece depois que imagem, PDF e metadados estiverem confirmados.

## Fluxo de envio direto ao Synology

Um sincronizador na VPS examinará periodicamente a pasta `termos-garantia`. Também haverá uma ação administrativa `Sincronizar agora`.

Para cada nova imagem:

1. extrai o número da venda do nome;
2. procura exatamente uma venda correspondente;
3. ignora arquivos que já tenham o mesmo hash de um documento processado;
4. baixa e valida a imagem;
5. gera o PDF;
6. renomeia ou grava a imagem no nome canônico;
7. envia o PDF para a mesma pasta;
8. grava o vínculo com a venda;
9. registra automaticamente a data e a hora da digitalização, destruição e descarte.

O sincronizador não deve interpretar PDFs colocados manualmente como fonte. O PDF oficial sempre será o gerado a partir da imagem validada.

## Dados persistidos

O registro do documento digitalizado deverá conter, no mínimo:

- ID;
- empresa;
- venda;
- cliente da venda;
- número da venda usado no arquivo;
- caminho privado da imagem original;
- caminho privado do PDF;
- nome original recebido;
- tipo e tamanho da imagem;
- hash SHA-256 da imagem;
- hash SHA-256 do PDF;
- origem: `tela_venda` ou `synology_direto`;
- estado de processamento;
- data e hora do upload;
- data e hora do processamento;
- data e hora registrada para destruição e descarte;
- usuário administrador responsável, quando o envio ocorrer pela tela;
- versão do registro, para substituições.

O novo registro complementa `warranty_documents`, que hoje guarda o conteúdo do termo gerado. Ele representa a cópia assinada e digitalizada.

## Estados e pendências

Estados previstos:

- `recebido`;
- `processando`;
- `disponivel`;
- `erro`;
- `substituido`.

Arquivos que não puderem ser associados não serão publicados ao cliente. Eles aparecerão numa lista administrativa de pendências com o motivo:

- nome inválido;
- venda inexistente;
- mais de uma venda correspondente;
- extensão não permitida;
- arquivo corrompido;
- falha ao gerar o PDF;
- falha no Synology;
- conflito com documento existente.

Uma pendência poderá ser reprocessada depois da correção do nome ou do problema operacional.

## Substituição e histórico

Uma venda terá apenas uma versão ativa do termo assinado. Um novo upload não apagará silenciosamente a versão anterior:

- a versão atual será marcada como `substituido`;
- os arquivos anteriores permanecerão disponíveis somente para administradores;
- o cliente verá apenas a versão ativa;
- o histórico registrará data, origem e administrador responsável.

O envio repetido do mesmo arquivo, identificado pelo hash, será idempotente e não criará outra versão.

## Segurança e privacidade

Os termos podem conter assinatura, CPF, endereço e IMEI. Portanto:

- a pasta não terá listagem ou download público;
- credenciais do Synology permanecerão somente na VPS;
- o cliente autenticado só poderá acessar um documento se `venda.customer_id` for igual ao cliente da sessão;
- administradores autenticados poderão acessar documentos da empresa;
- toda autorização será verificada novamente na VPS, sem confiar apenas na interface;
- URLs de download serão autenticadas e de curta duração, ou o arquivo será transmitido pela própria VPS;
- os acessos e substituições serão registrados;
- a resposta ao cliente não revelará o caminho físico do Synology.

O documento é uma cópia digitalizada do papel assinado. O recurso não transforma a assinatura manuscrita em assinatura digital certificada.

## Apresentação ao administrador

Nos detalhes da venda:

- estado `Termo assinado pendente` quando ainda não houver digitalização;
- botão `Digitalizar termo assinado`;
- miniatura da imagem para conferência administrativa;
- botão `Abrir PDF`;
- botão `Imprimir`;
- botão `Substituir`;
- origem e data do processamento;
- mensagem de destruição e descarte;
- histórico de versões;
- alerta de pendência, se houver.

## Apresentação ao cliente

Em `Minhas compras`, dentro da venda correspondente:

- seção `Termo de garantia assinado`;
- botão `Visualizar PDF`;
- botão `Baixar`;
- botão `Imprimir`;
- mensagem `Documento físico digitalizado, destruído e descartado em DD/MM/AAAA às HH:mm.`

O cliente não verá a imagem original, caminhos internos, hashes, pendências ou versões substituídas.

## Tratamento da imagem e geração do PDF

- formatos aceitos: JPEG e PNG;
- somente uma imagem por documento;
- tamanho máximo definido na implementação para proteger a VPS;
- correção de orientação EXIF;
- remoção opcional de metadados desnecessários;
- preservação de resolução suficiente para leitura e impressão;
- PDF A4 vertical, com margens discretas;
- imagem redimensionada proporcionalmente, sem corte;
- uma única página;
- compressão que preserve assinatura, texto, números e IMEI legíveis.

## Falhas e consistência

O documento só muda para `disponivel` depois que os dois arquivos e os metadados estiverem persistidos.

Se a imagem for salva, mas o PDF falhar, o registro fica em `erro` e pode ser reprocessado. O cliente não verá um documento parcial.

Se o banco falhar depois do upload, o processo mantém dados suficientes para reconciliação e evita produzir duplicidades no próximo ciclo.

O sincronizador terá trava para impedir dois processamentos simultâneos do mesmo arquivo.

## Testes essenciais

- captura pelo celular;
- captura por webcam;
- escolha de JPEG e PNG existente;
- geração de PDF A4 de uma página;
- orientação correta para fotos giradas;
- texto e assinatura legíveis na impressão;
- upload direto com nome válido;
- rejeição de nome inválido;
- rejeição de venda inexistente;
- idempotência do mesmo arquivo;
- substituição com preservação do histórico;
- falha temporária do Synology e reprocessamento;
- cliente dono da venda consegue abrir;
- outro cliente recebe acesso negado;
- usuário não autenticado recebe acesso negado;
- administrador consegue visualizar e imprimir;
- cliente não recebe a imagem original;
- mensagem e horário aparecem apenas depois da conclusão integral.

## Critérios de aceite

O recurso estará concluído quando:

1. uma foto enviada pela venda ou colocada diretamente no Synology gerar o mesmo PDF oficial;
2. o arquivo for associado à venda correta pelo número único;
3. imagem original e PDF forem preservados no Synology;
4. somente administrador e cliente dono da venda conseguirem acessar;
5. o PDF puder ser visualizado, baixado e impresso;
6. a mensagem de digitalização, destruição e descarte aparecer automaticamente com data e hora;
7. erros e arquivos não reconhecidos permanecerem em pendências administrativas;
8. substituições não eliminarem o histórico anterior.
