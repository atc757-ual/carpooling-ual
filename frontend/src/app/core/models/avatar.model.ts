// Catálogo de avatares (GET /api/avatars): los SVG de la plataforma y las
// imágenes PNG o WebP que sube el panel. Las claves salen de la API
export interface AvatarResource {
  '@type': 'Avatar';
  id: string;
  href: string;
  name: string;
  // El SVG de la plataforma, o null si es una imagen subida
  svg: string | null;
  // La imagen subida (/api/avatars/{id}/image), o null si es un SVG
  imageHref?: string | null;
}

export type AvatarShape =
  | { kind: 'path'; d: string }
  | { kind: 'circle'; cx: string; cy: string; r: string }
  | { kind: 'rect'; x: string; y: string; width: string; height: string; rx?: string; ry?: string }
  | { kind: 'polygon'; points: string };

// Un SVG del catálogo, ya validado: la plantilla crea sus nodos
export interface AvatarSvgGraphic {
  kind: 'svg';
  viewBox: string;
  fill: string | null;
  stroke: string | null;
  strokeWidth: string | null;
  strokeLinecap: string | null;
  strokeLinejoin: string | null;
  shapes: AvatarShape[];
}

// Una imagen subida: se pinta con un <img> (la API la sirve sin sesión)
export interface AvatarImageGraphic {
  kind: 'image';
  src: string;
}

export type AvatarGraphic = AvatarSvgGraphic | AvatarImageGraphic;

export interface AvatarOption {
  id: string;
  name: string;
  graphic: AvatarGraphic;
}
