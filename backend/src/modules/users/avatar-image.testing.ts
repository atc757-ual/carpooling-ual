// Cabeceras mínimas de PNG y WebP para los tests: solo lo que se lee para
// saber el tipo y las medidas (no son imágenes que se puedan dibujar)

export function pngHeader(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0);
  buffer.writeUInt32BE(13, 8);
  buffer.write('IHDR', 12, 'ascii');
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

function riff(chunk: string, body: Buffer): Buffer {
  const header = Buffer.alloc(20);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(12 + body.length, 4);
  header.write('WEBP', 8, 'ascii');
  header.write(chunk, 12, 'ascii');
  header.writeUInt32LE(body.length, 16);
  return Buffer.concat([header, body]);
}

export function webpLossyHeader(width: number, height: number): Buffer {
  const body = Buffer.alloc(10);
  body.writeUIntBE(0x9d012a, 3, 3);
  body.writeUInt16LE(width, 6);
  body.writeUInt16LE(height, 8);
  return riff('VP8 ', body);
}

export function webpLosslessHeader(width: number, height: number): Buffer {
  const body = Buffer.alloc(10);
  body[0] = 0x2f;
  body.writeUInt32LE(((height - 1) << 14) | (width - 1), 1);
  return riff('VP8L', body);
}

export function webpExtendedHeader(width: number, height: number): Buffer {
  const body = Buffer.alloc(10);
  body.writeUIntLE(width - 1, 4, 3);
  body.writeUIntLE(height - 1, 7, 3);
  return riff('VP8X', body);
}
