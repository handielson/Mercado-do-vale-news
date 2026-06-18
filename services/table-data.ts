import { vpsClient } from './vpsClient';

export interface TableOption {
    value: string | number;
    label: string;
    meta?: {
        primaryKey: string;
        primaryValue: string | number;
        row: TableRow;
    };
}

export type TableRow = Record<string, unknown>;

interface TableDataResponse {
    rows?: TableRow[];
    total?: number;
    limit?: number;
    offset?: number;
}

function compareValues(a: unknown, b: unknown, ascending: boolean): number {
    const left = String(a ?? '');
    const right = String(b ?? '');
    const result = left.localeCompare(right, 'pt-BR', { sensitivity: 'base', numeric: true });
    return ascending ? result : -result;
}

function sortRows(rows: TableRow[], labelColumn: string, orderBy?: string): TableRow[] {
    const [column = labelColumn, direction = 'ASC'] = String(orderBy || '').trim().split(/\s+/);
    const sortColumn = column || labelColumn;
    const ascending = direction.toUpperCase() !== 'DESC';
    return [...rows].sort((a, b) => compareValues(a[sortColumn], b[sortColumn], ascending));
}

function createTableOption(
    row: TableRow,
    valueColumn: string,
    labelColumn: string
): TableOption {
    const primaryKey = row.id != null ? 'id' : valueColumn;

    return {
        value: row[valueColumn] as string | number,
        label: String(row[labelColumn]),
        meta: {
            primaryKey,
            primaryValue: row[primaryKey] as string | number,
            row,
        },
    };
}

async function loadRows(tableName: string): Promise<TableRow[]> {
    const allRows: TableRow[] = [];
    const pageSize = 200;

    for (let offset = 0; ; offset += pageSize) {
        const data = await vpsClient.get<TableDataResponse>(
            `/table-data/${encodeURIComponent(tableName)}?limit=${pageSize}&offset=${offset}`
        );
        const rows = Array.isArray(data.rows) ? data.rows : [];
        allRows.push(...rows);
        if (rows.length < pageSize) break;
    }

    return allRows;
}

/**
 * Table Data Service
 * Loads options from database tables for table_relation fields through the VPS.
 */
export const tableDataService = {
    async createRow(
        tableName: string,
        values: TableRow
    ): Promise<TableRow> {
        return vpsClient.post<TableRow>(
            `/table-data/${encodeURIComponent(tableName)}`,
            values
        );
    },

    async updateRow(
        tableName: string,
        primaryKey: string,
        primaryValue: string | number,
        values: TableRow
    ): Promise<TableRow> {
        return vpsClient.patch<TableRow>(
            `/table-data/${encodeURIComponent(tableName)}/${encodeURIComponent(String(primaryValue))}?pk=${encodeURIComponent(primaryKey)}`,
            values
        );
    },

    async loadOptions(
        tableName: string,
        valueColumn: string = 'id',
        labelColumn: string = 'name',
        orderBy?: string
    ): Promise<TableOption[]> {
        try {
            const rows = sortRows(await loadRows(tableName), labelColumn, orderBy);
            return rows
                .filter((row) => row[valueColumn] != null && row[labelColumn] != null)
                .map(row => createTableOption(row, valueColumn, labelColumn));
        } catch (error) {
            console.error(`Failed to load options from ${tableName}:`, error);
            return [];
        }
    },

    async loadOption(
        tableName: string,
        value: string | number,
        valueColumn: string = 'id',
        labelColumn: string = 'name'
    ): Promise<TableOption | null> {
        try {
            const rows = await loadRows(tableName);
            const data = rows.find((row) => String(row[valueColumn]) === String(value));
            if (!data || data[valueColumn] == null || data[labelColumn] == null) return null;

            return createTableOption(data, valueColumn, labelColumn);
        } catch (error) {
            console.error(`Failed to load option from ${tableName}:`, error);
            return null;
        }
    }
};
