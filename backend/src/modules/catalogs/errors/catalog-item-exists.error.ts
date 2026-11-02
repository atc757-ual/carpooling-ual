import { BusinessError } from '../../../shared/errors/business-error';

// Ya hay un elemento con esa clave (el mismo nombre sin tildes ni mayúsculas),
// activo o no. La capa API lo traduce a un 409 (CATALOG_ITEM_EXISTS)
export class CatalogItemExistsError extends BusinessError {
  constructor(
    readonly catalog: string,
    readonly key: string,
  ) {
    super(
      'CATALOG_ITEM_EXISTS',
      'conflict',
      `The catalog ${catalog} already has the item ${key}`,
    );
  }
}
