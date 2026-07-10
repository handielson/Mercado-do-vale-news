import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const pdf = read('utils/cashReportPdf.ts');
const wizard = read('components/pdv/CashClosingWizard.tsx');

assert.match(pdf, /new jsPDF/, 'relatorio deve ser um PDF real');
assert.match(pdf, /autoTable/, 'relatorio deve tabular totais e vendas');
assert.match(pdf, /output\('arraybuffer'\)/, 'PDF deve ser convertido com seguranca para upload');
assert.match(wizard, /cashReportPdfBase64\(result\.report_snapshot\)/, 'fechamento deve enviar o snapshot congelado');
assert.match(wizard, /uploadDocument\(result\.document_id/, 'fechamento deve arquivar o documento criado pelo backend');

for (const serverName of ['vps_server.js', 'vps_server.cjs']) {
    const server = read(serverName);
    assert.match(server, /async function uploadCashReportToSynology/, `${serverName} deve ter helper de upload`);
    assert.match(server, /create_parents[^\n]*true/, `${serverName} deve criar pastas no Synology`);
    assert.match(server, /overwrite[^\n]*false/, `${serverName} nao pode sobrescrever relatorios`);
    assert.match(server, /\/caixa\/\$\{parts\.year\}/, `${serverName} deve usar pasta dedicada de caixa`);
    assert.match(server, /report_upload_(?:failed|retry|uploaded)/, `${serverName} deve auditar upload`);
}

console.log('cash register Synology report static checks passed');
