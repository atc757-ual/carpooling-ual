import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiError } from '../../models/api-error.model';
import { FaqLang, HelpFaq, HelpFaqQuery, HelpTopic } from '../../models/faq.model';

// Lo más que devuelve la API por página
const PAGE_LIMIT = 100;
// La API no busca con menos letras
export const MIN_FAQ_SEARCH_LENGTH = 2;

// Preguntas frecuentes de la app: los temas y las preguntas publicadas, en
// el idioma pedido. No hace falta sesión. Lanza ApiError
@Injectable({ providedIn: 'root' })
export class FaqsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/faqs`;
  private readonly topicsUrl = `${environment.apiUrl}/faq-topics`;

  listTopics(lang: FaqLang): Promise<HelpTopic[]> {
    return this.call(this.http.get<HelpTopic[]>(this.topicsUrl, { params: { lang } }));
  }

  // Todas las que cumplen lo pedido, en el orden de los temas: la API pagina
  // de 100 en 100 y se piden las páginas que haga falta
  list(query: HelpFaqQuery): Promise<HelpFaq[]> {
    const search = query.q?.trim() ?? '';
    const params: Record<string, string> = { lang: query.lang };
    if (query.audience) {
      params['audience'] = query.audience;
    }
    if (query.context) {
      params['context'] = query.context;
    }
    if (search.length >= MIN_FAQ_SEARCH_LENGTH) {
      params['q'] = search;
    }
    return this.listFrom(params, 0);
  }

  // Una pregunta publicada (su pantalla de detalle). FAQ_NOT_FOUND si no
  // existe o ya no está publicada
  get(id: string, lang: FaqLang): Promise<HelpFaq> {
    return this.call(
      this.http.get<HelpFaq>(`${this.url}/${encodeURIComponent(id)}`, { params: { lang } }),
    );
  }

  private async listFrom(params: Record<string, string>, offset: number): Promise<HelpFaq[]> {
    const page = await this.call(
      this.http.get<HelpFaq[]>(this.url, { params: { ...params, offset, limit: PAGE_LIMIT } }),
    );
    if (page.length < PAGE_LIMIT) {
      return page;
    }
    return [...page, ...(await this.listFrom(params, offset + page.length))];
  }

  private async call<T>(request: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request);
    } catch (error) {
      throw ApiError.fromHttpError(error);
    }
  }
}
