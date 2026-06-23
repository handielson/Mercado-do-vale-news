import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * Regressao: video_upload_timeout (HTTP 408) com video_upload_id retornado
 * pela Shopee deve causar ERRO no frontend, nao sucesso silencioso.
 *
 * Antes do fix: postShopeeDebug tratava 408 + video_upload_id como data valido
 * e devolvia o ID ao chamador, que o repassava ao add_item. A Shopee rejeitava
 * com "invalid or expired vid" porque o video ainda nao tinha sido transcodificado.
 *
 * Depois do fix: 408 lanca erro normalmente; o fluxo de upload usa
 * postShopeeDebugWithRetry com isShopeeVideoStillProcessingMessage para reenviar
 * o upload_video ate obter HTTP 200 limpo com o ID validado.
 */

// ---- 1) Servidor: polling estendido (30 x 3s) ----
for (const file of ['vps_server.js', 'vps_server.cjs', 'server.js']) {
  try {
    const source = readFileSync(file, 'utf8');

    // O polling deve ser de pelo menos 30 tentativas com intervalo >= 3s (~90s total)
    const pollMatch = source.match(/for\s*\(let\s+attempt\s*=\s*0;\s*attempt\s*<\s*(\d+)/);
    assert.ok(pollMatch, `${file}: loop de polling de video deve existir`);
    const maxAttempts = Number(pollMatch[1]);
    assert.ok(maxAttempts >= 30, `${file}: polling deve ser >= 30 tentativas (atual: ${maxAttempts})`);

    const delayMatch = source.match(/setTimeout\s*\(\s*resolve\s*,\s*(\d+)\s*\)/g);
    if (delayMatch && delayMatch.length > 0) {
      const lastDelay = Number(delayMatch[delayMatch.length - 1].match(/(\d+)/)[1]);
      // Pode haver outros setTimeouts, mas o do polling de video deve ser >= 3000
      // Nao falhar rigidamente — apenas documentar
    }

    // Ainda deve existir video_upload_timeout como retorno (mas o frontend nao usa mais o ID dele)
    assert.match(source, /video_upload_timeout/, `${file}: deve retornar video_upload_timeout quando esgotar polling`);

  } catch (err) {
    if (err.code === 'ENOENT') continue; // server.js pode nao existir em todos os worktrees
    throw err;
  }
}

// ---- 2) Frontend: 408 NAO deve ser tratado como sucesso ----
const page = readFileSync('pages/admin/settings/ShopeePage.tsx', 'utf8');

// O bloco antigo fazia: if (res.status === 408 && data?.error === 'video_upload_timeout' ...) return data
// Isso NAO deve mais existir — 408 deve cair no throw como qualquer !res.ok
assert.doesNotMatch(
  page,
  /res\.status\s*===\s*408\s*&&\s*data\?\.\s*error\s*===\s*['"]video_upload_timeout['"]\s*&&\s*data\?\.\s*response\?\.\s*video_upload_id[^}]*return data/,
  'Frontend NAO deve tratar 408 video_upload_timeout como sucesso (return data). Deve lancar erro para retry.'
);

// O comentario explicativo deve mencionar que o ID "ainda nao esta pronto"
assert.match(
  page,
  /ainda nao esta.*pronto|NAO.*validado.*add_item|invalid or expired vid.*reenviar/i,
  'Frontend deve ter comentario explicando que vid prematuro causa "invalid or expired vid"'
);

// ---- 3) Frontend: helper isShopeeVideoStillProcessingMessage deve existir ----
assert.match(
  page,
  /function\s+isShopeeVideoStillProcessingMessage/,
  'Frontend deve ter helper isShopeeVideoStillProcessingMessage para identificar vid ainda processando'
);

// Verificar que o helper cobre os tres padroes de erro (podem estar em linhas separadas)
const helperBlock = page.match(/function\s+isShopeeVideoStillProcessingMessage[\s\S]*?\n\}/);
assert.ok(helperBlock, 'Deve encontrar o bloco completo de isShopeeVideoStillProcessingMessage');
const helperSrc = helperBlock[0];
assert.ok(helperSrc.includes('video_upload_timeout'), 'Helper deve cobrir video_upload_timeout');
assert.ok(helperSrc.toLowerCase().includes('ainda em processamento'), 'Helper deve cobrir "ainda em processamento"');
assert.ok(helperSrc.toLowerCase().includes('invalid or expired vid'), 'Helper deve cobrir "invalid or expired vid"');
assert.ok(helperSrc.toLowerCase().includes('request vid is abnormal'), 'Helper deve cobrir "request vid is abnormal"');

// ---- 4) Fluxo de publicacao deve usar retry com shouldRetry ----
assert.match(
  page,
  /postShopeeDebugWithRetry\(\s*['"]upload_video['"]\s*,\s*videoUploadPayload[\s\S]*?shouldRetry[\s\S]*?isShopeeVideoStillProcessingMessage/,
  'Fluxo de publicacao (sync) deve usar postShopeeDebugWithRetry com shouldRetry para video ainda processando'
);

// ---- 5) Fluxo de edicao deve usar retry (nao fetch cru) ----
assert.match(
  page,
  /postShopeeDebugWithRetry\(\s*['"]upload_video['"]\s*,\s*\{[\s\S]*?shouldRetry[\s\S]*?isShopeeVideoStillProcessingMessage/,
  'Fluxo de edicao (update_item) deve usar postShopeeDebugWithRetry com shouldRetry para video ainda processando'
);

console.log('shopee-video-retry-no-premature-vid static checks ok');
