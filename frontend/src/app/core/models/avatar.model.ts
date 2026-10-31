export const AVATAR_KEYS = [
  'sun',
  'wave',
  'cactus',
  'palm',
  'compass',
  'car',
  'leaf',
  'book',
  'coffee',
  'headphones',
  'cat',
  'owl',
] as const;

export type AvatarKey = (typeof AVATAR_KEYS)[number];

export interface AvatarResource {
  '@type': 'Avatar';
  id: AvatarKey;
  href: string;
  name: string;
  svg: string;
}

export type AvatarShape =
  | { kind: 'path'; d: string }
  | { kind: 'circle'; cx: string; cy: string; r: string }
  | { kind: 'rect'; x: string; y: string; width: string; height: string; rx?: string; ry?: string }
  | { kind: 'polygon'; points: string };

export interface AvatarGraphic {
  viewBox: string;
  fill: string | null;
  stroke: string | null;
  strokeWidth: string | null;
  strokeLinecap: string | null;
  strokeLinejoin: string | null;
  shapes: AvatarShape[];
}
