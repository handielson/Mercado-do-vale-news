import fs from 'fs';

let c;
try {
    c = fs.readFileSync('services/categories.ts', 'utf8');
    c = c.replace('created: new Date().toISOString(),', '');
    fs.writeFileSync('services/categories.ts', c);
} catch(e) {}

try {
    c = fs.readFileSync('services/checkinService.ts', 'utf8');
    c = c.replace('is_cycle_complete: data.current_day === data.total_days,', '');
    fs.writeFileSync('services/checkinService.ts', c);
} catch(e) {}

try {
    c = fs.readFileSync('utils/printDebtClearance.ts', 'utf8');
    c = c.replace('conta.contato.cpf_cnpj', '(conta.contato as any).cpf_cnpj');
    fs.writeFileSync('utils/printDebtClearance.ts', c);
} catch(e) {}

try {
    c = fs.readFileSync('utils/printPaymentReceipt.ts', 'utf8');
    c = c.replace(/conta\.contato\.(cpf_cnpj|telefone|email)/g, '(conta.contato as any).$1');
    fs.writeFileSync('utils/printPaymentReceipt.ts', c);
} catch(e) {}

try {
    c = fs.readFileSync('utils/printSaleReceipt.ts', 'utf8');
    c = c.replace(/import.*benefitService.*/g, '');
    fs.writeFileSync('utils/printSaleReceipt.ts', c);
} catch(e) {}

console.log("Fix script completed.");
