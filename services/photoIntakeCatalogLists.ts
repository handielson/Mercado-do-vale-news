import { brandService } from './brands';
import { ramService } from './rams';
import { storageService } from './storages';

export interface PhotoIntakeCatalogLists {
  brands: Array<{ id: string; name: string }>;
  rams: string[];
  storages: string[];
}

// Listas usadas na conferência do cadastro por foto. Carrega uma vez por sessão
// (são pequenas e mudam pouco); "Atualizar listas" força nova leitura.
let cache: Promise<PhotoIntakeCatalogLists> | null = null;

function byNumericValue(items: Array<{ value?: number | string; label?: string; active?: boolean | number }>): string[] {
  return items
    .filter(item => item.label && item.active !== false && item.active !== 0)
    .sort((left, right) => Number(left.value || 0) - Number(right.value || 0))
    .map(item => String(item.label));
}

export function loadPhotoIntakeCatalogLists(force = false): Promise<PhotoIntakeCatalogLists> {
  if (!cache || force) {
    cache = Promise.all([brandService.listActive(), ramService.listActive(), storageService.listActive()])
      .then(([brands, rams, storages]) => ({
        brands: brands
          .map(brand => ({ id: brand.id, name: brand.name }))
          .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR')),
        rams: byNumericValue(rams),
        storages: byNumericValue(storages),
      }))
      .catch(error => {
        cache = null;
        throw error;
      });
  }
  return cache;
}
