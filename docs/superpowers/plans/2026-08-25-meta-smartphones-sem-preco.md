# Criativo Meta de Smartphones sem Preço — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produzir e colocar em veiculação um novo vídeo de smartphones sem preço, destacando pronta entrega, entrega grátis em Petrolina/Juazeiro e pagamento na entrega, preservando público, destino e teto vitalício da campanha.

**Architecture:** Reaproveitar os scripts de produção do vídeo atual e gerar uma variante isolada em `final/sem-preco`, com abertura e encerramento institucionais e cinco quadros de produto. A troca na Meta será feita por um novo anúncio no mesmo conjunto; o anúncio atual permanece disponível até o novo ser aprovado e validado.

**Tech Stack:** Python 3, Pillow, NumPy, FFmpeg/ffprobe, Node.js para testes estáticos, Central de Aprovações do Gestão MV e Meta Ads Manager autenticado.

---

## Estrutura de arquivos

- Modificar `output/marketing/meta-smartphones-20260805/build_creatives.py`: centralizar a copy aprovada, gerar abertura/encerramento e quadros sem preço.
- Modificar `output/marketing/meta-smartphones-20260805/build_video.py`: compor sete cenas em aproximadamente 15 segundos.
- Modificar `output/marketing/meta-smartphones-20260805/final/texto-do-anuncio.txt`: remover preço inicial e registrar texto, título, descrição e mensagem pronta finais.
- Criar `tmp-tests/meta-smartphones-no-price-static.test.mjs`: proteger copy, ausência de preço e contrato das sete cenas.
- Gerar `output/marketing/meta-smartphones-20260805/final/sem-preco/video-smartphones-conversao-9x16-sem-preco.mp4`: mídia final enviada à Meta.
- Gerar `output/marketing/meta-smartphones-20260805/final/sem-preco/qa-video-conversao-sem-preco.png`: contato visual das sete cenas.

### Task 1: Proteger a copy comercial aprovada

**Files:**
- Create: `tmp-tests/meta-smartphones-no-price-static.test.mjs`
- Modify: `output/marketing/meta-smartphones-20260805/build_creatives.py`
- Test: `tmp-tests/meta-smartphones-no-price-static.test.mjs`

- [ ] **Step 1: Criar o teste estático inicialmente falho**

```javascript
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL('../output/marketing/meta-smartphones-20260805/build_creatives.py', import.meta.url),
  'utf8',
);

for (const required of [
  'SMARTPHONES À PRONTA ENTREGA',
  'Estes e muitos outros modelos disponíveis',
  'ENTREGA GRÁTIS',
  'PAGUE NA ENTREGA',
  'PETROLINA E JUAZEIRO',
  'RECEBA A LISTA ATUALIZADA NO WHATSAPP',
  'make_campaign_card',
  'story-00-abertura-sem-preco.png',
  'story-06-encerramento-sem-preco.png',
]) assert.match(source, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

const noPriceBlock = source.slice(source.indexOf('NO_PRICE_COPY'), source.indexOf('def make_story'));
assert.doesNotMatch(noPriceBlock, /R\$|199|À VISTA|PIX a partir/i);
console.log('meta smartphones no-price static checks: OK');
```

- [ ] **Step 2: Executar o teste e confirmar a falha esperada**

Run:

```powershell
node tmp-tests/meta-smartphones-no-price-static.test.mjs
```

Expected: `AssertionError` indicando que `SMARTPHONES À PRONTA ENTREGA` ou `make_campaign_card` ainda não existe.

- [ ] **Step 3: Adicionar constantes e gerador das telas institucionais**

Adicionar antes de `make_story` em `build_creatives.py`:

