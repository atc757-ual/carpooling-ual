import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { SimulationSweep, StartSweep } from '../../models/admin-simulation.model';
import { ApiError } from '../../models/api-error.model';

// Análisis de sensibilidad desde el panel (capítulo 11). Lanza ApiError (ver
// shared/utils/error-message.util.ts)
@Injectable({ providedIn: 'root' })
export class AdminSimulationSweepsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/admin/simulation-sweeps`;

  start(sweep: StartSweep): Promise<SimulationSweep> {
    return this.call(this.http.post<SimulationSweep>(this.url, sweep));
  }

  get(sweepId: string): Promise<SimulationSweep> {
    return this.call(this.http.get<SimulationSweep>(`${this.url}/${sweepId}`));
  }

  // El más reciente, o null si aún no se ha lanzado ninguno
  async latest(): Promise<SimulationSweep | null> {
    const params = new HttpParams().set('offset', 0).set('limit', 1);
    const sweeps = await this.call(this.http.get<SimulationSweep[]>(this.url, { params }));
    return sweeps[0] ?? null;
  }

  private async call<T>(request: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request);
    } catch (error) {
      throw ApiError.fromHttpError(error);
    }
  }
}
