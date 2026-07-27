const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const ffmpegPath = require('ffmpeg-static');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdv-tiktok-ratio-test-'));
const outputPath = path.join(tempDir, 'normalized.mp4');

try {
  const normalized = spawnSync(ffmpegPath, [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', 'color=c=blue:size=474x850:duration=0.2',
    '-vf', "pad=w='ceil(max(iw,ih*9/16)/2)*2':h='ceil(max(ih,iw*9/16)/2)*2':x='(ow-iw)/2':y='(oh-ih)/2':color=black",
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
    outputPath,
  ], { encoding: 'utf8', timeout: 30000 });
  assert.equal(normalized.status, 0, normalized.stderr || 'FFmpeg normalization failed');
  assert.ok(fs.statSync(outputPath).size > 0, 'normalized video must not be empty');

  const inspected = spawnSync(ffmpegPath, [
    '-hide_banner', '-i', outputPath,
    '-vf', 'showinfo', '-frames:v', '1', '-f', 'null', '-',
  ], { encoding: 'utf8', timeout: 30000 });
  assert.match(inspected.stderr, /s:480x850\b/, '474x850 video must become 480x850');
  console.log('TikTok Shop video ratio normalization ok: 474x850 -> 480x850');
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
