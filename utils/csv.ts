/**
 * Utilitários para Tratamento de CSV no Frontend
 * Substitui o PapaParse para evitar quebras de dependência e erros de Node.
 */

export function encodeCSV(rows: any[][]): string {
    return rows.map(row => 
        row.map(cell => {
            if (cell === null || cell === undefined) return '';
            const cellStr = String(cell);
            // Se contiver aspas, vírgulas ou quebras de linha, precisamos escapar
            if (cellStr.includes('"') || cellStr.includes(',') || cellStr.includes('\n')) {
                return `"${cellStr.replace(/"/g, '""')}"`;
            }
            return cellStr;
        }).join(',')
    ).join('\n');
}

export function parseCSV(csvText: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let currentCell = '';
    let inQuotes = false;

    for (let i = 0; i < csvText.length; i++) {
        const char = csvText[i];
        const nextChar = csvText[i + 1];

        // Se encontrou aspas
        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                // Aspas duplas escapadas dentro de aspas ""
                currentCell += '"';
                i++; // Pula a segunda aspas
            } else {
                // Toggle o estado da string (abriu ou fechou bloco com aspas)
                inQuotes = !inQuotes;
            }
        } 
        // Se encontrou vírgula E NÃO ESTÁ dentro de aspas (fim da célula)
        else if (char === ',' && !inQuotes) {
            row.push(currentCell.trim());
            currentCell = '';
        } 
        // Se encontrou quebra de linha E NÃO ESTÁ dentro de aspas (fim da linha)
        else if ((char === '\n' || char === '\r') && !inQuotes) {
            if (char === '\r' && nextChar === '\n') {
                i++; // Pula o \n do \r\n
            }
            row.push(currentCell.trim());
            rows.push(row);
            row = [];
            currentCell = '';
        } 
        // Qualquer outro caractere
        else {
            currentCell += char;
        }
    }

    // Adiciona a última célula e linha caso não tenha terminado com \n
    if (currentCell !== '' || row.length > 0) {
        row.push(currentCell.trim());
        rows.push(row);
    }

    return rows;
}
