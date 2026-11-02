import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiError } from '../../models/api-error.model';

// Lo más que devuelve la API por página: los catálogos caben en una
const CATALOG_LIMIT = 100;

interface VehicleBrand {
  key: string;
  name: string;
}

// Un color del vehículo: todos llegan, para nombrar el de cada vehículo; solo
// los activos se pueden elegir
export interface VehicleColorItem {
  key: string;
  name: string;
  hexLight: string;
  hexDark: string;
  isActive: boolean;
}

// Catálogos que gestiona el panel de administración (marcas, colores…). Se
// piden una vez por sesión y se guardan en memoria; si falla, se vuelve a
// pedir la siguiente vez. Lanza ApiError
@Injectable({ providedIn: 'root' })
export class CatalogsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/catalogs`;
  private readonly cache = new Map<string, Promise<unknown>>();

  // Los nombres de las marcas activas, en su orden
  async vehicleBrandNames(): Promise<string[]> {
    const brands = await this.catalog<VehicleBrand>('vehicle-brands');
    return brands.map(({ name }) => name);
  }

  // Todos los colores, en su orden
  vehicleColors(): Promise<VehicleColorItem[]> {
    return this.catalog<VehicleColorItem>('vehicle-colors');
  }

  private catalog<T>(path: string): Promise<T[]> {
    let items = this.cache.get(path) as Promise<T[]> | undefined;
    if (items === undefined) {
      items = firstValueFrom(
        this.http.get<T[]>(`${this.url}/${path}`, { params: { limit: CATALOG_LIMIT } }),
      ).catch((error: unknown) => {
        this.cache.delete(path);
        throw ApiError.fromHttpError(error);
      });
      this.cache.set(path, items);
    }
    return items;
  }
}