```python
NO_PRICE_COPY = {
    "title": "SMARTPHONES À PRONTA ENTREGA",
    "subtitle": "Estes e muitos outros modelos disponíveis",
    "benefits": ("ENTREGA GRÁTIS", "PAGUE NA ENTREGA", "PETROLINA E JUAZEIRO"),
    "cta": "RECEBA A LISTA ATUALIZADA NO WHATSAPP",
}

def make_campaign_card(kind, output_dir):
    bg = Image.open(ROOT / "tech-background-9x16.png").convert("RGB").resize((1080, 1920), Image.Resampling.LANCZOS)
    canvas = ImageEnhance.Contrast(bg).enhance(1.08).convert("RGBA")
    draw = ImageDraw.Draw(canvas)
    overlay = Image.new("RGBA", canvas.size, (2, 11, 34, 112))
    canvas = Image.alpha_composite(canvas, overlay)
    draw = ImageDraw.Draw(canvas)

    logo = contain(Image.open(ROOT / "mercado-do-vale-logo.jpg").convert("RGB"), (300, 135))
    rounded(draw, (330, 100, 750, 285), 32, (255, 255, 255, 245))
    canvas.paste(logo, (540 - logo.width // 2, 192 - logo.height // 2))

    center_text(draw, 390, NO_PRICE_COPY["title"], font(48, heavy=True), (255, 255, 255), 1080)
    center_text(draw, 475, NO_PRICE_COPY["subtitle"], font(29), (103, 205, 255), 1080)

    colors = ((27, 189, 94, 255), (255, 122, 22, 255), (26, 110, 210, 255))
    for index, benefit in enumerate(NO_PRICE_COPY["benefits"]):
        top = 650 + index * 190
        rounded(draw, (105, top, 975, top + 130), 40, colors[index])
        center_text(draw, top + 38, benefit, font(39, heavy=True), (255, 255, 255), 1080)

    rounded(draw, (70, 1390, 1010, 1570), 52, (27, 189, 94, 255))
    center_text(draw, 1442, NO_PRICE_COPY["cta"], font(35, heavy=True), (255, 255, 255), 1080)
    center_text(draw, 1665, 'TOQUE EM “ENVIAR MENSAGEM”', font(29), (255, 255, 255), 1080)
    center_text(draw, 1760, "Mercado do Vale", font(27), (204, 225, 255), 1080)

    output_dir.mkdir(parents=True, exist_ok=True)
    filename = "story-00-abertura-sem-preco.png" if kind == "opening" else "story-06-encerramento-sem-preco.png"
    path = output_dir / filename
    canvas.convert("RGB").save(path, quality=94)
    return path
```

No bloco `if __name__ == "__main__":`, gerar as telas somente no modo sem preço:

```python
if not include_price:
    stories.append(make_campaign_card("opening", output_dir))
for i, p in enumerate(PRODUCTS):
    stories.append(make_story(p, i, include_price=include_price, output_dir=output_dir))
    make_square(p, i, include_price=include_price, output_dir=output_dir)
if not include_price:
    stories.append(make_campaign_card("closing", output_dir))
```

- [ ] **Step 4: Executar o teste e confirmar aprovação**

Run:

```powershell
node tmp-tests/meta-smartphones-no-price-static.test.mjs
```

Expected: `meta smartphones no-price static checks: OK`.

- [ ] **Step 5: Commitar somente os arquivos da Task 1**

```powershell
git add -- "tmp-tests/meta-smartphones-no-price-static.test.mjs" "output/marketing/meta-smartphones-20260805/build_creatives.py"
git diff --cached --check
git commit -m "feat(marketing): adicionar telas de conversão sem preço"
```

### Task 2: Compor o vídeo de sete cenas e remover preços da copy do anúncio

**Files:**
- Modify: `output/marketing/meta-smartphones-20260805/build_video.py`
- Modify: `output/marketing/meta-smartphones-20260805/final/texto-do-anuncio.txt`
- Modify: `tmp-tests/meta-smartphones-no-price-static.test.mjs`
- Test: `tmp-tests/meta-smartphones-no-price-static.test.mjs`

- [ ] **Step 1: Ampliar o teste para o contrato do vídeo e do texto**

Acrescentar ao teste:

```javascript
const videoSource = fs.readFileSync(
  new URL('../output/marketing/meta-smartphones-20260805/build_video.py', import.meta.url),
  'utf8',
);
const adCopy = fs.readFileSync(
  new URL('../output/marketing/meta-smartphones-20260805/final/texto-do-anuncio.txt', import.meta.url),
  'utf8',
);

assert.match(videoSource, /expected_scenes = 7 if args\.sem_preco else 5/);
assert.match(videoSource, /video-smartphones-conversao-9x16-sem-preco\.mp4/);
assert.match(adCopy, /entrega grátis em Petrolina e Juazeiro/i);
assert.match(adCopy, /pagamento na entrega/i);
assert.match(adCopy, /Quero receber a lista atualizada de smartphones disponíveis \| Origem: Instagram/);
assert.doesNotMatch(adCopy, /R\$|a partir de|compra mínima/i);
```

