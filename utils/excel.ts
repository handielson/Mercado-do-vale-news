import { readSheet } from 'read-excel-file/browser';
import writeXlsxFile, { type SheetData } from 'write-excel-file/browser';

type ExcelCellValue = string | number | boolean | Date | null | undefined;

function normalizeCell(value: unknown): ExcelCellValue {
    if (value == null) return null;
    if (value instanceof Date) return value;
    if (['string', 'number', 'boolean'].includes(typeof value)) return value as ExcelCellValue;
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

/**
 * Converte as linhas de uma aba (primeira linha = cabeçalho) em objetos.
 * Linhas totalmente vazias são ignoradas; cada objeto leva `__row` (linha da planilha, 1-based,
 * cabeçalho = 1) como propriedade não enumerável.
 */
export function rowsToObjects(rows: unknown[][]): Record<string, any>[] {
    const [headerRow, ...dataRows] = rows || [];
    if (!headerRow) return [];

    const headers = headerRow.map(cell => String(cell ?? '').trim());
    const records: Record<string, any>[] = [];
    dataRows.forEach((row, index) => {
        if (!row.some(cell => cell != null && cell !== '')) return;
        const record: Record<string, any> = {};
        headers.forEach((header, col) => {
            if (!header) return;
            record[header] = row[col] ?? null;
        });
        Object.defineProperty(record, '__row', { value: index + 2, enumerable: false });
        records.push(record);
    });
    return records;
}

export async function readExcelObjects(file: File): Promise<Record<string, any>[]> {
    // read-excel-file >= 8: o export padrão devolve [{ sheet, data }]; readSheet devolve as linhas da primeira aba.
    const rows = await readSheet(file);
    return rowsToObjects(rows as unknown[][]);
}

export async function writeExcelRows(
    fileName: string,
    rows: Record<string, any>[],
    fallbackHeaders: string[] = []
): Promise<void> {
    const headers = rows.length
        ? Array.from(rows.reduce((set, row) => {
            Object.keys(row).forEach(key => set.add(key));
            return set;
        }, new Set<string>()))
        : fallbackHeaders;

    const sheetData: SheetData = [
        headers,
        ...rows.map(row => headers.map(header => normalizeCell(row[header])))
    ];

    await writeXlsxFile(sheetData).toFile(fileName);
}

export async function writeExcelTemplate(fileName: string, headers: string[]): Promise<void> {
    await writeXlsxFile([headers]).toFile(fileName);
}
