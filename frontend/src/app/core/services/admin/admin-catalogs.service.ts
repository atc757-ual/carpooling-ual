import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  AdminCatalog,
  AdminCatalogChanges,
  AdminCatalogItem,
} from '../../models/admin-catalog.model';
import { ApiError } from '../../models/api-error.model';

// Lo más que devuelve la API por página: cada catálogo cabe en una
const CATALOG_LIMIT = 100;

type ApiItem = Omit<AdminCatalogItem, 'key'> & { key?: string; id?: string };

// Catálogos del panel: todos los elementos, alta, cambios, activar o
// desactivar, orden y la subida de avatares. Lanza ApiError
@Injectable({ providedIn: 'root' })
export class AdminCatalogsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/admin/catalogs`;

  async list(catalog: AdminCatalog): Promise<AdminCatalogItem[]> {
    const items = await this.call(
      this.http.get<ApiItem[]>(`${this.url}/${catalog}`, { params: { limit: CATALOG_LIMIT } }),
    );
    return items.map(toItem);
  }

  async create(catalog: AdminCatalog, fields: AdminCatalogChanges): Promise<AdminCatalogItem> {
    return toItem(await this.call(this.http.post<ApiItem>(`${this.url}/${catalog}`, fields)));
  }

  async update(
    catalog: AdminCatalog,
    key: string,
    changes: AdminCatalogChanges,
  ): Promise<AdminCatalogItem> {
    return toItem(
      await this.call(this.http.patch<ApiItem>(`${this.url}/${catalog}/${key}`, changes)),
    );
  }

  async move(catalog: AdminCatalog, key: string, direction: 'up' | 'down'): Promise<void> {
    await this.call(this.http.post<ApiItem>(`${this.url}/${catalog}/${key}/move`, { direction }));
  }

  // Un avatar nuevo: la imagen (PNG o WebP) y su nombre, en multipart
  async uploadAvatar(name: string, image: File): Promise<AdminCatalogItem> {
    const form = new FormData();
    form.append('name', name);
    form.append('image', image);
    return toItem(await this.call(this.http.post<ApiItem>(`${this.url}/avatars`, form)));
  }

  // Cambia la imagen de un avatar; el nombre va aparte, con update
  async replaceAvatarImage(key: string, image: File): Promise<void> {
    const form = new FormData();
    form.append('image', image);
    await this.call(this.http.put<ApiItem>(`${this.url}/avatars/${key}/image`, form));
  }

  private async call<T>(request: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request);
    } catch (error) {
      throw ApiError.fromHttpError(error);
    }
  }
}

function toItem({ key, id, ...item }: ApiItem): AdminCatalogItem {
  return { ...item, key: key ?? id ?? '' };
}