- [ ] **Step 2: Executar o teste e confirmar a nova falha**

Run:

```powershell
node tmp-tests/meta-smartphones-no-price-static.test.mjs
```

Expected: `AssertionError` na quantidade de cenas ou no novo nome do vídeo.

- [ ] **Step 3: Generalizar `build_video` para cinco ou sete cenas**

Substituir o início e a composição de filtros por:

```python
def build_video(audio, input_dir=OUT, output_name="video-smartphones-lista-whatsapp-9x16.mp4", expected_scenes=5):
    stories = sorted(input_dir.glob("story-*.png"))
    if len(stories) != expected_scenes:
        raise RuntimeError(f"Esperados {expected_scenes} criativos verticais; encontrados {len(stories)}")

    scene_seconds = 2.33 if expected_scenes == 7 else 3.20
    transition_seconds = 0.22 if expected_scenes == 7 else 0.25
    scene_frames = round(scene_seconds * 30)
    args = ["ffmpeg", "-y"]
    for story in stories:
        args += ["-loop", "1", "-t", f"{scene_seconds:.2f}", "-i", str(story)]
    args += ["-i", str(audio)]

    filters = []
    for index in range(len(stories)):
        speed = 0.00018 if index in (0, len(stories) - 1) else 0.00023
        filters.append(
            f"[{index}:v]zoompan=z='min(zoom+{speed},1.025)':"
            f"x='iw*0.5-(iw/zoom/2)':y='ih*0.5-(ih/zoom/2)':"
            f"d={scene_frames}:s=1080x1920:fps=30,format=yuv420p[v{index}]"
        )

    previous = "v0"
    for index in range(1, len(stories)):
        output = "vout" if index == len(stories) - 1 else f"x{index}"
        offset = index * (scene_seconds - transition_seconds)
        transition = "fade" if index in (1, len(stories) - 1) else ("slideleft" if index % 2 else "wipeup")
        filters.append(
            f"[{previous}][v{index}]xfade=transition={transition}:"
            f"duration={transition_seconds:.2f}:offset={offset:.2f}[{output}]"
        )
        previous = output

    audio_index = len(stories)
    filters.append(f"[{audio_index}:a]volume=0.82,afade=t=in:st=0:d=0.25,afade=t=out:st=14.6:d=0.4[aout]")
```

Atualizar o bloco principal:

```python
expected_scenes = 7 if args.sem_preco else 5
output_name = "video-smartphones-conversao-9x16-sem-preco.mp4" if args.sem_preco else "video-smartphones-lista-whatsapp-9x16.mp4"
print(build_video(audio, input_dir=input_dir, output_name=output_name, expected_scenes=expected_scenes))
```

- [ ] **Step 4: Substituir o texto do anúncio por copy sem preço**

Usar exatamente:

```text
TEXTO PRINCIPAL
Procurando celular novo? Temos smartphones à pronta entrega, entrega grátis em Petrolina e Juazeiro e pagamento na entrega. Toque em “Enviar mensagem” e receba a lista atualizada com modelos e cores disponíveis.

TÍTULO
Receba a lista atualizada de smartphones

DESCRIÇÃO
Modelos, cores e estoque atualizados no WhatsApp.

BOTÃO
Enviar mensagem

MENSAGEM PRONTA DO CLIENTE
Quero receber a lista atualizada de smartphones disponíveis | Origem: Instagram
```

- [ ] **Step 5: Executar a regressão estática**

Run:

```powershell
node tmp-tests/meta-smartphones-no-price-static.test.mjs
```

Expected: `meta smartphones no-price static checks: OK`.

- [ ] **Step 6: Commitar somente os arquivos da Task 2**

```powershell
git add -- "output/marketing/meta-smartphones-20260805/build_video.py" "output/marketing/meta-smartphones-20260805/final/texto-do-anuncio.txt" "tmp-tests/meta-smartphones-no-price-static.test.mjs"
git diff --cached --check
git commit -m "feat(marketing): montar vídeo de conversão sem preço"
```

