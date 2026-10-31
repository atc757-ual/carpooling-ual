import { HttpClient, HttpResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AvatarKey, AvatarResource } from '../../models/avatar.model';

const AVATAR_PAGE_SIZE = 100;

@Injectable({ providedIn: 'root' })
export class AvatarsService {
  private readonly http = inject(HttpClient);
  private readonly sanitizer = inject(DomSanitizer);
  private catalog: Promise<ReadonlyMap<AvatarKey, SafeHtml>> | null = null;

  async getSvg(key: AvatarKey): Promise<SafeHtml | null> {
    this.catalog ??= this.loadCatalog();
    try {
      return (await this.catalog).get(key) ?? null;
    } catch {
      this.catalog = null;
      return null;
    }
  }

  private async loadCatalog(): Promise<ReadonlyMap<AvatarKey, SafeHtml>> {
    const avatars: AvatarResource[] = [];
    let offset = 0;
    let total = Number.POSITIVE_INFINITY;

    while (offset < total) {
      const response: HttpResponse<AvatarResource[]> = await firstValueFrom(
        this.http.get<AvatarResource[]>(`${environment.apiUrl}/avatars`, {
          params: { offset, limit: AVATAR_PAGE_SIZE },
          observe: 'response',
        }),
      );
      const page = response.body ?? [];
      avatars.push(...page);
      total = Number(response.headers.get('X-Total-Count') ?? page.length);
      if (page.length === 0) {
        break;
      }
      offset += page.length;
    }

    const entries: [AvatarKey, SafeHtml][] = [];
    for (const { id, svg } of avatars) {
      const safeSvg = this.sanitizeSvg(svg);
      if (safeSvg) {
        entries.push([id, this.sanitizer.bypassSecurityTrustHtml(safeSvg)]);
      }
    }
    return new Map(entries);
  }

  // Solo se permite el subconjunto gráfico que usan los SVG del catálogo.
  private sanitizeSvg(svg: string): string | null {
    const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const root = document.documentElement;
    const allowedElements = new Set(['svg', 'g', 'path', 'circle', 'rect', 'polygon']);
    const allowedAttributes = new Set([
      'xmlns',
      'viewBox',
      'fill',
      'stroke',
      'stroke-width',
      'stroke-linecap',
      'stroke-linejoin',
      'd',
      'cx',
      'cy',
      'r',
      'x',
      'y',
      'width',
      'height',
      'rx',
      'ry',
      'points',
    ]);

    if (root.localName !== 'svg' || root.namespaceURI !== 'http://www.w3.org/2000/svg') {
      return null;
    }

    const elements = [root, ...root.querySelectorAll('*')];
    for (const element of elements) {
      if (!allowedElements.has(element.localName)) {
        return null;
      }
      for (const attribute of [...element.attributes]) {
        if (
          !allowedAttributes.has(attribute.name) ||
          /url\s*\(|javascript:/i.test(attribute.value)
        ) {
          return null;
        }
      }
    }

    root.setAttribute('width', '100%');
    root.setAttribute('height', '100%');
    return new XMLSerializer().serializeToString(root);
  }
}
