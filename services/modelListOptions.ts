import { findEquivalentOption, parseCapacityValue } from '../components/settings/modelListOptionCore.js';
import { colorService } from './colors';
import { customFieldsService, type CustomField } from './custom-fields';
import { ramService } from './rams';
import { storageService } from './storages';
import { tableDataService, type TableOption, type TableRow } from './table-data';
import { versionService } from './versions-vps';

export interface ModelListOptionDraft {
    label: string;
    hexCode?: string;
}

export interface PersistedModelListOption {
    field: CustomField;
    option: TableOption;
}

interface SaveModelListOptionParams {
    field: CustomField;
    options: TableOption[];
    draft: ModelListOptionDraft;
    current?: TableOption | null;
}

function isCurrentOption(option: TableOption, current?: TableOption | null): boolean {
    if (!current) return false;
    return String(option.value) === String(current.value)
        && String(option.label) === String(current.label);
}

function configuredOption(
    field: CustomField,
    row: TableRow,
    fallbackValue: string | number,
    fallbackLabel: string
): TableOption {
    const valueColumn = field.table_config?.value_column || 'id';
    const labelColumn = field.table_config?.label_column || 'name';

    return {
        value: (row[valueColumn] ?? fallbackValue) as string | number,
        label: String(row[labelColumn] ?? fallbackLabel),
    };
}

function strictConfiguredOption(field: CustomField, row: TableRow): TableOption {
    const { table_name: tableName, value_column: valueColumn, label_column: labelColumn } = field.table_config!;
    if (row[valueColumn] == null || row[labelColumn] == null) {
        throw new Error(
            `A tabela ${tableName} nao retornou as colunas configuradas ${valueColumn} e ${labelColumn}.`
        );
    }

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

function manualOptionsWithSavedLabel(
    field: CustomField,
    label: string,
    current?: TableOption | null
): string[] {
    const options = [...(field.options || [])];
    if (!current) return [...options, label];

    const currentIndex = options.findIndex(
        option => String(option) === String(current.value) || String(option) === current.label
    );
    if (currentIndex < 0) return [...options, label];

    options[currentIndex] = label;
    return options;
}

export async function saveModelListOption({
    field,
    options,
    draft,
    current = null,
}: SaveModelListOptionParams): Promise<PersistedModelListOption> {
    const label = draft.label.trim();
    if (!label) {
        throw new Error('Informe o nome da opcao.');
    }

    const equivalent = findEquivalentOption(
        label,
        options.filter(option => !isCurrentOption(option, current))
    );
    if (equivalent) {
        return { field, option: equivalent };
    }

    if (field.field_type === 'select') {
        const updatedField = await customFieldsService.update(field.id, {
            options: manualOptionsWithSavedLabel(field, label, current),
        });
        return {
            field: updatedField,
            option: { value: label, label },
        };
    }

    if (field.field_type !== 'table_relation' || !field.table_config) {
        throw new Error('O campo informado nao e uma lista editavel.');
    }

    const tableName = field.table_config.table_name;

    if (tableName === 'colors') {
        const input = { name: label, hex_code: draft.hexCode, active: true };
        const saved = current
            ? await colorService.update(String(current.value), input)
            : await colorService.create(input);
        return {
            field,
            option: configuredOption(field, saved as unknown as TableRow, saved.id, saved.name),
        };
    }

    if (tableName === 'rams') {
        const input = { value: parseCapacityValue(label), label, active: true };
        const saved = current
            ? await ramService.update(String(current.value), input)
            : await ramService.create(input);
        return {
            field,
            option: configuredOption(field, saved as unknown as TableRow, saved.id, saved.label),
        };
    }

    if (tableName === 'storages') {
        const input = { value: parseCapacityValue(label), label, active: true };
        const saved = current
            ? await storageService.update(String(current.value), input)
            : await storageService.create(input);
        return {
            field,
            option: configuredOption(field, saved as unknown as TableRow, saved.id, saved.label),
        };
    }

    if (tableName === 'versions') {
        const input = { name: label, active: true };
        const saved = current
            ? await versionService.update(String(current.value), input)
            : await versionService.create(input);
        return {
            field,
            option: configuredOption(field, saved as unknown as TableRow, saved.id, saved.name),
        };
    }

    const { value_column: valueColumn, label_column: labelColumn } = field.table_config;
    const values: TableRow = {
        [labelColumn]: label,
    };
    if (valueColumn !== 'id' && valueColumn !== labelColumn) {
        values[valueColumn] = label;
    }

    const primaryKey = current?.meta?.primaryKey ?? (valueColumn === 'id' ? 'id' : valueColumn);
    const primaryValue = current?.meta?.primaryValue ?? current?.value;
    const saved = current
        ? await tableDataService.updateRow(tableName, primaryKey, primaryValue!, values)
        : await tableDataService.createRow(tableName, values);
    const persistedRow = current
        ? { ...(current.meta?.row || {}), ...saved }
        : saved;

    return {
        field,
        option: strictConfiguredOption(field, persistedRow),
    };
}
