import ts from 'typescript';
import { execFileSync } from 'node:child_process';
import { resolve, relative } from 'node:path';
import assert from 'node:assert/strict';
const changed = ['components/pdv/InstallmentCalculator.tsx', 'components/pdv/PaymentSection.tsx',
    'components/pdv/ReceiptPreview.tsx', 'components/ui/CurrencyInput.tsx', 'pages/pdv/PDVPage.tsx',
    'services/saleService.ts', 'types/sale.ts', 'utils/printSaleReceipt.ts', 'utils/saleCalculations.ts'];
const mode = process.argv[2];
if (mode) {
    const config = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
    const host = ts.createCompilerHost(parsed.options);
    if (mode === 'baseline') {
        const originals = new Map(changed.map(path => [resolve(path).replaceAll('\\', '/').toLowerCase(), execFileSync('git', ['show', `HEAD:${path}`], { encoding: 'utf8' })]));
        const read = host.readFile;
        host.readFile = path => originals.get(resolve(path).replaceAll('\\', '/').toLowerCase()) ?? read(path);
        parsed.fileNames = parsed.fileNames.filter(path => !path.includes('pdv-payment-preview.tsx'));
    }
    const program = ts.createProgram(parsed.fileNames, parsed.options, host);
    const diagnostics = ts.getPreEmitDiagnostics(program).map(diagnostic => ({
        file: diagnostic.file ? relative(process.cwd(), diagnostic.file.fileName).replaceAll('\\', '/') : '',
        code: diagnostic.code, message: ts.flattenDiagnosticMessageText(diagnostic.messageText, ' '),
    }));
    process.stdout.write(JSON.stringify(diagnostics));
} else {
    const run = mode => JSON.parse(execFileSync(process.execPath, [import.meta.filename, mode], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }));
    const baseline = run('baseline');
    const current = run('current');
    const remaining = baseline.map(diagnostic => JSON.stringify(diagnostic));
    const introduced = current.filter(diagnostic => {
        const index = remaining.indexOf(JSON.stringify(diagnostic));
        if (index < 0) return true;
        remaining.splice(index, 1);
        return false;
    });
    assert.deepEqual(introduced, [], 'payment changes must not introduce TypeScript errors');
    console.log(`TypeScript: ${baseline.length} existing diagnostics, ${current.length} current, no new errors`);
}