### Task 3: Gerar e verificar a mídia final

**Files:**
- Generate: `output/marketing/meta-smartphones-20260805/final/sem-preco/story-00-abertura-sem-preco.png`
- Generate: `output/marketing/meta-smartphones-20260805/final/sem-preco/story-06-encerramento-sem-preco.png`
- Generate: `output/marketing/meta-smartphones-20260805/final/sem-preco/video-smartphones-conversao-9x16-sem-preco.mp4`
- Generate: `output/marketing/meta-smartphones-20260805/final/sem-preco/qa-video-conversao-sem-preco.png`

- [ ] **Step 1: Limpar somente os sete quadros gerados da variante sem preço**

Confirmar primeiro que o diretório resolvido termina em `final\sem-preco`. Remover apenas arquivos `story-*.png` desse diretório para impedir que quadros antigos alterem a quantidade de cenas. Não remover o diretório, o vídeo anterior ou arquivos fora dele.

- [ ] **Step 2: Gerar as artes e o vídeo**

Run:

```powershell
python "output/marketing/meta-smartphones-20260805/build_creatives.py" --sem-preco
python "output/marketing/meta-smartphones-20260805/build_video.py" --sem-preco
```

Expected: sete caminhos de imagem e o caminho de `video-smartphones-conversao-9x16-sem-preco.mp4`, sem exceção do FFmpeg.

- [ ] **Step 3: Validar contrato técnico do MP4**

Run:

```powershell
ffprobe -v error -show_entries format=duration,size:stream=codec_name,width,height,r_frame_rate,pix_fmt -of json "output/marketing/meta-smartphones-20260805/final/sem-preco/video-smartphones-conversao-9x16-sem-preco.mp4"
```

Expected:

```text
video codec_name=h264
audio codec_name=aac
width=1080
height=1920
pix_fmt=yuv420p
r_frame_rate=30/1
duration entre 14.9 e 15.1 segundos
```

- [ ] **Step 4: Gerar contato visual das sete cenas**

Run:

```powershell
ffmpeg -y -i "output/marketing/meta-smartphones-20260805/final/sem-preco/video-smartphones-conversao-9x16-sem-preco.mp4" -vf "fps=7/15,scale=270:-1,tile=7x1" -frames:v 1 -update 1 "output/marketing/meta-smartphones-20260805/final/sem-preco/qa-video-conversao-sem-preco.png"
```

Expected: PNG de 1890 × 480 contendo abertura, cinco modelos e encerramento.

- [ ] **Step 5: Fazer QA visual obrigatório**

Abrir o contato visual e cada tela institucional em resolução original. Confirmar:

```text
nenhum valor monetário visível
acentos e textos sem cortes
logo legível
três benefícios legíveis em celular
CTA dentro da área segura
ordem abertura → cinco modelos → encerramento
nenhuma promessa de compra mínima
```

- [ ] **Step 6: Calcular a identidade imutável da mídia**

Run:

```powershell
Get-FileHash -Algorithm SHA256 "output/marketing/meta-smartphones-20260805/final/sem-preco/video-smartphones-conversao-9x16-sem-preco.mp4"
```

Expected: hash SHA-256 de 64 caracteres, que será incluído na nova aprovação.

### Task 4: Substituir a aprovação antiga por uma solicitação final

**External systems:**
- Gestão MV — Marketing > Aprovações
- Meta Ads Manager

- [ ] **Step 1: Auditar novamente o estado da campanha sem alterar nada**

Confirmar na Meta:

```text
campaign_id=120247108390210772
adset_id=120247117593690772
source_ad_id=120247120281850772
source ad ativo=Vídeo | Smartphones | Lista WhatsApp | V1 | 20260805
orçamento vitalício do conjunto=R$ 600
```

Se qualquer identificador, estado ou orçamento divergir, parar e recalcular a solicitação.

- [ ] **Step 2: Não usar a aprovação anterior**

A solicitação `b280bb57-f9bd-4c4b-a029-53faeb4efd7c` aponta para a versão intermediária do vídeo, sem as novas telas de entrega e pagamento. Ela deve ser rejeitada pelo administrador ou deixada expirar; não executar seu payload.

