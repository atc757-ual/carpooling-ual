import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface DefaultAvatar {
  key: string;
  name: string;
  sortOrder: number;
  image: Buffer;
}

const AVATARS_DIR = join(__dirname, 'avatars');
// «Avatar 13 · Mujer · recogido y gafas · frontal.png»: número, grupo,
// descripción y vista
const FILE_NAME = /^Avatar (\d+) · [^·]+ · ([^·]+) · frontal\.png$/;

// El orden, el nombre visible (la descripción con mayúscula) y la clave (como
// la de un catálogo: sin tildes, en minúsculas y con guiones)
export function parseAvatarFileName(
  fileName: string,
): Omit<DefaultAvatar, 'image'> {
  const match = FILE_NAME.exec(fileName.normalize('NFC'));
  if (!match) {
    throw new Error(`Unexpected avatar file name: ${fileName}`);
  }
  const description = match[2].trim();
  return {
    key: description
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, ''),
    name: description.charAt(0).toUpperCase() + description.slice(1),
    sortOrder: Number(match[1]),
  };
}

// Los avatares que trae la plataforma (carpeta avatars/), en su orden
export function readDefaultAvatars(): DefaultAvatar[] {
  return readdirSync(AVATARS_DIR)
    .map((fileName) => ({
      ...parseAvatarFileName(fileName),
      image: readFileSync(join(AVATARS_DIR, fileName)),
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}
