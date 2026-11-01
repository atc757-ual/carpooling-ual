import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';

// Incidencias para el panel de administración (CU-12). Por ahora solo el
// número de abiertas, que la navegación del panel muestra junto a Incidencias
@Injectable({ providedIn: 'root' })
export class AdminIncidentsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;
  private readonly open = signal(0);

  readonly openCount = this.open.asReadonly();

  // Con status=open, X-Total-Count es el número de abiertas. Si falla, se
  // queda el número que había: el contador no es motivo para un error
  async refreshOpenCount(): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.http.get<unknown[]>(`${this.apiUrl}/incidents`, {
          params: { status: 'open', limit: 1 },
          observe: 'response',
        }),
      );
      this.open.set(Number(response.headers.get('X-Total-Count') ?? 0));
    } catch {
      // Se vuelve a intentar en la siguiente navegación
    }
  }
}
