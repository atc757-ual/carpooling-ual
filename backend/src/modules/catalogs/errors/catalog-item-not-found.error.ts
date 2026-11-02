import { BusinessError } from '../../../shared/errors/business-error';

// No hay ningún elemento con esa clave en el catálogo. La capa API lo traduce
// a un 404 (CATALOG_ITEM_NOT_FOUND)
export class CatalogItemNotFoundError extends BusinessError {
  constructor(
    readonly catalog: string,
    readonly key: string,
  ) {
    super(
      'CATALOG_ITEM_NOT_FOUND',
      'not_found',
      `There is no item ${key} in the catalog ${catalog}`,
    );
  }
}
