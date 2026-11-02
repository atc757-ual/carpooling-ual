import { AVATAR_MAX_BYTES, checkAvatarImage } from './avatar-image';
import { InvalidAvatarImageError } from './errors/invalid-avatar-image.error';
import {
  pngHeader,
  webpExtendedHeader,
  webpLosslessHeader,
  webpLossyHeader,
} from './avatar-image.testing';

describe('checkAvatarImage', () => {
  it('accepts square PNG and WebP images by their content', () => {
    expect(checkAvatarImage(pngHeader(256, 256))).toBe('image/png');
    expect(checkAvatarImage(webpLossyHeader(128, 128))).toBe('image/webp');
    expect(checkAvatarImage(webpLosslessHeader(512, 512))).toBe('image/webp');
    expect(checkAvatarImage(webpExtendedHeader(300, 300))).toBe('image/webp');
  });

  it('rejects SVG, other formats and broken headers', () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    );
    const jpeg = Buffer.from([
      0xff,
      0xd8,
      0xff,
      0xe0,
      ...Array<number>(40).fill(0),
    ]);
    const brokenWebp = webpLossyHeader(256, 256);
    brokenWebp.writeUIntBE(0, 23, 3);

    for (const image of [svg, jpeg, brokenWebp, Buffer.alloc(0)]) {
      expect(() => checkAvatarImage(image)).toThrow(InvalidAvatarImageError);
    }
  });

  it('rejects images that are not square or out of size', () => {
    for (const image of [
      pngHeader(256, 128),
      pngHeader(64, 64),
      webpLosslessHeader(1024, 1024),
    ]) {
      expect(() => checkAvatarImage(image)).toThrow(InvalidAvatarImageError);
    }
  });

  it('rejects files over the size limit before reading them', () => {
    const heavy = Buffer.concat([
      pngHeader(256, 256),
      Buffer.alloc(AVATAR_MAX_BYTES),
    ]);
    expect(() => checkAvatarImage(heavy)).toThrow(/larger than/);
  });
});
