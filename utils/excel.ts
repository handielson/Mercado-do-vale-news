import readXlsxFile from 'read-excel-file/browser';
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

export async function readExcelObjects(file: File): Promise<Record<string, any>[]> {
    const rows = await readXlsxFile(file);
    const [headerRow, ...dataRows] = rows;
    if (!headerRow) return [];

    const headers = headerRow.map(cell => String(cell ?? '').trim());
    return dataRows
        .filter(row => row.some(cell => cell != null && cell !== ''))
        .map(row => {
            const record: Record<string, any> = {};
            headers.forEach((header, index) => {
                if (!header) return;
                record[header] = row[index] ?? null;
            });
            return record;
        });
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
