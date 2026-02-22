-- Tabela de agendamento de conteúdo Instagram
-- Cada slot representa um post/story recorrente por dia da semana

CREATE TABLE IF NOT EXISTS instagram_schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Dom, 1=Seg … 6=Sáb
    scheduled_time TIME NOT NULL DEFAULT '09:00:00',
    content_type TEXT NOT NULL DEFAULT 'story' CHECK (content_type IN ('story', 'reels', 'carrossel', 'post')),

    -- Conteúdo da legenda completo (pronto para copiar e postar)
    hook TEXT,                  -- Primeira frase impactante (primeiros 3 segundos)
    caption TEXT,               -- Legenda completa pronta para postar
    cta TEXT,                   -- Call-to-action (ex: "Manda 'QUERO' nos comentários")
    hashtags TEXT,              -- Hashtags prontas (ex: #iphone #celular #oferta)
    visual_notes TEXT,          -- Instruções visuais (ex: "Mostrar produto na mão, fundo branco")

    -- Controles
    send_telegram_reminder BOOLEAN NOT NULL DEFAULT true,
    active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_instagram_schedule_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS instagram_schedule_updated_at ON instagram_schedule;
CREATE TRIGGER instagram_schedule_updated_at
    BEFORE UPDATE ON instagram_schedule
    FOR EACH ROW EXECUTE FUNCTION update_instagram_schedule_updated_at();

-- RLS
ALTER TABLE instagram_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage instagram_schedule"
    ON instagram_schedule FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Anon cannot access instagram_schedule"
    ON instagram_schedule FOR SELECT
    TO anon
    USING (false);

-- Seed: Semana de conteúdo padrão para loja de celulares
INSERT INTO instagram_schedule (day_of_week, scheduled_time, content_type, hook, caption, cta, hashtags, visual_notes, sort_order) VALUES
-- SEGUNDA-FEIRA
(1, '07:30', 'story', 
 'Semana começou com tudo! 🔥',
 'Bom dia! A semana começou e o estoque está recheado de novidades. 📦 Confira o que chegou de novo e garanta o seu com o melhor preço da cidade!',
 '⬆️ Arrasta pra cima e veja o catálogo completo!',
 '#celular #smartphone #novidades #MercadoDoVale #bomdiade',
 'Mostrar caixas ou produtos na bancada. Fundo arrumado. Luz natural se possível.',
 1),

(1, '12:00', 'reels',
 'Você sabia que esse celular tem esse preço? 😱',
 '🔥 OFERTA IMPERDÍVEL! Aproveite o preço especial de hoje.\n\n✅ Garantia inclusa\n✅ Nota fiscal\n✅ Parcelamos em até 12x\n\nNão deixe passar!',
 '👉 Chama no direct agora e garanta o seu!',
 '#iphone #samsung #celular #oferta #smartphone #MercadoDoVale #promo',
 'Reels curto (15-30s). Mostrar o produto, abrir a caixa, destacar a tela. Música animada. Texto na tela com o preço.',
 2),

(1, '19:00', 'post',
 NULL,
 '💪 Segunda-feira é dia de conquistar! E a gente te ajuda a começar com o aparelho certo.\n\nConfira os modelos disponíveis hoje e veja qual combina mais com você.\n\n🔗 Link do catálogo na bio!',
 '💬 Comenta aqui qual celular você usa atualmente!',
 '#celular #tecnologia #smartphone #MercadoDoVale #segunda',
 'Foto estética do produto em cima de uma superfície limpa. Tonalidades escuras ou minimalistas.',
 3),

-- TERÇA-FEIRA
(2, '08:00', 'story',
 '⚡ Estoque atualizado! Veja o que temos hoje:',
 'Bom dia! Confira o estoque de hoje 👇\n\nTodos os aparelhos com:\n✅ Garantia\n✅ Nota Fiscal\n✅ Melhor preço da cidade',
 '💬 Manda "LISTA" aqui que te envio os preços!',
 '#estoque #celular #smartphone #MercadoDoVale',
 'Stories com fotos dos produtos disponíveis. Pode usar o template de arte da MarketingPage.',
 1),

(2, '18:00', 'carrossel',
 'Qual o melhor celular pra comprar agora em 2026? Slide 2 →',
 '📱 GUIA COMPLETO: Os melhores celulares custo-benefício de 2026\n\nSlide 1: Capa com título chamativo\nSlide 2: iPhone (melhor câmera)\nSlide 3: Samsung (melhor tela)\nSlide 4: Xiaomi (melhor custo-benefício)\nSlide 5: Motorola (melhor bateria)\nSlide 6: Qual escolher para você?\nSlide 7: Onde comprar (Mercado do Vale)\nSlide 8: CTA - Chama no direct',
 '💾 Salva esse post pra consultar depois! E se tiver dúvida, chama no direct!',
 '#celular #guia #iphone #samsung #xiaomi #motorola #qualcomprar #review',
 'Carrossel de 8-10 slides. Design limpo com uma cor de destaque. Cada slide com um ponto principal.',
 2),

-- QUARTA-FEIRA
(3, '07:30', 'story',
 '🤫 Oferta secreta só pro pessoal fiel...',
 'Quarta-feira de promoção relâmpago! ⚡\n\nPor tempo limitado: preço especial em modelos selecionados!\n\nNão conta pra ninguém... só pra quem vê os stories! 😉',
 '👆 Arrasta pra cima ou chama no direct agora!',
 '#oferta #promo #relampago #celular #MercadoDoVale #exclusive',
 'Stories direto ao ponto. Mostrar o produto com o preço riscado e o novo preço destacado.',
 1),

(3, '20:00', 'reels',
 'Esse celular tá saindo por MENOS que um jantar fora... 😳',
 '🔥 Isso não é brincadeira! O preço tá absurdo e o estoque é limitado.\n\n✅ Aparelho seminovo/lacrado\n✅ Com garantia\n✅ Parcelamos no cartão\n\nDepois não fala que não avisou!',
 '🏃 Corre chamar no direct ou clica no link da bio!',
 '#celular #preco #oferta #smartphone #barato #MercadoDoVale #oportunidade',
 'Reels com ritmo acelerado. 3 segundos de hook visual forte. Mostrar o produto e o preço. CTA final com urgência.',
 2),

-- QUINTA-FEIRA
(4, '09:00', 'story',
 'Depoimento real de cliente do Mercado do Vale 👇',
 '❤️ A gente ama receber feedback assim!\n\n(Repostar depoimento de cliente satisfeito ou mostrar print de conversa positiva no WhatsApp)\n\nObrigado pela confiança! Isso nos motiva a fazer ainda mais!',
 '💬 Você também já comprou com a gente? Conta aqui!',
 '#cliente #depoimento #obrigado #confianca #MercadoDoVale #provasocial',
 'Repost de story de cliente ou print (com permissão). Fundo colorido com texto destacado.',
 1),

(4, '19:00', 'carrossel',
 'As 5 perguntas que TODO mundo faz antes de comprar um celular:',
 'Slide 1: "As 5 perguntas mais comuns sobre celulares"\nSlide 2: "Lacrado ou Seminovo?"\nSlide 3: "Quantas GB de armazenamento eu preciso?"\nSlide 4: "Vale a pena pagar mais pela câmera?"\nSlide 5: "Parcelado ou à vista - qual compensa?"\nSlide 6 (CTA): "Ficou com dúvida? Chama no direct!"',
 '💾 Salva esse carrossel! Vai ser útil quando for comprar!',
 '#duvidas #celular #comprar #dicascompra #smartphone #MercadoDoVale',
 'Visual educativo. Tons neutros ou da cor da marca. Ícones simples e texto grande.',
 2),

-- SEXTA-FEIRA
(5, '08:00', 'story',
 '🎉 SEXTA! Dia de oferta especial de fim de semana!',
 'É SEXTA!!! 🙌 E aqui no Mercado do Vale a sexta é sinônimo de OFERTA!\n\nConfira os preços especiais de hoje e do fim de semana. Estoque limitado!',
 '👇 Arrasta pra ver as ofertas ou manda "OFERTAS" no direct!',
 '#sexta #fimdesemana #oferta #promo #celular #MercadoDoVale',
 'Stories animados com GIF ou efeito de brilho. Destaque para o produto mais em conta da semana.',
 1),

(5, '12:00', 'reels',
 'O celular mais vendido dessa semana foi...',
 '📢 Toda semana a gente revela qual foi o aparelho mais procurado pelos nossos clientes!\n\nEssa semana o campeão foi... [PREENCHER COM O MODELO MAIS VENDIDO]\n\nDescubra por que tanta gente escolheu esse modelo e se ele faz sentido pra você também!',
 '💬 Comenta aqui se você já tem ou quer esse modelo!',
 '#maisvendido #celular #smartphone #ranking #MercadoDoVale #iphone #samsung',
 'Revelar o produto de forma dramática. Começar com uma caixa fechada ou fora de foco. Revelar com zoom.',
 2),

(5, '19:00', 'post',
 NULL,
 '✨ Que semana incrível! Muito obrigado a todos que confiaram no Mercado do Vale!\n\nFim de semana chegando e o estoque tá cheio! Se você vai presentear alguém especial ou tá precisando de um upgrade no seu celular, esse é o momento certo! 📱\n\n🔗 Catálogo completo na bio!',
 '❤️ Marca aqui aquela pessoa que tá precisando de um celular novo!',
 '#fimdesemana #celular #oferta #MercadoDoVale #sabado #domingo #presente',
 'Foto lifestyle - produto na mão de alguém sorrindo, ou em uma mesa bonita. Tom caloroso e acolhedor.',
 3),

-- SÁBADO
(6, '09:00', 'story',
 '☀️ Sábado é dia de começar bem!',
 'Bom sábado! 🌟 Estamos abertos e com estoque cheio!\n\nHorário de hoje: [PREENCHER COM HORÁRIO DA LOJA]\n\nVem nos visitar ou chama no WhatsApp!',
 '📍 Endereço: [PREENCHER] | WhatsApp: [PREENCHER]',
 '#sabado #aberto #loja #celular #MercadoDoVale',
 'Stories simples e acolhedor. Pode mostrar a equipe ou o espaço da loja.',
 1),

(6, '15:00', 'reels',
 'Quanto custa trocar de celular? A verdade que ninguém conta...',
 '💡 Muita gente acha que trocar de celular é um luxo. Mas e se eu te dissesse que:\n\n📉 Seu celular atual vai desvalorizar ainda mais\n⚡ A perda de produtividade custa mais caro\n💰 Com parcelamento fica mais barato que você pensa\n\nVem calcular com a gente!',
 '💬 Comenta o modelo que você usa hoje que te falo quanto vale!',
 '#troca #celular #valorize #compra #smartphone #MercadoDoVale #dica',
 'Reels educativo com texto na tela. Pode ser você falando ou legenda em cima de vídeo de produto.',
 2),

-- DOMINGO
(0, '11:00', 'story',
 '😊 Domingo também tem oferta aqui!',
 'Domingo de escolha! 📱 Se você tá pesquisando qual celular comprar, hoje é um ótimo dia para decidir.\n\nRespondo todas as dúvidas pelo WhatsApp ou direct!',
 '💬 Manda sua dúvida aqui nos stories!',
 '#domingo #compra #celular #duvidas #MercadoDoVale',
 'Stories relaxado, tom de fim de semana. Pode ser mais casual e pessoal.',
 1),

(0, '19:00', 'post',
 NULL,
 '🙏 Domingo é dia de agradecer!\n\nMorei aqui mais uma semana de vendas, novos clientes e muita satisfação em ajudar cada um de vocês a escolher o celular certo.\n\nSemana que vem tem mais novidades! Ativa as notificações para não perder nada! 🔔',
 '❤️ Obrigado pela confiança de sempre!',
 '#domingo #obrigado #gratidao #MercadoDoVale #fimdesemana',
 'Post reflexivo e humano. Pode ser um bastidor da semana ou uma foto da equipe.',
 2);
