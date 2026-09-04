const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
if (process.platform !== 'win32') throw new Error('Compilar o auxiliar no Windows.');
const compiler = path.join(process.env.SystemRoot || 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');
if (!fs.existsSync(compiler)) throw new Error('Compilador .NET Framework 4.x não encontrado.');
const output = path.join(__dirname, 'central-print-runtime');
fs.mkdirSync(output, { recursive: true });
execFileSync(compiler, ['/nologo', '/target:exe', '/platform:x64', '/reference:System.Drawing.dll',
  `/out:${path.join(output, 'central-print-paper.exe')}`, path.join(__dirname, 'central-print-paper.cs')], { windowsHide: true, stdio: 'inherit' });
console.log('Auxiliar de papel compilado em scripts/central-print-runtime/central-print-paper.exe');
