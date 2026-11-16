import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AdminFaq, AdminFaqFields, AdminFaqTopic } from '../../models/admin-faq.model';
import { ApiError } from '../../models/api-error.model';

// Lo más que devuelve la API por página
const PAGE_LIMIT = 100;

// Preguntas frecuentes del panel: todas (borradores incluidos), alta,
// cambios, publicar o pasar a borrador, orden y borrado. Lanza ApiError
@Injectable({ providedIn: 'root' })
export class AdminFaqsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/admin/faqs`;
  private readonly topicsUrl = `${environment.apiUrl}/admin/faq-topics`;

  listTopics(): Promise<AdminFaqTopic[]> {
    return this.call(this.http.get<AdminFaqTopic[]>(this.topicsUrl));
  }

  // Todas, en el orden de los temas: la API pagina de 100 en 100 y se piden
  // las páginas que haga falta
  list(): Promise<AdminFaq[]> {
    return this.listFrom(0);
  }

  private async listFrom(offset: number): Promise<AdminFaq[]> {
    const page = await this.call(
      this.http.get<AdminFaq[]>(this.url, { params: { offset, limit: PAGE_LIMIT } }),
    );
    if (page.length < PAGE_LIMIT) {
      return page;
    }
    return [...page, ...(await this.listFrom(offset + page.length))];
  }

  create(fields: AdminFaqFields): Promise<AdminFaq> {
    return this.call(this.http.post<AdminFaq>(this.url, fields));
  }

  update(id: string, changes: Partial<AdminFaqFields>): Promise<AdminFaq> {
    return this.call(this.http.patch<AdminFaq>(`${this.url}/${id}`, changes));
  }

  publish(id: string): Promise<AdminFaq> {
    return this.call(this.http.post<AdminFaq>(`${this.url}/${id}/publish`, {}));
  }

  unpublish(id: string): Promise<AdminFaq> {
    return this.call(this.http.post<AdminFaq>(`${this.url}/${id}/unpublish`, {}));
  }

  move(id: string, direction: 'up' | 'down'): Promise<AdminFaq> {
    return this.call(this.http.post<AdminFaq>(`${this.url}/${id}/move`, { direction }));
  }

  async remove(id: string): Promise<void> {
    await this.call(this.http.delete<void>(`${this.url}/${id}`));
  }

  private async call<T>(request: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request);
    } catch (error) {
      throw ApiError.fromHttpError(error);
    }
  }
}
