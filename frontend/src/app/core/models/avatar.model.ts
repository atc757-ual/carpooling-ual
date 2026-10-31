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
