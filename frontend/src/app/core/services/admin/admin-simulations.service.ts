import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  SimulationResults,
  SimulationRun,
  SimulationScenario,
  StartSimulation,
} from '../../models/admin-simulation.model';
import { ApiError } from '../../models/api-error.model';

export interface SimulationRunPage {
  items: SimulationRun[];
  total: number;
}

// Simulación de escenarios desde el panel (RF-15 a RF-20). Lanza ApiError
// (ver shared/utils/error-message.util.ts)
@Injectable({ providedIn: 'root' })
export class AdminSimulationsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/admin/simulations`;

  scenarios(): Promise<SimulationScenario[]> {
    return this.call(this.http.get<SimulationScenario[]>(`${this.url}/scenarios`));
  }

  start(simulation: StartSimulation): Promise<SimulationRun> {
    return this.call(this.http.post<SimulationRun>(this.url, simulation));
  }

  // Las ejecuciones, la más reciente primero, con el total
  async list(page: { offset: number; limit: number }): Promise<SimulationRunPage> {
    const params = new HttpParams().set('offset', page.offset).set('limit', page.limit);
    const response = await this.call(
      this.http.get<SimulationRun[]>(this.url, { params, observe: 'response' }),
    );
    const items = response.body ?? [];
    return { items, total: Number(response.headers.get('X-Total-Count') ?? items.length) };
  }

  get(runId: string): Promise<SimulationRun> {
    return this.call(this.http.get<SimulationRun>(`${this.url}/${runId}`));
  }

  results(runId: string): Promise<SimulationResults> {
    return this.call(this.http.get<SimulationResults>(`${this.url}/${runId}/results`));
  }

  cancel(runId: string): Promise<SimulationRun> {
    return this.call(this.http.post<SimulationRun>(`${this.url}/${runId}/cancel`, null));
  }

  // El CSV de las réplicas (con el token de la sesión, por eso no es un enlace)
  csv(runId: string): Promise<Blob> {
    return this.call(this.http.get(`${this.url}/${runId}/results.csv`, { responseType: 'blob' }));
  }

  private async call<T>(request: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request);
    } catch (error) {
      throw ApiError.fromHttpError(error);
    }
  }
}