- [ ] **Step 3: Criar nova solicitação idempotente na Central**

Registrar uma solicitação com:

```text
action_type=meta.replace_active_ad_creative.v1
executor=lenovo_chrome
novo anúncio=Vídeo | Smartphones | Sem preço | Conversão | V2 | 20260825
orçamento adicional=R$ 0
teto vitalício preservado=R$ 600
mídia=path + SHA-256 da Task 3
copy=texto final da Task 2
mensagem pronta=Quero receber a lista atualizada de smartphones disponíveis | Origem: Instagram
sucesso=novo anúncio aprovado/ativo, destino correto e anúncio antigo pausado
reversão=desativar V2 e reativar V1
validade=24 horas
```

- [ ] **Step 4: Parar para decisão humana**

Abrir a Central em `Marketing > Aprovações`. O agente não pode aprovar a própria solicitação. Prosseguir somente depois de a solicitação final aparecer como `approved`.

### Task 5: Criar o novo anúncio e realizar a troca sem perder cobertura

**External system:** Meta Ads Manager autenticado

- [ ] **Step 1: Revalidar a aprovação e o estado externo**

Confirmar que a aprovação ainda está válida, o hash do arquivo continua igual e o anúncio V1 continua ativo no conjunto esperado.

- [ ] **Step 2: Duplicar o anúncio V1 dentro do mesmo conjunto**

Criar a duplicata como rascunho/desativada, com o nome:

```text
Vídeo | Smartphones | Sem preço | Conversão | V2 | 20260825
```

Não duplicar campanha nem conjunto e não alterar público, posicionamentos ou orçamento.

- [ ] **Step 3: Substituir mídia e copy no novo anúncio**

Enviar o MP4 validado da Task 3 e aplicar exatamente o texto da Task 2. Manter o CTA `Enviar mensagem`, o WhatsApp oficial e a mensagem pronta aprovada.

- [ ] **Step 4: Conferir a prévia antes de publicar**

Validar Stories/Reels verticais, ausência de preço, texto completo, identidade correta, WhatsApp oficial e nenhuma recomendação automática aplicada.

- [ ] **Step 5: Publicar o novo anúncio para revisão da Meta**

Manter o V1 ativo enquanto o V2 estiver em análise. Confirmar que não houve alteração no teto vitalício de R$ 600.

- [ ] **Step 6: Efetuar a troca após aprovação**

Quando o V2 estiver aprovado, ativá-lo, confirmar que ficou `Ativo` e então desativar o V1. O período simultâneo deve se limitar à confirmação operacional.

- [ ] **Step 7: Verificar o estado final**

Registrar:

```text
novo ad_id
V2=Ativo
V1=Desativado
campanha e conjunto inalterados
orçamento vitalício=R$ 600
destino=WhatsApp oficial
rascunhos pendentes=0
```

Se qualquer verificação falhar, executar a reversão aprovada: desligar o V2 e reativar o V1.

### Task 6: Monitorar o teste de conversão

**External systems:** Gestão MV e Meta Ads Manager

- [ ] **Step 1: Registrar a linha de base**

Usar como referência recente:

```text
custo por conversa=R$ 4,94
clique no CTA → conversa=38,2%
```

- [ ] **Step 2: Evitar outras alterações durante o teste**

Não mudar público, orçamento, destino ou formato enquanto o V2 acumula evidência, salvo erro operacional, produto indisponível ou violação de política.

- [ ] **Step 3: Revisar após sete dias completos ou 30 conversas**

Comparar períodos equivalentes e relatar custo por conversa, conversas iniciadas, cliques no CTA, taxa clique→conversa, frequência e gasto.

- [ ] **Step 4: Aplicar o critério de decisão**

```text
Manter: custo por conversa ≤ R$ 4,94 e clique→conversa ≥ 38,2%.
Investigar: uma métrica piora, mas existe volume insuficiente ou falha de mensuração.
Reverter: piora material confirmada com volume suficiente ou problema no WhatsApp/bot.
```

- [ ] **Step 5: Encerrar com relatório de estado**

Informar mídia utilizada, IDs, aprovação, orçamento autorizado, gasto realizado, métricas, decisão e próxima revisão. Não atribuir vendas enquanto compras, receita e ROAS permanecerem sem mensuração.
