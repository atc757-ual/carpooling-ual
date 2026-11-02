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

// Catálogos que gestiona el panel de administración (marcas…). Se piden una
// vez por sesión y se guardan en memoria; si falla, se vuelve a pedir la
// siguiente vez. Lanza ApiError
@Injectable({ providedIn: 'root' })
export class CatalogsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/catalogs`;
  private brandNames: Promise<string[]> | null = null;

  // Los nombres de las marcas activas, en su orden
  vehicleBrandNames(): Promise<string[]> {
    this.brandNames ??= this.fetchBrandNames().catch((error: unknown) => {
      this.brandNames = null;
      throw ApiError.fromHttpError(error);
    });
    return this.brandNames;
  }

  private async fetchBrandNames(): Promise<string[]> {
    const brands = await firstValueFrom(
      this.http.get<VehicleBrand[]>(`${this.url}/vehicle-brands`, {
        params: { limit: CATALOG_LIMIT },
      }),
    );
    return brands.map(({ name }) => name);
  }
}
