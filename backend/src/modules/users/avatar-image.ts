import type { AvatarImageType } from './entities/avatar.entity';
import { InvalidAvatarImageError } from './errors/invalid-avatar-image.error';

// Límites de los avatares subidos: ligeros y cuadrados
export const AVATAR_MAX_BYTES = 100 * 1024;
export const AVATAR_MIN_SIZE = 128;
export const AVATAR_MAX_SIZE = 512;

interface ImageInfo {
  contentType: AvatarImageType;
  width: number;
  height: number;
}

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

// PNG: firma de 8 bytes y el primer bloque, IHDR, con el ancho y el alto
function readPng(buffer: Buffer): ImageInfo | null {
  if (
    buffer.length < 24 ||
    !buffer.subarray(0, 8).equals(PNG_SIGNATURE) ||
    buffer.toString('ascii', 12, 16) !== 'IHDR'
  ) {
    return null;
  }
  return {
    contentType: 'image/png',
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

// WebP: contenedor RIFF/WEBP y sus tres variantes (con pérdida, sin pérdida y
// extendida), cada una con las medidas en un sitio
function readWebp(buffer: Buffer): ImageInfo | null {
  if (
    buffer.length < 30 ||
    buffer.toString('ascii', 0, 4) !== 'RIFF' ||
    buffer.toString('ascii', 8, 12) !== 'WEBP'
  ) {
    return null;
  }
  const size = webpSize(buffer, buffer.toString('ascii', 12, 16));
  return size ? { contentType: 'image/webp', ...size } : null;
}

function webpSize(
  buffer: Buffer,
  chunk: string,
): { width: number; height: number } | null {
  if (chunk === 'VP8 ' && buffer.readUIntBE(23, 3) === 0x9d012a) {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }
  if (chunk === 'VP8L' && buffer[20] === 0x2f) {
    const bits = buffer.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8X') {
    return {
      width: buffer.readUIntLE(24, 3) + 1,
      height: buffer.readUIntLE(27, 3) + 1,
    };
  }
  return null;
}

// Comprueba un avatar subido por su contenido, no por su nombre ni por el tipo
// que dice el navegador: PNG o WebP (nunca SVG, que puede llevar scripts), de
// AVATAR_MAX_BYTES como mucho y cuadrado de AVATAR_MIN_SIZE a AVATAR_MAX_SIZE
// px. Devuelve su tipo real o lanza InvalidAvatarImageError
export function checkAvatarImage(buffer: Buffer): AvatarImageType {
  if (buffer.length > AVATAR_MAX_BYTES) {
    throw new InvalidAvatarImageError(`larger than ${AVATAR_MAX_BYTES} bytes`);
  }
  const image = readPng(buffer) ?? readWebp(buffer);
  if (image === null) {
    throw new InvalidAvatarImageError('not a PNG or WebP image');
  }
  const { width, height } = image;
  if (width !== height) {
    throw new InvalidAvatarImageError(`not square (${width}×${height})`);
  }
  if (width < AVATAR_MIN_SIZE || width > AVATAR_MAX_SIZE) {
    throw new InvalidAvatarImageError(
      `${width} px, not between ${AVATAR_MIN_SIZE} and ${AVATAR_MAX_SIZE}`,
    );
  }
  return image.contentType;
}
