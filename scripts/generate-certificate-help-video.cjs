const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const sharp = require('sharp');
const ffmpeg = require('ffmpeg-static');

const slides = [
  ['Certificado A1', 'Instalação segura no Mercado do Vale'],
  ['1. Selecione a empresa', 'Confira nome e CNPJ antes de continuar.'],
  ['2. Envie o PFX ou P12', 'Informe a senha e clique em Instalar certificado.'],
  ['3. Teste a SEFAZ', 'Comece em homologação. Código 107 = serviço em operação.'],
  ['4. Proteja sua operação', 'Configure o aviso e mantenha um backup externo do A1.'],
];

(async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mdv-certificate-video-'));
  try {
    for (let index = 0; index < slides.length; index++) {
      const [title, text] = slides[index];
      const svg = `<svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg"><rect width="1280" height="720" fill="#071b33"/><circle cx="1060" cy="145" r="95" fill="#10b981" opacity=".22"/><rect x="80" y="80" width="1120" height="560" rx="38" fill="#f8fafc"/><text x="135" y="210" font-family="Arial,sans-serif" font-size="34" font-weight="700" fill="#047857">MERCADO DO VALE</text><text x="135" y="350" font-family="Arial,sans-serif" font-size="58" font-weight="700" fill="#0f172a">${title}</text><text x="135" y="445" font-family="Arial,sans-serif" font-size="30" fill="#334155">${text}</text><text x="135" y="565" font-family="Arial,sans-serif" font-size="22" fill="#64748b">Administração › Dados da empresa › Certificado digital</text></svg>`;
      await sharp(Buffer.from(svg)).png().toFile(path.join(directory, `slide-${index + 1}.png`));
    }
    const output = path.join(__dirname, '..', 'public', 'help', 'certificado-digital-a1.mp4');
    const result = spawnSync(ffmpeg, ['-y','-framerate','1/5','-start_number','1','-i',path.join(directory,'slide-%d.png'),'-c:v','libx264','-r','30','-pix_fmt','yuv420p','-movflags','+faststart',output], { encoding: 'utf8' });
    if (result.status !== 0) throw new Error(result.stderr || result.error?.message || 'Falha ao gerar vídeo.');
    console.log(output);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exit(1); });
