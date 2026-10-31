import { HttpClient, HttpResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AvatarGraphic, AvatarKey, AvatarResource, AvatarShape } from '../../models/avatar.model';

const AVATAR_PAGE_SIZE = 100;
const ROOT_ATTRIBUTES = new Set([
  'xmlns',
  'viewBox',
  'fill',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
]);

@Injectable({ providedIn: 'root' })
export class AvatarsService {
  private readonly http = inject(HttpClient);
  private catalog: Promise<ReadonlyMap<AvatarKey, AvatarGraphic>> | null = null;

  async getGraphic(key: AvatarKey): Promise<AvatarGraphic | null> {
    this.catalog ??= this.loadCatalog();
    try {
      return (await this.catalog).get(key) ?? null;
    } catch {
      this.catalog = null;
      return null;
    }
  }

  private async loadCatalog(): Promise<ReadonlyMap<AvatarKey, AvatarGraphic>> {
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

    const entries: [AvatarKey, AvatarGraphic][] = [];
    for (const { id, svg } of avatars) {
      const graphic = this.parseGraphic(svg);
      if (graphic) {
        entries.push([id, graphic]);
      }
    }
    return new Map(entries);
  }

  // Traduce el catÃ¡logo a geometrÃ­a validada; la plantilla crea los nodos SVG.
  private parseGraphic(svg: string): AvatarGraphic | null {
    if (/<!DOCTYPE|<!ENTITY/i.test(svg)) {
      return null;
    }
    const root = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
    if (root.localName !== 'svg' || root.namespaceURI !== 'http://www.w3.org/2000/svg') {
      return null;
    }
    const viewBox = root.getAttribute('viewBox');
    if (!viewBox || !/^\s*\d+(?:\.\d+)?(?:\s+\d+(?:\.\d+)?){3}\s*$/.test(viewBox)) {
      return null;
    }
    if ([...root.attributes].some(({ name }) => !ROOT_ATTRIBUTES.has(name))) {
      return null;
    }

    const shapes: AvatarShape[] = [];
    for (const node of [...root.childNodes]) {
      if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) {
        continue;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) {
        return null;
      }
      const shape = this.parseShape(node as Element);
      if (!shape) {
        return null;
      }
      shapes.push(shape);
    }

    return {
      viewBox,
      fill: this.safeColor(root.getAttribute('fill')),
      stroke: this.safeColor(root.getAttribute('stroke')),
      strokeWidth: this.safeNumber(root.getAttribute('stroke-width')),
      strokeLinecap: this.safeEnum(root.getAttribute('stroke-linecap'), [
        'butt',
        'round',
        'square',
      ]),
      strokeLinejoin: this.safeEnum(root.getAttribute('stroke-linejoin'), [
        'arcs',
        'bevel',
        'miter',
        'round',
      ]),
      shapes,
    };
  }

  private parseShape(element: Element): AvatarShape | null {
    const number = (name: string): string | null => this.safeNumber(element.getAttribute(name));
    const onlyAttributes = (...names: string[]): boolean =>
      [...element.attributes].every(({ name }) => names.includes(name));

    if (element.localName === 'path' && onlyAttributes('d')) {
      const d = element.getAttribute('d');
      return d && /^[MmZzLlHhVvCcSsQqTtAa0-9.,+\-\s]+$/.test(d) ? { kind: 'path', d } : null;
    }
    if (element.localName === 'circle' && onlyAttributes('cx', 'cy', 'r')) {
      const cx = number('cx');
      const cy = number('cy');
      const r = number('r');
      return cx && cy && r ? { kind: 'circle', cx, cy, r } : null;
    }
    if (element.localName === 'rect' && onlyAttributes('x', 'y', 'width', 'height', 'rx', 'ry')) {
      const x = number('x');
      const y = number('y');
      const width = number('width');
      const height = number('height');
      const rx = number('rx');
      const ry = number('ry');
      if (x && y && width && height) {
        return { kind: 'rect', x, y, width, height, ...(rx ? { rx } : {}), ...(ry ? { ry } : {}) };
      }
    }
    if (element.localName === 'polygon' && onlyAttributes('points')) {
      const points = element.getAttribute('points');
      return points && /^[0-9.,+\-\s]+$/.test(points) ? { kind: 'polygon', points } : null;
    }
    return null;
  }

  private safeNumber(value: string | null): string | null {
    return value && /^-?\d+(?:\.\d+)?$/.test(value) ? value : null;
  }

  private safeColor(value: string | null): string | null {
    return value && /^(?:none|currentColor|#[\da-f]{3,8})$/i.test(value) ? value : null;
  }

  private safeEnum<const T extends string>(value: string | null, options: readonly T[]): T | null {
    return options.find((option) => option === value) ?? null;
  }
}
