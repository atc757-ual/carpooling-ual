import { HttpClient, HttpResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  AvatarGraphic,
  AvatarOption,
  AvatarResource,
  AvatarShape,
  AvatarSvgGraphic,
} from '../../models/avatar.model';

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

function safeNumber(value: string | null): string | null {
  return value && /^-?\d+(?:\.\d+)?$/.test(value) ? value : null;
}

function parsePath(element: Element): AvatarShape | null {
  const d = element.getAttribute('d');
  return d && /^[MmZzLlHhVvCcSsQqTtAa0-9.,+\-\s]+$/.test(d) ? { kind: 'path', d } : null;
}

function parseCircle(element: Element): AvatarShape | null {
  const [cx, cy, r] = ['cx', 'cy', 'r'].map((name) => safeNumber(element.getAttribute(name)));
  return cx && cy && r ? { kind: 'circle', cx, cy, r } : null;
}

// x, y, ancho y alto obligatorios; las esquinas (rx, ry), si las tiene
function parseRect(element: Element): AvatarShape | null {
  const [x, y, width, height, rx, ry] = ['x', 'y', 'width', 'height', 'rx', 'ry'].map((name) =>
    safeNumber(element.getAttribute(name)),
  );
  if (!x || !y || !width || !height) {
    return null;
  }
  return { kind: 'rect', x, y, width, height, ...(rx && { rx }), ...(ry && { ry }) };
}

function parsePolygon(element: Element): AvatarShape | null {
  const points = element.getAttribute('points');
  return points && /^[0-9.,+\-\s]+$/.test(points) ? { kind: 'polygon', points } : null;
}

// Las formas del subconjunto de SVG del catálogo: sus atributos permitidos y
// cómo se leen (un Map: el nombre del nodo viene del SVG recibido)
const SHAPES = new Map<string, { attributes: ReadonlySet<string>; parse: typeof parsePath }>([
  ['path', { attributes: new Set(['d']), parse: parsePath }],
  ['circle', { attributes: new Set(['cx', 'cy', 'r']), parse: parseCircle }],
  ['rect', { attributes: new Set(['x', 'y', 'width', 'height', 'rx', 'ry']), parse: parseRect }],
  ['polygon', { attributes: new Set(['points']), parse: parsePolygon }],
]);

// El enlace de la API (/api/avatars/…/image) con la URL de la API de este
// entorno (en la app nativa no es relativa)
function imageSrc(href: string): string {
  return `${environment.apiUrl}${href.replace(/^\/api/, '')}`;
}

@Injectable({ providedIn: 'root' })
export class AvatarsService {
  private readonly http = inject(HttpClient);
  private catalog: Promise<ReadonlyMap<string, AvatarOption>> | null = null;

  async getGraphic(key: string): Promise<AvatarGraphic | null> {
    const entries = await this.loadMap();
    return entries.get(key)?.graphic ?? null;
  }

  async listCatalog(): Promise<AvatarOption[]> {
    const entries = await this.loadMap();
    return [...entries.values()];
  }

  private async loadMap(): Promise<ReadonlyMap<string, AvatarOption>> {
    this.catalog ??= this.loadCatalog();
    try {
      return await this.catalog;
    } catch {
      this.catalog = null;
      return new Map();
    }
  }

  private async loadCatalog(): Promise<ReadonlyMap<string, AvatarOption>> {
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

    const entries: [string, AvatarOption][] = [];
    for (const avatar of avatars) {
      const graphic = this.toGraphic(avatar);
      if (graphic) {
        entries.push([avatar.id, { id: avatar.id, name: avatar.name, graphic }]);
      }
    }
    return new Map(entries);
  }

  // Un SVG de la plataforma, validado; o una imagen subida, por su enlace
  private toGraphic({ svg, imageHref }: AvatarResource): AvatarGraphic | null {
    if (svg) {
      return this.parseGraphic(svg);
    }
    return imageHref ? { kind: 'image', src: imageSrc(imageHref) } : null;
  }

  // Traduce el catálogo a geometría validada; la plantilla crea los nodos SVG.
  private parseGraphic(svg: string): AvatarSvgGraphic | null {
    const root = this.parseRoot(svg);
    if (!root) return null;

    const viewBox = root.getAttribute('viewBox');
    if (!viewBox || !/^\s*\d+(?:\.\d+)?(?:\s+\d+(?:\.\d+)?){3}\s*$/.test(viewBox)) {
      return null;
    }
    if (!this.hasOnlyRootAttributes(root)) return null;
    const shapes = this.parseShapes(root);
    if (!shapes) return null;

    return {
      kind: 'svg',
      viewBox,
      fill: this.safeColor(root.getAttribute('fill')),
      stroke: this.safeColor(root.getAttribute('stroke')),
      strokeWidth: safeNumber(root.getAttribute('stroke-width')),
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

  private parseRoot(svg: string): Element | null {
    if (/<!DOCTYPE|<!ENTITY/i.test(svg)) return null;
    const root = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
    return root.localName === 'svg' && root.namespaceURI === 'http://www.w3.org/2000/svg'
      ? root
      : null;
  }

  private hasOnlyRootAttributes(root: Element): boolean {
    for (const attribute of root.attributes) {
      if (!ROOT_ATTRIBUTES.has(attribute.name)) return false;
    }
    return true;
  }

  private parseShapes(root: Element): AvatarShape[] | null {
    const shapes: AvatarShape[] = [];
    for (const node of root.childNodes) {
      if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) continue;
      if (node.nodeType !== Node.ELEMENT_NODE) return null;
      const shape = this.parseShape(node as Element);
      if (!shape) return null;
      shapes.push(shape);
    }
    return shapes;
  }

  // Solo las formas del catálogo y con sus atributos: cualquier otro, fuera
  private parseShape(element: Element): AvatarShape | null {
    const shape = SHAPES.get(element.localName);
    const hasOnlyItsAttributes = [...element.attributes].every(({ name }) =>
      shape?.attributes.has(name),
    );
    return shape && hasOnlyItsAttributes ? shape.parse(element) : null;
  }

  private safeColor(value: string | null): string | null {
    return value && /^(?:none|currentColor|#[\da-f]{3,8})$/i.test(value) ? value : null;
  }

  private safeEnum<const T extends string>(value: string | null, options: readonly T[]): T | null {
    return options.find((option) => option === value) ?? null;
  }
}
