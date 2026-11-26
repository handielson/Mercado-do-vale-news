'use strict';
// marklife-p50-v1: converte PDF para o formato da etiquetadora Marklife P50 (chip YICHIP YC3121),
// igual ao que o driver "P50 Printer" do Windows manda (capturado do Lenovo em 26/11/2026):
//   1F 70 01 0A · 1F 11 51 · GS v 0 (48 bytes = 384 pontos de largura) · GS FF (vai para a próxima etiqueta) · 1F 11 50
// O desenho vai girado 180° e encostado no lado direito da cabeça (é onde a etiqueta fica no rolo).
// Sem os comandos 1F 11 51 / 1F 11 50 a impressora ignora a etiqueta.
const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const os = require('os');
const path = require('path');

const HEAD_DOTS = 384;
const HEAD_BYTES = HEAD_DOTS / 8;
const START = Buffer.from('1f70010a1f1151', 'hex');
const END = Buffer.from('1d0c1f1150', 'hex');

function parsePbm(buffer) {
    let i = 0; const toks = [];
    const space = (b) => b === 0x20 || b === 0x0a || b === 0x0d || b === 0x09;
    while (toks.length < 3) {
        while (space(buffer[i])) i++;
        if (buffer[i] === 0x23) { while (buffer[i] !== 0x0a) i++; continue; }
        const j0 = i; while (!space(buffer[i])) i++;
        toks.push(buffer.slice(j0, i).toString());
    }
    i++;
    if (toks[0] !== 'P4') throw new Error('PBM inválido');
    const width = Number(toks[1]); const height = Number(toks[2]); const rowBytes = Math.ceil(width / 8);
    return { width, height, rowBytes, data: buffer.slice(i, i + rowBytes * height), next: i + rowBytes * height };
}

/** Uma página (bitmap 1 = preto) → bytes da P50. */
function encodePage({ width, height, rowBytes, data }) {
    const w = Math.min(width, HEAD_DOTS);
    const x0 = HEAD_DOTS - w;
    const out = Buffer.alloc(HEAD_BYTES * height);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < w; x++) {
            if ((data[y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1) {
                const nx = x0 + (w - 1 - x); const ny = height - 1 - y;
                out[ny * HEAD_BYTES + (nx >> 3)] |= 0x80 >> (nx & 7);
            }
        }
    }
    const header = Buffer.from([0x1d, 0x76, 0x30, 0x00, HEAD_BYTES, 0, height & 255, height >> 8]);
    return Buffer.concat([START, header, out, END]);
}

/** PDF (uma ou várias páginas) → bytes prontos para mandar "raw" para a P50. */
async function encodePdf(pdfPath, { exec = promisify(execFile), dpi = 203 } = {}) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p50-'));
    try {
        await exec('gs', ['-q', '-dBATCH', '-dNOPAUSE', '-dSAFER', '-sDEVICE=pbmraw', `-r${dpi}`, '-o', path.join(dir, 'p%03d.pbm'), pdfPath], { timeout: 60000 });
        const pages = fs.readdirSync(dir).filter((f) => f.endsWith('.pbm')).sort();
        if (!pages.length) throw new Error('PDF sem páginas');
        return Buffer.concat(pages.map((f) => encodePage(parsePbm(fs.readFileSync(path.join(dir, f))))));
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

module.exports = { encodePdf, encodePage, parsePbm, HEAD_DOTS };
